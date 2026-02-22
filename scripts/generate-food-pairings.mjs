#!/usr/bin/env node
/**
 * Generate expanded food-pairing dictionary via Claude Haiku.
 *
 * Usage:  node scripts/generate-food-pairings.mjs
 * Output: Prints TypeScript entries to stdout. Pipe to file if wanted.
 *
 * Cost: ~$0.03 for all 280 dishes (Haiku pricing)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('❌ ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey });

// ============================================================================
// Dishes to generate pairings for
// ============================================================================

const DISHES = [
  // --- Swedish classics ---
  'köttbullar', 'raggmunk', 'pytt i panna', 'ärtsoppa', 'blodpudding',
  'kroppkakor', 'palt', 'pitepalt', 'rotmos', 'bruna bönor',
  'falukorv', 'prinskorv', 'revbensspjäll', 'fläskfilé', 'fläskkarré',
  'sylta', 'lutfisk', 'surströmming', 'gravlax', 'laxpudding',
  'janssons frestelse', 'smörgåstårta', 'västerbottenpaj', 'löjrom',
  'toast skagen', 'räksmörgås', 'skagenröra', 'kräftor', 'krabba',
  'renskav', 'renstek', 'älgstek', 'viltfärslimpa', 'hjortfilé',
  'fasan', 'rapphöna', 'tjäder', 'korv stroganoff',

  // --- Italian ---
  'carbonara', 'bolognese', 'lasagne', 'risotto', 'osso buco',
  'vitello tonnato', 'saltimbocca', 'bruschetta', 'antipasto',
  'gnocchi', 'ravioli', 'tortellini', 'pappardelle', 'tagliatelle',
  'prosciutto', 'burrata', 'caprese', 'panna cotta', 'tiramisu',
  'focaccia', 'minestrone', 'ribollita', 'arancini', 'fritto misto',
  'piccata', 'parmigiana', 'cacciatore', 'arrabiata', 'puttanesca',
  'amatriciana', 'cacio e pepe', 'aglio olio', 'primavera',
  'frutti di mare', 'vongole',

  // --- French ---
  'coq au vin', 'boeuf bourguignon', 'ratatouille', 'bouillabaisse',
  'cassoulet', 'confit de canard', 'magret de canard', 'foie gras',
  'quiche lorraine', 'soupe à l\'oignon', 'escargot', 'moules frites',
  'steak frites', 'blanquette de veau', 'pot-au-feu', 'navarin',
  'tarte tatin', 'crème brûlée', 'gratin dauphinois',
  'salade niçoise', 'béarnaise', 'hollandaise',

  // --- Spanish ---
  'paella', 'tapas', 'gazpacho', 'patatas bravas', 'tortilla española',
  'jamón ibérico', 'chorizo', 'gambas al ajillo', 'pulpo a la gallega',
  'pimientos de padrón', 'croquetas', 'albondigas',

  // --- Greek / Mediterranean ---
  'moussaka', 'souvlaki', 'gyros', 'tzatziki', 'spanakopita',
  'dolma', 'kleftiko', 'pastitsio', 'saganaki', 'horiatiki',
  'hummus', 'falafel', 'baba ganoush', 'shakshuka', 'fattoush',
  'tabbouleh', 'kibbeh', 'shawarma',

  // --- Asian ---
  'sushi', 'sashimi', 'ramen', 'pad thai', 'phở',
  'dim sum', 'dumpling', 'wonton', 'peking duck', 'kung pao',
  'sweet and sour', 'mapo tofu', 'char siu', 'bao buns',
  'green curry', 'red curry', 'massaman curry', 'tom yum',
  'tom kha', 'larb', 'som tam', 'satay', 'rendang',
  'nasi goreng', 'laksa', 'bibimbap', 'bulgogi', 'kimchi jjigae',
  'japchae', 'katsu', 'tempura', 'yakitori', 'okonomiyaki',
  'gyoza', 'edamame', 'miso soup',
  'tikka masala', 'butter chicken', 'vindaloo', 'korma',
  'biryani', 'dal', 'palak paneer', 'tandoori', 'naan',
  'samosa', 'pakora',

  // --- Mexican / Latin ---
  'tacos', 'burrito', 'enchiladas', 'tamales', 'mole',
  'ceviche', 'empanadas', 'arepas', 'chimichurri',

  // --- American / Modern ---
  'burger', 'pulled pork', 'bbq ribs', 'mac and cheese',
  'clam chowder', 'lobster roll', 'fish and chips', 'chicken wings',
  'caesar salad', 'cobb salad', 'poke bowl',

  // --- Seafood ---
  'hummer', 'ostron', 'musslor', 'pilgrimsmussla', 'räkor',
  'tonfisk', 'svärdfisk', 'havskatt', 'torsk', 'kolja',
  'abborre', 'gös', 'röding', 'öring', 'piggvar',
  'sjötunga', 'sardiner', 'ansjovis', 'bläckfisk', 'calamari',

  // --- Vegetariskt ---
  'vegansk bowl', 'quinoa', 'edamame bowl', 'portobello',
  'grillad aubergine', 'rostad blomkål', 'rostade rödbetor',
  'zucchinipasta', 'linssoppa', 'daal', 'grönkålssallad',
  'svamp risotto', 'tryffel', 'sparris', 'kronärtskocka',

  // --- Ost ---
  'ostbricka', 'fondue', 'raclette', 'gratinerad getost',
  'mozzarella', 'gorgonzola', 'pecorino', 'comté', 'brie',
  'roquefort', 'manchego', 'stilton', 'parmesan',

  // --- Brunch ---
  'eggs benedict', 'croque monsieur', 'smörrebröd', 'plättar',
  'pannkakor', 'french toast', 'avokado toast', 'bagel med lax',

  // --- Dessert ---
  'chokladfondant', 'cheesecake', 'fruktpaj',
  'äppelpaj', 'kladdkaka', 'mousse au chocolat', 'tarte au citron',
  'profiteroles', 'pannacotta',

  // --- Street food ---
  'pizza', 'kebab', 'wrap', 'quesadilla', 'nachos',
  'crêpes', 'spring rolls', 'banh mi',

  // --- Tillagningsstilar ---
  'grillat kött', 'rökt fisk', 'friterad kyckling', 'stekt fläsk',
  'kokt hummer', 'ugnsrostad kyckling', 'confiterat', 'sous vide',
  'carpaccio',
];

// ============================================================================
// Call Claude Haiku
// ============================================================================

async function callHaiku(systemPrompt, userPrompt, maxTokens = 4000) {
  const msg = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return msg.content[0].text.trim();
}

// ============================================================================
// Generate pairings in batches
// ============================================================================

async function generateBatch(dishes) {
  const systemPrompt = 'Svara ENBART med valid JSON. Inga kommentarer.';

  const userPrompt = `Ge vinpairings för dessa rätter. Format: {"r":[{"n":"namn","c":["red"],"re":["bordeaux"],"g":["Cabernet Sauvignon"]}]}

c = colors: red/white/rose/sparkling (max 2 per rätt)
re = VINREGIONER (inte länder!): bordeaux, bourgogne, rhône, rioja, toscana, piemonte, barolo, chianti, mosel, alsace, champagne, loire, provence, languedoc, barossa, marlborough, mendoza, napa valley, willamette, ribera del duero, priorat, douro, alentejo, naoussa, etna, sicilien, chablis, beaujolais, sancerre, vouvray, stellenbosch
g = druvor med stor bokstav (max 4)

Klassiska sommelier-pairings. Rätter: ${dishes.join(', ')}`;

  const raw = await callHaiku(systemPrompt, userPrompt, 4000);

  // Extract JSON
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('  ❌ Could not extract JSON');
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    // Map compact format back to full names
    return (parsed.r || []).map(d => ({
      namn: (d.n || '').toLowerCase(),
      colors: d.c || [],
      regions: d.re || [],
      grapes: d.g || [],
    }));
  } catch (e) {
    console.error('  ❌ JSON parse error:', e.message);
    // Try fixing trailing commas
    try {
      const fixed = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      const parsed = JSON.parse(fixed);
      return (parsed.r || []).map(d => ({
        namn: (d.n || '').toLowerCase(),
        colors: d.c || [],
        regions: d.re || [],
        grapes: d.g || [],
      }));
    } catch {
      return [];
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.error(`🍷 Generating food pairings for ${DISHES.length} dishes via Claude Haiku...\n`);

  const BATCH_SIZE = 30;
  const allResults = [];

  for (let i = 0; i < DISHES.length; i += BATCH_SIZE) {
    const batch = DISHES.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(DISHES.length / BATCH_SIZE);

    console.error(`  Batch ${batchNum}/${totalBatches} (${batch.length} dishes)...`);

    try {
      const results = await generateBatch(batch);
      allResults.push(...results);
      console.error(`    ✅ Got ${results.length} pairings`);
    } catch (e) {
      console.error(`    ❌ Batch failed: ${e.message}`);
    }

    // Small pause between batches
    if (i + BATCH_SIZE < DISHES.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.error(`\n✅ Generated ${allResults.length} pairings total\n`);

  // Output as TypeScript
  console.log('  // ==========================================================================');
  console.log('  // AUTO-GENERATED — AI sommelier pairings');
  console.log(`  // Generated: ${new Date().toISOString().split('T')[0]}`);
  console.log(`  // Source: Claude Haiku (${allResults.length} dishes)`);
  console.log('  // ==========================================================================');

  for (const dish of allResults) {
    const name = (dish.namn || '').toLowerCase().trim();
    if (!name) continue;

    const colors = (dish.colors || []).map(c => `'${c}'`).join(', ');
    const regions = (dish.regions || []).map(r => `'${r.toLowerCase().trim()}'`).join(', ');
    const grapes = (dish.grapes || []).map(g => `'${g.trim()}'`).join(', ');

    console.log(`  '${name}': { colors: [${colors}], regions: [${regions}], grapes: [${grapes}] },`);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
