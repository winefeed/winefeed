import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import crypto from 'crypto';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken:false, persistSession:false } });

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const EMAIL = 'marcus.henningsson@etthem.se';

// Find existing user (created in earlier run)
let userId = null;
for (let p = 1; p <= 5; p++) {
  const { data } = await s.auth.admin.listUsers({ page: p, perPage: 100 });
  const found = data?.users?.find(u => u.email?.toLowerCase() === EMAIL);
  if (found) { userId = found.id; break; }
  if (!data?.users || data.users.length < 100) break;
}
console.log('Using user_id:', userId);

// Ensure restaurant exists & is named correctly
const { data: rest, error: re } = await s.from('restaurants').upsert({
  id: userId, name: 'Ett Hem', contact_email: EMAIL, city: 'Stockholm',
}).select('id, name, contact_email').single();
if (re) { console.error('restaurant err:', re); process.exit(1); }
console.log('Restaurant:', rest);

// Clean any stale invites for this email (so we get a fresh one)
await s.from('invites').delete().eq('email', EMAIL);

// Create fresh invite token, 14 days
const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const { data: inv, error: ie } = await s.from('invites').insert({
  tenant_id: TENANT_ID, email: EMAIL, role: 'RESTAURANT',
  restaurant_id: rest.id, token_hash: tokenHash,
  expires_at: new Date(Date.now() + 14*24*3600*1000).toISOString(),
}).select('id, expires_at').single();
if (ie) { console.error('invite err:', ie); process.exit(1); }
console.log('Invite created:', inv.id, 'expires:', inv.expires_at);

console.log('\n=== INVITE URL ===');
console.log('https://winefeed.se/invite?token=' + token);
console.log('\n=== restaurant_id:', rest.id);
