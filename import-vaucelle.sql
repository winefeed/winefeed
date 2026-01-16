-- IMPORTERA 10 VINER FRÅN CHAMPAGNE VAUCELLE
-- Konvertering: EUR → SEK (1 EUR = 11.5 SEK)
-- Pris baserat på Customer Price från prislistan

INSERT INTO wines (namn, producent, land, region, pris_sek, beskrivning, druva, ekologisk, lagerstatus) VALUES

-- CHAMPAGNE (Mousserande)
('Cuvée Rosé – Le Suchot', 'Vaucelle', 'Frankrike', 'Champagne', 207, 'Elegant roséchampagne med toner av röda bär, jordgubbar och brioche. Perfekt som aperitif eller till skaldjur och lax.', 'Pinot Noir, Chardonnay', false, 'tillgänglig'),

('Cuvée Terre Nacrée (Blanc de Blancs)', 'Vaucelle', 'Frankrike', 'Champagne', 224, 'Raffinerad Blanc de Blancs med toner av citrus, mineraler och mandel. Passar utmärkt till ostron, skaldjur och vit fisk.', 'Chardonnay', false, 'tillgänglig'),

('Cuvée Terre Natale (Blanc de Noirs)', 'Vaucelle', 'Frankrike', 'Champagne', 261, 'Kraftfull Blanc de Noirs med toner av röda äpplen, brioche och nötter. Perfekt till fågel, vitt kött och smöriga rätter.', 'Pinot Noir', false, 'tillgänglig'),

('Cuvée Les Vallons', 'Vaucelle', 'Frankrike', 'Champagne', 261, 'Balanserad champagne med toner av citrus, honung och brioche. Passar både som aperitif och till hela måltiden.', 'Pinot Noir, Chardonnay', false, 'tillgänglig'),

('Cuvée Ambassadeurs', 'Vaucelle', 'Frankrike', 'Champagne', 309, 'Premium champagne med toner av mogen frukt, honung och rostade nötter. Perfekt till festliga tillfällen och lyxiga rätter.', 'Pinot Noir, Chardonnay', false, 'tillgänglig'),

('Cuvée Éphémère "Terre de Nuances"', 'Vaucelle', 'Frankrike', 'Champagne', 475, 'Exklusiv champagne med komplex karaktär av mogen frukt, brioche och mineraler. Perfekt till gourmeträtter och festliga tillfällen.', 'Pinot Noir, Chardonnay', false, 'tillgänglig'),

-- BOURGOGNE (Vita viner)
('Santenay Blanc', 'Vaucelle', 'Frankrike', 'Bourgogne', 415, 'Elegant vit bourgogne med toner av citrus, vit persika och mineraler. Passar utmärkt till skaldjur, vit fisk och vitt kött.', 'Chardonnay', false, 'tillgänglig'),

('Chassagne-Montrachet Blanc', 'Vaucelle', 'Frankrike', 'Bourgogne', 247, 'Raffinerad Chardonnay med toner av citrus, hasselnöt och smör. Perfekt till hummer, kräftor och smöriga fisksåser.', 'Chardonnay', false, 'tillgänglig'),

-- BOURGOGNE (Röda viner)
('Santenay Rouge', 'Vaucelle', 'Frankrike', 'Bourgogne', 392, 'Elegant röd bourgogne med toner av körsbär, jordgubbe och kryddor. Passar fågel, vilt och medelkraftiga rätter.', 'Pinot Noir', false, 'tillgänglig'),

('Chassagne-Montrachet Rouge', 'Vaucelle', 'Frankrike', 'Bourgogne', 202, 'Silkig Pinot Noir med toner av röda bär, rosor och underskog. Perfekt till and, lamm och svamprätter.', 'Pinot Noir', false, 'tillgänglig');

-- Skapa leverantör för Vaucelle
INSERT INTO suppliers (namn, kontakt_email, hemsida, normalleveranstid_dagar)
VALUES ('Champagne Vaucelle', 'contact@champagne-vaucelle.fr', 'https://champagne-vaucelle.fr', 5)
ON CONFLICT DO NOTHING;

-- Koppla alla Vaucelle-viner till leverantören
INSERT INTO wine_suppliers (wine_id, supplier_id)
SELECT w.id, s.id
FROM wines w
CROSS JOIN suppliers s
WHERE w.producent = 'Vaucelle'
  AND s.namn = 'Champagne Vaucelle'
  AND NOT EXISTS (
    SELECT 1 FROM wine_suppliers ws
    WHERE ws.wine_id = w.id AND ws.supplier_id = s.id
  );
