/**
 * AI Wine Description Generator
 *
 * Generates Swedish wine descriptions using free OpenRouter models.
 * Sommelier-style: aroma, flavor, character, food pairing.
 */

import { callOpenRouter } from './openrouter';

export interface WineForDescription {
  id: string;
  namn: string;
  producent?: string;
  land?: string;
  region?: string;
  druva?: string;
  color?: string;
  argang?: number;
  alkohol?: number;
  ekologisk?: boolean;
  biodynamiskt?: boolean;
  veganskt?: boolean;
  existing_description?: string;
}

const COLOR_LABELS: Record<string, string> = {
  red: 'Rött vin',
  white: 'Vitt vin',
  rose: 'Rosévin',
  sparkling: 'Mousserande vin',
  orange: 'Orangevin',
  fortified: 'Starkvin',
};

function buildPrompt(wine: WineForDescription): string {
  const parts: string[] = [];

  parts.push(`Vin: ${wine.namn}`);
  if (wine.producent) parts.push(`Producent: ${wine.producent}`);
  if (wine.color) parts.push(`Typ: ${COLOR_LABELS[wine.color] || wine.color}`);
  if (wine.land) parts.push(`Land: ${wine.land}${wine.region ? `, ${wine.region}` : ''}`);
  if (wine.druva) parts.push(`Druva: ${wine.druva}`);
  if (wine.argang && wine.argang > 0) parts.push(`Årgång: ${wine.argang}`);
  if (wine.alkohol) parts.push(`Alkohol: ${wine.alkohol}%`);

  const certs: string[] = [];
  if (wine.ekologisk) certs.push('ekologisk');
  if (wine.biodynamiskt) certs.push('biodynamisk');
  if (wine.veganskt) certs.push('vegansk');
  if (certs.length > 0) parts.push(`Certifiering: ${certs.join(', ')}`);

  if (wine.existing_description) {
    parts.push(`Befintlig kort beskrivning (engelska): ${wine.existing_description}`);
  }

  const wineInfo = parts.join('\n');

  return `Du är en erfaren sommelier som skriver vinbeskrivningar för en B2B-plattform riktad till svenska restauranger och krögare.

VININFORMATION:
${wineInfo}

SKRIV EN VINBESKRIVNING PÅ SVENSKA (3-5 meningar, ca 50-80 ord):

1. DOFT & SMAK: Beskriv vinets aromprofi konkret — vilka frukter, blommor, kryddor eller mineraler känns? Undvik generiska ord som "god" eller "trevlig".
2. KARAKTÄR: Beskriv kropp, syra, tanniner (rött), textur. Vad gör vinet unikt eller intressant?
3. MATFÖRSLAG: Avsluta med 2-3 specifika rätter eller råvaror som passar. Tänk som en sommelier som ger tips till en kock.

REGLER:
- Skriv ENBART beskrivningen, ingen rubrik, inget "Detta vin..."
- Professionell men varm ton — inte stelt, inte säljigt
- Använd sensoriska ord: "doftar av...", "smak av...", "påminner om..."
- Om vinet är ekologiskt/biodynamiskt, väv in det naturligt (inte som en rubrik)
- Svara BARA med beskrivningen`;
}

export async function generateWineDescription(
  wine: WineForDescription
): Promise<string> {
  const prompt = buildPrompt(wine);
  return callOpenRouter(prompt, 500);
}

export async function batchGenerateDescriptions(
  wines: WineForDescription[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const wine of wines) {
    try {
      const description = await generateWineDescription(wine);
      results.set(wine.id, description);
    } catch (error: any) {
      console.error(`❌ Failed to generate description for ${wine.id}: ${error.message}`);
    }

    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}
