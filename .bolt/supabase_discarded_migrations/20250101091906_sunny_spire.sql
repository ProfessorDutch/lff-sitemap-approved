-- Create leads table for client inquiries
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  case_type TEXT NOT NULL,
  city TEXT,
  state TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  payment_option TEXT,
  monthly_payment DECIMAL,
  total_amount DECIMAL,
  CONSTRAINT phone_format CHECK (phone ~ '^\d{10}$'),
  CONSTRAINT zip_format CHECK (zip_code ~ '^\d{5}(-\d{4})?$')
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policies with proper permissions
DO $$ 
BEGIN
    -- Safely drop existing policies if they exist
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'leads' 
        AND policyname = 'leads_anon_insert'
    ) THEN
        DROP POLICY leads_anon_insert ON leads;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'leads' 
        AND policyname = 'leads_auth_select'
    ) THEN
        DROP POLICY leads_auth_select ON leads;
    END IF;
END $$;

-- Create new policies
CREATE POLICY "leads_anon_insert"
ON leads FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "leads_auth_select"
ON leads FOR SELECT
TO authenticated
USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads(email);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_case_type_idx ON leads(case_type);
CREATE INDEX IF NOT EXISTS leads_zip_code_idx ON leads(zip_code);