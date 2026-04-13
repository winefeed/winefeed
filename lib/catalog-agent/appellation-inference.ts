/**
 * Appellation inference via Claude Haiku.
 *
 * The supplier_wines.appellation column stays empty for wines imported
 * via CSV because producers rarely encode it. This helper batches a set
 * of wines into a single LLM call and returns a map of id → appellation
 * (or null for non-wines / unrecognised entries).
 *
 * Used by the post-import enrichment loop in
 * /api/suppliers/[id]/wines/import/route.ts as a non-blocking step.
 * The manual backfill script (2026-04-13) used the same prompt shape
 * to enrich the first 86 wines in the catalogue.
 */

export interface WineForAppellation {
  id: string;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  grape: string | null;
  vintage: number | null;
}

export interface AppellationResult {
  id: string;
  appellation: string | null;
}

const SYSTEM_PROMPT = `You are a wine expert. For each wine, determine its appellation (AOC/AOP/DOC/DOCG/DO/IGT/etc. or wine law region).

Rules:
- Return the official appellation name only (e.g. "Chablis", "Châteauneuf-du-Pape", "Rioja DOCa", "Barolo DOCG", "Chianti Classico DOCG", "Stellenbosch WO").
- If the wine is a basic regional wine with no specific appellation, return the region as an IGT/Vin de Pays/Landwein level label (e.g. "Vin de France", "IGP Pays d'Oc").
- If you genuinely cannot determine the appellation from the data, return null for that wine. Do NOT guess.
- Use wine name, producer, region, country, and grape together to infer. The wine name often contains or implies the appellation.
- For spirits (Pisco, Armagnac, Cognac etc) and other non-wines that ended up in the catalogue by mistake, return null.

Return ONLY valid JSON, no prose, in this exact shape:
{"results": [{"id": "uuid", "appellation": "..." | null}, ...]}`;

/**
 * Infer appellation for a batch of wines. Returns a Map from wine id to
 * appellation (or null). Wines that the model couldn't confidently label
 * are omitted from the map so the caller can distinguish "model said
 * null" from "call failed" if it wants.
 *
 * Batches of up to ~50 wines fit comfortably in one Haiku call.
 * Larger inputs are chunked automatically.
 */
export async function inferAppellations(
  wines: WineForAppellation[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (wines.length === 0) return result;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[appellation-inference] ANTHROPIC_API_KEY not set — skipping');
    return result;
  }

  const CHUNK_SIZE = 50;
  for (let i = 0; i < wines.length; i += CHUNK_SIZE) {
    const chunk = wines.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Wines:\n${JSON.stringify(chunk, null, 2)}` }],
        }),
      });

      if (!res.ok) {
        console.warn(`[appellation-inference] API error ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data?.content?.[0]?.text;
      if (typeof text !== 'string') continue;

      // Haiku occasionally wraps JSON in ```json fences even when told not to
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonText = fenceMatch ? fenceMatch[1] : text;

      let parsed: { results?: AppellationResult[] };
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseErr) {
        console.warn('[appellation-inference] JSON parse failed');
        continue;
      }

      for (const r of parsed.results || []) {
        if (typeof r.id === 'string') {
          result.set(r.id, r.appellation ?? null);
        }
      }
    } catch (err: any) {
      console.warn(`[appellation-inference] chunk error:`, err?.message);
    }
  }

  return result;
}
