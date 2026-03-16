/**
 * Preview AI-generated wine descriptions (does NOT save to database)
 *
 * Usage: node scripts/preview-descriptions.mjs
 */

const SB_URL = 'https://pqmmgclfpyydrbjaoump.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OR_KEY = process.env.OPENROUTER_API_KEY;

if (!SB_KEY || !OR_KEY) {
  // Try reading from .env.local
  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) {
        process.env[match[1]] = match[2];
      }
    }
  }
}

const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const orKey = process.env.OPENROUTER_API_KEY;

if (!sbKey || !orKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or OPENROUTER_API_KEY');
  process.exit(1);
}

const COLOR_LABELS = {
  red: 'Rött vin',
  white: 'Vitt vin',
  rose: 'Rosévin',
  sparkling: 'Mousserande vin',
  orange: 'Orangevin',
  fortified: 'Starkvin',
};

function buildPrompt(wine) {
  const parts = [];
  parts.push(`Vin: ${wine.name}`);
  if (wine.producer) parts.push(`Producent: ${wine.producer}`);
  if (wine.color) parts.push(`Typ: ${COLOR_LABELS[wine.color] || wine.color}`);
  if (wine.country) parts.push(`Land: ${wine.country}${wine.region ? `, ${wine.region}` : ''}`);
  if (wine.grape) parts.push(`Druva: ${wine.grape}`);
  if (wine.vintage && wine.vintage > 0) parts.push(`Årgång: ${wine.vintage}`);
  if (wine.alcohol_pct) parts.push(`Alkohol: ${wine.alcohol_pct}%`);

  const certs = [];
  if (wine.organic) certs.push('ekologisk');
  if (wine.biodynamic) certs.push('biodynamisk');
  if (certs.length > 0) parts.push(`Certifiering: ${certs.join(', ')}`);

  if (wine.description) {
    parts.push(`Befintlig kort beskrivning (engelska): ${wine.description}`);
  }

  const wineInfo = parts.join('\n');

  return `Du är en erfaren sommelier som skriver vinbeskrivningar för en B2B-plattform riktad till svenska restauranger och krögare.

VININFORMATION:
${wineInfo}

SKRIV EN VINBESKRIVNING PÅ SVENSKA (3-5 meningar, ca 50-80 ord):

1. DOFT & SMAK: Beskriv vinets aromprofil konkret — vilka frukter, blommor, kryddor eller mineraler känns? Undvik generiska ord som "god" eller "trevlig".
2. KARAKTÄR: Beskriv kropp, syra, tanniner (rött), textur. Vad gör vinet unikt eller intressant?
3. MATFÖRSLAG: Avsluta med 2-3 specifika rätter eller råvaror som passar. Tänk som en sommelier som ger tips till en kock.

REGLER:
- Skriv ENBART beskrivningen, ingen rubrik, inget "Detta vin..."
- Professionell men varm ton — inte stelt, inte säljigt
- Använd sensoriska ord: "doftar av...", "smak av...", "påminner om..."
- Om vinet är ekologiskt/biodynamiskt, väv in det naturligt (inte som en rubrik)
- Svara BARA med beskrivningen`;
}

const MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
];

async function callOpenRouter(prompt) {
  for (const model of MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        console.warn(`  ⚠ ${model} → ${res.status}, trying next...`);
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        console.warn(`  ⚠ ${model} → empty response, trying next...`);
        continue;
      }
      return text.trim();
    } catch (e) {
      console.warn(`  ⚠ ${model} failed: ${e.message}`);
      continue;
    }
  }
  return null;
}

// Fetch all wines
console.log('Hämtar alla viner...\n');
const res = await fetch(
  `${SB_URL}/rest/v1/supplier_wines?select=id,name,producer,grape,color,country,region,vintage,alcohol_pct,organic,biodynamic,description,description_source&order=name`,
  {
    headers: {
      'apikey': sbKey,
      'Authorization': `Bearer ${sbKey}`,
    },
  }
);

const wines = await res.json();
console.log(`Hittade ${wines.length} viner. Genererar nya beskrivningar...\n`);
console.log('='.repeat(80));

for (const wine of wines) {
  console.log(`\n🍷 ${wine.name} (${wine.producer})`);
  console.log(`   ${wine.grape} | ${wine.color} | ${wine.country}, ${wine.region}`);
  if (wine.description) {
    console.log(`   NUVARANDE: "${wine.description}"`);
  } else {
    console.log(`   NUVARANDE: (saknas)`);
  }

  const prompt = buildPrompt(wine);
  const newDesc = await callOpenRouter(prompt);

  if (newDesc) {
    console.log(`   NY:        "${newDesc}"`);
  } else {
    console.log(`   ❌ Kunde inte generera`);
  }

  console.log('-'.repeat(80));

  // Rate limit
  await new Promise(r => setTimeout(r, 1500));
}

console.log('\n✅ Klar! Inga ändringar sparade — detta var bara en förhandsgranskning.');
