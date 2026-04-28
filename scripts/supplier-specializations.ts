import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type SpecType = 'country' | 'region' | 'appellation';

interface Suggestion {
  type: SpecType;
  value: string;
  count: number;
  pct: number;
}

const THRESHOLDS = {
  country: { pct: 0.10, min: 2 },
  region: { pct: 0.08, min: 2 },
  appellation: { pct: 0.05, min: 2 },
} as const;

function tally(rows: any[], field: 'country' | 'region' | 'appellation') {
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = (r[field] || '').trim();
    if (!v) continue;
    map.set(v, (map.get(v) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function buildSuggestions(active: any[]): Suggestion[] {
  const total = active.length;
  if (total === 0) return [];
  const out: Suggestion[] = [];

  for (const [v, n] of tally(active, 'country')) {
    if (n >= THRESHOLDS.country.min && n / total >= THRESHOLDS.country.pct) {
      out.push({ type: 'country', value: v, count: n, pct: n / total });
    }
  }
  for (const [v, n] of tally(active, 'region')) {
    if (n >= THRESHOLDS.region.min && n / total >= THRESHOLDS.region.pct) {
      out.push({ type: 'region', value: v, count: n, pct: n / total });
    }
  }
  for (const [v, n] of tally(active, 'appellation')) {
    if (n >= THRESHOLDS.appellation.min && n / total >= THRESHOLDS.appellation.pct) {
      out.push({ type: 'appellation', value: v, count: n, pct: n / total });
    }
  }

  // Dedupe: if a region and appellation share the same value, keep both
  // (different match semantics in fan-out) but mark with a note.
  return out;
}

async function processSupplier(supplier: { id: string; namn: string; type: string }, apply: boolean, skipExisting: boolean) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Supplier: ${supplier.namn}  (${supplier.id})`);

  const { data: wines } = await sb
    .from('supplier_wines')
    .select('country, region, appellation, is_active')
    .eq('supplier_id', supplier.id);

  const active = (wines || []).filter(w => w.is_active !== false);
  console.log(`Wines: ${wines?.length ?? 0} total, ${active.length} active`);

  if (active.length === 0) {
    console.log('  (skipping — no active wines)');
    return;
  }

  const suggestions = buildSuggestions(active);

  console.log(`\n  Suggestions (${suggestions.length}):`);
  if (suggestions.length === 0) {
    console.log('    (none — catalogue too small or too dispersed)');
  } else {
    for (const s of suggestions) {
      console.log(`    [${s.type.padEnd(11)}] ${s.value.padEnd(35)} ${String(s.count).padStart(3)} viner (${(s.pct * 100).toFixed(0)}%)`);
    }
  }

  const { data: existing } = await sb
    .from('supplier_specializations')
    .select('type, value')
    .eq('supplier_id', supplier.id);

  console.log(`\n  Existing (${existing?.length ?? 0}):`);
  if (!existing || existing.length === 0) {
    console.log('    (none)');
  } else {
    for (const s of existing) console.log(`    [${s.type}] ${s.value}`);
  }

  if (!apply) return;

  if (suggestions.length === 0) {
    console.log('  (apply skipped — no suggestions)');
    return;
  }

  if (skipExisting && existing && existing.length > 0) {
    console.log(`  (apply skipped — supplier already has ${existing.length} curated specializations; --skip-existing)`);
    return;
  }

  await sb.from('supplier_specializations').delete().eq('supplier_id', supplier.id);

  const rows = suggestions.map(s => ({
    supplier_id: supplier.id,
    type: s.type,
    value: s.value,
  }));

  const { data: inserted, error } = await sb
    .from('supplier_specializations')
    .insert(rows)
    .select('type, value');

  if (error) {
    console.error('  Insert error:', error);
    return;
  }
  console.log(`  ✓ Applied ${inserted?.length ?? 0} specializations`);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const allImporters = args.includes('--all-importers');
  const skipExisting = args.includes('--skip-existing');
  const supplierIdx = args.indexOf('--supplier');
  const supplierName = supplierIdx !== -1 ? args[supplierIdx + 1] : null;

  if (!allImporters && !supplierName) {
    console.log('Usage:');
    console.log('  --supplier "<partial-name>"     Analyze one supplier');
    console.log('  --all-importers                 Analyze all SWEDISH_IMPORTER suppliers');
    console.log('  --apply                         Replace specializations with suggestions');
    process.exit(1);
  }

  const { data: all } = await sb
    .from('suppliers')
    .select('id, namn, type, is_active')
    .eq('is_active', true)
    .order('namn');

  let targets = all || [];

  if (supplierName) {
    const needle = supplierName.toLowerCase();
    targets = targets.filter(s => (s.namn || '').toLowerCase().includes(needle));
  } else if (allImporters) {
    targets = targets.filter(s => s.type === 'SWEDISH_IMPORTER');
  }

  if (targets.length === 0) {
    console.log('No matching suppliers.');
    process.exit(1);
  }

  console.log(`Mode: ${apply ? 'APPLY' : 'analyze-only'}${skipExisting ? ' (skip-existing)' : ''}`);
  console.log(`Targets: ${targets.length} supplier(s)`);

  for (const t of targets) {
    await processSupplier(t, apply, skipExisting);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
