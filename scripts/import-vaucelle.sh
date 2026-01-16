#!/bin/bash

# Load environment variables
source .env.local

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

echo "Starting wine import to Supabase..."

# Insert wines
echo "Inserting wines..."
curl -X POST "${SUPABASE_URL}/rest/v1/wines" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '[
  {
    "namn": "Cuvée Rosé – Le Suchot",
    "producent": "Vaucelle",
    "land": "Frankrike",
    "region": "Champagne",
    "pris_sek": 207,
    "beskrivning": "Elegant roséchampagne med toner av röda bär, jordgubbar och brioche. Perfekt som aperitif eller till skaldjur och lax.",
    "druva": "Pinot Noir, Chardonnay",
    "ekologisk": false,
    "lagerstatus": "tillgänglig"
  },
  {
    "namn": "Cuvée Terre Nacrée (Blanc de Blancs)",
    "producent": "Vaucelle",
    "land": "Frankrike",
    "region": "Champagne",
    "pris_sek": 224,
    "beskrivning": "Raffinerad Blanc de Blancs med toner av citrus, mineraler och mandel. Passar utmärkt till ostron, skaldjur och vit fisk.",
    "druva": "Chardonnay",
    "ekologisk": false,
    "lagerstatus": "tillgänglig"
  },
  {
    "namn": "Cuvée Terre Natale (Blanc de Noirs)",
    "producent": "Vaucelle",
    "land": "Frankrike",
    "region": "Champagne",
    "pris_sek": 261,
    "beskrivning": "Kraftfull Blanc de Noirs med toner av röda äpplen, brioche och nötter. Perfekt till fågel, vitt kött och smöriga rätter.",
    "druva": "Pinot Noir",
    "ekologisk": false,
    "lagerstatus": "tillgänglig"
  },
  {
    "namn": "Cuvée Les Vallons",
    "producent": "Vaucelle",
    "land": "Frankrike",
    "region": "Champagne",
    "pris_sek": 261,
    "beskrivning": "Balanserad champagne med toner av citrus, honung och brioche. Passar både som aperitif och till hela måltiden.",
    "druva": "Pinot Noir, Chardonnay",
    "ekologisk": false,
    "lagerstatus": "tillgänglig"
  },
  {
    "namn": "Cuvée Ambassadeurs",
    "producent": "Vaucelle",
    "land": "Frankrike",
    "region": "Champagne",
    "pris_sek": 309,
    "beskrivning": "Premium champagne med toner av mogen frukt, honung och rostade nötter. Perfekt till festliga tillfällen och lyxiga rätter.",
    "druva": "Pinot Noir, Chardonnay",
    "ekologisk": false,
    "lagerstatus": "tillgänglig"
  },
  {
    "namn": "Cuvée Éphémère \"Terre de Nuances\"",
    "producent": "Vaucelle",
    "land": "Frankrike",
    "region": "Champagne",
    "pris_sek": 475,
    "beskrivning": "Exklusiv champagne med komplex karaktär av mogen frukt, brioche och mineraler. Perfekt till gourmeträtter och festliga tillfällen.",
    "druva": "Pinot Noir, Chardonnay",
    "ekologisk": false,
    "lagerstatus": "tillgänglig"
  },
  {
    "namn": "Santenay Blanc",
    "producent": "Vaucelle",
    "land": "Frankrike",
    "region": "Bourgogne",
    "pris_sek": 415,
    "beskrivning": "Elegant vit bourgogne med toner av citrus, vit persika och mineraler. Passar utmärkt till skaldjur, vit fisk och vitt kött.",
    "druva": "Chardonnay",
    "ekologisk": false,
    "lagerstatus": "tillgänglig"
  },
  {
    "namn": "Chassagne-Montrachet Blanc",
    "producent": "Vaucelle",
    "land": "Frankrike",
    "region": "Bourgogne",
    "pris_sek": 247,
    "beskrivning": "Raffinerad Chardonnay med toner av citrus, hasselnöt och smör. Perfekt till hummer, kräftor och smöriga fisksåser.",
    "druva": "Chardonnay",
    "ekologisk": false,
    "lagerstatus": "tillgänglig"
  },
  {
    "namn": "Santenay Rouge",
    "producent": "Vaucelle",
    "land": "Frankrike",
    "region": "Bourgogne",
    "pris_sek": 392,
    "beskrivning": "Elegant röd bourgogne med toner av körsbär, jordgubbe och kryddor. Passar fågel, vilt och medelkraftiga rätter.",
    "druva": "Pinot Noir",
    "ekologisk": false,
    "lagerstatus": "tillgänglig"
  },
  {
    "namn": "Chassagne-Montrachet Rouge",
    "producent": "Vaucelle",
    "land": "Frankrike",
    "region": "Bourgogne",
    "pris_sek": 202,
    "beskrivning": "Silkig Pinot Noir med toner av röda bär, rosor och underskog. Perfekt till and, lamm och svamprätter.",
    "druva": "Pinot Noir",
    "ekologisk": false,
    "lagerstatus": "tillgänglig"
  }
]' > /tmp/wines_response.json

echo ""
echo "✓ Wine insert response saved to /tmp/wines_response.json"
cat /tmp/wines_response.json | head -20
echo ""

# Insert supplier
echo "Inserting supplier..."
curl -X POST "${SUPABASE_URL}/rest/v1/suppliers" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation,resolution=merge-duplicates" \
  -d '{
    "namn": "Champagne Vaucelle",
    "kontakt_email": "contact@champagne-vaucelle.fr",
    "hemsida": "https://champagne-vaucelle.fr",
    "normalleveranstid_dagar": 5
  }' > /tmp/supplier_response.json

echo ""
echo "✓ Supplier insert response saved to /tmp/supplier_response.json"
cat /tmp/supplier_response.json
echo ""

# Extract supplier ID
SUPPLIER_ID=$(cat /tmp/supplier_response.json | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)
echo "Supplier ID: ${SUPPLIER_ID}"

# Get wine IDs for Vaucelle wines
echo "Fetching Vaucelle wine IDs..."
curl -X GET "${SUPABASE_URL}/rest/v1/wines?producent=eq.Vaucelle&select=id" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  > /tmp/wine_ids.json

echo "Wine IDs response:"
cat /tmp/wine_ids.json
echo ""

# Create wine_suppliers links (this part would need to be done manually or with jq)
echo ""
echo "✅ Import completed!"
echo ""
echo "Next steps:"
echo "1. Check /tmp/wines_response.json for imported wines"
echo "2. Check /tmp/supplier_response.json for supplier info"
echo "3. Link wines to supplier manually in Supabase dashboard or create wine_suppliers entries"
