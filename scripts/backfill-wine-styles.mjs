/**
 * One-time backfill script: enrich all supplier_wines with body/tannin/acidity.
 *
 * Usage:
 *   node scripts/backfill-wine-styles.mjs              # update all NULL values
 *   node scripts/backfill-wine-styles.mjs --dry-run    # preview without writing
 *
 * Reads env from .env.local. Respects non-null values (only fills NULLs).
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: new URL('../.env.local', import.meta.url).pathname });

const DRY_RUN = process.argv.includes('--dry-run');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// Inline grape style map (copied from lib/matching-agent/style-inference.ts)
// ============================================================================

const GRAPE_STYLE_MAP = {
  'pinot noir':          { body: 'light',  tannin: 'medium', acidity: 'high' },
  'spätburgunder':       { body: 'light',  tannin: 'medium', acidity: 'high' },
  'pinot nero':          { body: 'light',  tannin: 'medium', acidity: 'high' },
  'cabernet sauvignon':  { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'cabernet':            { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'cab sav':             { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'nebbiolo':            { body: 'full',   tannin: 'high',   acidity: 'high' },
  'gamay':               { body: 'light',  tannin: 'low',    acidity: 'high' },
  'gamay noir':          { body: 'light',  tannin: 'low',    acidity: 'high' },
  'merlot':              { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'syrah':               { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'shiraz':              { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'grenache':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'garnacha':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'cannonau':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'tempranillo':         { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'tinta de toro':       { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'tinto fino':          { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'cencibel':            { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'aragonez':            { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'sangiovese':          { body: 'medium', tannin: 'medium', acidity: 'high' },
  'brunello':            { body: 'medium', tannin: 'medium', acidity: 'high' },
  'morellino':           { body: 'medium', tannin: 'medium', acidity: 'high' },
  'prugnolo gentile':    { body: 'medium', tannin: 'medium', acidity: 'high' },
  'malbec':              { body: 'full',   tannin: 'medium', acidity: 'low' },
  'côt':                 { body: 'full',   tannin: 'medium', acidity: 'low' },
  'cabernet franc':      { body: 'medium', tannin: 'medium', acidity: 'high' },
  'mourvèdre':           { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'monastrell':          { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'mataro':              { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'carignan':            { body: 'medium', tannin: 'high',   acidity: 'medium' },
  'cariñena':            { body: 'medium', tannin: 'high',   acidity: 'medium' },
  'mazuelo':             { body: 'medium', tannin: 'high',   acidity: 'medium' },
  'cinsault':            { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'cinsaut':             { body: 'light',  tannin: 'low',    acidity: 'medium' },
  "nero d'avola":        { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'barbera':             { body: 'medium', tannin: 'low',    acidity: 'high' },
  'dolcetto':            { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'aglianico':           { body: 'full',   tannin: 'high',   acidity: 'high' },
  'touriga nacional':    { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'zweigelt':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'blauer zweigelt':     { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'blaufränkisch':       { body: 'medium', tannin: 'high',   acidity: 'high' },
  'lemberger':           { body: 'medium', tannin: 'high',   acidity: 'high' },
  'kékfrankos':          { body: 'medium', tannin: 'high',   acidity: 'high' },
  'pinotage':            { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'zinfandel':           { body: 'full',   tannin: 'medium', acidity: 'medium' },
  'primitivo':           { body: 'full',   tannin: 'medium', acidity: 'medium' },
  'mencía':              { body: 'medium', tannin: 'medium', acidity: 'high' },
  'mencia':              { body: 'medium', tannin: 'medium', acidity: 'high' },
  'trousseau':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'poulsard':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'ploussard':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'frappato':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'nerello mascalese':   { body: 'medium', tannin: 'medium', acidity: 'high' },
  'corvina':             { body: 'medium', tannin: 'medium', acidity: 'high' },
  'rondinella':          { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'tannat':              { body: 'full',   tannin: 'high',   acidity: 'high' },
  'petit verdot':        { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'carménère':           { body: 'full',   tannin: 'medium', acidity: 'medium' },
  'carmenere':           { body: 'full',   tannin: 'medium', acidity: 'medium' },
  'bonarda':             { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'graciano':            { body: 'medium', tannin: 'high',   acidity: 'high' },
  'petite sirah':        { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'xinomavro':           { body: 'medium', tannin: 'high',   acidity: 'high' },
  'sagrantino':          { body: 'full',   tannin: 'high',   acidity: 'high' },
  'lagrein':             { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'st. laurent':         { body: 'medium', tannin: 'medium', acidity: 'high' },
  'sankt laurent':       { body: 'medium', tannin: 'medium', acidity: 'high' },
  'dornfelder':          { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'lambrusco':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'schiava':             { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'vernatsch':           { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'counoise':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'négrette':            { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'chardonnay':          { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'morillon':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'sauvignon blanc':     { body: 'light',  tannin: 'low',    acidity: 'high' },
  'fumé blanc':          { body: 'light',  tannin: 'low',    acidity: 'high' },
  'riesling':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'chenin blanc':        { body: 'medium', tannin: 'low',    acidity: 'high' },
  'steen':               { body: 'medium', tannin: 'low',    acidity: 'high' },
  'pinot grigio':        { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'pinot gris':          { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'grauburgunder':       { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'ruländer':            { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'albariño':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'albarino':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'alvarinho':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'viognier':            { body: 'full',   tannin: 'low',    acidity: 'low' },
  'gewürztraminer':      { body: 'medium', tannin: 'low',    acidity: 'low' },
  'gewurztraminer':      { body: 'medium', tannin: 'low',    acidity: 'low' },
  'traminer':            { body: 'medium', tannin: 'low',    acidity: 'low' },
  'grüner veltliner':    { body: 'light',  tannin: 'low',    acidity: 'high' },
  'gruner veltliner':    { body: 'light',  tannin: 'low',    acidity: 'high' },
  'verdejo':             { body: 'light',  tannin: 'low',    acidity: 'high' },
  'vermentino':          { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'rolle':               { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'assyrtiko':           { body: 'medium', tannin: 'low',    acidity: 'high' },
  'muscadet':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'melon de bourgogne':  { body: 'light',  tannin: 'low',    acidity: 'high' },
  'marsanne':            { body: 'full',   tannin: 'low',    acidity: 'low' },
  'roussanne':           { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'torrontés':           { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'torrontes':           { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'sémillon':            { body: 'medium', tannin: 'low',    acidity: 'low' },
  'semillon':            { body: 'medium', tannin: 'low',    acidity: 'low' },
  'savagnin':            { body: 'medium', tannin: 'low',    acidity: 'high' },
  'furmint':             { body: 'medium', tannin: 'low',    acidity: 'high' },
  'godello':             { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'garganega':           { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'müller-thurgau':      { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'muller-thurgau':      { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'rivaner':             { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'fiano':               { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'greco':               { body: 'medium', tannin: 'low',    acidity: 'high' },
  'greco di tufo':       { body: 'medium', tannin: 'low',    acidity: 'high' },
  'trebbiano':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'ugni blanc':          { body: 'light',  tannin: 'low',    acidity: 'high' },
  'glera':               { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'prosecco':            { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'pinot blanc':         { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'pinot bianco':        { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'weissburgunder':      { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'silvaner':            { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'sylvaner':            { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'malvasia':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'friulano':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'tocai':               { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'grillo':              { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'arneis':              { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'cortese':             { body: 'light',  tannin: 'low',    acidity: 'high' },
  'pecorino':            { body: 'medium', tannin: 'low',    acidity: 'high' },
  'falanghina':          { body: 'light',  tannin: 'low',    acidity: 'high' },
  'hondarrabi zuri':     { body: 'light',  tannin: 'low',    acidity: 'high' },
  'muscadelle':          { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'picpoul':             { body: 'light',  tannin: 'low',    acidity: 'high' },
  'piquepoul':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'grenache blanc':      { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'clairette':           { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'bourboulenc':         { body: 'light',  tannin: 'low',    acidity: 'high' },
  'macabeo':             { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'viura':               { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'parellada':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'xarel-lo':            { body: 'medium', tannin: 'low',    acidity: 'high' },
};

const COLOR_DEFAULTS = {
  red:        { body: 'medium', tannin: 'medium', acidity: 'medium' },
  white:      { body: 'light',  tannin: 'low',    acidity: 'medium' },
  rose:       { body: 'light',  tannin: 'low',    acidity: 'medium' },
  sparkling:  { body: 'light',  tannin: 'low',    acidity: 'high' },
  orange:     { body: 'medium', tannin: 'medium', acidity: 'medium' },
  fortified:  { body: 'full',   tannin: 'medium', acidity: 'medium' },
};

// ============================================================================
// Simplified descriptor inference (key descriptors only, no encyclopedia)
// ============================================================================

const DESCRIPTOR_MAP = {
  // Body signals
  'fyllig': { body: 'full' }, 'kraftig': { body: 'full' }, 'koncentrerad': { body: 'full' },
  'robust': { body: 'full' }, 'full-bodied': { body: 'full' }, 'rich': { body: 'full' },
  'powerful': { body: 'full' }, 'dense': { body: 'full' }, 'bold': { body: 'full' },
  'balanserad': { body: 'medium' }, 'rund': { body: 'medium' }, 'harmonisk': { body: 'medium' },
  'elegant': { body: 'medium' }, 'medium-bodied': { body: 'medium' }, 'balanced': { body: 'medium' },
  'medelfyllig': { body: 'medium' }, 'smooth': { body: 'medium' },
  'lätt': { body: 'light' }, 'fräsch': { body: 'light' }, 'frisk': { body: 'light' },
  'light-bodied': { body: 'light' }, 'crisp': { body: 'light' }, 'delicate': { body: 'light' },
  'light': { body: 'light' }, 'lean': { body: 'light' },
  // Tannin signals
  'tanninrik': { tannin: 'high' }, 'stram': { tannin: 'high' }, 'strukturerad': { tannin: 'high' },
  'tannic': { tannin: 'high' }, 'firm': { tannin: 'high' }, 'grippy': { tannin: 'high' },
  'silkig': { tannin: 'medium' }, 'sammetslen': { tannin: 'medium' }, 'silky': { tannin: 'medium' },
  'mjuk': { tannin: 'low' }, 'soft': { tannin: 'low' }, 'gentle': { tannin: 'low' },
  // Acidity signals
  'syrlig': { acidity: 'high' }, 'mineralisk': { acidity: 'high' }, 'pigg': { acidity: 'high' },
  'racy': { acidity: 'high' }, 'zesty': { acidity: 'high' }, 'bright': { acidity: 'high' },
  'vibrant': { acidity: 'high' }, 'tart': { acidity: 'high' },
  'mogen': { acidity: 'low' }, 'mellow': { acidity: 'low' }, 'ripe': { acidity: 'low' },
};

function inferFromDescription(description) {
  if (!description) return null;
  const text = description.toLowerCase();
  const words = text.split(/[\s,;:.!?()[\]{}"/]+/).filter(Boolean);
  const bodyVotes = { light: 0, medium: 0, full: 0 };
  const tanninVotes = { low: 0, medium: 0, high: 0 };
  const acidityVotes = { low: 0, medium: 0, high: 0 };
  let signals = 0;

  for (const word of words) {
    const signal = DESCRIPTOR_MAP[word];
    if (!signal) continue;
    signals++;
    if (signal.body) bodyVotes[signal.body] += 1;
    if (signal.tannin) tanninVotes[signal.tannin] += 1;
    if (signal.acidity) acidityVotes[signal.acidity] += 1;
  }

  if (signals === 0) return null;

  const pick = (votes) => {
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : null;
  };

  return { body: pick(bodyVotes), tannin: pick(tanninVotes), acidity: pick(acidityVotes) };
}

// ============================================================================
// Inference function (mirrors style-inference.ts logic)
// ============================================================================

function inferWineStyle(grape, color, _region, description) {
  let grapeStyle = null;

  if (grape) {
    const primaryGrape = grape.split(/[,/&+]/).map(g => g.trim()).filter(Boolean)[0];
    if (primaryGrape) {
      const normalized = primaryGrape.toLowerCase();
      const directMatch = GRAPE_STYLE_MAP[normalized];
      if (directMatch) {
        grapeStyle = { ...directMatch };
      }
    }
  }

  // If grape gave a complete style, return it
  if (grapeStyle && grapeStyle.body && grapeStyle.tannin && grapeStyle.acidity) {
    return grapeStyle;
  }

  // Description-based inference
  const descStyle = inferFromDescription(description);

  // Merge: grape takes priority, description fills gaps
  if (grapeStyle || descStyle) {
    const merged = {
      body: grapeStyle?.body ?? descStyle?.body ?? null,
      tannin: grapeStyle?.tannin ?? descStyle?.tannin ?? null,
      acidity: grapeStyle?.acidity ?? descStyle?.acidity ?? null,
    };

    if (merged.body || merged.tannin || merged.acidity) {
      const colorLower = (color || '').toLowerCase();
      const colorFallback = COLOR_DEFAULTS[colorLower] || COLOR_DEFAULTS['red'];
      return {
        body: merged.body ?? colorFallback.body,
        tannin: merged.tannin ?? colorFallback.tannin,
        acidity: merged.acidity ?? colorFallback.acidity,
      };
    }
  }

  // Color-based fallback
  const colorLower = (color || '').toLowerCase();
  return { ...(COLOR_DEFAULTS[colorLower] || COLOR_DEFAULTS['red']) };
}

// ============================================================================
// Main
// ============================================================================

const BATCH_SIZE = 50;

async function main() {
  console.log(DRY_RUN ? '[DRY RUN] Preview mode — no writes\n' : 'Starting wine style backfill...\n');

  // Fetch ALL wines with any NULL style columns
  const { data: wines, error } = await sb
    .from('supplier_wines')
    .select('id, name, grape_variety, wine_type, region, description, body, tannin, acidity')
    .or('body.is.null,tannin.is.null,acidity.is.null');

  if (error) {
    console.error('Failed to fetch wines:', error.message);
    process.exit(1);
  }

  if (!wines || wines.length === 0) {
    console.log('No wines need enrichment. All style profiles are set.');
    return;
  }

  console.log(`Found ${wines.length} wines with missing style data.\n`);

  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < wines.length; i += BATCH_SIZE) {
    const batch = wines.slice(i, i + BATCH_SIZE);

    for (const wine of batch) {
      try {
        const style = inferWineStyle(
          wine.grape_variety || '',
          wine.wine_type || '',
          wine.region || undefined,
          wine.description || undefined,
        );

        // Only fill NULL columns
        const update = {};
        if (wine.body === null) update.body = style.body;
        if (wine.tannin === null) update.tannin = style.tannin;
        if (wine.acidity === null) update.acidity = style.acidity;

        if (Object.keys(update).length === 0) {
          skipped++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`  [DRY] ${wine.name}: ${JSON.stringify(update)}`);
          enriched++;
          continue;
        }

        const { error: updateError } = await sb
          .from('supplier_wines')
          .update(update)
          .eq('id', wine.id);

        if (updateError) {
          console.error(`  ERROR updating ${wine.name} (${wine.id}):`, updateError.message);
          errors++;
        } else {
          enriched++;
        }
      } catch (err) {
        console.error(`  ERROR processing ${wine.name} (${wine.id}):`, err.message);
        errors++;
      }
    }

    const done = Math.min(i + BATCH_SIZE, wines.length);
    console.log(`Enriched ${done}/${wines.length} wines...`);
  }

  console.log(`\nDone! enriched=${enriched}, skipped=${skipped}, errors=${errors}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
