/**
 * Steg 1: Lägger till Pontus Frithiof city venues i restaurant_leads
 * (för pipeline-tracking i /admin/growth).
 *
 * Restaurants-tabellen kan INTE pre-skapas — den är FK:ad mot auth.users
 * via en trigger som auto-skapar restaurants-raden när en auth-user
 * skapas med user_type='restaurant' metadata.
 *
 * Steg 2 (auth user + restaurants-rad + restaurant_users + email) körs
 * via send-mario-pontus-onboarding.mjs när Mario's email kommit.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const restName = 'Pontus Frithiof city venues';
const today = new Date().toISOString().slice(0, 10);

console.log('📊 Lägger Pontus i restaurant_leads för pipeline-tracking...');

const { data: existingLead } = await supabase
  .from('restaurant_leads')
  .select('id')
  .ilike('name', restName)
  .limit(1);

const leadFields = {
  name: restName,
  city: 'Stockholm',
  restaurant_type: 'fine_dining',
  contact_name: 'Mario Moroni (sommelier)',
  contact_role: 'Sommelier',
  contact_phone: '08-23 99 50',
  wine_focus_score: 5,
  pilot_fit_score: 5,
  wine_focus_notes: 'Restaurangkedja: Fabriken by Pontus Frithiof (Nacka Strand), Pontus by Pontus, La Tour by Pontus m.fl. Sommelier Mario Moroni. Org 556600-5293, VD Mattias Ekström, ordf Pontus Frithiof.',
  outreach_angle: 'Varm referral från Corentin (Brasri). Mario intresserad av äldre Bordeaux. Plan: pre-build Pontus-konto + skicka magic-link till sökfilter "äldre fransk Bordeaux 1958-2005".',
  status: 'meeting_booked',
  source: 'referral',
  lead_type: 'restaurant',
  next_action_date: today,
  next_action: 'Bygg Mario-konto + skicka intro-mejl när email-adressen kommer från Corentin',
  notes: `[${today}] Varm referral från Corentin (Brasri) via Messenger. Mario sommelier, Pontus restaurangkedja (~7 koncept i Sthlm). Corentin gav green light på pris-spridning + erbjuder sig som expert-kontakt (+46 738 240 272). Org 556600-5293, Box 12011 102 21 Stockholm. Väntar på Mario's email innan vi kan skapa restaurant-konto (kräver auth-user). Onboarding-skript förberett: scripts/send-mario-pontus-onboarding.mjs`,
};

if (existingLead && existingLead.length > 0) {
  const { error } = await supabase
    .from('restaurant_leads')
    .update(leadFields)
    .eq('id', existingLead[0].id);
  if (error) console.error('   ❌', error.message);
  else console.log(`   ✓ Uppdaterad lead (${existingLead[0].id})`);
} else {
  const { data: lead, error } = await supabase
    .from('restaurant_leads')
    .insert(leadFields)
    .select('id')
    .single();
  if (error) console.error('   ❌', error.message);
  else console.log(`   ✓ Skapad lead (${lead.id})`);
}

console.log('\nNästa: kör scripts/send-mario-pontus-onboarding.mjs MARIO_EMAIL=mario@... när emailen kommit.');
