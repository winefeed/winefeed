import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} });

const { data } = await s.from('restaurant_leads').select('id, name, contact_name, contact_email, status, lead_type, restaurant_id').or('name.ilike.%pontus%,contact_email.ilike.%pontusfrithiof%,contact_email.ilike.%mario%');
console.log('Pontus/Mario leads:', data);
