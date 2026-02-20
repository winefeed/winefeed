/**
 * Test: Brasri import pipeline (dry-run)
 *
 * Kör: npx tsx data/test-samples/test-brasri-import.ts
 *
 * Testar flattenBrasriItem, mapToWineInput och importBrasriCatalog (dry-run)
 * med Brasris faktiska vinkatalog i deras nestade JSON-format.
 */

import { flattenBrasriItem, mapToWineInput, importBrasriCatalog } from '../../lib/access-import';

// ============================================================================
// Brasri-data i deras nestade format (simulerat från verklig export)
// ============================================================================

function brasriField(fieldName: string, displayName: string, value: string) {
  return { fieldName, displayName, value };
}

const BRASRI_CATALOG_NESTED = [
  {
    productName: brasriField('productName', 'Product Name', 'Beaujolais Villages Blanc « Beur Blanc » 2024'),
    type: brasriField('type', 'Type', 'White'),
    vintage: brasriField('vintage', 'Vintage', '2024'),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Beaujolais'),
    producer: brasriField('producer', 'Producer', 'Karim Vionnet'),
    grape: brasriField('grape', 'Grape', 'Chardonnay'),
    price: brasriField('price', 'Price', '180'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Bourgogne Blanc'),
    type: brasriField('type', 'Type', 'White'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Bourgogne'),
    producer: brasriField('producer', 'Producer', 'Camille & Laurent Schaller'),
    grape: brasriField('grape', 'Grape', 'Chardonnay'),
    price: brasriField('price', 'Price', '170'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Carpe Libre'),
    type: brasriField('type', 'Type', 'Red'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Languedoc'),
    producer: brasriField('producer', 'Producer', 'Banjo Vino'),
    grape: brasriField('grape', 'Grape', 'Pinot Noir'),
    price: brasriField('price', 'Price', '150'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Chablis'),
    type: brasriField('type', 'Type', 'White'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Bourgogne'),
    producer: brasriField('producer', 'Producer', 'Camille & Laurent Schaller'),
    grape: brasriField('grape', 'Grape', 'Chardonnay'),
    price: brasriField('price', 'Price', '190'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Château Bonalgue Bel Air'),
    type: brasriField('type', 'Type', 'Red'),
    vintage: brasriField('vintage', 'Vintage', '2020'),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Bordeaux'),
    producer: brasriField('producer', 'Producer', 'Tour Calon'),
    grape: brasriField('grape', 'Grape', 'Merlot'),
    price: brasriField('price', 'Price', '400'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Château La Rose de Haut Mouschet'),
    type: brasriField('type', 'Type', 'Red'),
    vintage: brasriField('vintage', 'Vintage', '2022'),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Bordeaux'),
    producer: brasriField('producer', 'Producer', 'Tour Calon'),
    grape: brasriField('grape', 'Grape', 'Merlot, Cabernet Franc, Cabernet Sauvignon'),
    price: brasriField('price', 'Price', '150'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Château Tour Calon'),
    type: brasriField('type', 'Type', 'Red'),
    vintage: brasriField('vintage', 'Vintage', '2021'),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Bordeaux'),
    producer: brasriField('producer', 'Producer', 'Tour Calon'),
    grape: brasriField('grape', 'Grape', 'Merlot, Malbec'),
    price: brasriField('price', 'Price', '160'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Château Tour Calon Premier des Tours'),
    type: brasriField('type', 'Type', 'Red'),
    vintage: brasriField('vintage', 'Vintage', '2020'),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Bordeaux'),
    producer: brasriField('producer', 'Producer', 'Tour Calon'),
    grape: brasriField('grape', 'Grape', 'Merlot'),
    price: brasriField('price', 'Price', '220'),
  },
  {
    productName: brasriField('productName', 'Product Name', "Crémant d'Alsace Blanc"),
    type: brasriField('type', 'Type', 'Sparkling'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Alsace'),
    producer: brasriField('producer', 'Producer', 'G. Metz'),
    grape: brasriField('grape', 'Grape', 'Blend'),
    price: brasriField('price', 'Price', '160'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Crocodile Bock'),
    type: brasriField('type', 'Type', 'White'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Languedoc'),
    producer: brasriField('producer', 'Producer', 'Banjo Vino'),
    grape: brasriField('grape', 'Grape', 'Sauvignon Blanc'),
    price: brasriField('price', 'Price', '150'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Fleurie 2021'),
    type: brasriField('type', 'Type', 'Red'),
    vintage: brasriField('vintage', 'Vintage', '2021'),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Beaujolais'),
    producer: brasriField('producer', 'Producer', 'Karim Vionnet'),
    grape: brasriField('grape', 'Grape', 'Gamay'),
    price: brasriField('price', 'Price', '210'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Frankenstein – Blend'),
    type: brasriField('type', 'Type', 'White'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Alsace'),
    producer: brasriField('producer', 'Producer', 'Charles Frey'),
    grape: brasriField('grape', 'Grape', 'Riesling, Pinot Gris, Gewurztraminer'),
    price: brasriField('price', 'Price', '220'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Guru'),
    type: brasriField('type', 'Type', 'Red'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Rhône'),
    producer: brasriField('producer', 'Producer', 'Banjo Vino'),
    grape: brasriField('grape', 'Grape', 'Syrah, Grenache'),
    price: brasriField('price', 'Price', '150'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Josita'),
    type: brasriField('type', 'Type', 'Rosé'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Languedoc'),
    producer: brasriField('producer', 'Producer', 'Banjo Vino'),
    grape: brasriField('grape', 'Grape', 'Caladoc, Mourvèdre'),
    price: brasriField('price', 'Price', '150'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Macération - Dry'),
    type: brasriField('type', 'Type', 'Orange'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Alsace'),
    producer: brasriField('producer', 'Producer', 'Charles Frey'),
    grape: brasriField('grape', 'Grape', 'Gewurztraminer, Riesling'),
    price: brasriField('price', 'Price', '180'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Massé'),
    type: brasriField('type', 'Type', 'Orange'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Languedoc'),
    producer: brasriField('producer', 'Producer', 'Banjo Vino'),
    grape: brasriField('grape', 'Grape', 'Grenache BG, Roussanne, Viognier'),
    price: brasriField('price', 'Price', '150'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Pétillant Naturel (PET NAT)'),
    type: brasriField('type', 'Type', 'Sparkling'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Beaujolais'),
    producer: brasriField('producer', 'Producer', 'Karim Vionnet'),
    grape: brasriField('grape', 'Grape', 'Gamay'),
    price: brasriField('price', 'Price', '170'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'PetLat'),
    type: brasriField('type', 'Type', 'Sparkling'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Bordeaux'),
    producer: brasriField('producer', 'Producer', 'Lateyron'),
    grape: brasriField('grape', 'Grape', 'Sémillon'),
    price: brasriField('price', 'Price', '150'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Pinot Gris Symbiose - Dry'),
    type: brasriField('type', 'Type', 'White'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Alsace'),
    producer: brasriField('producer', 'Producer', 'Charles Frey'),
    grape: brasriField('grape', 'Grape', 'Pinot Gris'),
    price: brasriField('price', 'Price', '170'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Pinot Noir Harmonie - Dry'),
    type: brasriField('type', 'Type', 'Red'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Alsace'),
    producer: brasriField('producer', 'Producer', 'Charles Frey'),
    grape: brasriField('grape', 'Grape', 'Pinot Noir'),
    price: brasriField('price', 'Price', '170'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Riesling Granite - Dry'),
    type: brasriField('type', 'Type', 'White'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Alsace'),
    producer: brasriField('producer', 'Producer', 'Charles Frey'),
    grape: brasriField('grape', 'Grape', 'Riesling'),
    price: brasriField('price', 'Price', '170'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Tradition'),
    type: brasriField('type', 'Type', 'Red'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Languedoc'),
    producer: brasriField('producer', 'Producer', 'Clos Fantine'),
    grape: brasriField('grape', 'Grape', 'Carignan, Grenache, Syrah'),
    price: brasriField('price', 'Price', '180'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Wine Note Blanc – Natural wine'),
    type: brasriField('type', 'Type', 'White'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Alsace'),
    producer: brasriField('producer', 'Producer', 'G. Metz'),
    grape: brasriField('grape', 'Grape', 'Riesling'),
    price: brasriField('price', 'Price', '180'),
  },
  {
    productName: brasriField('productName', 'Product Name', 'Wine Note Orange – Natural wine'),
    type: brasriField('type', 'Type', 'Orange'),
    vintage: brasriField('vintage', 'Vintage', ''),
    Country: brasriField('Country', 'Country', 'France'),
    Region: brasriField('Region', 'Region', 'Alsace'),
    producer: brasriField('producer', 'Producer', 'G. Metz'),
    grape: brasriField('grape', 'Grape', 'Gewurztraminer'),
    price: brasriField('price', 'Price', '180'),
  },
];

// ============================================================================
// Test 1: flattenBrasriItem
// ============================================================================

console.log('='.repeat(80));
console.log('  TEST 1: flattenBrasriItem');
console.log('='.repeat(80));
console.log('');

const firstFlat = flattenBrasriItem(BRASRI_CATALOG_NESTED[0]);
console.log('Input (nested):');
console.log('  productName.value =', BRASRI_CATALOG_NESTED[0].productName.value);
console.log('  type.value        =', BRASRI_CATALOG_NESTED[0].type.value);
console.log('');
console.log('Output (flat):');
for (const [k, v] of Object.entries(firstFlat)) {
  console.log(`  ${k.padEnd(15)} = ${v}`);
}

// Test with already-flat data
const alreadyFlat = flattenBrasriItem({
  productName: 'Test Wine',
  type: 'Red',
  Country: 'Italy',
  Region: 'Toscana',
  producer: 'Test Producer',
});
console.log('\nAlready-flat input works:', alreadyFlat.productName === 'Test Wine' ? 'PASS' : 'FAIL');

console.log('');

// ============================================================================
// Test 2: mapToWineInput
// ============================================================================

console.log('='.repeat(80));
console.log('  TEST 2: mapToWineInput');
console.log('='.repeat(80));
console.log('');

let passCount = 0;
let failCount = 0;

for (const item of BRASRI_CATALOG_NESTED) {
  const flat = flattenBrasriItem(item);
  const { wine, producerName, price } = mapToWineInput(flat);

  const checks = [
    { label: 'name', ok: !!wine.name },
    { label: 'wine_type', ok: !!wine.wine_type && ['red', 'white', 'rose', 'sparkling', 'fortified', 'orange'].includes(wine.wine_type) },
    { label: 'country', ok: wine.country === 'France' },
    { label: 'region', ok: !!wine.region },
    { label: 'producer', ok: !!producerName },
    { label: 'status', ok: wine.status === 'DRAFT' },
    { label: 'volume_ml', ok: wine.volume_ml === 750 },
  ];

  const failures = checks.filter(c => !c.ok);
  if (failures.length > 0) {
    console.log(`FAIL: ${wine.name}`);
    for (const f of failures) {
      console.log(`  - ${f.label}: got ${(wine as any)[f.label]}`);
    }
    failCount++;
  } else {
    passCount++;
  }
}

console.log(`\nResults: ${passCount} PASS, ${failCount} FAIL out of ${BRASRI_CATALOG_NESTED.length}`);
console.log('');

// Show detailed mapping for a few wines
const sampleIndices = [0, 4, 8, 13, 14];
console.log('Sample mappings:');
console.log('-'.repeat(80));
for (const i of sampleIndices) {
  const flat = flattenBrasriItem(BRASRI_CATALOG_NESTED[i]);
  const { wine, producerName, price } = mapToWineInput(flat);
  console.log(`  ${wine.name}`);
  console.log(`    type: ${wine.wine_type} | vintage: ${wine.vintage ?? 'NV'} | country: ${wine.country}`);
  console.log(`    region: ${wine.region} | grape: ${wine.grape}`);
  console.log(`    producer: ${producerName} | price: ${price} SEK`);
  console.log('');
}

// ============================================================================
// Test 3: mapToWineInput — country enrichment from region
// ============================================================================

console.log('='.repeat(80));
console.log('  TEST 3: Country enrichment (region -> country fallback)');
console.log('='.repeat(80));
console.log('');

const noCountryItem = flattenBrasriItem({
  productName: brasriField('productName', 'Product Name', 'Test Barolo'),
  type: brasriField('type', 'Type', 'Red'),
  vintage: brasriField('vintage', 'Vintage', '2019'),
  Country: brasriField('Country', 'Country', ''),
  Region: brasriField('Region', 'Region', 'Barolo'),
  producer: brasriField('producer', 'Producer', 'Test Producer'),
  grape: brasriField('grape', 'Grape', 'Nebbiolo'),
  price: brasriField('price', 'Price', '350'),
});

const { wine: enrichedWine } = mapToWineInput(noCountryItem);
console.log(`  Input:  Country="" Region="Barolo"`);
console.log(`  Output: country="${enrichedWine.country}" (expected: "Italy")`);
console.log(`  Result: ${enrichedWine.country === 'Italy' ? 'PASS' : 'FAIL'}`);
console.log('');

// Test Swedish country alias
const swedishCountry = flattenBrasriItem({
  productName: brasriField('productName', 'Product Name', 'Test Rioja'),
  type: brasriField('type', 'Type', 'Tinto'),
  Region: brasriField('Region', 'Region', 'Rioja'),
  Country: brasriField('Country', 'Country', 'Spanien'),
  producer: brasriField('producer', 'Producer', 'Test Bodega'),
  grape: brasriField('grape', 'Grape', 'Tempranillo'),
  price: brasriField('price', 'Price', '200'),
});

const { wine: spanishWine } = mapToWineInput(swedishCountry);
console.log(`  Input:  Country="Spanien"`);
console.log(`  Output: country="${spanishWine.country}" (expected: "Spain")`);
console.log(`  Result: ${spanishWine.country === 'Spain' ? 'PASS' : 'FAIL'}`);
console.log('');

// Test color alias (Tinto -> red)
console.log(`  Input:  type="Tinto"`);
console.log(`  Output: wine_type="${spanishWine.wine_type}" (expected: "red")`);
console.log(`  Result: ${spanishWine.wine_type === 'red' ? 'PASS' : 'FAIL'}`);
console.log('');

// ============================================================================
// Test 4: importBrasriCatalog — dry run
// ============================================================================

console.log('='.repeat(80));
console.log('  TEST 4: importBrasriCatalog (dry run)');
console.log('='.repeat(80));
console.log('');

async function testDryRun() {
  const result = await importBrasriCatalog(
    BRASRI_CATALOG_NESTED,
    'Brasri AB',
    { dryRun: true },
  );

  console.log(`  Total:   ${result.total}`);
  console.log(`  Created: ${result.created} (dry run — always 0)`);
  console.log(`  Skipped: ${result.skipped}`);
  console.log(`  Errors:  ${result.errors.length}`);
  console.log(`  Preview: ${result.wines.length} wines`);
  console.log('');

  if (result.errors.length > 0) {
    console.log('  Errors:');
    for (const err of result.errors) {
      console.log(`    [${err.index}] ${err.name}: ${err.reason}`);
    }
    console.log('');
  }

  // Show type distribution
  const typeCount: Record<string, number> = {};
  for (const w of result.wines) {
    typeCount[w.wine_type] = (typeCount[w.wine_type] || 0) + 1;
  }
  console.log('  Type distribution:');
  for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(12)} ${count}`);
  }
  console.log('');

  // Show producer distribution
  const prodCount: Record<string, number> = {};
  for (const w of result.wines) {
    prodCount[w.producer] = (prodCount[w.producer] || 0) + 1;
  }
  console.log('  Producer distribution:');
  for (const [prod, count] of Object.entries(prodCount).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${prod.padEnd(30)} ${count}`);
  }
  console.log('');

  // Show full preview table
  console.log('  Preview:');
  console.log(`  ${'#'.padStart(3)} ${'Name'.padEnd(45)} ${'Type'.padEnd(12)} ${'Producer'.padEnd(30)}`);
  console.log('  ' + '-'.repeat(93));
  for (let i = 0; i < result.wines.length; i++) {
    const w = result.wines[i];
    console.log(`  ${String(i + 1).padStart(3)} ${w.name.substring(0, 43).padEnd(45)} ${w.wine_type.padEnd(12)} ${w.producer.padEnd(30)}`);
  }

  console.log('');
  console.log(`  Dry run: ${result.wines.length === BRASRI_CATALOG_NESTED.length && result.errors.length === 0 ? 'PASS' : 'FAIL'}`);
}

// ============================================================================
// Test 5: Validation — missing fields should be skipped
// ============================================================================

async function testValidation() {
  console.log('='.repeat(80));
  console.log('  TEST 5: Validation (missing fields -> skipped)');
  console.log('='.repeat(80));
  console.log('');

  const badItems = [
    // Missing name
    {
      productName: brasriField('productName', 'Product Name', ''),
      type: brasriField('type', 'Type', 'Red'),
      Country: brasriField('Country', 'Country', 'France'),
      Region: brasriField('Region', 'Region', 'Bordeaux'),
      producer: brasriField('producer', 'Producer', 'Test'),
    },
    // Missing country AND region (no fallback possible)
    {
      productName: brasriField('productName', 'Product Name', 'Orphan Wine'),
      type: brasriField('type', 'Type', 'White'),
      Country: brasriField('Country', 'Country', ''),
      Region: brasriField('Region', 'Region', ''),
      producer: brasriField('producer', 'Producer', 'Nobody'),
    },
    // Valid wine (should pass)
    {
      productName: brasriField('productName', 'Product Name', 'Good Wine'),
      type: brasriField('type', 'Type', 'Red'),
      Country: brasriField('Country', 'Country', 'Italy'),
      Region: brasriField('Region', 'Region', 'Toscana'),
      producer: brasriField('producer', 'Producer', 'Good Producer'),
      grape: brasriField('grape', 'Grape', 'Sangiovese'),
      price: brasriField('price', 'Price', '250'),
    },
  ];

  const result = await importBrasriCatalog(badItems, 'Test Importer', { dryRun: true });

  console.log(`  Total:   ${result.total}`);
  console.log(`  Preview: ${result.wines.length} (expected: 1)`);
  console.log(`  Skipped: ${result.skipped} (expected: 2)`);
  console.log(`  Errors:  ${result.errors.length}`);

  for (const err of result.errors) {
    console.log(`    [${err.index}] ${err.name}: ${err.reason}`);
  }

  console.log(`\n  Validation test: ${result.wines.length === 1 && result.skipped === 2 ? 'PASS' : 'FAIL'}`);
}

// Run all tests
testDryRun()
  .then(() => testValidation())
  .then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('  ALL TESTS COMPLETE');
    console.log('='.repeat(80));
  })
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
