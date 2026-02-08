-- Add billing fields to restaurants table
-- These fields allow restaurants to specify separate billing contact and address

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS billing_contact_person text,
ADD COLUMN IF NOT EXISTS billing_contact_phone text,
ADD COLUMN IF NOT EXISTS billing_address text,
ADD COLUMN IF NOT EXISTS billing_postal_code text,
ADD COLUMN IF NOT EXISTS billing_city text,
ADD COLUMN IF NOT EXISTS billing_reference text;

-- Add comments for documentation
COMMENT ON COLUMN restaurants.billing_email IS 'Email address for invoices (if different from main email)';
COMMENT ON COLUMN restaurants.billing_contact_person IS 'Contact person for billing/finance questions';
COMMENT ON COLUMN restaurants.billing_contact_phone IS 'Phone number for billing contact';
COMMENT ON COLUMN restaurants.billing_address IS 'Billing address if different from restaurant address';
COMMENT ON COLUMN restaurants.billing_postal_code IS 'Billing postal code';
COMMENT ON COLUMN restaurants.billing_city IS 'Billing city';
COMMENT ON COLUMN restaurants.billing_reference IS 'Customer reference/PO number to show on invoices';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
