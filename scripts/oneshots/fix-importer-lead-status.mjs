/**
 * Fix importer lead status mismatches:
 *   restaurant_leads.status = 'contacted' but supplier exists with is_active=true.
 * Also reports any other mismatches found beyond the known ones.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

console.log('━━━ Cross-checking importer leads vs suppliers table ━━━\n');

const { data: leads } = await supabase
  .from('restaurant_leads')
  .select('id, name, status, contact_email, last_contact_at')
  .eq('lead_type', 'importer')
  .in('status', ['contacted', 'responded', 'researched']);

const { data: suppliers } = await supabase
  .from('suppliers')
  .select('id, namn, kontakt_email, is_active, created_at');

const mismatches = [];
for (const lead of leads || []) {
  const match = (suppliers || []).find(s => {
    const sn = (s.namn || '').toLowerCase().trim();
    const ln = (lead.name || '').toLowerCase().trim();
    if (!sn || !ln) return false;
    if (sn === ln) return true;
    // soft match: each side's first significant token
    const lt = ln.split(/\s+/)[0];
    const st = sn.split(/\s+/)[0];
    if (lt && st && lt === st && lt.length >= 4) return true;
    return false;
  });
  if (match && match.is_active) {
    mismatches.push({ lead, supplier: match });
  }
}

console.log(`Found ${mismatches.length} mismatch(es):\n`);
for (const m of mismatches) {
  console.log(`  • lead "${m.lead.name}" [${m.lead.status}] ↔ supplier "${m.supplier.namn}" [active=${m.supplier.is_active}]`);
}

if (mismatches.length === 0) {
  console.log('Nothing to update.');
  process.exit(0);
}

console.log('\n━━━ Updating leads → status=onboarded ━━━\n');

for (const m of mismatches) {
  const { error } = await supabase
    .from('restaurant_leads')
    .update({
      status: 'onboarded',
      updated_at: new Date().toISOString(),
      notes: undefined, // leave notes alone
    })
    .eq('id', m.lead.id);
  if (error) {
    console.log(`  ✗ ${m.lead.name}: ${error.message}`);
  } else {
    console.log(`  ✓ ${m.lead.name} → onboarded`);
  }
}

// Verify
console.log('\n━━━ Verifying ━━━\n');
const { data: after } = await supabase
  .from('restaurant_leads')
  .select('name, status')
  .in('id', mismatches.map(m => m.lead.id));
for (const r of after || []) console.log(`  ${r.name}: ${r.status}`);
