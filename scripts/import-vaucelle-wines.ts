import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const wines = [
  // CHAMPAGNE (Mousserande)
  {
    namn: 'Cuvée Rosé – Le Suchot',
    producent: 'Vaucelle',
    land: 'Frankrike',
    region: 'Champagne',
    pris_sek: 207,
    beskrivning: 'Elegant roséchampagne med toner av röda bär, jordgubbar och brioche. Perfekt som aperitif eller till skaldjur och lax.',
    druva: 'Pinot Noir, Chardonnay',
    ekologisk: false,
    lagerstatus: 'tillgänglig'
  },
  {
    namn: 'Cuvée Terre Nacrée (Blanc de Blancs)',
    producent: 'Vaucelle',
    land: 'Frankrike',
    region: 'Champagne',
    pris_sek: 224,
    beskrivning: 'Raffinerad Blanc de Blancs med toner av citrus, mineraler och mandel. Passar utmärkt till ostron, skaldjur och vit fisk.',
    druva: 'Chardonnay',
    ekologisk: false,
    lagerstatus: 'tillgänglig'
  },
  {
    namn: 'Cuvée Terre Natale (Blanc de Noirs)',
    producent: 'Vaucelle',
    land: 'Frankrike',
    region: 'Champagne',
    pris_sek: 261,
    beskrivning: 'Kraftfull Blanc de Noirs med toner av röda äpplen, brioche och nötter. Perfekt till fågel, vitt kött och smöriga rätter.',
    druva: 'Pinot Noir',
    ekologisk: false,
    lagerstatus: 'tillgänglig'
  },
  {
    namn: 'Cuvée Les Vallons',
    producent: 'Vaucelle',
    land: 'Frankrike',
    region: 'Champagne',
    pris_sek: 261,
    beskrivning: 'Balanserad champagne med toner av citrus, honung och brioche. Passar både som aperitif och till hela måltiden.',
    druva: 'Pinot Noir, Chardonnay',
    ekologisk: false,
    lagerstatus: 'tillgänglig'
  },
  {
    namn: 'Cuvée Ambassadeurs',
    producent: 'Vaucelle',
    land: 'Frankrike',
    region: 'Champagne',
    pris_sek: 309,
    beskrivning: 'Premium champagne med toner av mogen frukt, honung och rostade nötter. Perfekt till festliga tillfällen och lyxiga rätter.',
    druva: 'Pinot Noir, Chardonnay',
    ekologisk: false,
    lagerstatus: 'tillgänglig'
  },
  {
    namn: 'Cuvée Éphémère "Terre de Nuances"',
    producent: 'Vaucelle',
    land: 'Frankrike',
    region: 'Champagne',
    pris_sek: 475,
    beskrivning: 'Exklusiv champagne med komplex karaktär av mogen frukt, brioche och mineraler. Perfekt till gourmeträtter och festliga tillfällen.',
    druva: 'Pinot Noir, Chardonnay',
    ekologisk: false,
    lagerstatus: 'tillgänglig'
  },
  // BOURGOGNE (Vita viner)
  {
    namn: 'Santenay Blanc',
    producent: 'Vaucelle',
    land: 'Frankrike',
    region: 'Bourgogne',
    pris_sek: 415,
    beskrivning: 'Elegant vit bourgogne med toner av citrus, vit persika och mineraler. Passar utmärkt till skaldjur, vit fisk och vitt kött.',
    druva: 'Chardonnay',
    ekologisk: false,
    lagerstatus: 'tillgänglig'
  },
  {
    namn: 'Chassagne-Montrachet Blanc',
    producent: 'Vaucelle',
    land: 'Frankrike',
    region: 'Bourgogne',
    pris_sek: 247,
    beskrivning: 'Raffinerad Chardonnay med toner av citrus, hasselnöt och smör. Perfekt till hummer, kräftor och smöriga fisksåser.',
    druva: 'Chardonnay',
    ekologisk: false,
    lagerstatus: 'tillgänglig'
  },
  // BOURGOGNE (Röda viner)
  {
    namn: 'Santenay Rouge',
    producent: 'Vaucelle',
    land: 'Frankrike',
    region: 'Bourgogne',
    pris_sek: 392,
    beskrivning: 'Elegant röd bourgogne med toner av körsbär, jordgubbe och kryddor. Passar fågel, vilt och medelkraftiga rätter.',
    druva: 'Pinot Noir',
    ekologisk: false,
    lagerstatus: 'tillgänglig'
  },
  {
    namn: 'Chassagne-Montrachet Rouge',
    producent: 'Vaucelle',
    land: 'Frankrike',
    region: 'Bourgogne',
    pris_sek: 202,
    beskrivning: 'Silkig Pinot Noir med toner av röda bär, rosor och underskog. Perfekt till and, lamm och svamprätter.',
    druva: 'Pinot Noir',
    ekologisk: false,
    lagerstatus: 'tillgänglig'
  }
];

async function importWines() {
  console.log('Starting wine import...');

  // 1. Insert wines
  const { data: winesData, error: winesError } = await supabase
    .from('wines')
    .insert(wines)
    .select();

  if (winesError) {
    console.error('Error inserting wines:', winesError);
    throw winesError;
  }

  console.log(`✓ Inserted ${winesData.length} wines`);

  // 2. Insert supplier
  const { data: supplierData, error: supplierError } = await supabase
    .from('suppliers')
    .upsert({
      namn: 'Champagne Vaucelle',
      kontakt_email: 'contact@champagne-vaucelle.fr',
      hemsida: 'https://champagne-vaucelle.fr',
      normalleveranstid_dagar: 5
    }, {
      onConflict: 'namn',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (supplierError) {
    console.error('Error inserting supplier:', supplierError);
    throw supplierError;
  }

  console.log(`✓ Inserted supplier: ${supplierData.namn}`);

  // 3. Link wines to supplier
  const wineSupplierLinks = winesData.map(wine => ({
    wine_id: wine.id,
    supplier_id: supplierData.id
  }));

  const { data: linksData, error: linksError } = await supabase
    .from('wine_suppliers')
    .insert(wineSupplierLinks)
    .select();

  if (linksError) {
    console.error('Error linking wines to supplier:', linksError);
    throw linksError;
  }

  console.log(`✓ Linked ${linksData.length} wines to supplier`);
  console.log('\n✅ Import completed successfully!');
}

importWines()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
