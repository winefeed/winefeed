/**
 * Fuzzy Food Matching Layer
 *
 * Matches Swedish food words to FOOD_TO_WINE_STYLES keys using:
 * 1. Exact match
 * 2. Swedish suffix stripping (compound word decomposition)
 * 3. Substring matching (min 4 chars)
 * 4. Compound word splitting
 *
 * Pure string manipulation — no external calls, handles åäö.
 */

/**
 * Swedish suffixes that indicate a dish type.
 * Order matters: longer suffixes first to avoid partial matches.
 */
const SWEDISH_DISH_SUFFIXES = [
  'kotlett',  // fläskkotlett → fläsk
  'sallad',   // räksallad → räk (then mapped)
  'soppa',    // svampsoppa → svamp
  'bröst',    // ankbröst → ank (then mapped)
  'gryta',    // lammgryta → lamm
  'rätt',     // fiskrätt → fisk
  'stek',     // viltstek → vilt
  'filé',     // kycklingfilé → kyckling
  'file',     // kycklingfile → kyckling (without accent)
  'färs',     // nötfärs → nöt (then mapped)
  'fars',     // nötfars → nöt (without accent)
  'biff',     // oxbiff → ox (then mapped)
  'lår',      // anklår → ank (then mapped)
  'lar',      // anklar → ank (without accent)
  'sås',      // svampsås → svamp
  'sas',      // svampsas → svamp (without accent)
];

/**
 * Maps stripped stems to the actual food key when the stem alone
 * doesn't match (e.g. "nöt" → "nötkött", "räk" → "räkor", "ank" → "anka").
 */
const STEM_TO_FOOD: Record<string, string> = {
  'nöt': 'nötkött',
  'not': 'nötkött',
  'räk': 'räkor',
  'rak': 'räkor',
  'ank': 'anka',
  'ox': 'oxfilé',
  'ärt': 'ärtor',
  'art': 'ärtor',
  'tomat': 'tomat',
  'svamp': 'svamp',
  'fisk': 'fisk',
  'kyckling': 'kyckling',
  'vilt': 'vilt',
  'lamm': 'lamm',
  'fläsk': 'fläsk',
  'lax': 'lax',
  'torsk': 'torsk',
  'kött': 'nötkött',
  'gris': 'fläsk',
};

/**
 * Tokenize input string into words, normalizing whitespace.
 */
function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * Try to strip a Swedish dish suffix and return the base word.
 * Returns null if no suffix matches or base is too short.
 */
function stripSuffix(word: string): { base: string; suffix: string } | null {
  for (const suffix of SWEDISH_DISH_SUFFIXES) {
    if (word.endsWith(suffix) && word.length > suffix.length) {
      const base = word.slice(0, word.length - suffix.length);
      if (base.length >= 2) {
        return { base, suffix };
      }
    }
  }
  return null;
}

/**
 * Resolve a stem to a food key, checking:
 * 1. Direct match in foodKeys
 * 2. STEM_TO_FOOD mapping → then check in foodKeys
 */
function resolveStem(stem: string, foodKeySet: Set<string>): string | null {
  // Direct match
  if (foodKeySet.has(stem)) return stem;

  // Mapped stem
  const mapped = STEM_TO_FOOD[stem];
  if (mapped && foodKeySet.has(mapped)) return mapped;

  return null;
}

/**
 * Fuzzy-match a food input string against known food keys.
 *
 * @param input  - the fritext (lowercased by caller or not — we lowercase internally)
 * @param foodKeys - array of keys from FOOD_TO_WINE_STYLES
 * @returns array of matched food keywords, deduplicated
 */
