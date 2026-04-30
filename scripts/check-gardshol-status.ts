import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SUPPLIER_ID = '56618333-25f2-4863-a1af-2758a7a3ed1f';

async function main() {
  const { data: wines } = await sb
    .from('supplier_wines')
    .select('sku, name, producer, vintage, color, country, region, price_ex_vat_sek, stock_qty, case_size, moq, is_active')
    .eq('supplier_id', SUPPLIER_ID)
    .order('sku');

  console.log(`Gardshol Wines — ${wines?.length ?? 0} viner totalt\n`);
  if (!wines) return;

  for (const w of wines) {
    const price = w.price_ex_vat_sek ? `${Math.round(w.price_ex_vat_sek / 100)} kr` : '—';
    const stock = w.stock_qty ?? '—';
    const status = w.is_active ? '✓' : '✗';
    console.log(`  ${status} ${w.sku}  ${(w.name || '').padEnd(40).slice(0,40)}  ${(w.producer || '').padEnd(20).slice(0,20)}  ${w.vintage || 'NV'}  ${(w.region || '').padEnd(15).slice(0,15)}  ${price.padStart(8)}  stock=${stock}  case=${w.case_size ?? '—'}  moq=${w.moq ?? '—'}`);
  }

  const active = wines.filter(w => w.is_active);
  console.log(`\nAktiva: ${active.length} / ${wines.length}`);

  // Check for assignments / offers
  const wineIds = wines.map(w => w.sku);
  const { data: offers } = await sb
    .from('offer_lines')
    .select('id, offer_id, sku, accepted')
    .in('sku', wineIds.filter(Boolean) as string[])
    .limit(50);

  console.log(`\nOffer lines med Gardshol-SKU: ${offers?.length ?? 0}`);

  // Check assignments via supplier
  const { data: assignments } = await sb
    .from('quote_request_assignments')
    .select('id, status, sent_at, expires_at, quote_request_id')
    .eq('supplier_id', SUPPLIER_ID)
    .order('sent_at', { ascending: false })
    .limit(10);

  console.log(`\nSenaste 10 förfrågningar (assignments) till Gardshol:`);
  if (!assignments || assignments.length === 0) {
    console.log('  (inga)');
  } else {
    for (const a of assignments) {
      const expired = a.expires_at && new Date(a.expires_at) < new Date() ? ' [UTGÅNGEN]' : '';
      console.log(`  ${a.status.padEnd(10)}  ${new Date(a.sent_at).toISOString().slice(0,16)}  req=${a.quote_request_id?.slice(0,8)}${expired}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
