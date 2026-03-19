/**
 * Food → Wine Style Preferences
 *
 * Maps food categories to preferred wine body/tannin/acidity.
 * Used by the pre-scorer to apply style-aware bonus/penalty.
 */

export interface StylePreference {
  body: string[];
  tannin: string[];
  acidity: string[];
}

/**
 * Food category → preferred wine style profiles.
 * Swedish keywords matching FOOD_TO_WINE_STYLES in food-pairing.ts.
 */
export const FOOD_STYLE_PREFERENCES: Record<string, StylePreference> = {
  // Seafood — light, low tannin, high acidity
  'fisk':           { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'skaldjur':       { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'ostron':         { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'hummer':         { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'räkor':          { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'musslor':        { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'kräftor':        { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'lax':            { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'torsk':          { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'ceviche':        { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'sushi':          { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'sashimi':        { body: ['light'],            tannin: ['low'],              acidity: ['high'] },

  // Red meats — full body, higher tannin
  'nötkött':        { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },
  'biff':           { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },
  'entrecote':      { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },
  'entrecôte':      { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },
  'oxfilé':         { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },
  'steak':          { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },

  // Game — full body, good structure
  'vilt':           { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium', 'high'] },
  'älg':            { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium', 'high'] },
  'hjort':          { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium', 'high'] },
  'rådjur':         { body: ['medium'],           tannin: ['medium'],           acidity: ['medium', 'high'] },
  'vildsvin':       { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },

  // Lamb
  'lamm':           { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
  'lammracks':      { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },

  // Poultry — light to medium
  'kyckling':       { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'anka':           { body: ['medium'],           tannin: ['medium'],           acidity: ['medium', 'high'] },
  'ankbröst':       { body: ['medium'],           tannin: ['medium'],           acidity: ['medium', 'high'] },

  // Pork
  'fläsk':          { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'fläskfilé':      { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'pulled pork':    { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },

  // Grilled
  'grillat':        { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },
  'burger':         { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },
  'hamburgare':     { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },

  // Stews
  'gryta':          { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },
  'köttgryta':      { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
  'viltgryta':      { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium', 'high'] },

  // Italian
  'pasta':          { body: ['medium'],           tannin: ['medium'],           acidity: ['high'] },
  'pizza':          { body: ['medium'],           tannin: ['medium'],           acidity: ['high'] },
  'risotto':        { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },

  // Cheese
  'ost':            { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },

  // Charcuterie
  'chark':          { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'charkuterier':   { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },

  // Salad / light
  'sallad':         { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'vegetariskt':    { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },

  // Asian / spicy
  'thai':           { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'indisk':         { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'curry':          { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'koreanskt':      { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['high'] },
  'asiatiskt':      { body: ['light'],            tannin: ['low'],              acidity: ['high'] },

  // Dessert
  'dessert':        { body: ['medium', 'full'],   tannin: ['low'],              acidity: ['low'] },
  'choklad':        { body: ['full'],             tannin: ['low', 'medium'],    acidity: ['low'] },

  // Foie gras
  'foie gras':      { body: ['medium', 'full'],   tannin: ['low'],              acidity: ['medium'] },
  'anklever':       { body: ['medium', 'full'],   tannin: ['low'],              acidity: ['medium'] },

  // Tapas
  'tapas':          { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },

  // Svamp
  'svamp':          { body: ['medium'],           tannin: ['medium'],           acidity: ['medium', 'high'] },
  'tryffel':        { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
};
