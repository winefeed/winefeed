import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const BORDEAUX_OR = 'region.ilike.%Bordeaux%,appellation.ilike.%Bordeaux%,appellation.ilike.%Pomerol%,appellation.ilike.%Saint-Emilion%,appellation.ilike.%Saint-Émilion%,appellation.ilike.%Pauillac%,appellation.ilike.%Margaux%,appellation.ilike.%Saint-Julien%,appellation.ilike.%Sauternes%,appellation.ilike.%Pessac%,appellation.ilike.%Graves%,appellation.ilike.%Médoc%,appellation.ilike.%Listrac%,appellation.ilike.%Moulis%,appellation.ilike.%Saint-Estèphe%,appellation.ilike.%Fronsac%,appellation.ilike.%Castillon%,appellation.ilike.%Lalande%,appellation.ilike.%Puisseguin%,appellation.ilike.%Montagne%,appellation.ilike.%Lussac%,appellation.ilike.%Barsac%,appellation.ilike.%Côtes de Bordeaux%';

const { data } = await s.from('supplier_wines')
  .select('producer, vintage, appellation')
  .or(BORDEAUX_OR).eq('location', 'eu').eq('is_active', true)
  .order('vintage');

const decades = { '1950s':[], '1960s':[], '1970s':[], '1980s':[], '1990s':[], '2000s':[], '2010s':[], '2020s':[] };
for (const w of data) {
  const v = parseInt(w.vintage); if (!v || v < 1900 || v > 2030) continue;
  const d = `${Math.floor(v/10)*10}s`;
  if (decades[d]) decades[d].push({ vintage: v, producer: w.producer, app: w.appellation });
}

for (const [d, items] of Object.entries(decades)) {
  // Unique producers in that decade
  const seen = new Set();
  const uniqueProducers = [];
  for (const i of items) {
    const key = i.producer;
    if (!seen.has(key)) { seen.add(key); uniqueProducers.push(i); }
  }
  console.log(`\n=== ${d} (${items.length} viner, ${uniqueProducers.length} producenter) ===`);
  uniqueProducers.slice(0, 8).forEach(i => console.log(`  ${i.producer} ${i.vintage} (${i.app})`));
}
