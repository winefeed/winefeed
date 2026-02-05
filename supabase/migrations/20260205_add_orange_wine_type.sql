-- Add ORANGE to ior_wine_type enum
-- Orange wines are skin-contact white wines, popular in natural wine segment

ALTER TYPE ior_wine_type ADD VALUE IF NOT EXISTS 'ORANGE' AFTER 'ROSE';
