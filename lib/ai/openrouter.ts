/**
 * OpenRouter AI Client — Free models for wine descriptions
 *
 * Uses free-tier models via OpenRouter.ai.
 * OPENROUTER_API_KEY is optional but recommended for higher rate limits.
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

const PRIMARY_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const FALLBACK_MODEL = 'qwen/qwen3-coder:free';

export async function callOpenRouter(
  prompt: string,
  maxTokens: number = 1000
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Try primary model, fall back to secondary
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
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
          console.error('❌ OpenRouter: Invalid API key (401)');
        } else if (status === 429) {
          console.error(`❌ OpenRouter: Rate limited (429) on ${model}`);
        } else if (status === 503) {
          console.error(`❌ OpenRouter: Model unavailable (503) on ${model}`);
        } else {
          console.error(`❌ OpenRouter: HTTP ${status} on ${model}`);
        }
        // Try fallback model
        if (model === PRIMARY_MODEL) continue;
        throw new Error(`OpenRouter API error: ${status}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;

      if (!text) {
        if (model === PRIMARY_MODEL) continue;
        throw new Error('Empty response from OpenRouter');
      }

      return text.trim();
    } catch (error: any) {
      if (model === PRIMARY_MODEL) {
        console.warn(`⚠️  OpenRouter: ${model} failed, trying fallback...`);
        continue;
      }
      console.error('❌ OpenRouter API error:', error?.message || error);
      throw error;
    }
  }

  throw new Error('All OpenRouter models failed');
}
