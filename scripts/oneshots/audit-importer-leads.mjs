/**
 * Full audit: every importer lead vs every supplier row.
 * Reports leads that are missing supplier rows + suppliers that are missing leads.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: leads } = await supabase
  .from('restaurant_leads')
  .select('id, name, status, contact_email')
  .eq('lead_type', 'importer');

const { data: suppliers } = await supabase
  .from('suppliers')
  .select('id, namn, kontakt_email, is_active, created_at');

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^a-zåäö0-9 ]/g, '').trim();
const tokens = (s) => norm(s).split(' ').filter(t => t.length >= 4);

console.log('━━━ Lead/Supplier audit ━━━\n');
console.log(`${leads?.length || 0} importer leads, ${suppliers?.length || 0} suppliers\n`);

console.log('LEADS WITH MATCHING SUPPLIER:\n');
const matchedSupplierIds = new Set();
for (const lead of leads || []) {
  const lt = tokens(lead.name);
  if (lt.length === 0) continue;
  const match = (suppliers || []).find(s => {
    const st = tokens(s.namn);
    if (st.length === 0) return false;
    return lt.some(t => st.includes(t));
  });
  if (match) {
    matchedSupplierIds.add(match.id);
    const flag = lead.status === 'onboarded' ? '✓' : '⚠️';
    console.log(`  ${flag} lead "${lead.name}" [${lead.status}] ↔ supplier "${match.namn}" [active=${match.is_active}]`);
  }
}

console.log('\nLEADS WITH NO SUPPLIER ROW (still researched / contacted, normal):\n');
for (const lead of leads || []) {
  const lt = tokens(lead.name);
  if (lt.length === 0) { console.log(`  ? "${lead.name}" — too short to match`); continue; }
  const hasMatch = (suppliers || []).some(s => {
    const st = tokens(s.namn);
    return st.length > 0 && lt.some(t => st.includes(t));
  });
  if (!hasMatch) {
    console.log(`  · "${lead.name}" [${lead.status}]`);
  }
}

console.log('\nSUPPLIERS WITH NO MATCHING LEAD (likely seed/manual):\n');
for (const s of suppliers || []) {
  if (!matchedSupplierIds.has(s.id)) {
    console.log(`  · "${s.namn}" | active=${s.is_active} | created ${s.created_at?.slice(0,10)} | ${s.kontakt_email || '—'}`);
  }
}
