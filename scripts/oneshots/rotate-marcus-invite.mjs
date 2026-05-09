import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import crypto from 'crypto';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} });

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const EMAIL = 'marcus.henningsson@etthem.se';
const RESTAURANT_ID = '2e7c76a8-bb87-41b9-a852-5f19658079a9';

// Invalidate the leaked invite (delete row — token_hash for the leaked token can't be reused)
const { data: del, error: de } = await s.from('invites').delete().eq('email', EMAIL).select('id, expires_at');
console.log('Invalidated leaked invites:', del);
if (de) { console.error(de); process.exit(1); }

// Mint fresh token
const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const { data: inv, error: ie } = await s.from('invites').insert({
  tenant_id: TENANT_ID, email: EMAIL, role: 'RESTAURANT',
  restaurant_id: RESTAURANT_ID, token_hash: tokenHash,
  expires_at: new Date(Date.now() + 14*24*3600*1000).toISOString(),
}).select('id, expires_at').single();
if (ie) { console.error(ie); process.exit(1); }

console.log('New invite created:', inv.id, 'expires:', inv.expires_at);
console.log('NEW URL (handle out-of-band, do not commit):');
console.log('https://winefeed.se/invite?token=' + token);
