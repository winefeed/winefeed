/**
 * MULTI-LINE OFFERS — Leverantörsbatchad offerthantering
 *
 * Ändring: En leverantör svarar med EN samlad offert per förfrågan (alla viner i lines).
 * Restaurangen kan acceptera DELAR av en offert (per rad).
 * Flera leverantörer kan accepteras per förfrågan.
 *
 * Nya kolumner:
 * - offer_lines.supplier_wine_id: Kopplar rad till supplier_wines-katalogen
 * - offer_lines.price_ex_vat_sek: Pris i SEK (decimal, ej öre) — lättare att jobba med
 * - offer_lines.accepted: null = ej beslutad, true = accepterad, false = avvisad
 * - offers.min_total_quantity: Leverantörens MOQ per offert (minsta totalvolym)
 * - offers.supplier_wine_id nullable: Gammal single-wine-modell deprekeras
 * - quote_request_assignments.accepted_offer_id: Acceptans per leverantör (ej per request)
 * - orders.supplier_confirmed_at: Tvåstegsbekräftelse
 * - restaurants: gln_number, delivery_instructions
 * - offers status CHECK utökas med PARTIALLY_ACCEPTED
 */

-- 1. Koppla offer_lines till supplier_wines-katalog
ALTER TABLE offer_lines
  ADD COLUMN IF NOT EXISTS supplier_wine_id UUID REFERENCES supplier_wines(id) ON DELETE SET NULL;

-- 2. Pris i SEK (decimal) — supplement till offered_unit_price_ore
ALTER TABLE offer_lines
  ADD COLUMN IF NOT EXISTS price_ex_vat_sek NUMERIC(10,2);

-- 3. Acceptansstatus per rad
ALTER TABLE offer_lines
  ADD COLUMN IF NOT EXISTS accepted BOOLEAN;

COMMENT ON COLUMN offer_lines.supplier_wine_id IS 'Referens till supplier_wines-katalogen';
COMMENT ON COLUMN offer_lines.price_ex_vat_sek IS 'Offertpris ex moms i SEK (decimal)';
COMMENT ON COLUMN offer_lines.accepted IS 'null = ej beslutad, true = accepterad av restaurang, false = avvisad';

-- 4. Leverantörens MOQ per offert
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS min_total_quantity INTEGER;

COMMENT ON COLUMN offers.min_total_quantity IS 'Minsta totalantal flaskor för hela offerten (leverantörens MOQ)';

-- 5. Gör supplier_wine_id på offers nullable (gammal single-wine deprekeras)
-- Kontrollera om NOT NULL constraint finns — om ja, droppa den
DO $$
BEGIN
  -- Försök droppa NOT NULL (ignorera om den redan är nullable)
  ALTER TABLE offers ALTER COLUMN supplier_wine_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    NULL; -- Kolumnen finns kanske inte eller är redan nullable
END;
$$;

-- 6. Utöka offers status CHECK med PARTIALLY_ACCEPTED
-- Droppa gammal constraint och skapa ny
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_check;
ALTER TABLE offers ADD CONSTRAINT offers_status_check
  CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'pending', 'accepted', 'rejected', 'expired'));

-- 7. Acceptans per leverantör på assignment (inte per request)
ALTER TABLE quote_request_assignments
  ADD COLUMN IF NOT EXISTS accepted_offer_id UUID REFERENCES offers(id) ON DELETE SET NULL;

COMMENT ON COLUMN quote_request_assignments.accepted_offer_id IS 'Offert accepterad av restaurang för denna leverantör';

-- 8. Tvåstegsbekräftelse: leverantör bekräftar order
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS supplier_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.supplier_confirmed_at IS 'Tidpunkt då leverantören bekräftade ordern i Winefeed';

-- 9. Nya restaurangfält för orderunderlag
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS gln_number TEXT,
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

COMMENT ON COLUMN restaurants.gln_number IS 'GLN-nummer (Global Location Number) för EDI';
COMMENT ON COLUMN restaurants.delivery_instructions IS 'Leveransinstruktioner: portkod, tider, ring vid leverans etc.';

-- 10. Index
CREATE INDEX IF NOT EXISTS idx_offer_lines_supplier_wine_id ON offer_lines(supplier_wine_id);
CREATE INDEX IF NOT EXISTS idx_offer_lines_accepted ON offer_lines(offer_id, accepted);
CREATE INDEX IF NOT EXISTS idx_assignments_accepted_offer ON quote_request_assignments(accepted_offer_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_confirmed ON orders(supplier_confirmed_at) WHERE supplier_confirmed_at IS NOT NULL;

-- PostgREST schema reload
NOTIFY pgrst, 'reload schema';
