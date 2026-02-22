#!/usr/bin/env node
/**
 * Clean generated pairings: fix only the regions field, leave grapes untouched.
 */

import { readFileSync } from 'fs';

const raw = readFileSync('new-pairings-clean.txt', 'utf8');
const lines = raw.split('\n').filter(l => l.trim().startsWith("'"));

// Bad region values → replacement wine regions
const BAD_REGIONS = {
  'thai': 'alsace',
  'kinesiskt': 'alsace',
  'vietnamesiskt': 'mosel',
  'indonesiskt': 'rhône',
  'malaysiskt': 'mosel',
  'singaporanskt': 'mosel',
  'laotiskt': 'loire',
  'kantonesiskt': 'alsace',
  'sichuan': 'alsace',
  'guangdong': 'provence',
  'kanton': 'provence',
  'israël': 'rhône',
  'libanon': 'rhône',
  'syrien': 'rhône',
  'mediterranea': 'rhône',
  'australiskt': 'barossa',
  'sumatras': 'barossa',
  'padang': 'mendoza',
  'xinjiang': 'mosel',
  'tawny': 'douro',
  'porto': 'douro',
  'piedmont': 'piemonte',
  'langhe': 'piemonte',
  // Grape names that ended up in regions
  'sauvignon blanc': 'marlborough',
  'cabernet sauvignon': 'napa valley',
  'tempranillo': 'rioja',
  'chenin blanc': 'vouvray',
  'chenin': 'vouvray',
  'pinot gris': 'alsace',
  'sangiovese': 'toscana',
};

// Manual entries for the 5 filtered bad ones
const MANUAL = [
  "  'surströmming': { colors: ['white'], regions: ['alsace', 'mosel'], grapes: ['Riesling', 'Gewürztraminer'] },",
  "  'gravlax': { colors: ['white', 'sparkling'], regions: ['chablis', 'champagne', 'alsace'], grapes: ['Chardonnay', 'Riesling', 'Pinot Noir'] },",
  "  'smörgåstårta': { colors: ['white', 'sparkling'], regions: ['champagne', 'bourgogne', 'alsace'], grapes: ['Chardonnay', 'Pinot Noir', 'Riesling'] },",
  "  'västerbottenpaj': { colors: ['white'], regions: ['bourgogne', 'chablis', 'alsace'], grapes: ['Chardonnay', 'Riesling'] },",
  "  'löjrom': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'sancerre'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },",
];

const output = [];

for (const line of lines) {
  // Parse the line to extract regions separately
  const regMatch = line.match(/regions: \[([^\]]+)\]/);
  const grapesMatch = line.match(/grapes: \[([^\]]+)\]/);
  const colorsMatch = line.match(/colors: \[([^\]]+)\]/);
  const nameMatch = line.match(/'([^']+)':/);

  if (!nameMatch || !regMatch || !colorsMatch) continue;

  const name = nameMatch[1];
  const colors = colorsMatch[1];
  const grapes = grapesMatch ? grapesMatch[1] : '';

  // Fix regions only
  let regions = regMatch[1].split(',').map(r => {
    const cleaned = r.trim().replace(/'/g, '').toLowerCase();
    return BAD_REGIONS[cleaned] || cleaned;
  });
  // Deduplicate
  regions = [...new Set(regions)];
  const regionsStr = regions.map(r => `'${r}'`).join(', ');

  output.push(`  '${name}': { colors: [${colors}], regions: [${regionsStr}], grapes: [${grapes}] },`);
}

output.push(...MANUAL);

console.error(`Cleaned ${output.length} entries`);
for (const line of output) {
  console.log(line);
}
