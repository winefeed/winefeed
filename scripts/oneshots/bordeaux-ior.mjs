import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Force a column read by inserting nothing — read all rows even if 0 by select('*') — but invites is empty
// Probe: try select with known columns
const { data, error } = await s.from('invites').select('id,tenant_id,email,role,restaurant_id,supplier_id,token_hash,expires_at,used_at,accepted_at,created_at,created_by_user_id').limit(0);
console.log('invites probe error:', error?.message);
console.log('invites rows count:', data?.length);

// Check if there's a default tenant
const { data: t, error: te } = await s.from('tenants').select('*').limit(5);
console.log('tenants:', t, te?.message);

// Get a sample restaurant's tenant_id structure
const { data: full } = await s.from('restaurants').select('*').eq('name', 'Pontus Frithiof city venues').single();
console.log('restaurant row keys:', Object.keys(full));
console.log('tenant_id field exists:', 'tenant_id' in full);
