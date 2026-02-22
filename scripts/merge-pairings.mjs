#!/usr/bin/env node
/**
 * Merge generated pairings into food-pairing.ts
 * Deduplicates against existing entries, filters out bad data.
 */

import { readFileSync } from 'fs';

// 1. Extract existing keys from food-pairing.ts
const fp = readFileSync('lib/matching-agent/food-pairing.ts', 'utf8');
const existing = new Set();
for (const m of fp.matchAll(/'([^']+)':\s*\{/g)) {
  existing.add(m[1].toLowerCase());
}

// 2. Read generated pairings
const gen = readFileSync('generated-pairings.txt', 'utf8');
const lines = gen.split('\n').filter(l => l.trim().startsWith("'"));

// 3. Bad patterns to filter out
const BAD_REGIONS = /västerbotten|västergötland|hälsinge|ligurische|göteborg|stockholm|skåne|norrland/i;
const BAD_GRAPES = /Västerbotten|Hälsinge|Skåne|Norrland/;

let added = 0, skipped = 0, bad = 0;
const output = [];

for (const line of lines) {
  const keyMatch = line.match(/'([^']+)':/);
  if (!keyMatch) continue;
  const key = keyMatch[1].toLowerCase();

  if (BAD_REGIONS.test(line) || BAD_GRAPES.test(line)) {
    bad++;
    console.error(`  SKIP (bad data): ${key}`);
    continue;
  }
  if (existing.has(key)) {
    skipped++;
    continue;
  }

  output.push(line.trim());
  added++;
}

console.error(`\nExisting: ${existing.size}, Generated: ${lines.length}`);
console.error(`Added: ${added}, Skipped (duplicate): ${skipped}, Filtered (bad): ${bad}`);
console.error(`\nNew total will be: ${existing.size + added}\n`);

// Output clean entries to stdout
for (const line of output) {
  console.log(line);
}
