-- Restaurant Sommelier Profile
-- Adds wine preference fields for personalized AI suggestions

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS cuisine_type text[],
ADD COLUMN IF NOT EXISTS price_segment text,
ADD COLUMN IF NOT EXISTS wine_preference_notes text;

ALTER TABLE restaurants ADD CONSTRAINT chk_price_segment
CHECK (price_segment IS NULL OR price_segment IN ('casual', 'mid-range', 'fine-dining')) NOT VALID;

NOTIFY pgrst, 'reload schema';
