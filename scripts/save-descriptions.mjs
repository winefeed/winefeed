/**
 * Save new wine descriptions to Supabase
 * Preserves old description in description_original
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local
const envPath = join(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) process.env[match[1]] = match[2];
}

const SB_URL = 'https://pqmmgclfpyydrbjaoump.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const wines = JSON.parse(readFileSync(join(process.cwd(), 'scripts/new-descriptions.json'), 'utf-8'));

console.log(`Uppdaterar ${wines.length} viner...\n`);

let success = 0;
let failed = 0;

for (const wine of wines) {
  const body = {
    description: wine.new,
    description_source: 'ai',
  };

  // Preserve old description if it existed
  if (wine.old) {
    body.description_original = wine.old;
  }

  const res = await fetch(
    `${SB_URL}/rest/v1/supplier_wines?id=eq.${wine.id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(body),
    }
  );

  if (res.ok) {
    console.log(`  ✅ ${wine.name}`);
    success++;
  } else {
    const err = await res.text();
    console.log(`  ❌ ${wine.name}: ${err}`);
    failed++;
  }
}

console.log(`\n✅ ${success} uppdaterade, ❌ ${failed} misslyckade`);
