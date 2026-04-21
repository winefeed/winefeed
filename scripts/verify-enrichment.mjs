/**
 * Multi-agent cross-check: kör samma vinsdata genom en ANNAN LLM (Sonnet 4.6)
 * och jämför med den första LLM:ens output (Haiku 4.5 från batch-enrich).
 *
 * Flaggar bara viner där modellerna är OENIGA på grape_composition eller
 * alcohol_percent. Korta listan går sedan till Corentin för human review.
 *
 * Input: JSON-fil från `batch-enrich-brasri.mjs --json-file`
 * Output: markdown-rapport med endast disagreements
 *
 * Usage:
 *   node scripts/verify-enrichment.mjs <input.json> <output.md>
 *   node scripts/verify-enrichment.mjs --concurrency 3 <input.json> <output.md>
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);
const CONCURRENCY = (() => {
  const idx = args.indexOf('--concurrency');
  return idx > -1 ? parseInt(args[idx + 1], 10) : 3;
})();
const positional = args.filter((a, i) => {
  if (a.startsWith('--')) return false;
  if (i > 0 && args[i - 1] === '--concurrency') return false;
  return true;
});

if (positional.length < 2) {
  console.error('Usage: node scripts/verify-enrichment.mjs <input.json> <output.md>');
  console.error('Optional: --concurrency N (default 3)');
  process.exit(1);
}

const [INPUT_FILE, OUTPUT_FILE] = positional;

// ============================================================================
// SETUP
// ============================================================================

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('❌ Saknar ANTHROPIC_API_KEY');
  process.exit(1);
}
const anthropic = new Anthropic({ apiKey });

// Same system prompt as batch-enrich — ensures apples-to-apples comparison
const SYSTEM_PROMPT = `Du är en fakta-driven vinkatalog-assistent för Winefeed. Du bygger strukturerad
data för en B2B-vinplattform där svenska restauranger söker vin.

## DRUV-REGLER PER APPELLATION

**Högra stranden av Bordeaux (Saint-Émilion, Pomerol, Fronsac, Castillon,
Lalande de Pomerol, Côtes de Bourg, Cotes de Bordeaux):**
- Dominerande druva: Merlot (70–95%)
- Vanliga partners: Cabernet Franc
- Cabernet Sauvignon är OVANLIGT här — lägg INTE till det som standard

**Vänstra stranden (Médoc, Haut-Médoc, Saint-Julien, Pauillac, Margaux,
Saint-Estèphe, Graves, Pessac-Léognan):**
- Dominerande druva: Cabernet Sauvignon (50–70%)
- Vanliga partners: Merlot (20–40%), Cabernet Franc, Petit Verdot

**Moderna Bordeaux (årgång 2010+)** har typiskt alkoholhalt 13,5–15 %.

## KÄLLKRITIK

- Om du inte är säker på druvsammansättningen, skriv en typisk för
  appellationen (inte specifik för producenten) och sätt confidence "medium".
- Om du inte vet alkoholhalten, returnera null. Gissa ALDRIG.

## OUTPUT-FORMAT

Returnera ett JSON-objekt:
{
  "grape_composition": "Merlot 75%, Cabernet Franc 25%",
  "alcohol_percent": 14.0,
  "confidence": "high|medium|low"
}

Svara ENBART JSON.`;

const buildPrompt = (wine) => `Vinet som ska berikas:

Namn: ${wine.wine_name}
Producent: ${wine.producer}
Land: ${wine.region?.split(',')[0] || 'okänd'}
Region: ${wine.region || 'okänd'}
Appellation: ${wine.appellation || 'okänd'}
Årgång: ${wine.vintage === 0 ? 'NV' : wine.vintage || 'okänd'}
Färg: ${wine.color}

Returnera JSON enligt schemat.`;

async function callSonnet(wine) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(wine) }],
  });

  const text = message.content[0]?.text || '';
  let jsonText = text.trim();
  const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) jsonText = fence[1];

  const parsed = JSON.parse(jsonText);
  return {
    grape: parsed.grape_composition || '',
    alcohol: parsed.alcohol_percent ?? null,
    confidence: (parsed.confidence || 'medium').toLowerCase(),
    _inputTokens: message.usage?.input_tokens || 0,
    _outputTokens: message.usage?.output_tokens || 0,
  };
}

// ============================================================================
// COMPARISON LOGIC
// ============================================================================

/** Strippa procent/siffror, splitta på separator, normalisera namn. */
function extractGrapes(grapeString) {
  if (!grapeString) return [];
  return grapeString
    .replace(/\d+[.,]?\d*\s*%?/g, '')  // strippa "75%", "12.5", etc
    .split(/[,/&+]/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function extractPrimaryGrape(grapeString) {
  const grapes = extractGrapes(grapeString);
  return grapes[0] || '';
}

function compareGrapes(haiku, sonnet) {
  const hGrapes = extractGrapes(haiku);
  const sGrapes = extractGrapes(sonnet);
  const hPrimary = hGrapes[0] || '';
  const sPrimary = sGrapes[0] || '';

  // Tom från båda sidor är OK
  if (!hPrimary && !sPrimary) return { level: 'agree', reason: null };

  // Major: olika primärdruva
  if (hPrimary && sPrimary && hPrimary !== sPrimary) {
    return { level: 'major', reason: `olika primärdruva: Haiku=${hPrimary} vs Sonnet=${sPrimary}` };
  }

  // Fullständig överlappning — båda listar identiska druvor (ignorera procent)
  const hSet = new Set(hGrapes);
  const sSet = new Set(sGrapes);
  const intersection = [...hSet].filter(g => sSet.has(g));
  const union = new Set([...hSet, ...sSet]);

  if (union.size === 0) return { level: 'agree', reason: null };
  const overlap = intersection.length / union.size;

  if (overlap >= 0.66) return { level: 'agree', reason: null };
  if (overlap >= 0.33) {
    return {
      level: 'minor',
      reason: `delvis olika blend: Haiku=[${[...hSet].join(', ')}] vs Sonnet=[${[...sSet].join(', ')}]`
    };
  }
  return {
    level: 'major',
    reason: `nästan ingen överlappning: Haiku=[${[...hSet].join(', ')}] vs Sonnet=[${[...sSet].join(', ')}]`
  };
}

function compareAlcohol(haiku, sonnet) {
  // Båda null = agree
  if (haiku == null && sonnet == null) return { level: 'agree', reason: null };

  // En modell avstod (null) och andra gav värde: inte oenighet,
  // bara att Sonnet var mer konservativ. Rapporteras som info, inte flagga.
  if (haiku == null || sonnet == null) {
    return { level: 'agree', reason: null };  // agree = visa inte
  }

  const diff = Math.abs(haiku - sonnet);
  if (diff >= 1.5) return { level: 'major', reason: `>1.5% skillnad: Haiku=${haiku}% vs Sonnet=${sonnet}%` };
  if (diff >= 1.0) return { level: 'minor', reason: `~1% skillnad: Haiku=${haiku}% vs Sonnet=${sonnet}%` };
  return { level: 'agree', reason: null };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const wines = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Läst ${wines.length} viner från ${INPUT_FILE}`);
  console.log(`Kör Sonnet 4.6 cross-check med concurrency ${CONCURRENCY}...\n`);

  const results = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let errors = 0;

  const queue = wines.map((w, i) => ({ wine: w, idx: i }));

  const workers = Array(CONCURRENCY).fill(null).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const { wine, idx } = item;

      try {
        const sonnet = await callSonnet(wine);
        totalInputTokens += sonnet._inputTokens;
        totalOutputTokens += sonnet._outputTokens;

        const grapeCompare = compareGrapes(wine.grape_composition, sonnet.grape);
        const alcoholCompare = compareAlcohol(wine.alcohol_percent, sonnet.alcohol);

        const hasDisagreement = grapeCompare.level !== 'agree' || alcoholCompare.level !== 'agree';

        results[idx] = {
          wine,
          sonnet,
          grapeCompare,
          alcoholCompare,
          hasDisagreement,
        };

        const marker = hasDisagreement ? '⚠️ ' : '✓ ';
        console.log(`${marker}[${wines.length - queue.length}/${wines.length}] ${wine.wine_name.slice(0, 50)}`);
      } catch (err) {
        console.error(`✗ ${wine.wine_name}: ${err.message}`);
        errors++;
      }
    }
  });

  await Promise.all(workers);

  // ============================================================================
  // WRITE REPORT
  // ============================================================================

  const disagreements = results.filter(r => r && r.hasDisagreement);
  const majorCount = disagreements.filter(d =>
    d.grapeCompare.level === 'major' || d.alcoholCompare.level === 'major'
  ).length;

  const cost = (totalInputTokens / 1_000_000) * 3.0 + (totalOutputTokens / 1_000_000) * 15.0;

  let md = `# Multi-Agent Cross-Check — Disagreements\n\n`;
  md += `**Genererat:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
  md += `**Modeller:** Haiku 4.5 (original) vs Sonnet 4.6 (verifiering)\n`;
  md += `**Viner totalt:** ${wines.length}\n`;
  md += `**Disagreements:** ${disagreements.length} (${((disagreements.length / wines.length) * 100).toFixed(0)}%)\n`;
  md += `  - 🔴 Major: ${majorCount}\n`;
  md += `  - 🟡 Minor: ${disagreements.length - majorCount}\n`;
  md += `**Sonnet-tokens:** ${totalInputTokens} in / ${totalOutputTokens} out\n`;
  md += `**Sonnet-kostnad:** $${cost.toFixed(3)} (~${(cost * 10.5).toFixed(2)} kr)\n`;
  md += `**Errors:** ${errors}\n\n`;
  md += `---\n\n`;
  md += `## Instruktion\n\n`;
  md += `Endast viner där Haiku 4.5 och Sonnet 4.6 är oeniga listas nedan. För varje vin:\n`;
  md += `avgör vem som har rätt (eller om båda är fel), och anteckna under \`Beslut:\`.\n\n`;
  md += `Om båda är rimliga — välj den mer konservativa.\n\n`;
  md += `---\n\n`;

  // Sort: major first, then minor
  disagreements.sort((a, b) => {
    const aMajor = a.grapeCompare.level === 'major' || a.alcoholCompare.level === 'major';
    const bMajor = b.grapeCompare.level === 'major' || b.alcoholCompare.level === 'major';
    if (aMajor !== bMajor) return bMajor - aMajor;
    return 0;
  });

  disagreements.forEach((r, i) => {
    const { wine, sonnet, grapeCompare, alcoholCompare } = r;
    const isMajor = grapeCompare.level === 'major' || alcoholCompare.level === 'major';
    const icon = isMajor ? '🔴' : '🟡';

    md += `### ${i + 1}. ${icon} ${wine.wine_name} ${wine.vintage ?? ''}\n\n`;
    md += `**Producent:** ${wine.producer} · **Appellation:** ${wine.appellation || '—'} · **Färg:** ${wine.color}\n\n`;

    if (grapeCompare.level !== 'agree') {
      md += `**Druva — ${grapeCompare.level.toUpperCase()} oenighet:**\n`;
      md += `- Haiku: \`${wine.grape_composition}\`\n`;
      md += `- Sonnet: \`${sonnet.grape}\`\n`;
      md += `- _${grapeCompare.reason}_\n\n`;
    }

    if (alcoholCompare.level !== 'agree') {
      md += `**Alkohol — ${alcoholCompare.level.toUpperCase()} oenighet:**\n`;
      md += `- Haiku: ${wine.alcohol_percent}%\n`;
      md += `- Sonnet: ${sonnet.alcohol}%\n`;
      md += `- _${alcoholCompare.reason}_\n\n`;
    }

    md += `**Beslut:** \n\n`;
    md += `---\n\n`;
  });

  if (disagreements.length === 0) {
    md += `## ✅ Inga disagreements\n\nBåda modellerna är överens på alla ${wines.length} viner.\n`;
  }

  writeFileSync(OUTPUT_FILE, md, 'utf-8');

  console.log(`\n================================================`);
  console.log(`KLART`);
  console.log(`================================================`);
  console.log(`Viner totalt:       ${wines.length}`);
  console.log(`Disagreements:      ${disagreements.length} (${majorCount} major, ${disagreements.length - majorCount} minor)`);
  console.log(`Sonnet tokens:      ${totalInputTokens} in / ${totalOutputTokens} out`);
  console.log(`Sonnet kostnad:     $${cost.toFixed(3)} (~${(cost * 10.5).toFixed(2)} kr)`);
  console.log(`Errors:             ${errors}`);
  console.log(`Rapport:            ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
