import { callClaude } from './claude';

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
2. Budget - pris inom eller nära angiven budget
3. Land/Region - om specificerat
4. Druva - om specificerat
5. Certifieringar - om ekologiskt/biodynamiskt/veganskt efterfrågas
6. Stil/smakprofil - baserat på eventuell beskrivning

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
    console.log('Calling Claude AI to rank', wines.length, 'wines...');
    console.log('User request:', userRequest);
    const response = await callClaude(prompt, 2000);
    console.log('✓ Claude AI responded successfully');
    console.log('Claude raw response:', response.substring(0, 500));

    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.error('Claude returned no JSON:', response);
      throw new Error('Claude returned no JSON');
    }

    console.log('Extracted JSON:', jsonMatch[0].substring(0, 300));
    const ranked: { wine_id: string; score: number; reason: string }[] = JSON.parse(
      jsonMatch[0]
    );
    console.log('Parsed ranked wines:', ranked.length, 'wines');

    // Map back to Wine objects with score and reason
    const result = ranked
      .map((r) => {
        const wine = wines.find((w) => w.id === r.wine_id);
        if (!wine) {
          console.log('WARNING: Could not find wine with ID:', r.wine_id);
          return null;
        }
        return {
          ...wine,
          score: r.score,
          ai_reason: r.reason,
        };
      })
      .filter((w): w is RankedWine => w !== null);

    console.log('Final ranked wines after filtering:', result.length, 'wines');
    return result;
  } catch (error: any) {
    console.error('❌ Error ranking wines with Claude:', error?.message || error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.log('⚠️  Falling back to default ranking (no AI)');
    // Fallback: return wines without AI ranking
    return wines.slice(0, 8).map((wine, index) => ({
      ...wine,
      score: 0.9 - index * 0.1,
      ai_reason: 'Baserat på dina kriterier.', // Clearer fallback text
    }));
  }
}
