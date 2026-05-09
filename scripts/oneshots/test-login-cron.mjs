import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} });

console.log('=== DRY RUN: vad cron skulle hitta nu ===\n');

// Restaurant logins
const { data: rLeads } = await s.from('restaurant_leads')
  .select('id, name, contact_name, contact_email, restaurant_id')
  .eq('status', 'contacted').eq('lead_type', 'restaurant').not('restaurant_id','is',null);
console.log(`Restaurant leads med status=contacted: ${rLeads?.length || 0}`);
for (const l of rLeads || []) {
  const { data } = await s.auth.admin.getUserById(l.restaurant_id);
  const lsi = data?.user?.last_sign_in_at;
  console.log(`  [${lsi ? '✓ logged in' : '· väntar'}] ${l.name} — ${l.contact_email} — last_sign_in: ${lsi || 'aldrig'}`);
}

// Supplier logins
const { data: sLeads } = await s.from('restaurant_leads')
  .select('id, name, contact_email')
  .eq('status', 'contacted').eq('lead_type', 'importer');
console.log(`\nImporter leads med status=contacted: ${sLeads?.length || 0}`);
for (const l of sLeads || []) {
  if (!l.contact_email) { console.log(`  [skip - no email] ${l.name}`); continue; }
  let userId = null;
  for (let p=1; p<=3; p++) {
    const { data } = await s.auth.admin.listUsers({ page: p, perPage: 100 });
    const f = data?.users?.find(u => u.email?.toLowerCase() === l.contact_email.toLowerCase());
    if (f) { userId = f.id; break; }
    if (!data?.users || data.users.length < 100) break;
  }
  if (!userId) { console.log(`  [no auth user] ${l.name} — ${l.contact_email}`); continue; }
  const { data } = await s.auth.admin.getUserById(userId);
  const lsi = data?.user?.last_sign_in_at;
  console.log(`  [${lsi ? '✓ logged in' : '· väntar'}] ${l.name} — ${l.contact_email} — last_sign_in: ${lsi || 'aldrig'}`);
}
