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
  if (wine.argang) parts.push(`Årgång: ${wine.argang}`);
  if (wine.alkohol) parts.push(`Alkohol: ${wine.alkohol}%`);

  const certs: string[] = [];
  if (wine.ekologisk) certs.push('ekologisk');
  if (wine.biodynamiskt) certs.push('biodynamisk');
  if (wine.veganskt) certs.push('vegansk');
  if (certs.length > 0) parts.push(`Certifiering: ${certs.join(', ')}`);

  const wineInfo = parts.join('\n');

  return `Du är en erfaren sommelier. Skriv en kort vinbeskrivning på svenska (2-4 meningar).

VININFORMATION:
${wineInfo}

INSTRUKTIONER:
- Beskriv arom, smak och karaktär baserat på druva, region och vintyp
- Avsluta med ett kort matförslag
- Skriv i professionell men tillgänglig ton
- Svara ENBART med beskrivningen, ingen rubrik eller extra text
- Max 60 ord`;
}

export async function generateWineDescription(
  wine: WineForDescription
): Promise<string> {
  const prompt = buildPrompt(wine);
  return callOpenRouter(prompt, 300);
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
