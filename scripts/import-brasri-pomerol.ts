/**
 * Import Brasri Pomerol 1994 into Vinkoll Access (live)
 *
 * Kör: npx tsx scripts/import-brasri-pomerol.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { flattenBrasriItem, mapToWineInput } from '../lib/access-import';
import { getOrCreateProducer, createWine, createLot, updateWine } from '../lib/access-service';

// Brasri AB importer ID from database
const BRASRI_IMPORTER_ID = '26c2e3ad-ceb0-4126-9cee-c9afd6987712';

const BRASRI_ITEM = {
  'Alcohol %': { fieldName: 'Alcohol %', displayName: 'Alcohol %', value: '13' },
  'Picture': { value: 'https://drive.google.com/file/d/1HPGEF0DrZUnzCcPg3y7QiEY5IowdYhqI/view', fieldName: 'Picture', displayName: 'Picture' },
  'price': { fieldName: 'price', value: '499', displayName: 'Price' },
  'Country': { fieldName: 'Country', value: 'France', displayName: 'Country' },
  'Appellation': { displayName: 'Appellation', fieldName: 'Appellation', value: 'Pomerol' },
  'producer': { value: 'Château Bonalgue Bel Air', displayName: 'Producer', fieldName: 'producer' },
  'Volume ml': { value: '750', displayName: 'Volume ml', fieldName: 'Volume ml' },
  'description': { fieldName: 'description', displayName: 'Description', value: 'A well-made 100% Merlot aged in oak barrels, grown on clay-sandy soils. After 3 decades in the cellar, gentle acidity persists: freshness & maturity.' },
  'type': { displayName: 'Type', fieldName: 'type', value: 'Red' },
  'grapes': { displayName: 'Grapes', fieldName: 'grapes', value: 'Merlot' },
  'productName': { value: 'Pomerol', fieldName: 'productName', displayName: 'Product Name' },
  'Region': { fieldName: 'Region', value: 'Bordeaux', displayName: 'Region' },
  'vintage': { displayName: 'Vintage', value: '1994', fieldName: 'vintage' },
};

async function main() {
  // 1. Flatten + map
  const flat = flattenBrasriItem(BRASRI_ITEM);
  const { wine: wineInput, producerName, price } = mapToWineInput(flat);

  console.log('Mappat vin:');
  console.log('  name:        ' + wineInput.name);
  console.log('  wine_type:   ' + wineInput.wine_type);
  console.log('  vintage:     ' + wineInput.vintage);
  console.log('  country:     ' + wineInput.country);
  console.log('  region:      ' + wineInput.region);
  console.log('  grape:       ' + wineInput.grape);
  console.log('  appellation: ' + wineInput.appellation);
  console.log('  price_sek:   ' + wineInput.price_sek);
  console.log('  producer:    ' + producerName);
  console.log('');

  // 2. Create producer
  console.log('Skapar/hämtar producent...');
  const producerId = await getOrCreateProducer(producerName);
  console.log('  producer_id: ' + producerId);

  // 3. Create wine
  console.log('Skapar vin...');
  const wine = await createWine({
    name: wineInput.name || '',
    wine_type: wineInput.wine_type || 'red',
    vintage: wineInput.vintage ?? null,
    country: wineInput.country || '',
    region: wineInput.region || '',
    grape: wineInput.grape || null,
    appellation: wineInput.appellation || null,
    description: wineInput.description || null,
    price_sek: wineInput.price_sek ?? null,
    volume_ml: wineInput.volume_ml || 750,
    status: 'DRAFT',
    producer_id: producerId,
  });
  console.log('  wine_id: ' + wine.id);
  console.log('  status:  ' + wine.status);

  // 4. Create lot linked to Brasri
  console.log('Skapar lot kopplad till Brasri AB...');
  const lot = await createLot({
    wine_id: wine.id,
    importer_id: BRASRI_IMPORTER_ID,
    price_sek: price ?? null,
    available: true,
  });
  console.log('  lot_id: ' + lot.id);

  // 5. Activate wine
  console.log('Sätter status ACTIVE...');
  const updated = await updateWine(wine.id, { status: 'ACTIVE' });
  console.log('  status: ' + updated.status);

  console.log('');
  console.log('Klart! Pomerol 1994 är live på Vinkoll Access.');
}

main().catch((err) => {
  console.error('Import misslyckades:', err.message);
  process.exit(1);
});
