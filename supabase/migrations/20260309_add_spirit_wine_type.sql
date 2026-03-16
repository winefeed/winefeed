-- Add 'spirit' to wine_color enum
ALTER TYPE wine_color ADD VALUE IF NOT EXISTS 'spirit' AFTER 'alcohol_free';
