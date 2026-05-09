import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} });

// Show enum options for restaurant_type
const { data: sample } = await s.from('restaurant_leads').select('restaurant_type').not('restaurant_type','is',null).limit(20);
const types = new Set(sample.map(r=>r.restaurant_type));
console.log('Existing restaurant_type values:', [...types]);

const { data: newLead, error: ie } = await s.from('restaurant_leads').insert({
  name: 'Ett Hem',
  city: 'Stockholm',
  contact_name: 'Marcus Henningsson',
  contact_role: 'Sommelier',
  contact_email: 'marcus.henningsson@etthem.se',
  wine_focus_score: 5,
  pilot_fit_score: 5,
  status: 'contacted',
  source: 'referral',
  last_contact_at: new Date().toISOString(),
  next_action: 'Vänta på inlogg + första offertförfrågan',
  wine_focus_notes: 'Fine-dining hotell på Östermalm. Sommelier Marcus Henningsson.',
  notes: 'Onboarded 2026-05-07 via Corentin/Brasri intro. Bordeaux IOR-katalog skickad. Restaurang skapad i system. Resend msg-id c609dbe0-2b01-497d-87f7-a50f9fe27681.',
  lead_type: 'restaurant',
  restaurant_id: '2e7c76a8-bb87-41b9-a852-5f19658079a9',
}).select('id').single();
if (ie) console.error('lead insert err:', ie);
else console.log('✅ Pipeline lead created:', newLead.id);
