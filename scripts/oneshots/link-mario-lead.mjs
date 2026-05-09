import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} });

const { error } = await s.from('restaurant_leads').update({
  restaurant_id: '39edddf7-599c-4e21-a3aa-db0a27945e4a',
  updated_at: new Date().toISOString(),
}).eq('id', '34ffe510-41ae-4670-b27e-84d8f1c39795');
console.log(error || '✅ Mario lead linked to restaurant_id');

// Re-check
const { data } = await s.from('restaurant_leads').select('id, name, restaurant_id, status').eq('id', '34ffe510-41ae-4670-b27e-84d8f1c39795').single();
console.log(data);
