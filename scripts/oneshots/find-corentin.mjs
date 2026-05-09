import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} });

// All suppliers with namn containing brasri (case insensitive)
const { data: sup } = await s.from('suppliers').select('*').ilike('namn', '%brasri%');
console.log('Brasri suppliers (full row):', sup);

// All supplier_users for that supplier with auth-user emails
if (sup?.[0]) {
  const sid = sup[0].id;
  const { data: su } = await s.from('supplier_users').select('id, role, is_active');
  console.log(`Total supplier_users:`, su?.length);
  for (const u of su.slice(0, 10)) {
    const { data: au } = await s.auth.admin.getUserById(u.id);
    if (au?.user?.email) console.log(`  ${au.user.email} | metadata:`, JSON.stringify(au.user.user_metadata).slice(0,120));
  }
}

// Auth users with corentin or brasri in email
console.log('\n=== Auth users matching brasri/corentin ===');
let p = 1;
while (true) {
  const { data } = await s.auth.admin.listUsers({ page: p, perPage: 100 });
  if (!data?.users?.length) break;
  for (const u of data.users) {
    if (/brasri|corentin|tregomain|trégomain/i.test(u.email||'') || /brasri|corentin/i.test(JSON.stringify(u.user_metadata||{}))) {
      console.log(`  ${u.email} | metadata:`, JSON.stringify(u.user_metadata).slice(0,150));
    }
  }
  if (data.users.length < 100) break;
  p++;
}
