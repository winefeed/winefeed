import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { count: total } = await sb.from('supplier_wines').select('*', { count: 'exact', head: true }).eq('is_active', true);
  console.log(`Aktiva viner totalt: ${total}\n`);

  const { data: suppliers } = await sb.from('suppliers').select('id, namn, type').eq('is_active', true);
  for (const s of suppliers || []) {
    const { count } = await sb.from('supplier_wines').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('supplier_id', s.id);
    console.log(`  ${(count || 0).toString().padStart(4)}  ${(s.namn || '').padEnd(28)} ${s.type}`);
  }
}
main();
