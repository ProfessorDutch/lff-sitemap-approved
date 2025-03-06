import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-sitemap',
      writeBundle: async () => {
        // Copy sitemap files from public to dist
        const files = fs.readdirSync('public');
        files.forEach(file => {
          if (file.startsWith('sitemap')) {
            fs.copyFileSync(`public/${file}`, `dist/${file}`);
            console.log(`Copied ${file} from public to dist directory`);
          }
        });
      }
    }
  ],
  build: {
    sourcemap: true,
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-helmet-async'],
          contentful: ['contentful', '@contentful/rich-text-react-renderer']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-helmet-async']
  }
});
