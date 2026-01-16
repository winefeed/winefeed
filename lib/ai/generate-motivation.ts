import { callClaude } from './claude';
import type { Wine } from './rank-wines';

export async function generateMotivation(
  wine: Wine,
  userRequest: string
): Promise<string> {
  const prompt = `Du är en sommelier-AI för restauranger.

En restaurang söker: "${userRequest}"

Du ska förklara varför detta vin passar deras behov:
- Vin: ${wine.namn}
- Producent: ${wine.producent}
- Land: ${wine.land}${wine.region ? `, ${wine.region}` : ''}
- Pris: ${wine.pris_sek} kr
- Beskrivning: ${wine.beskrivning}

UPPGIFT:
Skriv 2-3 meningar (max 50 ord) som förklarar varför detta vin passar restaurangens behov.
Fokusera på praktiska fördelar för restaurangen (matmatchning, gästupplevelse, pris-värde).

Skriv ENDAST motiveringstexten, ingen introduktion eller förklaringar.`;

  try {
    const motivation = await callClaude(prompt, 200);
    return motivation.trim();
  } catch (error) {
    console.error('Error generating motivation:', error);
    // Fallback till beskrivningen från DB
    return wine.beskrivning || 'Ett utmärkt val för din restaurang.';
  }
}
