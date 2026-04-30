/**
 * Kör vintage-aware style-inference lokalt mot Brasris Tour-Calon-viner (TC* + BBA*).
 * Skriver body/tannin/acidity baserat på den nya inferWineStyle-funktionen.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { inferWineStyle } from '../lib/matching-agent/style-inference';

config({ path: '.env.local' });

const BRASRI_SUPPLIER_ID = 'a1111111-1111-1111-1111-111111111111';

async function main() {
  const apply = process.argv.includes('--apply');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: wines, error } = await sb
    .from('supplier_wines')
    .select('id, sku, name, vintage, grape, color, region, description, body, tannin, acidity')
    .eq('supplier_id', BRASRI_SUPPLIER_ID)
    .or('sku.like.TC%,sku.like.BBA%');

  if (error || !wines) {
    console.error('Fetch error:', error);
    process.exit(1);
  }

  console.log(`Hittade ${wines.length} Tour-Calon/Bonalgue-viner att enricha\n`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

  // Sortera på vintage för tydlig output
  wines.sort((a, b) => (a.vintage || 0) - (b.vintage || 0));

  const updates: { id: string; body: string; tannin: string; acidity: string }[] = [];

  for (const w of wines) {
    const style = inferWineStyle(
      w.grape || '',
      w.color || '',
      w.region || undefined,
      w.description || undefined,
      w.vintage ?? undefined
    );
    const changed = w.body !== style.body || w.tannin !== style.tannin || w.acidity !== style.acidity;
    if (changed) {
      updates.push({ id: w.id, body: style.body, tannin: style.tannin, acidity: style.acidity });
    }
    const flag = changed ? '★' : ' ';
    console.log(`  ${flag} ${w.sku.padEnd(10)} ${(w.vintage || '?').toString().padEnd(5)} ${(w.name || '').slice(0, 38).padEnd(38)} → body=${style.body.padEnd(7)} tannin=${style.tannin.padEnd(7)} acidity=${style.acidity}`);
  }

  console.log(`\n${updates.length} viner ändrar profil${apply ? ' — applicerar...' : ' (dry-run)'}`);

  if (apply && updates.length > 0) {
    let ok = 0;
    for (const u of updates) {
      const { error: upErr } = await sb
        .from('supplier_wines')
        .update({ body: u.body, tannin: u.tannin, acidity: u.acidity })
        .eq('id', u.id);
      if (!upErr) ok++;
      else console.error(`  ✗ ${u.id}: ${upErr.message}`);
    }
    console.log(`✓ ${ok}/${updates.length} uppdaterade`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
