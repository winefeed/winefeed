/**
 * Batch enrichment för Brasri-katalogen (och alla andra viner med saknade fält).
 *
 * Hämtar viner som saknar grape, description (< 20 tecken) eller alcohol_pct,
 * och använder Haiku 4.5 för att fylla i luckorna baserat på namn, producent,
 * region, appellation, land och färg.
 *
 * Efter AI-berikningen körs style-inference deterministiskt via
 * backfill-wine-styles.mjs-logiken (grape + region → body/tannin/acidity).
 *
 * Usage:
 *   node scripts/batch-enrich-brasri.mjs                 # kör på alla berörda viner
 *   node scripts/batch-enrich-brasri.mjs --dry-run       # preview, inga writes
 *   node scripts/batch-enrich-brasri.mjs --limit 10      # testkörning på 10 viner
 *   node scripts/batch-enrich-brasri.mjs --supplier UUID # filtrera per supplier
 *   node scripts/batch-enrich-brasri.mjs --concurrency 5 # parallellism (default 3)
 *
 * Idempotent — endast NULL/tomma fält skrivs. Befintlig data rörs inte.
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

// ============================================================================
// CLI args
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx > -1 ? parseInt(process.argv[idx + 1], 10) : null;
})();
const SUPPLIER_FILTER = (() => {
  const idx = process.argv.indexOf('--supplier');
  return idx > -1 ? process.argv[idx + 1] : null;
})();
const CONCURRENCY = (() => {
  const idx = process.argv.indexOf('--concurrency');
  return idx > -1 ? parseInt(process.argv[idx + 1], 10) : 3;
})();
const REVIEW_FILE = (() => {
  const idx = process.argv.indexOf('--review-file');
  return idx > -1 ? process.argv[idx + 1] : null;
})();
const JSON_FILE = (() => {
  const idx = process.argv.indexOf('--json-file');
  return idx > -1 ? process.argv[idx + 1] : null;
})();

// ============================================================================
// Setup
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Saknar NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local');
  process.exit(1);
}
if (!anthropicKey) {
  console.error('❌ Saknar ANTHROPIC_API_KEY i .env.local');
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

// ============================================================================
// Haiku enrichment call
// ============================================================================

const SYSTEM_PROMPT = `Du är en fakta-driven vinkatalog-assistent för Winefeed, en B2B-plattform som
kopplar europeiska vinleverantörer till svenska restauranger. Din uppgift är
att berika vinkatalogen med korrekt druvsammansättning, alkoholhalt och
koncis, faktabaserad svensk beskrivning.

Din målgrupp är svenska sommelierer, restaurangchefer och inköpare. De behöver
snabbt kunna bedöma vinet — inte läsa säljbroschyrer. Håll tonen nykter och
informativ, inte entusiastisk.

## OUTPUT-FORMAT

Returnera ett JSON-objekt per vin med fälten:
- grape_composition (string, t.ex. "Merlot 75%, Cabernet Franc 25%")
- alcohol_percent (number eller null)
- description (string, 3–5 meningar, på svenska)
- confidence (high | medium | low)

## KÄLLKRITIK OCH OSÄKERHET

- Om du inte är säker på druvsammansättningen, sätt confidence till "medium"
  eller "low" och skriv en sammansättning som är typisk för appellationen
  (inte specifik för producenten).
- Om du inte vet alkoholhalten, returnera null. Gissa ALDRIG.
- Om du inte känner igen producenten, skriv en beskrivning baserad på
  appellationen och årgången, och sätt confidence till "low".
- Hitta ALDRIG på fakta om ägarskap, historia eller utmärkelser. Om du inte
  är säker, utelämna det.

## DRUV-REGLER PER APPELLATION

**Högra stranden av Bordeaux (Saint-Émilion, Pomerol, Fronsac, Castillon,
Lalande de Pomerol, Côtes de Bourg, Cotes de Bordeaux):**
- Dominerande druva: Merlot (ofta 70–95%)
- Vanliga partners: Cabernet Franc
- Cabernet Sauvignon är OVANLIGT här — lägg INTE till det som standard
- Côtes de Bourg kan ha Malbec (särskilt hos producenter som Roc de Cambes)

**Vänstra stranden av Bordeaux (Médoc, Haut-Médoc, Saint-Julien, Pauillac,
Margaux, Saint-Estèphe, Graves, Pessac-Léognan):**
- Dominerande druva: Cabernet Sauvignon (ofta 50–70%)
- Vanliga partners: Merlot (20–40%), Cabernet Franc, Petit Verdot
- Petit Verdot är ofta 1–5% — nämn bara om du vet att det ingår

**Moderna Bordeaux (årgång 2010 och senare) har typiskt alkoholhalt
13,5–15 %.** Sätt inte 13 % om du inte har källa. Om du är osäker, använd
14 % eller null.

## ANDRAVIN-LOGIK

Om vinet heter något av följande mönster, är det troligen ett andravin från
en etablerad producent — nämn alltid kopplingen:

- "Pensees de la Tour Carnet" → andravin till Château La Tour Carnet
  (4ème Cru Classé, Haut-Médoc)
- "Les Allées de Cantemerle" → andravin till Château Cantemerle
  (5ème Cru Classé, Haut-Médoc)
- "Madame de Beaucaillou" → Ducru-Beaucaillous Haut-Médoc-vin (inte Ducru
  själv, som är 2ème Cru Classé i Saint-Julien)
- "La Chenade" → tillhör Denis Durantou (L'Église-Clinet i Pomerol, drivs
  idag av döttrarna Noémie och Constance)
- "Joanin Bécot" → ägs av familjen Bécot (Château Beau-Séjour Bécot,
  1er Grand Cru Classé B i Saint-Émilion)
- "Cap de Faugères" → ägs av Silvio Denz (Château Faugères i Saint-Émilion)
- "d'Aiguilhe" → ägs av Stephan von Neipperg (Canon La Gaffelière, La Mondotte)
- "Roc de Cambes" → François Mitjavile (Tertre-Roteboeuf). OBS: detta är
  ett kultvin i Côtes de Bourg, inte ett budget-vin.

Använd listan som fakta-check. Lägg INTE till kopplingar du inte känner till.

## SPRÅK-REGLER (MYCKET VIKTIGT)

- Skriv på korrekt, neutral svenska
- Undvik svengelska: skriv "druvsammansättning", inte "grape blend";
  "andravin", inte "second wine"; "fransk ek", inte "French oak"
- Undvik säljfraser: "prisvärt", "pålitligt dagsvin", "gott värde", "klassiker"
- Undvik marknadsföringstermer: "ostentativ", "kvalitetsalternativ", "solid"
- Kontrollera stavning: "grafit" (inte "graphit"), "rött kött" (inte "rötkött"),
  "kvalitet" (inte "kwalitet"), "noter" (inte "nötter" om det är smaknoter)
- Bordeaux ligger vid floden **Gironde**, inte Garonne. Médoc = vänster
  strand av Gironde.

## BESKRIVNINGS-MALL

Varje beskrivning ska täcka, i denna ordning:

1. **En mening om appellationen och vinets plats i producentens portfölj**
   (andravin? prestigecuvée? vanligt vin?)
2. **En mening om stil och smakprofil** (tanninstruktur, frukt, ekkaraktär)
3. **En mening om drickbarhet** (ungt nu, potential, serveringsförslag)
4. **Valfri fjärde mening med relevant kontext** (producentens ägarskap,
   lagring, eller årgångens karaktär — bara om du är säker)

Håll total längd 60–100 ord. Var konkret. Undvik tomma ord.

## SVART LISTA — fraser som aldrig ska användas

- "dagsvinsnivå"
- "värdeöverenskommelse"
- "klassisk fransk köket" (felaktig svenska — säg "franska köket")
- "ostentativ"
- "ett praktiskt restaurangvin"
- "pålitlig vardagsvin"
- "för restaurangkund som söker"
- "utan prestigspris"
- "mocka betongbaserade rätter" eller liknande meningslösa konstruktioner
- "kraftfull men tillgänglig" (cliché)
- "harmonisk och välbalanserad" (säger ingenting)

Svara ENBART med JSON-objektet. Inget annat.`;

const buildPrompt = (wine) => `Vinet som ska berikas:

Namn: ${wine.name}
Producent: ${wine.producer}
Land: ${wine.country}
Region: ${wine.region || 'okänd'}
Appellation: ${wine.appellation || 'okänd'}
Årgång: ${wine.vintage === 0 ? 'NV' : wine.vintage || 'okänd'}
Färg: ${wine.color}

Returnera JSON enligt schemat i system-prompten.`;

async function enrichWine(wine) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(wine) }],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Non-text response from Haiku');
  }

  // Extract JSON — may be wrapped in markdown code fence
  let jsonText = content.text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) jsonText = fenceMatch[1];

  const parsed = JSON.parse(jsonText);

  // Stödjer både nya (grape_composition/alcohol_percent) och gamla (grape/alcohol_pct) fältnamn
  const grape = parsed.grape_composition || parsed.grape;
  const alcohol = parsed.alcohol_percent ?? parsed.alcohol_pct;
  const confidence = (parsed.confidence || '').toLowerCase();

  return {
    grape: typeof grape === 'string' && grape.trim() ? grape.trim().slice(0, 200) : null,
    description: typeof parsed.description === 'string' && parsed.description.length >= 20 ? parsed.description.trim() : null,
    alcohol_pct: typeof alcohol === 'number' && alcohol > 0 && alcohol < 25 ? alcohol : null,
    confidence: ['high', 'medium', 'low'].includes(confidence) ? confidence : 'medium',
    _inputTokens: message.usage?.input_tokens || 0,
    _outputTokens: message.usage?.output_tokens || 0,
  };
}

// ============================================================================
// Style inference (samma logik som backfill-wine-styles.mjs, förenklad)
// ============================================================================

const COLOR_DEFAULTS = {
  red:        { body: 'medium', tannin: 'medium', acidity: 'medium' },
  white:      { body: 'light',  tannin: 'low',    acidity: 'medium' },
  rose:       { body: 'light',  tannin: 'low',    acidity: 'medium' },
  sparkling:  { body: 'light',  tannin: 'low',    acidity: 'high' },
  orange:     { body: 'medium', tannin: 'medium', acidity: 'medium' },
  fortified:  { body: 'full',   tannin: 'medium', acidity: 'medium' },
};

/**
 * Minimal style-inference — används bara om backfill-wine-styles.mjs
 * ska köras efter detta script. Här sätter vi bara color-fallback om
 * grape saknas, annars överlåter vi till backfill-skriptet.
 */
