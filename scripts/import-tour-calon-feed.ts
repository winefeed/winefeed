/**
 * Import Tour-Calon vintage Bordeaux feed to Winefeed under Brasri (IOR).
 *
 * Source: https://dpiszenzbjemzrizcmdf.supabase.co/functions/v1/feed/tour-calon-reserve-restaurant
 * Target: supplier_wines (supplier_id = Brasri AB)
 *
 * Idempotent — upsert mot (sku, supplier_id). Kör flera gånger utan att duplicera.
 *
 * Usage:
 *   Dry-run (default):     npx tsx scripts/import-tour-calon-feed.ts
 *   Skarp insert/update:   npx tsx scripts/import-tour-calon-feed.ts --apply
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const FEED_URL = 'https://precieu.se/feed/tour-calon-reserve-restaurant';
const BRASRI_SUPPLIER_ID = 'a1111111-1111-1111-1111-111111111111';

interface FeedItem {
  sku: string;
  wine_name: string;
  vintage: string;
  price: number;
  bottle_size_ml: number;
}

interface FeedResponse {
  schema_version: number;
  pricing_id: string;
  pricing_name: string;
  source_supplier_id: string;
  source_supplier_name: string;
  last_ingested_at: string;
  product_count: number;
  data: FeedItem[];
}

const APPELLATION_BY_PRODUCER: Record<string, string> = {
  'Chateau Tour-Calon': 'Castillon Cotes de Bordeaux',
  'Chateau Bonalgue Bel-Air': 'Pomerol',
};

function buildName(item: FeedItem): string {
  const base = item.wine_name;
  const vintage = item.vintage;
  const isMagnum = item.bottle_size_ml === 1500;
  if (isMagnum) {
    return `${base} ${vintage} Magnum`;
  }
  return `${base} ${vintage}`;
}

// Bordeaux blend default — Right Bank tends Merlot-led, Left Bank Cab Sauv-led.
// Tour-Calon (Castillon) and Bonalgue Bel-Air (Pomerol) are both Right Bank,
// so Merlot-dominant blend is the right default.
const GRAPE_BY_PRODUCER: Record<string, string> = {
  'Chateau Tour-Calon': 'Merlot, Cabernet Sauvignon, Cabernet Franc',
  'Chateau Bonalgue Bel-Air': 'Merlot, Cabernet Franc',
};

function mapToSupplierWine(item: FeedItem) {
  const producer = item.wine_name; // wine_name = château-namn för Bordeaux
  const appellation = APPELLATION_BY_PRODUCER[producer] || null;
  const grape = GRAPE_BY_PRODUCER[producer] || null;
  return {
    supplier_id: BRASRI_SUPPLIER_ID,
    sku: item.sku,
    name: buildName(item),
    producer,
    vintage: parseInt(item.vintage, 10),
    country: 'France',
    region: 'Bordeaux',
    appellation,
    color: 'red',
    grape,
    bottle_size_ml: item.bottle_size_ml,
    price_ex_vat_sek: Math.round(item.price * 100), // öre
    case_size: 6,
    moq: 6,
    stock_qty: 0,
    location: 'eu',
    is_active: true,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

  console.log(`Hämtar feed från ${FEED_URL}`);
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Feed status ${res.status}`);
  const feed = (await res.json()) as FeedResponse;
  console.log(`✓ ${feed.product_count} viner i feeden (last_ingested_at: ${feed.last_ingested_at})\n`);

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Hämta befintliga Brasri-rader med dessa SKUs
  const skus = feed.data.map(d => d.sku);
  const { data: existing } = await sb
    .from('supplier_wines')
    .select('sku, id, price_ex_vat_sek, name')
    .eq('supplier_id', BRASRI_SUPPLIER_ID)
    .in('sku', skus);

  const existingMap = new Map((existing || []).map(e => [e.sku, e]));

  let inserts = 0;
  let updates = 0;
  let unchanged = 0;
  const sample: any[] = [];

  for (const item of feed.data) {
    const mapped = mapToSupplierWine(item);
    const existingRow = existingMap.get(item.sku);
    if (!existingRow) {
      inserts++;
      if (sample.length < 5) sample.push({ action: 'INSERT', ...mapped });
    } else if (existingRow.price_ex_vat_sek !== mapped.price_ex_vat_sek || existingRow.name !== mapped.name) {
      updates++;
      if (sample.length < 5) sample.push({ action: 'UPDATE', ...mapped });
    } else {
      unchanged++;
    }
  }

  console.log(`Mappning sammanfattat:`);
  console.log(`  INSERT (nya):       ${inserts}`);
  console.log(`  UPDATE (ändrade):   ${updates}`);
  console.log(`  UNCHANGED:          ${unchanged}`);
  console.log(`  TOTAL feed-items:   ${feed.data.length}\n`);

  console.log(`Sample (första 5 raderna att skriva):`);
  for (const s of sample) {
    console.log(`  ${s.action}  ${s.sku.padEnd(10)}  ${s.name.padEnd(50)}  ${(s.price_ex_vat_sek/100).toFixed(0)} kr  ${s.bottle_size_ml}ml  app=${s.appellation || '(null)'}`);
  }
  console.log('');

  if (!apply) {
    console.log('DRY-RUN — inga rader skrivna. Kör med --apply för att skarp.');
    return;
  }

  // Skarp upsert
  const rows = feed.data.map(mapToSupplierWine);
  const { error } = await sb
    .from('supplier_wines')
    .upsert(rows, { onConflict: 'sku,supplier_id' });

  if (error) {
    console.error('Upsert error:', error);
    process.exit(1);
  }

  console.log(`✓ ${rows.length} rader upsertade till supplier_wines (supplier=Brasri)`);
  console.log(`  Verifiera på admin/suppliers/${BRASRI_SUPPLIER_ID}`);
}

main().catch(err => {
  console.error('Skript-fel:', err);
  process.exit(1);
});