export function fuzzyMatchFood(input: string, foodKeys: string[]): string[] {
  const foodKeySet = new Set(foodKeys);
  const matched = new Set<string>();
  const ft = input.toLowerCase();
  const words = tokenize(ft);

  // -------------------------------------------------------------------
  // Pass 1: Multi-word exact matches (longest first)
  // Check 3-word, 2-word, then 1-word phrases against foodKeys.
  // Use word-boundary matching to avoid "till" matching "tortilla".
  // -------------------------------------------------------------------
  const sortedKeys = [...foodKeys].sort((a, b) => b.length - a.length);

  for (const food of sortedKeys) {
    if (food.length < 3) continue; // Skip very short keys
    // Check word-boundary match: food must appear as whole word(s)
    const escaped = food.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s|,)${escaped}(?:$|\\s|,|\\.)`, 'i');
    if (regex.test(ft)) {
      // Avoid adding if a longer match already covers this
      if (!Array.from(matched).some(m => m.includes(food))) {
        matched.add(food);
      }
    }
  }

  // -------------------------------------------------------------------
  // Pass 2: Suffix stripping on each word
  // -------------------------------------------------------------------
  for (const word of words) {
    // Skip if already exactly matched
    if (matched.has(word)) continue;

    const stripped = stripSuffix(word);
    if (stripped) {
      const { base, suffix } = stripped;

      // Try to resolve the base
      const resolved = resolveStem(base, foodKeySet);
      if (resolved && !matched.has(resolved)) {
        matched.add(resolved);
      }

      // Also try the suffix itself as food (e.g. "gryta" is a food key)
      if (foodKeySet.has(suffix) && !matched.has(suffix)) {
        // Only add suffix if the base was NOT resolved — avoid double-counting
        // e.g. "lammgryta" → "lamm" + "gryta" (both useful)
        matched.add(suffix);
      }
    }
  }

  // -------------------------------------------------------------------
  // Pass 3: Substring matching (foodKey inside a word, min 4 chars)
  // Skip common Swedish stop words that cause false positives
  // -------------------------------------------------------------------
  const stopWords = new Set(['till', 'från', 'eller', 'under', 'över', 'inte', 'utan', 'alla', 'vara', 'viner', 'vinet', 'wine', 'lite', 'gärna', 'kanske', 'bästa', 'bäst', 'mitt', 'vill', 'finn', 'hitta']);

  for (const word of words) {
    if (word.length < 4) continue;
    if (stopWords.has(word)) continue;

    for (const food of foodKeys) {
      if (food.length < 4) continue;
      if (matched.has(food)) continue;

      // Check if food key is a substring of the word (word must be longer)
      if (word.includes(food) && word !== food && word.length > food.length) {
        if (!Array.from(matched).some(m => m.includes(food))) {
          matched.add(food);
        }
      }

      // Check if word is a substring of a food key (e.g. "grill" in "grillat")
      // Only if word is at least 5 chars to avoid false positives
      if (food.includes(word) && food !== word && word.length >= 5) {
        if (!Array.from(matched).some(m => m.includes(word) || word.includes(m))) {
          matched.add(food);
        }
      }
    }
  }

  // -------------------------------------------------------------------
  // Pass 4: Compound word splitting for long words not yet matched
  // Try splitting at every position and matching both halves
  // -------------------------------------------------------------------
  for (const word of words) {
    if (word.length < 6) continue;
    // Skip if already matched as-is
    if (matched.has(word)) continue;

    for (let i = 3; i <= word.length - 3; i++) {
      const left = word.slice(0, i);
      const right = word.slice(i);

      const resolvedLeft = resolveStem(left, foodKeySet);
      const resolvedRight = resolveStem(right, foodKeySet);

      if (resolvedLeft && !matched.has(resolvedLeft)) {
        matched.add(resolvedLeft);
      }
      if (resolvedRight && !matched.has(resolvedRight)) {
        matched.add(resolvedRight);
      }
    }
  }

  return Array.from(matched);
}

// ============================================================================
// Test cases (commented out — uncomment to verify)
// ============================================================================
//
// import { FOOD_TO_WINE_STYLES } from './food-pairing';
// const foodKeys = Object.keys(FOOD_TO_WINE_STYLES);
//
// console.log('viltstek →', fuzzyMatchFood('viltstek', foodKeys));
// // Expected: ["vilt"] or ["vilt", "stek"]
//
// console.log('fiskrätt →', fuzzyMatchFood('fiskrätt', foodKeys));
// // Expected: ["fisk"]
//
// console.log('kycklingfilé →', fuzzyMatchFood('kycklingfilé', foodKeys));
// // Expected: ["kyckling"]
//
// console.log('lammgryta →', fuzzyMatchFood('lammgryta', foodKeys));
// // Expected: ["lamm", "gryta"]
//
// console.log('grillad lax med potatis →', fuzzyMatchFood('grillad lax med potatis', foodKeys));
// // Expected: subset of ["grillat", "lax", "potatis"]
//
// console.log('räksallad →', fuzzyMatchFood('räksallad', foodKeys));
// // Expected: ["räkor"]
//
// console.log('svampsås →', fuzzyMatchFood('svampsås', foodKeys));
// // Expected: ["svamp"]
//
// console.log('ankbröst →', fuzzyMatchFood('ankbröst', foodKeys));
// // Expected: ["anka"] or ["ankbröst"] (if ankbröst exists in table)
//
// console.log('nötfärs →', fuzzyMatchFood('nötfärs', foodKeys));
// // Expected: ["nötkött"]
