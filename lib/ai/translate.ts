import { callClaude } from './claude';

/**
 * Detects if text is likely Swedish
 * Uses common Swedish words and patterns
 */
function isLikelySwedish(text: string): boolean {
  if (!text || text.length < 10) return true; // Too short to determine, assume Swedish

  const lowerText = text.toLowerCase();

  // Common Swedish words
  const swedishIndicators = [
    'och', 'med', 'som', 'för', 'från', 'till', 'den', 'det', 'ett', 'en',
    'är', 'var', 'har', 'hade', 'kan', 'ska', 'vill', 'vin', 'smak', 'doft',
    'frukt', 'bär', 'körsbär', 'hallon', 'jordgubb', 'äpple', 'päron',
    'kryddor', 'vanilj', 'choklad', 'kaffe', 'örter', 'blommor',
    'tanniner', 'syra', 'sötma', 'fruktig', 'kryddig', 'elegant',
    'fyllig', 'lätt', 'frisk', 'torr', 'söt', 'mustig', 'mjuk',
  ];

  // Common English words that indicate non-Swedish
  const englishIndicators = [
    'the', 'and', 'with', 'for', 'from', 'this', 'that', 'which',
    'wine', 'notes', 'flavors', 'aromas', 'finish', 'palate',
    'cherry', 'raspberry', 'blackberry', 'strawberry', 'apple', 'pear',
    'vanilla', 'chocolate', 'coffee', 'spice', 'herbs', 'flowers',
    'tannins', 'acidity', 'sweetness', 'fruity', 'spicy', 'elegant',
    'full-bodied', 'light', 'fresh', 'dry', 'sweet', 'rich', 'soft',
    'bursting', 'vibrant', 'pure', 'easy', 'drinkability',
  ];

  let swedishScore = 0;
  let englishScore = 0;

  for (const word of swedishIndicators) {
    if (lowerText.includes(word)) swedishScore++;
  }

  for (const word of englishIndicators) {
    if (lowerText.includes(word)) englishScore++;
  }

  // If more English indicators than Swedish, it's likely not Swedish
  return swedishScore >= englishScore;
}

/**
 * Translates wine description to Swedish if needed
 * Returns original text if already Swedish or translation fails
 */
export async function translateToSwedish(text: string): Promise<string> {
  // Skip empty or very short text
  if (!text || text.trim().length < 5) {
    return text;
  }

  // Check if already Swedish
  if (isLikelySwedish(text)) {
    return text;
  }

  try {
    const prompt = `Översätt följande vinbeskrivning till svenska. Behåll vinspråk och terminologi. Svara ENDAST med översättningen, inget annat.

Text att översätta:
"${text}"

Svensk översättning:`;

    const translated = await callClaude(prompt, 500);

    // Clean up response - remove quotes if present
    let result = translated.trim();
    if (result.startsWith('"') && result.endsWith('"')) {
      result = result.slice(1, -1);
    }
    if (result.startsWith("'") && result.endsWith("'")) {
      result = result.slice(1, -1);
    }

    return result || text;
  } catch (error) {
    console.error('Translation failed, using original text:', error);
    return text;
  }
}

/**
 * Batch translate multiple texts to Swedish
 * More efficient than translating one by one
 */
export async function batchTranslateToSwedish(texts: string[]): Promise<string[]> {
  // Filter out texts that need translation
  const needsTranslation: { index: number; text: string }[] = [];
  const results: string[] = [...texts];

  texts.forEach((text, index) => {
    if (text && text.trim().length >= 5 && !isLikelySwedish(text)) {
      needsTranslation.push({ index, text });
    }
  });

  // If nothing needs translation, return original
  if (needsTranslation.length === 0) {
    return results;
  }

  // Batch translate (max 10 at a time to avoid token limits)
  const batchSize = 10;
  for (let i = 0; i < needsTranslation.length; i += batchSize) {
    const batch = needsTranslation.slice(i, i + batchSize);

    try {
      const numberedTexts = batch
        .map((item, idx) => `${idx + 1}. "${item.text}"`)
        .join('\n');

      const prompt = `Översätt följande vinbeskrivningar till svenska. Behåll vinspråk och terminologi. Svara med numrerade översättningar i samma ordning.

Texter att översätta:
${numberedTexts}

Svenska översättningar (samma numrering):`;

      const response = await callClaude(prompt, 2000);

      // Parse response - expect numbered lines
      const lines = response.trim().split('\n');
      batch.forEach((item, idx) => {
        const lineNum = idx + 1;
        const matchingLine = lines.find(line => line.match(new RegExp(`^${lineNum}\\.?\\s*`)));
        if (matchingLine) {
          let translated = matchingLine.replace(new RegExp(`^${lineNum}\\.?\\s*`), '').trim();
          // Remove quotes if present
          if (translated.startsWith('"') && translated.endsWith('"')) {
            translated = translated.slice(1, -1);
          }
          results[item.index] = translated || item.text;
        }
      });
    } catch (error) {
      console.error('Batch translation failed for batch starting at', i, error);
      // Keep original texts on failure
    }
  }

  return results;
}
