/**
 * Regex-baserad patch av svenska stavfel/quirks i AI-genererade beskrivningar.
 *
 * Säkert att köra flera gånger — idempotent. Skriver bara rader som faktiskt
 * ändrades.
 *
 * Usage:
 *   node scripts/fix-swedish-quirks.mjs --dry-run   # preview utan writes
 *   node scripts/fix-swedish-quirks.mjs             # kör skarpt
 *   node scripts/fix-swedish-quirks.mjs --supplier UUID  # per leverantör
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');
const SUPPLIER_FILTER = (() => {
  const idx = process.argv.indexOf('--supplier');
  return idx > -1 ? process.argv[idx + 1] : null;
})();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ============================================================================
// PATCH-REGLER
// ============================================================================
//
// Ordning spelar roll — de mer specifika kommer först, annars kan generella
// regler skriva över specifika (t.ex. "klassisk fransk köket" måste matchas
// innan "fransk köket" ersätts).

const PATCHES = [
  // Geografi-fel
  { pattern: /Garonnebränningen|garonnebränningen/g, replacement: 'Gironde-sidan' },
  { pattern: /floden Garonne\b/g, replacement: 'floden Gironde' },

  // Svengelska konstruktioner (flera ord)
  { pattern: /klassiska? franska? köket/g, replacement: 'det franska köket' },
  { pattern: /klassisk franskt kök\b/g, replacement: 'det franska köket' },

  // Stavfel
  { pattern: /violà/g, replacement: 'viol' },
  { pattern: /\bdrinkbar/g, replacement: 'drickbar' },
  { pattern: /\bmellanlundigt?\b/g, replacement: 'medelfyllig' },
  { pattern: /\bmellanlundiga\b/g, replacement: 'medelfylliga' },
  { pattern: /\bandelavin\b/g, replacement: 'andravin' },
  { pattern: /\bmediumkroppad\b/g, replacement: 'medelfyllig' },
  { pattern: /\bmediumkroppat\b/g, replacement: 'medelfylligt' },
  { pattern: /\bmediumkroppade\b/g, replacement: 'medelfylliga' },
  { pattern: /\bmediumkropp\b/g, replacement: 'medelfyllig' },

  // "Samordnad struktur" är inte svenska för wine context
  { pattern: /samordnad struktur/g, replacement: 'sammanhållen struktur' },
  { pattern: /samordnade strukturen/g, replacement: 'sammanhållna strukturen' },

  // "Tanninkstruktur" -> "tanninstruktur"
  { pattern: /tanninkstruktur/g, replacement: 'tanninstruktur' },

  // Generella AI-förbjudna cliché-konstruktioner (från Corentin's prompt)
  { pattern: /dagsvinsnivå/g, replacement: 'vardagsvin' },
  { pattern: /praktiskt restaurangvin/g, replacement: 'restaurangvin' },
  { pattern: /utan prestig[sj]pris\b/g, replacement: 'i prisvärt segment' },
  { pattern: /väderleksstabilitet/g, replacement: 'konsistens över årgångarna' },

  // Engelska som slunkit igenom
  { pattern: /\bgraphit\b/g, replacement: 'grafit' },
  { pattern: /\bkwalitet\b/g, replacement: 'kvalitet' },

  // "rötkött" — tvetydigt: ofta stavfel för "rött kött" men kan betyda "rotkött"
  // Flaggar inte automatiskt — låter manuell review fånga det.
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN]' : '[LIVE]'} Kör svenska grammatik-patch`);
  if (SUPPLIER_FILTER) console.log(`Filter: supplier_id=${SUPPLIER_FILTER}`);
  console.log(`${PATCHES.length} regex-regler aktiva\n`);

  let query = sb
    .from('supplier_wines')
    .select('id, name, description')
    .not('description', 'is', null);

  if (SUPPLIER_FILTER) query = query.eq('supplier_id', SUPPLIER_FILTER);

  const { data: wines, error } = await query;
  if (error) {
    console.error('❌ Fetch failed:', error.message);
    process.exit(1);
  }

  console.log(`Hittade ${wines.length} viner med beskrivning.\n`);

  let changed = 0;
  let unchanged = 0;
  const patchCounts = {};

  for (const wine of wines) {
    let newDesc = wine.description;
    const hitsThisWine = [];

    for (const { pattern, replacement } of PATCHES) {
      pattern.lastIndex = 0; // reset for global regex
      const matches = newDesc.match(pattern);
      if (matches) {
        hitsThisWine.push({ pattern: pattern.source, count: matches.length, replacement });
        newDesc = newDesc.replace(pattern, replacement);
        patchCounts[pattern.source] = (patchCounts[pattern.source] || 0) + matches.length;
      }
    }

    if (newDesc !== wine.description) {
      changed++;
      if (DRY_RUN || changed <= 3) {
        console.log(`✎ ${wine.name.slice(0, 50)}`);
        hitsThisWine.forEach(h => {
          console.log(`    /${h.pattern}/ → "${h.replacement}" (${h.count}x)`);
        });
      }

      if (!DRY_RUN) {
        const { error: updErr } = await sb
          .from('supplier_wines')
          .update({ description: newDesc })
          .eq('id', wine.id);
        if (updErr) console.error(`  ✗ Update failed for ${wine.id}: ${updErr.message}`);
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\n=== SUMMERING ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===`);
  console.log(`Ändrade:   ${changed}`);
  console.log(`Oförändrade: ${unchanged}`);
  console.log(`\nPatch-träffar per regel:`);
  Object.entries(patchCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pat, count]) => console.log(`  ${count.toString().padStart(4)} × /${pat}/`));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
