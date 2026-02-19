-- Add alcohol_free (NoLo) as a wine color/type
-- Driven by market trend: Viva Wine Group acquired Alpha Brands for NoLo segment
-- Restaurants increasingly need alcohol-free options on their menus

ALTER TYPE wine_color ADD VALUE IF NOT EXISTS 'alcohol_free' AFTER 'orange';

COMMENT ON TYPE wine_color IS 'Wine type/color enum: red, white, rose, sparkling, fortified, orange, alcohol_free';
