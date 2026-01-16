-- Add import_id column to supplier_imports
-- Links CSV uploads (supplier_imports) to import cases (imports)
-- Nullable to maintain backwards compatibility with standalone CSV workflow

ALTER TABLE supplier_imports
ADD COLUMN import_id UUID NULL REFERENCES imports(id) ON DELETE SET NULL;

CREATE INDEX idx_supplier_imports_tenant_import ON supplier_imports(tenant_id, import_id);

COMMENT ON COLUMN supplier_imports.import_id IS 'Optional link to import case (nullable for standalone CSV uploads)';
