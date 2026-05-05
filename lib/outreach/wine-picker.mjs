/**
 * Väljer 3-5 viner från supplier_wines som matchar restaurang-profil.
 * Prioriterar live-data (priser, tillgänglighet) framför hardcodade exempel.
 *
 * Strategi:
 * 1. Bygg query-filter från tags (region, druva, organic etc.)
 * 2. Hämta matchande viner
 * 3. Spread: 1 affordable (<400 kr) + 1 mid (400-1500) + 1 premium (>1500) om möjligt
 * 4. Diversifiera producent — undvik 5 olika Tour-Calon-årgångar
 * 5. Returnera 3-5 stycken
 */

const PRICE_TIERS = {
  affordable: { min: 0, max: 40000 }, // 0-400 kr (öre)
  mid: { min: 40000, max: 150000 },
  premium: { min: 150000, max: 99999999 },
};

/**
 * Mappar tags till query-filter på supplier_wines-tabellen.
 */
function tagsToFilters(tags) {
  const filters = {
    countries: [],
    regions: [],
    grapes: [],
    organic: false,
    vintage_max: null,
  };
  if (tags.has('fransk') || tags.has('bordeaux') || tags.has('bourgogne') || tags.has('champagne') || tags.has('rhone') || tags.has('loire') || tags.has('jura') || tags.has('alsace')) filters.countries.push('France');
  if (tags.has('italiensk')) filters.countries.push('Italy');
  if (tags.has('spansk')) filters.countries.push('Spain');
  if (tags.has('tysk')) filters.countries.push('Germany');
  if (tags.has('sydafrikansk')) filters.countries.push('South Africa');
  if (tags.has('nz')) filters.countries.push('New Zealand');
  if (tags.has('bordeaux')) filters.regions.push('Bordeaux', 'Saint Emilion Grand Cru', 'Pomerol', 'Pauillac', 'Saint Estephe', 'Pessac Leognan', 'Margaux', 'Saint Julien', 'Sauternes', 'Barsac', 'Castillon Cotes de Bordeaux', 'Medoc', 'Haut Medoc');
  if (tags.has('bourgogne')) filters.regions.push('Burgundy', 'Beaujolais');
  if (tags.has('loire')) filters.regions.push('Loire');
  if (tags.has('alsace')) filters.regions.push('Alsace');
  if (tags.has('rhone')) filters.regions.push('Rhone');
  if (tags.has('jura')) filters.regions.push('Jura');
  if (tags.has('champagne')) filters.regions.push('Champagne');
  if (tags.has('mosel') || tags.has('tysk')) filters.regions.push('Mosel');
  if (tags.has('pinot_noir')) filters.grapes.push('Pinot Noir');
  if (tags.has('organic') || tags.has('naturvin')) filters.organic = true;
  if (tags.has('old_vintage')) filters.vintage_max = 2005;
  return filters;
}

/**
 * Hämtar matchande viner från DB.
 */
