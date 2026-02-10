import { callClaude } from './claude';
import type { ScoredWine, MergedPreferences } from '../matching-agent/types';

export interface Wine {
  id: string;
  namn: string;
  producent: string;
  land: string;
  region?: string;
  appellation?: string;
  druva?: string;
  color?: string;
  argang?: number;
  pris_sek: number;
  beskrivning?: string;
  // Extended details
  alkohol?: number;
  volym_ml?: number;
  sku?: string;
  lager?: number;
  moq?: number;
  kartong?: number;
  ledtid_dagar?: number;
  // Legacy fields
  ekologisk?: boolean;
  biodynamiskt?: boolean;
  veganskt?: boolean;
}

export interface RankedWine extends Wine {
  score: number;
  ai_reason: string;
}

// Color labels for display in prompt
const COLOR_LABELS: Record<string, string> = {
  red: 'Rött',
  white: 'Vitt',
  rose: 'Rosé',
  sparkling: 'Mousserande',
  orange: 'Orange',
  fortified: 'Starkvin',
};

export async function rankWinesWithClaude(
  wines: Wine[],
  userRequest: string
): Promise<RankedWine[]> {
  if (wines.length === 0) {
    return [];
  }

  // Build wine list with all relevant info including color
  const wineList = wines.map((w, i) => {
    const parts = [
      `${i + 1}. ID: ${w.id}`,
      `   ${w.namn} - ${w.producent}`,
      `   Typ: ${COLOR_LABELS[w.color || ''] || w.color || 'Okänd'}`,
      `   Land: ${w.land}${w.region ? `, ${w.region}` : ''}`,
      `   Pris: ${w.pris_sek} kr`,
    ];

    if (w.druva) {
      parts.push(`   Druva: ${w.druva}`);
    }
    if (w.argang) {
      parts.push(`   Årgång: ${w.argang}`);
    }

    const certifications = [];
    if (w.ekologisk) certifications.push('Ekologisk');
    if (w.biodynamiskt) certifications.push('Biodynamisk');
    if (w.veganskt) certifications.push('Vegansk');
    if (certifications.length > 0) {
      parts.push(`   Certifiering: ${certifications.join(', ')}`);
    }

    if (w.beskrivning) {
      parts.push(`   Beskrivning: ${w.beskrivning.substring(0, 150)}${w.beskrivning.length > 150 ? '...' : ''}`);
    }

    return parts.join('\n');
  }).join('\n\n');

  const prompt = `Du är en sommelier-AI för restauranger i Sverige.

RESTAURANGENS SÖKNING:
${userRequest}

TILLGÄNGLIGA VINER (${wines.length} st):
${wineList}

UPPGIFT:
Rangordna vinerna baserat på hur väl de matchar restaurangens behov.

BEDÖMNINGSKRITERIER (i prioritetsordning):
1. Vintyp (rött/vitt/etc) - MÅSTE matcha om specificerat
2. Budget - pris UNDER eller vid budget är BRA (lägre pris = bättre värde för restaurangen). Pris ÖVER budget är negativt.
3. Land/Region - om specificerat
4. Druva - om specificerat
5. Certifieringar - om ekologiskt/biodynamiskt/veganskt efterfrågas
6. Stil/smakprofil - baserat på eventuell beskrivning

OBS: Ett vin som matchar alla kriterier men kostar MINDRE än budget ska få HÖG score - det är ett fynd!

Returnera JSON i detta exakta format (utan markdown-formatering):

[
  {"wine_id": "faktiskt-uuid-från-listan", "score": 0.95, "reason": "kort motivering på svenska"},
  {"wine_id": "faktiskt-uuid-från-listan", "score": 0.87, "reason": "kort motivering på svenska"}
]

REGLER:
- wine_id MÅSTE vara det faktiska UUID från vinlistan ovan
- score: 0.0-1.0 (1.0 = perfekt match)
- Returnera max 8 viner
- reason: max 20 ord, förklara varför vinet passar
- Om restaurangen söker specifik vintyp, uteslut viner av annan typ
- Svenskt språk i reason`;

  try {
    const response = await callClaude(prompt, 2000);

    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      throw new Error('Claude returned no JSON');
    }

    const ranked: { wine_id: string; score: number; reason: string }[] = JSON.parse(
      jsonMatch[0]
    );

    // Map back to Wine objects with score and reason
    const result = ranked
      .map((r) => {
        const wine = wines.find((w) => w.id === r.wine_id);
        if (!wine) {
          return null;
        }
        return {
          ...wine,
          score: r.score,
          ai_reason: r.reason,
        };
      })
      .filter((w): w is RankedWine => w !== null);

    return result;
  } catch (error: any) {
    // Fallback: return wines without AI ranking
    return wines.slice(0, 8).map((wine, index) => ({
      ...wine,
      score: 0.9 - index * 0.1,
      ai_reason: 'Baserat på dina kriterier.', // Clearer fallback text
    }));
  }
}

// ============================================================================
// Enhanced Re-ranking — Used by Matching Agent pipeline
// ============================================================================

export interface EnhancedRankResult {
  wine_id: string;
  score: number;
  reason: string;
}

/**
 * Enhanced AI re-ranking with richer context from the matching pipeline.
 * Receives pre-scored, pre-filtered wines (15 instead of 50) + food/occasion/style context.
 * Returns up to finalTopN wines with AI scores and motivations.
 */
