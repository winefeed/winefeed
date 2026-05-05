/**
 * Uppdaterar restaurant_leads-status för dagens (2026-05-04 + 2026-05-05)
 * skickade outreach-mejl. Sätter status='contacted', last_contact_at,
 * next_action_date, contact_email och notes.
 *
 * Om en lead inte finns i databasen skapas den.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const updates = [
  {
    name: 'Morbror Fabian',
    city: 'Östersund',
    contact_email: 'info@morbrorfabian.se',
    contact_phone: '063-10 15 75',
    contact_name: 'Wisam Gharzoul + Martin Dahl',
    last_contact_at: '2026-05-04T16:09:00+02:00',
    next_action_date: '2026-05-11',
    next_action: 'Följ upp om inget svar',
    notes: 'Outreach skickat 2026-05-04 (Resend-ID fcb397ac-7be7-4170-bb7e-586fca58e5bc). Vinkel: gratis pilot + import-stöd + Bordeaux-trio. Världsbistro-pivot från Jazzkökets naturvinsfinkrog.',
  },
  {
    name: 'Bankpalatset',
    city: 'Helsingborg',
    contact_email: 'info@bankpalats.se',
    contact_phone: '+46 76-163 40 40',
    contact_name: 'Simon Weinberg',
    last_contact_at: '2026-05-04T18:00:00+02:00',
    next_action_date: '2026-05-11',
    next_action: 'Följ upp om inget svar + menymatchning efter premiär',
    notes: 'Outreach skickat 2026-05-04 (Resend-ID afefc80f-c127-49f8-b19d-7951c406b6d4). Vinkel: Weinberry-vinbaren, Bordeaux-trio. Öppnar vår 2026.',
  },
  {
    name: 'Nabo Matbar',
    city: 'Helsingborg',
    contact_email: 'info@nabomatbar.se',
    contact_phone: '042-42 47 401',
    contact_name: 'Isabell Seger + Felix Paradis',
    last_contact_at: '2026-05-04T19:00:00+02:00',
    next_action_date: '2026-05-11',
    next_action: 'Följ upp om inget svar (1 signup öppnar Nabo + L\'Enoteque + Regio + Culise)',
    notes: 'Outreach skickat 2026-05-04 (Resend-ID 1d2ad74d-eb96-4df9-b636-b5e462196d87). Vinkel: multi-koncept-hävstång (4 restauranger via Isabell), Tour-Calon-vertikal som Winemakers Dinners-pitch.',
  },
  {
    name: 'Krakas Krog',
    city: 'Kraklingbo',
    contact_email: 'info@krakas.se',
    contact_phone: '+46 498 53062',
    contact_name: 'Ulrika Karlsson',
    last_contact_at: '2026-05-04T20:30:00+02:00',
    next_action_date: '2026-05-11',
    next_action: 'Följ upp innan säsongsstart 1 juni',
    notes: 'Outreach skickat 2026-05-04 (Resend-ID 3e258914-b9a3-4f2f-a7d3-9e54c7382184). Vinkel: ödmjuk profil-fit + Pinot Noir från NZ/Sydafrika som jämförelse-glas. Säsong juni-okt = naturlig deadline.',
  },
  {
    name: 'Brogatan',
    city: 'Malmö',
    contact_email: 'Restaurang.brogatan@gmail.com',
    contact_phone: '+46 40 30 77 17',
    last_contact_at: '2026-05-05T10:00:00+02:00',
    next_action_date: '2026-05-12',
    next_action: 'Följ upp + introducera Vedette Cinsault (Wena) som konkret fransk naturvinsexempel',
    notes: 'Outreach skickat 2026-05-05 (Resend-ID 323194c6-17e8-4dfd-b0a5-171c65987129). Vinkel: generell signal om fransk naturvinstäckning, ingen producent-lista. Naturvinsbar Bourgogne/Jura/Loire-fokus.',
  },
  {
    name: 'Bryggargatan',
    city: 'Skellefteå',
    contact_email: 'info@bryggargatan.se',
    contact_phone: '0910-21 16 50',
    contact_name: 'Jón Óskar Arnason (ägare/kock) — sommelier i Piteå OBEKRÄFTAT',
    last_contact_at: '2026-05-05T10:01:00+02:00',
    next_action_date: '2026-05-12',
    next_action: 'Följ upp + identifiera Piteå-sommelierens namn',
    notes: 'Outreach skickat 2026-05-05 (Resend-ID c0612b66-a17e-4b16-9b00-1dfb4f6a2d30). Vinkel: 17-tema-fredagar 2026 = direkt mappning till broadcast-funktionen. Tre konkreta exempel matchar tre teman (Pinot Noir x2, Riesling).',
  },
];

const WRITABLE = [
  'name', 'city', 'restaurant_type', 'website', 'instagram',
  'contact_name', 'contact_role', 'contact_email', 'contact_phone', 'contact_linkedin',
  'wine_focus_score', 'pilot_fit_score',
  'wine_focus_notes', 'wine_match_notes', 'outreach_angle', 'outreach_draft',
  'status', 'source', 'lead_type', 'notes',
  'next_action', 'next_action_date', 'last_contact_at',
];

function pickWritable(obj) {
  const out = {};
  for (const k of WRITABLE) if (k in obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

console.log(`📊 Uppdaterar ${updates.length} leads i restaurant_leads-tabellen\n`);

for (const u of updates) {
  // Sök befintlig lead på namn (case-insensitive)
  const { data: existing, error: findErr } = await supabase
    .from('restaurant_leads')
    .select('id, name, city, status')
    .ilike('name', u.name)
    .limit(5);

  if (findErr) {
    console.error(`❌ ${u.name}: query-fel: ${findErr.message}`);
    continue;
  }

  // Filtrera på stad också för att undvika false positives
  const match = (existing || []).find(
    (l) =>
      l.name.toLowerCase() === u.name.toLowerCase() &&
      (!u.city || (l.city && l.city.toLowerCase() === u.city.toLowerCase()))
  );

  const fieldsToWrite = pickWritable({ ...u, status: 'contacted', lead_type: 'restaurant' });

  if (match) {
    // Uppdatera
    const { error: updErr } = await supabase
      .from('restaurant_leads')
      .update(fieldsToWrite)
      .eq('id', match.id);

    if (updErr) {
      console.error(`❌ ${u.name}: update-fel: ${updErr.message}`);
    } else {
      console.log(`✓ Uppdaterad: ${u.name} (${u.city}) — status: ${match.status} → contacted`);
    }
  } else {
    // Skapa
    const { error: insErr } = await supabase
      .from('restaurant_leads')
      .insert({ ...fieldsToWrite, source: 'google' });

    if (insErr) {
      console.error(`❌ ${u.name}: insert-fel: ${insErr.message}`);
    } else {
      console.log(`+ Skapad: ${u.name} (${u.city}) — status: contacted`);
    }
  }
}

console.log('\n📊 Klart. Kolla https://www.winefeed.se/admin/growth');
