/**
 * EMBEDDINGS UTILITY
 *
 * Generates text embeddings via Hugging Face Inference API (free).
 * Model: BAAI/bge-small-en-v1.5 (384 dimensions)
 *
 * Cost: $0 (free tier)
 * Dimensions: 384
 */

const HF_MODEL = 'BAAI/bge-small-en-v1.5';
const HF_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

function getApiKey(): string {
  const key = process.env.HF_API_TOKEN || process.env.HUGGINGFACE_API_TOKEN;
  if (!key) {
    throw new Error('HF_API_TOKEN environment variable is required for embeddings');
  }
  return key;
}

/**
 * Generate embedding for a single text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const results = await generateEmbeddings([text]);
  return results[0];
}

/**
 * Generate embeddings for multiple texts (batch).
 * HF Inference API processes one at a time, so we batch sequentially.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = getApiKey();
  const allEmbeddings: number[][] = [];

  for (const text of texts) {
    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HF embeddings API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    // HF returns flat array for single input
    const embedding = Array.isArray(data[0]) ? data[0] : data;
    allEmbeddings.push(embedding);
  }

  return allEmbeddings;
}

/**
 * Build a searchable text from wine knowledge fields.
 * This text gets embedded for vector search.
 */
export function buildWineEmbeddingText(wine: {
  wine_name: string;
  producer?: string;
  grape?: string;
  country?: string;
  region?: string;
  subregion?: string;
  color?: string;
  aroma_description?: string;
  taste_description?: string;
  food_pairings?: string;
  taste_clock_body?: number;
  taste_clock_acidity?: number;
  taste_clock_tannin?: number;
  taste_clock_sweetness?: number;
}): string {
  const parts: string[] = [];

  parts.push(wine.wine_name);
  if (wine.producer) parts.push(wine.producer);
  if (wine.grape) parts.push(`Druva: ${wine.grape}`);
  if (wine.country) parts.push(wine.country);
  if (wine.region) parts.push(wine.region);
  if (wine.subregion) parts.push(wine.subregion);
  if (wine.color) parts.push(wine.color === 'red' ? 'Rött vin' : wine.color === 'white' ? 'Vitt vin' : wine.color);

  if (wine.aroma_description) parts.push(`Doft: ${wine.aroma_description}`);
  if (wine.taste_description) parts.push(`Smak: ${wine.taste_description}`);
  if (wine.food_pairings) parts.push(`Passar till: ${wine.food_pairings}`);

  // Taste clock as descriptive text
  if (wine.taste_clock_body) {
    const bodyLabel = wine.taste_clock_body <= 4 ? 'lätt' : wine.taste_clock_body <= 8 ? 'medelfyllig' : 'fyllig';
    parts.push(`Kropp: ${bodyLabel}`);
  }
  if (wine.taste_clock_acidity) {
    const acidLabel = wine.taste_clock_acidity <= 4 ? 'låg syra' : wine.taste_clock_acidity <= 8 ? 'medelsyra' : 'hög syra';
    parts.push(`Syra: ${acidLabel}`);
  }
  if (wine.taste_clock_tannin) {
    const tanninLabel = wine.taste_clock_tannin <= 4 ? 'mjuk' : wine.taste_clock_tannin <= 8 ? 'medeltannin' : 'kraftig tannin';
    parts.push(`Tannin: ${tanninLabel}`);
  }

  return parts.join('. ');
}
