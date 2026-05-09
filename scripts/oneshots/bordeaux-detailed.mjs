import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const BORDEAUX_OR = 'region.ilike.%Bordeaux%,appellation.ilike.%Bordeaux%,appellation.ilike.%Pomerol%,appellation.ilike.%Saint-Emilion%,appellation.ilike.%Saint-Émilion%,appellation.ilike.%Pauillac%,appellation.ilike.%Margaux%,appellation.ilike.%Saint-Julien%,appellation.ilike.%Sauternes%,appellation.ilike.%Pessac%,appellation.ilike.%Graves%,appellation.ilike.%Médoc%,appellation.ilike.%Listrac%,appellation.ilike.%Moulis%,appellation.ilike.%Saint-Estèphe%,appellation.ilike.%Fronsac%,appellation.ilike.%Castillon%,appellation.ilike.%Lalande%,appellation.ilike.%Puisseguin%,appellation.ilike.%Montagne%,appellation.ilike.%Lussac%,appellation.ilike.%Barsac%,appellation.ilike.%Côtes de Bordeaux%';

const { data } = await s.from('supplier_wines')
  .select('name, producer, vintage, appellation, color, price_ex_vat_sek, bottle_size_ml, moq')
  .or(BORDEAUX_OR).eq('location', 'eu').eq('is_active', true)
  .order('vintage', { ascending: true });

console.log(`\n=== ALL ${data.length} producers ===\n`);
const producers = {};
for (const w of data) {
  const p = w.producer || '(none)';
  if (!producers[p]) producers[p] = { count:0, vintages:new Set(), apps:new Set(), minV:9999, maxV:0 };
  producers[p].count++;
  if (w.vintage) {
    const v = parseInt(w.vintage);
    if (v) {
      producers[p].vintages.add(v);
      producers[p].minV = Math.min(producers[p].minV, v);
      producers[p].maxV = Math.max(producers[p].maxV, v);
    }
  }
  producers[p].apps.add(w.appellation);
}
const sorted = Object.entries(producers).sort((a,b)=>b[1].count - a[1].count);
console.log('Producer'.padEnd(40), 'Antal'.padEnd(7), 'Årgångsspann'.padEnd(15), 'Appellation');
for (const [p,d] of sorted) {
  console.log(p.padEnd(40), String(d.count).padEnd(7), `${d.minV}-${d.maxV}`.padEnd(15), [...d.apps].join(', ').slice(0,50));
}

// Special highlights — 1er Cru / 1er GCC
console.log('\n=== Iconic Bordeaux producers in stock ===');
const iconic = ['Lafite','Latour','Margaux','Mouton','Haut Brion','Yquem','Petrus','Cheval','Ausone','Angélus','Pavie','La Mission'];
for (const ic of iconic) {
  const matches = data.filter(w => (w.producer||'').toLowerCase().includes(ic.toLowerCase()));
  if (matches.length) {
    const vintages = matches.map(m=>m.vintage).sort();
    console.log(`  ${ic}: ${matches.length} bottles | vintages: ${vintages[0]}–${vintages[vintages.length-1]}`);
  }
}

// 50s/60s wines
console.log('\n=== Allt äldre än 1980 (37 viner) ===');
const old = data.filter(w => w.vintage && parseInt(w.vintage) < 1980);
for (const w of old) {
  console.log(`  ${w.vintage} ${(w.name||'').slice(0,55)}`, w.appellation?.slice(0,30), `${w.price_ex_vat_sek||'?'} kr`);
}

// Sauternes details
console.log('\n=== Sauternes-segmentet (70 viner) — top producents ===');
const saut = data.filter(w => /sauternes|barsac/i.test(w.appellation||''));
const sautProd = {};
for (const w of saut) sautProd[w.producer] = (sautProd[w.producer]||0)+1;
console.log(Object.entries(sautProd).sort((a,b)=>b[1]-a[1]));
