import { callClaude } from './claude';

export interface Wine {
  id: string;
  namn: string;
  producent: string;
  land: string;
  region?: string;
  pris_sek: number;
  beskrivning: string;
  druva?: string;
  ekologisk: boolean;
  biodynamiskt?: boolean;
  veganskt?: boolean;
}

export interface RankedWine extends Wine {
  score: number;
  ai_reason: string;
}

export async function rankWinesWithClaude(
  wines: Wine[],
  userRequest: string
): Promise<RankedWine[]> {
  if (wines.length === 0) {
    return [];
  }

  const prompt = `Du är en sommelier-AI för restauranger.

En restaurang söker: "${userRequest}"

Här är ${wines.length} viner som matchar deras budget:
${wines.map((w, i) => `${i + 1}. ID: ${w.id}
   ${w.namn} - ${w.producent} (${w.land}, ${w.region || 'N/A'}, ${w.pris_sek} kr)
   ${w.beskrivning}`).join('\n\n')}

UPPGIFT:
Rangordna dessa viner från bäst till sämst match för restaurangens behov.
Returnera JSON i detta exakta format (utan formatering):

[
  {"wine_id": "actual-uuid-from-above", "score": 0.95, "reason": "kort motivering"},
  {"wine_id": "actual-uuid-from-above", "score": 0.87, "reason": "kort motivering"}
]

Regler:
- wine_id MÅSTE vara det faktiska UUID från vinlistan ovan (tex "a9c15ec1-de5c-41ff-b296-5c2d98743824")
- score: 0.0-1.0 (1.0 = perfekt match)
- Ta hänsyn till pris, matstil, region, beskrivning
- Max 6 viner i svaret
- reason ska vara max 15 ord och förklara varför detta vin passar`;

  try {
    const response = await callClaude(prompt, 2000);
    console.log('Claude raw response:', response.substring(0, 500));

    // Extrahera JSON från svaret
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.error('Claude returnerade inte JSON:', response);
      throw new Error('Claude returnerade inte JSON');
    }

    console.log('Extracted JSON:', jsonMatch[0].substring(0, 300));
    const ranked: { wine_id: string; score: number; reason: string }[] = JSON.parse(
      jsonMatch[0]
    );
    console.log('Parsed ranked wines:', ranked.length, 'wines');

    // Mappa tillbaka till Wine-objekt med score och reason
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
  } catch (error) {
    console.error('Error ranking wines with Claude:', error);
    // Fallback: returnera viner utan ranking
    return wines.slice(0, 6).map((wine, index) => ({
      ...wine,
      score: 0.9 - index * 0.1,
      ai_reason: 'Ett utmärkt val för din restaurang.',
    }));
  }
}
