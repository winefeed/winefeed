-- Fix supplier types: Agenda Wine and AKO Wine & Spirits are Swedish importers, not EU importers.
-- Only Brasri AB is an EU importer.
UPDATE suppliers SET type = 'SWEDISH_IMPORTER' WHERE namn = 'Agenda Wine' AND type = 'EU_IMPORTER';
UPDATE suppliers SET type = 'SWEDISH_IMPORTER' WHERE namn = 'AKO Wine & Spirits' AND type = 'EU_IMPORTER';