export async function pickWineExamples(supabase, tags, { count = 4, fallback = true } = {}) {
  const filters = tagsToFilters(tags);
  let query = supabase.from('supplier_wines').select('id, producer, name, region, country, vintage, price_ex_vat_sek, bottle_size_ml, color, organic, appellation, location').eq('is_active', true);

  if (filters.countries.length > 0) query = query.in('country', filters.countries);
  if (filters.regions.length > 0) query = query.in('region', filters.regions);
  if (filters.grapes.length > 0) {
    const orParts = filters.grapes.map(g => `grape.ilike.%${g}%`).join(',');
    query = query.or(orParts);
  }
  if (filters.organic) query = query.eq('organic', true);
  if (filters.vintage_max) query = query.lte('vintage', filters.vintage_max).gt('vintage', 0);

  const { data, error } = await query.limit(200);
  if (error) throw error;

  let pool = data || [];

  // Om för få träffar och fallback tillåts: släpp ner till country-only
  if (pool.length < count && fallback && filters.countries.length > 0) {
    const { data: fb } = await supabase.from('supplier_wines').select('id, producer, name, region, country, vintage, price_ex_vat_sek, bottle_size_ml, color, organic, appellation, location').eq('is_active', true).in('country', filters.countries).limit(200);
    pool = fb || [];
  }
  // Sista fallback: alla aktiva
  if (pool.length < count && fallback) {
    const { data: fb } = await supabase.from('supplier_wines').select('id, producer, name, region, country, vintage, price_ex_vat_sek, bottle_size_ml, color, organic, appellation, location').eq('is_active', true).limit(200);
    pool = fb || [];
  }

  if (pool.length === 0) return [];

  // Sortera efter pris för spread
  pool.sort((a, b) => (a.price_ex_vat_sek || 0) - (b.price_ex_vat_sek || 0));

  // Plocka 1 affordable + 1 mid + 1 premium + 1 extra affordable
  const affordable = pool.filter(w => w.price_ex_vat_sek > 0 && w.price_ex_vat_sek < PRICE_TIERS.affordable.max);
  const mid = pool.filter(w => w.price_ex_vat_sek >= PRICE_TIERS.mid.min && w.price_ex_vat_sek < PRICE_TIERS.mid.max);
  const premium = pool.filter(w => w.price_ex_vat_sek >= PRICE_TIERS.premium.min);

  // Diversifiera producent — välj olika producenter
  const seenProducers = new Set();
  const uniqueByProducer = arr => arr.filter(w => {
    if (seenProducers.has(w.producer)) return false;
    seenProducers.add(w.producer);
    return true;
  });

  const picked = [];
  const aff = uniqueByProducer(affordable);
  if (aff.length > 0) picked.push(aff[0]);
  // Reset seen så mid/premium kan välja samma producent som inte var i aff
  // (vi vill ha olika producenter, men bordet är litet)
  const mid2 = uniqueByProducer(mid);
  if (mid2.length > 0) picked.push(mid2[0]);
  const prem = uniqueByProducer(premium);
  if (prem.length > 0) picked.push(prem[0]);

  // Fyll på med fler från affordable/mid om vi har plats kvar
  for (const w of [...affordable, ...mid]) {
    if (picked.length >= count) break;
    if (!w || !w.id) continue;
    if (picked.find(p => p && p.id === w.id)) continue;
    if (seenProducers.has(w.producer)) continue;
    picked.push(w);
    seenProducers.add(w.producer);
  }

  return picked.slice(0, count);
}

/**
 * Formaterar valda viner som markdown-bullets för mejlet.
 */
export function formatWineBullets(wines) {
  return wines.map(w => {
    const sek = ((w.price_ex_vat_sek || 0) / 100).toLocaleString('sv-SE');
    const region = w.appellation || w.region || w.country;
    const vintage = w.vintage && w.vintage > 0 ? ` ${w.vintage}` : '';
    const size = w.bottle_size_ml && w.bottle_size_ml !== 750 ? ` (${w.bottle_size_ml} ml)` : '';
    const producer = w.producer || w.name;
    return `- **${producer}**${vintage} (${region})${size}. ${sek} kr ex moms`;
  }).join('\n');
}

/**
 * HTML-version av wine-bullets (för mejl-HTML).
 */
export function formatWineBulletsHtml(wines) {
  return '<ul style="margin:0 0 18px 0;padding-left:22px;">' + wines.map(w => {
    const sek = ((w.price_ex_vat_sek || 0) / 100).toLocaleString('sv-SE');
    const region = w.appellation || w.region || w.country;
    const vintage = w.vintage && w.vintage > 0 ? ` ${w.vintage}` : '';
    const size = w.bottle_size_ml && w.bottle_size_ml !== 750 ? ` (${w.bottle_size_ml} ml)` : '';
    const producer = w.producer || w.name;
    return `<li style="margin-bottom:8px;"><strong>${producer}</strong>${vintage} (${region})${size}. ${sek} kr ex moms</li>`;
  }).join('') + '</ul>';
}
