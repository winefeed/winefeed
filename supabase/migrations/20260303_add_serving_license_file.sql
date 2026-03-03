-- Add serving_license_file_url to restaurants (uploaded PDF/image of license)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS serving_license_file_url TEXT;
