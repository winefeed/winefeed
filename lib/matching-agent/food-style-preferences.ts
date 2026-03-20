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
  'stek':           { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },

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
  'kantareller':    { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'karl-johan':     { body: ['medium'],           tannin: ['medium'],           acidity: ['medium', 'high'] },
  'trattkantareller': { body: ['light', 'medium'], tannin: ['low', 'medium'],   acidity: ['medium', 'high'] },

  // ========================================================================
  // GAP FILL — Swedish restaurant menu coverage (2026-03)
  // ========================================================================

  // --- More seafood ---
  'torskrygg':      { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'piggvar':        { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'sjötunga':       { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'abborre':        { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'gös':            { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'röding':         { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'gädda':          { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'sik':            { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'makrill':        { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['high'] },
  'rödspätta':      { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'kummel':         { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'hälleflundra':   { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'tonfisk':        { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },
  'kammusslor':     { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'havskräfta':     { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'calamari':       { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'bläckfisk':      { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['high'] },
  'havsöring':      { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'gravad lax':     { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'gravlax':        { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'löjrom':         { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'skaldjursplatå': { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'kräftskiva':     { body: ['light'],            tannin: ['low'],              acidity: ['high'] },

  // --- More red meat / game ---
  'lammlägg':       { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
  'lammstek':       { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
  'pepparstek':     { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },
  'högrev':         { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },
  'flankstek':      { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },
  'ryggbiff':       { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },
  'oxbringa':       { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },
  'oxsvans':        { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
  'carpaccio':      { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'tartar':         { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'tartare':        { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'råbiff':         { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'renstek':        { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium', 'high'] },
  'renskav':        { body: ['medium'],           tannin: ['medium'],           acidity: ['medium', 'high'] },
  'renkött':        { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium', 'high'] },
  'benmärg':        { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },
  'fasan':          { body: ['medium'],           tannin: ['medium'],           acidity: ['medium', 'high'] },
  'rapphöna':       { body: ['medium'],           tannin: ['medium'],           acidity: ['medium', 'high'] },

  // --- Poultry / veal extended ---
  'kalv':           { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'kalvschnitzel':  { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'gås':            { body: ['medium'],           tannin: ['medium'],           acidity: ['medium', 'high'] },
  'kanin':          { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },

  // --- Pork extended ---
  'fläskkarré':     { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'fläskkotlett':   { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'revbensspjäll':  { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },
  'spareribs':      { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },
  'brisket':        { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },
  'korv':           { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'falukorv':       { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'prinskorv':      { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'isterband':      { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },

  // --- Swedish classics ---
  'toast skagen':   { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'wallenbergare':  { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'pytt i panna':   { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'köttbullar':     { body: ['medium'],           tannin: ['medium'],           acidity: ['medium', 'high'] },
  'janssons frestelse': { body: ['light', 'medium'], tannin: ['low'],           acidity: ['medium'] },
  'smörgåstårta':   { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'smörgåsbord':    { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'julbord':        { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'kroppkakor':     { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'raggmunk':       { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'blodpudding':    { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'palt':           { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },
  'ärtsoppa':       { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'sill':           { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'inlagd sill':    { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'strömming':      { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'stekt strömming': { body: ['light'],           tannin: ['low'],              acidity: ['high'] },
  'lutfisk':        { body: ['light'],            tannin: ['low'],              acidity: ['medium'] },
  'husmanskost':    { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'dillkött':       { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'kalops':         { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'pannbiff':       { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'sjömansbiff':    { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'oxrulad':        { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
  'schnitzel':      { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'planka':         { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
  'kålpudding':     { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },
  'kåldolmar':      { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },
  'flygande jacob': { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'fläskpannkaka':  { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'räkmacka':       { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'västerbottenpaj': { body: ['medium'],          tannin: ['low', 'medium'],    acidity: ['medium'] },
  'köttfärssås':    { body: ['medium'],           tannin: ['medium'],           acidity: ['high'] },

  // --- Italian extended ---
  'carbonara':      { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'cacio e pepe':   { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'bolognese':      { body: ['medium'],           tannin: ['medium'],           acidity: ['high'] },
  'lasagne':        { body: ['medium'],           tannin: ['medium'],           acidity: ['high'] },
  'vitello tonnato': { body: ['light', 'medium'], tannin: ['low'],              acidity: ['medium', 'high'] },
  'burrata':        { body: ['light'],            tannin: ['low'],              acidity: ['medium'] },
  'osso buco':      { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
  'pesto':          { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'ragù':           { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['high'] },
  'gnocchi':        { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'bruschetta':     { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'antipasti':      { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },

  // --- French ---
  'bouillabaisse':  { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'coq au vin':     { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'confit':         { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },
  'cassoulet':      { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
  'boeuf bourguignon': { body: ['medium', 'full'], tannin: ['medium'],          acidity: ['medium'] },
  'steak frites':   { body: ['full'],             tannin: ['medium', 'high'],   acidity: ['medium'] },
  'béarnaise':      { body: ['medium', 'full'],   tannin: ['medium', 'high'],   acidity: ['medium'] },
  'quiche':         { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'ratatouille':    { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'gratin':         { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },
  'escargot':       { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },

  // --- Spanish ---
  'paella':         { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'jamón':          { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'patatas bravas': { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },

  // --- Mediterranean / Middle Eastern ---
  'mezze':          { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'falafel':        { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'hummus':         { body: ['light'],            tannin: ['low'],              acidity: ['medium'] },
  'kebab':          { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'shawarma':       { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'lahmacun':       { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'kofta':          { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },
  'börek':          { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'moussaka':       { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },

  // --- Asian extended ---
  'pad thai':       { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'ramen':          { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'pho':            { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'bibimbap':       { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['high'] },
  'dim sum':        { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'dumplings':      { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'kimchi':         { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'miso':           { body: ['light'],            tannin: ['low'],              acidity: ['medium'] },
  'yakitori':       { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'tonkotsu':       { body: ['medium'],           tannin: ['low'],              acidity: ['medium'] },
  'donburi':        { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'gyoza':          { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'tempura':        { body: ['light'],            tannin: ['low'],              acidity: ['high'] },
  'teriyaki':       { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'katsu':          { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'wok':            { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'bao buns':       { body: ['light'],            tannin: ['low'],              acidity: ['medium'] },
  'korean bbq':     { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['high'] },
  'ssam':           { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['high'] },
  'japansk curry':  { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },

  // --- Vegetarian / vegan ---
  'halloumi':       { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'linser':         { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },
  'bönor':          { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },
  'kikärtor':       { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },
  'tofu':           { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'tempeh':         { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },
  'aubergine':      { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },
  'rödbeta':        { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium', 'high'] },
  'blomkål':        { body: ['light'],            tannin: ['low'],              acidity: ['medium'] },
  'pumpa':          { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'sötpotatis':     { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'rotfrukter':     { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'grönkål':        { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'spenat':         { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },

  // --- Desserts ---
  'crème brûlée':   { body: ['medium', 'full'],   tannin: ['low'],              acidity: ['low', 'medium'] },
  'kladdkaka':      { body: ['full'],             tannin: ['low', 'medium'],    acidity: ['low'] },
  'panna cotta':    { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['low'] },
  'pannacotta':     { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['low'] },
  'chokladfondant': { body: ['full'],             tannin: ['low', 'medium'],    acidity: ['low'] },
  'äppelpaj':       { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'äppelkaka':      { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'tiramisu':       { body: ['medium', 'full'],   tannin: ['low'],              acidity: ['low'] },
  'crumble':        { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'brownie':        { body: ['full'],             tannin: ['low', 'medium'],    acidity: ['low'] },
  'semla':          { body: ['light'],            tannin: ['low'],              acidity: ['low', 'medium'] },
  'tårta':          { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['low'] },

  // --- Soups ---
  'soppa':          { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'svampsoppa':     { body: ['medium'],           tannin: ['low', 'medium'],    acidity: ['medium'] },
  'hummersoppa':    { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'fisksoppa':      { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'fiskgryta':      { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium', 'high'] },

  // --- Street food / casual ---
  'tacos':          { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'nachos':         { body: ['light', 'medium'],  tannin: ['low', 'medium'],    acidity: ['medium'] },
  'sandwich':       { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['medium'] },
  'wrap':           { body: ['light'],            tannin: ['low'],              acidity: ['medium'] },
  'poke':           { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'bowl':           { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'bbq':            { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },

  // --- Cheese ---
  'getost':         { body: ['light', 'medium'],  tannin: ['low'],              acidity: ['high'] },
  'lagrad ost':     { body: ['medium', 'full'],   tannin: ['medium'],           acidity: ['medium'] },
  'ostbricka':      { body: ['medium'],           tannin: ['medium'],           acidity: ['medium'] },

  // --- Starters / misc ---
  'sparris':        { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'grönsaker':      { body: ['light'],            tannin: ['low'],              acidity: ['medium', 'high'] },
  'avokado':        { body: ['light'],            tannin: ['low'],              acidity: ['medium'] },
};
