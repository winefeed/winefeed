import Anthropic from '@anthropic-ai/sdk';

// Check if API key is configured
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.warn('⚠️  ANTHROPIC_API_KEY is not set - AI features will be disabled');
}

const anthropic = new Anthropic({
  apiKey: apiKey || 'missing-key', // Prevent SDK crash
});

export { anthropic };

export async function callClaude(prompt: string, maxTokens: number = 2000): Promise<string> {
  // Check API key before making request
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Please add it to your .env.local file.');
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    throw new Error('Unexpected response type from Claude');
  } catch (error: any) {
    // Log detailed error info
    if (error?.status === 401) {
      console.error('❌ Claude API: Invalid API key (401 Unauthorized)');
    } else if (error?.status === 429) {
      console.error('❌ Claude API: Rate limited (429 Too Many Requests)');
    } else if (error?.status === 500) {
      console.error('❌ Claude API: Server error (500)');
    } else {
      console.error('❌ Claude API error:', error?.message || error);
    }
    throw error;
  }
}
