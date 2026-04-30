import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: wines } = await sb.from('supplier_wines').select('location, country, supplier_id').eq('is_active', true);
  if (!wines) return;

  const byLocation: Record<string, number> = {};
  const countries = new Set<string>();
  const suppliers = new Set<string>();

  for (const w of wines) {
    byLocation[w.location || 'null'] = (byLocation[w.location || 'null'] || 0) + 1;
    if (w.country) countries.add(w.country);
    if (w.supplier_id) suppliers.add(w.supplier_id);
  }

  console.log(`Aktiva viner: ${wines.length}`);
  console.log(`Per location:`);
  for (const [loc, n] of Object.entries(byLocation)) console.log(`  ${loc.padEnd(10)} ${n}`);
  console.log(`Direktimport (location ≠ domestic): ${wines.filter(w => w.location !== 'domestic').length}`);
  console.log(`Unika länder: ${countries.size}  →  ${[...countries].sort().join(', ')}`);
  console.log(`Aktiva leverantörer (i använt): ${suppliers.size}`);

  // Producenter (distinkt från supplier_wines.producer)
  const { data: producers } = await sb.from('supplier_wines').select('producer').eq('is_active', true).not('producer', 'is', null);
  const producerSet = new Set((producers || []).map(p => p.producer));
  console.log(`Unika producenter (distinkt 'producer'): ${producerSet.size}`);
}
main();
