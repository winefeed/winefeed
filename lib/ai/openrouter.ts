/**
 * OpenRouter AI Client — Free models for wine descriptions
 *
 * Uses free-tier models via OpenRouter.ai.
 * OPENROUTER_API_KEY is optional but recommended for higher rate limits.
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Ordered by quality — tries each until one succeeds
const MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'qwen/qwen3-coder:free',
  'google/gemma-3-4b-it:free',
];

export async function callOpenRouter(
  prompt: string,
  maxTokens: number = 1000
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured. Get a free key at https://openrouter.ai/keys');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // Try each model in order until one succeeds
  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    const isLast = i === MODELS.length - 1;

    try {
      const response = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401) {
          throw new Error('OpenRouter: Invalid API key (401)');
        }
        console.warn(`⚠️  OpenRouter: ${model} → ${status}, trying next...`);
        if (isLast) throw new Error(`OpenRouter API error: ${status}`);
        continue;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;

      if (!text) {
        console.warn(`⚠️  OpenRouter: ${model} → empty response, trying next...`);
        if (isLast) throw new Error('Empty response from OpenRouter');
        continue;
      }

      return text.trim();
    } catch (error: any) {
      if (error.message?.includes('Invalid API key')) throw error;
      if (!isLast) {
        console.warn(`⚠️  OpenRouter: ${model} failed, trying next...`);
        continue;
      }
      console.error('❌ OpenRouter: All models failed:', error?.message || error);
      throw error;
    }
  }

  throw new Error('All OpenRouter models failed');
}