function colorFallback(color) {
  const c = (color || '').toLowerCase();
  return COLOR_DEFAULTS[c] || COLOR_DEFAULTS['red'];
}

// ============================================================================
// Main pipeline
// ============================================================================

async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN]' : '[LIVE]'} Batch-enrichment startar${LIMIT ? ` (limit ${LIMIT})` : ''}${SUPPLIER_FILTER ? ` (supplier ${SUPPLIER_FILTER})` : ''}\n`);

  // Fetch wines with missing critical fields
  let query = sb
    .from('supplier_wines')
    .select('id, supplier_id, name, producer, country, region, appellation, vintage, color, grape, description, alcohol_pct, body, tannin, acidity')
    .eq('status', 'ACTIVE')
    .or('grape.is.null,description.is.null,alcohol_pct.is.null');

  if (SUPPLIER_FILTER) query = query.eq('supplier_id', SUPPLIER_FILTER);
  if (LIMIT) query = query.limit(LIMIT);

  const { data: wines, error } = await query;
  if (error) {
    console.error('❌ Failed to fetch wines:', error.message);
    process.exit(1);
  }

  if (!wines || wines.length === 0) {
    console.log('✅ Inga viner behöver berikning.');
    return;
  }

  console.log(`Hittade ${wines.length} viner som behöver berikning.\n`);

  // Stats
  let enriched = 0;
  let skipped = 0;
  let errors = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const reviewRows = []; // For review-file output

  // Process with controlled concurrency
  const queue = [...wines];
  const workers = Array(CONCURRENCY).fill(null).map(async (_, workerId) => {
    while (queue.length > 0) {
      const wine = queue.shift();
      if (!wine) break;

      const progress = `[${wines.length - queue.length}/${wines.length}]`;
      try {
        const result = await enrichWine(wine);
        totalInputTokens += result._inputTokens;
        totalOutputTokens += result._outputTokens;

        // Build update: only fill NULL/empty fields from the wine
        const update = {};
        if (!wine.grape && result.grape) update.grape = result.grape;
        if ((!wine.description || wine.description.length < 20) && result.description) update.description = result.description;
        if (!wine.alcohol_pct && result.alcohol_pct) update.alcohol_pct = result.alcohol_pct;

        // Color-fallback for style if none set and no grape was inferred
        if (!wine.body && !wine.tannin && !wine.acidity && !result.grape) {
          const fallback = colorFallback(wine.color);
          update.body = fallback.body;
          update.tannin = fallback.tannin;
          update.acidity = fallback.acidity;
        }

        if (Object.keys(update).length === 0) {
          console.log(`${progress} ⊙ SKIPPED ${wine.name.slice(0, 50)} (inga luckor att fylla)`);
          skipped++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`${progress} [DRY] ${wine.name.slice(0, 50)} (confidence: ${result.confidence}):`);
          if (update.grape) console.log(`     grape → ${update.grape}`);
          if (update.alcohol_pct !== undefined) console.log(`     alcohol_pct → ${update.alcohol_pct ?? 'null'}`);
          if (update.description) console.log(`     description → ${update.description.slice(0, 80)}...`);
          if (REVIEW_FILE || JSON_FILE) {
            reviewRows.push({ wine, update, confidence: result.confidence });
          }
          enriched++;
          continue;
        }

        const { error: updateError } = await sb
          .from('supplier_wines')
          .update(update)
          .eq('id', wine.id);

        if (updateError) {
          console.error(`${progress} ✗ ERROR updating ${wine.name}: ${updateError.message}`);
          errors++;
        } else {
          console.log(`${progress} ✓ ${wine.name.slice(0, 50)} — ${Object.keys(update).join(', ')}`);
          enriched++;
        }
      } catch (err) {
        console.error(`${progress} ✗ ERROR ${wine.name}: ${err.message}`);
        errors++;
      }
    }
  });

  await Promise.all(workers);

  // Cost estimate
  const inputCost = (totalInputTokens / 1_000_000) * 1.0;
  const outputCost = (totalOutputTokens / 1_000_000) * 5.0;
  const totalCost = inputCost + outputCost;

  console.log(`\n================================================`);
  console.log(`KLART${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`================================================`);
  console.log(`Berikade:  ${enriched}`);
  console.log(`Hoppade över: ${skipped}`);
  console.log(`Errors:    ${errors}`);
  console.log(`Tokens:    ${totalInputTokens} in / ${totalOutputTokens} out`);
  console.log(`Kostnad:   $${totalCost.toFixed(4)} (~${(totalCost * 10.5).toFixed(2)} kr)`);
  console.log();

  if (!DRY_RUN && enriched > 0) {
    console.log('📝 Nästa steg: kör style-inference för de berikade vinerna:');
    console.log('   node scripts/backfill-wine-styles.mjs');
    console.log();
  }

  // Write review file
  if (REVIEW_FILE && reviewRows.length > 0) {
    const md = buildReviewMarkdown(reviewRows, { totalInputTokens, totalOutputTokens });
    writeFileSync(REVIEW_FILE, md, 'utf-8');
    console.log(`📄 Review-fil skriven: ${REVIEW_FILE} (${reviewRows.length} viner)\n`);
  }

  // Write JSON file for Python validator
  if (JSON_FILE && reviewRows.length > 0) {
    const validatorInput = reviewRows.map(({ wine, update }) => ({
      producer: wine.producer,
      wine_name: wine.name,
      appellation: wine.appellation || '',
      region: wine.region || '',
      vintage: wine.vintage,
      color: wine.color,
      grape_composition: update.grape || '',
      alcohol_percent: update.alcohol_pct ?? null,
      description: update.description || '',
    }));
    writeFileSync(JSON_FILE, JSON.stringify(validatorInput, null, 2), 'utf-8');
    console.log(`📦 JSON för validator: ${JSON_FILE} (${reviewRows.length} viner)\n`);
    console.log(`   Kör: python3 scripts/winefeed_validator.py ${JSON_FILE}`);
  }
}

function buildReviewMarkdown(rows, stats) {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let md = `# Winefeed AI-berikning — review\n\n`;
  md += `**Genererat:** ${timestamp}\n`;
  md += `**Antal viner:** ${rows.length}\n`;
  md += `**Modell:** claude-haiku-4-5-20251001\n`;
  md += `**Tokens:** ${stats.totalInputTokens} in / ${stats.totalOutputTokens} out\n\n`;
  md += `---\n\n`;
  md += `## Instruktion\n\n`;
  md += `För varje vin, verifiera att AI-genererad data stämmer:\n\n`;
  md += `- **Druva** — rimlig för region/appellation? Om nej, notera korrekt druva.\n`;
  md += `- **Alkohol %** — rimlig för stilen? Om nej, notera rätt värde (eller null).\n`;
  md += `- **Beskrivning** — faktabaserad, inte säljig, rätt region? Flagga sakfel.\n\n`;
  md += `Markera ❌ efter fält som behöver justeras, ✅ om det är OK.\n\n`;
  md += `---\n\n`;

  const confidenceBadge = { high: '🟢', medium: '🟡', low: '🔴' };
  rows.forEach((row, i) => {
    const { wine, update, confidence } = row;
    md += `### ${i + 1}. ${wine.name}  ${confidenceBadge[confidence] || ''} ${confidence || ''}\n\n`;
    md += `**Producent:** ${wine.producer} · **Land:** ${wine.country} · **Region:** ${wine.region || '—'} · **Appellation:** ${wine.appellation || '—'} · **Årgång:** ${wine.vintage === 0 ? 'NV' : wine.vintage || '—'} · **Färg:** ${wine.color}\n\n`;

    if (update.grape) {
      md += `**Druvsammansättning (AI):** ${update.grape}  \n`;
    }
    md += `**Alkoholhalt (AI):** ${update.alcohol_pct ?? '_null (AI osäker)_'}  \n`;
    if (update.description) {
      md += `\n**Beskrivning (AI):**\n> ${update.description.replace(/\n/g, '\n> ')}\n`;
    }

    md += `\n**Review:** \n\n`;
    md += `---\n\n`;
  });

  return md;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
