/**
 * Matching Agent — Fritext Parser
 *
 * Uses OpenRouter (free) to parse free-text wine requests into structured criteria.
 * Extracts: food pairing, style, occasion, implied wine attributes.
 * Respects already-selected UI filters — only extracts what's NOT already chosen.
 */

import { callOpenRouter } from '../ai/openrouter';
import { ParsedFritext, EMPTY_PARSED, StructuredFilters } from './types';

/**
 * Parse free text into structured wine criteria using AI.
 * Returns EMPTY_PARSED on any error — pipeline continues without parsing.
 */
export async function parseFritext(
  fritext: string,
  structuredFilters: StructuredFilters,
): Promise<ParsedFritext> {
  if (!fritext || fritext.trim().length < 3) {
    return { ...EMPTY_PARSED };
  }

  // Tell the AI what's already selected so it doesn't duplicate
  const alreadySelected: string[] = [];
  if (structuredFilters.color && structuredFilters.color !== 'all') {
    alreadySelected.push(`vintyp: ${structuredFilters.color}`);
  }
  if (structuredFilters.country && structuredFilters.country !== 'all') {
    alreadySelected.push(`land: ${structuredFilters.country}`);
  }
  if (structuredFilters.grape && structuredFilters.grape !== 'all') {
    alreadySelected.push(`druva: ${structuredFilters.grape}`);
  }

  const alreadySelectedText = alreadySelected.length > 0
    ? `\nAnvändaren har REDAN valt dessa filter (extrahera INTE dessa): ${alreadySelected.join(', ')}`
    : '';

  const prompt = `Du är en vinexpert. Analysera denna fritextförfrågan från en restaurang och extrahera strukturerad information.

FÖRFRÅGAN: "${fritext}"${alreadySelectedText}

Returnera ENBART ett JSON-objekt (ingen markdown, ingen förklaring) med denna struktur:
{
  "food_pairing": ["mat1", "mat2"],
  "style": ["stil1"],
  "occasion": "tillfälle eller null",
  "implied_color": "red/white/rose/sparkling/orange/fortified/alcohol_free eller null",
  "implied_country": "land på engelska eller null",
  "implied_region": "region på originalspråk eller null",
  "implied_grapes": ["druva1"],
  "organic": false,
  "biodynamic": false,
  "price_sensitivity": "budget/premium/any"
}

REGLER:
- food_pairing: svenska basord för mat. Normalisera alltid till grundformen:
  "torskrygg" → "torsk", "lammracks" → "lamm", "beef tartare"/"tartare" → "tartar",
  "räksallad" → "räkor", "ankbröst" → "anka", "oxfilé med rödvinssås" → "oxfilé".
  Inkludera BÅDE det specifika och det generella om relevant: "torskrygg" → ["torsk", "fisk"]
- style: svenska stilord (elegant, kraftig, naturvin, lätt, fruktig, mineralisk)
- implied_color: BARA om texten antyder färg som INTE redan är valt. Tänk på matpairing:
  fisk/skaldjur → "white", rött kött → "red", tartar/carpaccio → "red"
- implied_country: BARA om texten antyder land som INTE redan är valt, skriv på engelska (France, Italy, Spain)
- implied_region: vinregion om nämnd (Bordeaux, Toscana, Rioja)
- implied_grapes: BARA om texten antyder druvor som INTE redan är valt
- organic: true om "ekologisk", "eko", "organic" nämns
- biodynamic: true om "biodynamisk", "biodynamic" nämns
- price_sensitivity: "budget" om billigt/prisvärt, "premium" om exklusivt/lyxigt, "any" annars
- Sätt till null/tom array/false om inget relevant finns i texten`;

  try {
    const response = await callOpenRouter(prompt, 500);

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[MatchingAgent] Fritext parser returned no JSON');
      return { ...EMPTY_PARSED };
    }

    const raw = JSON.parse(jsonMatch[0]);

    // Validate and sanitize the response
    return {
      food_pairing: Array.isArray(raw.food_pairing) ? raw.food_pairing.filter((s: any) => typeof s === 'string') : [],
      style: Array.isArray(raw.style) ? raw.style.filter((s: any) => typeof s === 'string') : [],
      occasion: typeof raw.occasion === 'string' ? raw.occasion : null,
      implied_color: typeof raw.implied_color === 'string' ? raw.implied_color : null,
      implied_country: typeof raw.implied_country === 'string' ? raw.implied_country : null,
      implied_region: typeof raw.implied_region === 'string' ? raw.implied_region : null,
      implied_grapes: Array.isArray(raw.implied_grapes) ? raw.implied_grapes.filter((s: any) => typeof s === 'string') : [],
      organic: raw.organic === true,
      biodynamic: raw.biodynamic === true,
      price_sensitivity: ['budget', 'premium', 'any'].includes(raw.price_sensitivity) ? raw.price_sensitivity : 'any',
    };
  } catch (error: any) {
    console.warn('[MatchingAgent] Fritext parsing failed, using empty parsed:', error?.message);
    return { ...EMPTY_PARSED };
  }
}