export async function rankWinesEnhanced(
  scoredWines: ScoredWine[],
  preferences: MergedPreferences,
  userRequest: string,
  finalTopN: number = 10,
  knowledgeContext?: string,
): Promise<EnhancedRankResult[]> {
  if (scoredWines.length === 0) return [];

  const wineList = scoredWines.map((sw, i) => {
    const w = sw.wine;
    const parts = [
      `${i + 1}. ID: ${w.id}`,
      `   ${w.name} - ${w.producer}`,
      `   Typ: ${COLOR_LABELS[w.color || ''] || w.color || 'Okänd'}`,
      `   Land: ${w.country}${w.region ? `, ${w.region}` : ''}${w.appellation ? ` (${w.appellation})` : ''}`,
      `   Pris: ${Math.round(w.price_ex_vat_sek / 100)} kr`,
      `   Förpoäng: ${sw.score}/100`,
    ];

    if (w.grape) parts.push(`   Druva: ${w.grape}`);
    if (w.vintage) parts.push(`   Årgång: ${w.vintage}`);
    if (w.organic) parts.push(`   Ekologisk: Ja`);
    if (w.biodynamic) parts.push(`   Biodynamisk: Ja`);
    if (w.description) {
      parts.push(`   Beskrivning: ${w.description.substring(0, 150)}${w.description.length > 150 ? '...' : ''}`);
    }

    return parts.join('\n');
  }).join('\n\n');

  // Build rich context
  const contextParts: string[] = [userRequest];

  if (preferences.food_pairing.length > 0) {
    contextParts.push(`Matlagning: ${preferences.food_pairing.join(', ')}`);
  }
  if (preferences.occasion) {
    contextParts.push(`Tillfälle: ${preferences.occasion}`);
  }
  if (preferences.style.length > 0) {
    contextParts.push(`Önskad stil: ${preferences.style.join(', ')}`);
  }

  const richContext = contextParts.join('. ');

  const prompt = `Du är en sommelier-AI för restauranger i Sverige.

RESTAURANGENS SÖKNING:
${richContext}

${knowledgeContext ? `VINKUNSKAP (använd för att motivera dina val):\n${knowledgeContext}\n` : ''}FÖRFILTRERADE VINER (${scoredWines.length} st, sorterade efter förpoäng):
${wineList}

UPPGIFT:
Rangordna vinerna baserat på hur väl de matchar restaurangens behov.
Vinerna är redan förfiltrerade och poängsatta — din uppgift är att göra den slutgiltiga rankingen med ditt vinexpertomdöme.

BEDÖMNINGSKRITERIER (i prioritetsordning):
1. Vintyp (rött/vitt/etc) - MÅSTE matcha om specificerat
2. Budget - pris UNDER eller vid budget = BRA (fynd för restaurangen). Pris ÖVER budget = negativt.
3. Land/Region - om specificerat
4. Druva - om specificerat
5. Matkompatibilitet - ${preferences.food_pairing.length > 0 ? `passar till ${preferences.food_pairing.join(', ')}` : 'ingen specifik mat'}
6. Tillfälle - ${preferences.occasion || 'inget specifikt tillfälle'}
7. Stil/smakprofil - ${preferences.style.length > 0 ? preferences.style.join(', ') : 'ingen specifik stil'}

${preferences.food_pairing.length > 0 ? `VIKTIGT: Förklara i "reason" VARFÖR vinet passar till ${preferences.food_pairing.join('/')}. T.ex. "Tanninerna i Barolo gifter sig med lammets fetma" eller "Frisk Chablis lyfter den grillade fisken".` : ''}

Returnera JSON i detta exakta format (utan markdown-formatering):

[
  {"wine_id": "faktiskt-uuid-från-listan", "score": 0.95, "reason": "kort motivering på svenska"},
  {"wine_id": "faktiskt-uuid-från-listan", "score": 0.87, "reason": "kort motivering på svenska"}
]

REGLER:
- wine_id MÅSTE vara det faktiska UUID från vinlistan ovan
- score: 0.0-1.0 (1.0 = perfekt match)
- Returnera max ${finalTopN} viner
- reason: max 25 ord, förklara varför vinet passar (nämn mat/tillfälle om relevant)
- Om restaurangen söker specifik vintyp, uteslut viner av annan typ
- Svenskt språk i reason`;

  try {
    const response = await callClaude(prompt, 2000);

    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      throw new Error('Claude returned no JSON in enhanced ranking');
    }

    const ranked: EnhancedRankResult[] = JSON.parse(jsonMatch[0]);

    // Validate wine_ids exist in input
    const validIds = new Set(scoredWines.map(sw => sw.wine.id));
    return ranked
      .filter(r => validIds.has(r.wine_id))
      .slice(0, finalTopN);
  } catch (error: any) {
    console.warn('[MatchingAgent] Enhanced AI re-rank failed, using pre-score order:', error?.message);
    // Fallback: use pre-score order
    return scoredWines.slice(0, finalTopN).map(sw => ({
      wine_id: sw.wine.id,
      score: sw.score / 100, // Normalize to 0-1
      reason: 'Baserat på dina kriterier.',
    }));
  }
}
