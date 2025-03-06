const contentful = require('contentful');
const fs = require('fs');
const path = require('path');
const xmlFormatter = require('xml-formatter');
require('dotenv').config();

// Load environment variables
const CONTENTFUL_SPACE = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ACCESS_TOKEN = process.env.CONTENTFUL_ACCESS_TOKEN;

if (!CONTENTFUL_SPACE || !CONTENTFUL_ACCESS_TOKEN) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

const BASE_URL = 'https://legalfeefinder.com';
const CURRENT_DATE = new Date().toISOString().split('T')[0];
const MAX_URLS_PER_SITEMAP = 1000; // Google's recommended limit

const contentfulClient = contentful.createClient({
  space: CONTENTFUL_SPACE,
  accessToken: CONTENTFUL_ACCESS_TOKEN,
  environment: 'master'
});

const CORE_PAGES = [
  {
    loc: '/',
    lastmod: CURRENT_DATE,
    changefreq: 'monthly',
    priority: '1.0'
  },
  {
    loc: '/demo',
    lastmod: CURRENT_DATE,
    changefreq: 'monthly',
    priority: '0.9'
  },
  {
    loc: '/privacy',
    lastmod: CURRENT_DATE,
    changefreq: 'monthly',
    priority: '0.8'
  },
  {
    loc: '/terms',
    lastmod: CURRENT_DATE,
    changefreq: 'monthly',
    priority: '0.8'
  }
];

const MAJOR_CITIES = [
  'new york', 'los angeles', 'chicago', 'houston', 'phoenix',
  'philadelphia', 'san antonio', 'san diego', 'dallas', 'san jose'
];

const generateUrlEntry = (entry) => {
  return `
    <url>
      <loc>${BASE_URL}${entry.loc}</loc>
      <lastmod>${entry.lastmod}</lastmod>
      <changefreq>${entry.changefreq}</changefreq>
      <priority>${entry.priority}</priority>
    </url>`;
};

const generateSitemapXML = (entries) => {
  const urlElements = entries.map(generateUrlEntry).join('');
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;

  return xmlFormatter(sitemap, {
    indentation: '  ',
    collapseContent: true
  });
};

const generateSitemapIndex = (sitemapFiles) => {
  const sitemaps = sitemapFiles.map(file => `
    <sitemap>
      <loc>${BASE_URL}/${file}</loc>
      <lastmod>${CURRENT_DATE}</lastmod>
    </sitemap>`).join('');

  const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;

  return xmlFormatter(index, {
    indentation: '  ',
    collapseContent: true
  });
};

async function fetchAllPages() {
  const allItems = [];
  let skip = 0;
  const limit = 1000; // Contentful's max limit per request

  while (true) {
    console.log(`Fetching pages ${skip} to ${skip + limit}...`);
    
    const response = await contentfulClient.getEntries({
      content_type: 'legalleads',
      limit,
      skip,
      select: ['fields.url_slug', 'fields.city', 'sys.updatedAt']
    });

    allItems.push(...response.items);

    if (response.items.length < limit) {
      break;
    }

    skip += limit;
  }

  return allItems;
}

async function generateSitemap() {
  try {
    console.log('Fetching all pages from Contentful...');
    const items = await fetchAllPages();
    console.log(`Found ${items.length} pages`);

    const contentfulEntries = items.map(entry => ({
      loc: `/${entry.fields.url_slug}`,
      lastmod: entry.sys.updatedAt.split('T')[0],
      changefreq: 'weekly',
      priority: MAJOR_CITIES.includes((entry.fields.city || '').toLowerCase()) ? '0.9' : '0.7'
    }));

    const allEntries = [...CORE_PAGES, ...contentfulEntries];
    const totalSitemaps = Math.ceil(allEntries.length / MAX_URLS_PER_SITEMAP);

    if (totalSitemaps > 50000) {
      throw new Error('Too many sitemaps! Maximum allowed is 50,000');
    }

    const sitemapFiles = [];
    const publicDir = path.resolve(process.cwd(), 'public');
    
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Generate individual sitemaps
    for (let i = 0; i < totalSitemaps; i++) {
      const start = i * MAX_URLS_PER_SITEMAP;
      const end = start + MAX_URLS_PER_SITEMAP;
      const entries = allEntries.slice(start, end);
      const filename = `sitemap-${i + 1}.xml`;
      
      console.log(`Generating ${filename} with ${entries.length} URLs...`);
      
      const sitemap = generateSitemapXML(entries);
      const sitemapPath = path.join(publicDir, filename);
      
      fs.writeFileSync(sitemapPath, sitemap);
      
      // Verify file size (50MB = 52,428,800 bytes)
      const stats = fs.statSync(sitemapPath);
      if (stats.size > 52428800) {
        throw new Error(`Sitemap ${filename} exceeds 50MB limit!`);
      }
      
      sitemapFiles.push(filename);
    }

    // Generate sitemap index
    if (totalSitemaps > 1) {
      console.log('Generating sitemap index...');
      const sitemapIndex = generateSitemapIndex(sitemapFiles);
      fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapIndex);
    } else {
      // If only one sitemap, use it as the main sitemap
      fs.copyFileSync(
        path.join(publicDir, sitemapFiles[0]),
        path.join(publicDir, 'sitemap.xml')
      );
    }

    console.log('\nSitemap generation complete!');
    console.log(`Total URLs: ${allEntries.length}`);
    console.log(`Total sitemap files: ${sitemapFiles.length}`);
    console.log(`Each sitemap contains max ${MAX_URLS_PER_SITEMAP} URLs`);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    process.exit(1);
  }
}

// Run the generator
generateSitemap();