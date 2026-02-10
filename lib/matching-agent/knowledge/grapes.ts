/**
 * GRAPE ENCYCLOPEDIA
 *
 * Structured wine grape knowledge for the sommelier matching agent.
 * ~60 grapes covering all major varieties relevant to Swedish restaurant market.
 *
 * Used by: pre-scorer (taste profile matching), AI re-ranker (prompt enrichment),
 *          food-pairing (grape → food affinity)
 */

export interface GrapeProfile {
  /** Canonical name */
  name: string;
  /** Known synonyms/aliases */
  synonyms: string[];
  /** red | white | rosé */
  color: 'red' | 'white';
  /** Taste profile 1-5 scale */
  body: 1 | 2 | 3 | 4 | 5;
  tannin: 0 | 1 | 2 | 3 | 4 | 5;       // 0 for white
  acidity: 1 | 2 | 3 | 4 | 5;
  /** Primary fruit character */
  fruitProfile: string[];
  /** Secondary aromas (oak, mineral, floral, etc.) */
  secondaryAromas: string[];
  /** Best-known regions */
  keyRegions: string[];
  /** Common blending partners */
  blendPartners: string[];
  /** Foods this grape pairs well with */
  foodAffinities: string[];
  /** Serving temperature range °C */
  servingTempC: [number, number];
  /** Decanting recommended */
  decanting: 'no' | 'optional' | 'recommended';
  /** Aging potential */
  agingPotential: 'drink-young' | 'medium' | 'long';
  /** How common on Swedish market (restaurant/Systembolaget) */
  swedenPopularity: 'very-common' | 'common' | 'niche' | 'rare';
  /** Brief sommelier description in Swedish */
  description: string;
}

export const GRAPE_ENCYCLOPEDIA: Record<string, GrapeProfile> = {
  // ═══════════════════════════════════════════
  // RED GRAPES
  // ═══════════════════════════════════════════

  'Cabernet Sauvignon': {
    name: 'Cabernet Sauvignon',
    synonyms: ['Cab Sav', 'Cabernet'],
    color: 'red',
    body: 5,
    tannin: 5,
    acidity: 3,
    fruitProfile: ['svarta vinbär', 'björnbär', 'plommon', 'ceder'],
    secondaryAromas: ['ek', 'vanilj', 'tobak', 'grafitmineral', 'eucalyptus'],
    keyRegions: ['Bordeaux', 'Napa Valley', 'Coonawarra', 'Maipo Valley', 'Bolgheri'],
    blendPartners: ['Merlot', 'Cabernet Franc', 'Petit Verdot', 'Malbec'],
    foodAffinities: ['nötkött', 'lamm', 'vilt', 'hårda ostar', 'grillat'],
    servingTempC: [16, 18],
    decanting: 'recommended',
    agingPotential: 'long',
    swedenPopularity: 'very-common',
    description: 'Kraftfull och tanninrik med svarta vinbär och ceder. Klassisk till rött kött och vilt.'
  },

  'Merlot': {
    name: 'Merlot',
    synonyms: [],
    color: 'red',
    body: 4,
    tannin: 3,
    acidity: 2,
    fruitProfile: ['plommon', 'körsbär', 'blåbär', 'fikon'],
    secondaryAromas: ['choklad', 'ek', 'vanilj', 'kryddor'],
    keyRegions: ['Bordeaux', 'Toscana', 'Chile', 'Washington State'],
    blendPartners: ['Cabernet Sauvignon', 'Cabernet Franc', 'Petit Verdot'],
    foodAffinities: ['lamm', 'anka', 'pasta med köttsås', 'svamp', 'halvhårda ostar'],
    servingTempC: [15, 17],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'very-common',
    description: 'Rund och mjuk med mogna plommon och körsbär. Tillgänglig och mångsidig matvin.'
  },

  'Pinot Noir': {
    name: 'Pinot Noir',
    synonyms: ['Spätburgunder', 'Pinot Nero', 'Blauburgunder'],
    color: 'red',
    body: 2,
    tannin: 2,
    acidity: 4,
    fruitProfile: ['körsbär', 'hallon', 'jordgubbar', 'tranbär'],
    secondaryAromas: ['svamp', 'skogsbotten', 'violer', 'kryddnejlika', 'rök'],
    keyRegions: ['Bourgogne', 'Oregon', 'Marlborough', 'Central Otago', 'Baden', 'Champagne'],
    blendPartners: ['Chardonnay', 'Pinot Meunier'],
    foodAffinities: ['anka', 'kyckling', 'lax', 'svamp', 'mjuka ostar', 'fläskkotlett'],
    servingTempC: [14, 16],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'very-common',
    description: 'Elegant och aromatisk med röda bär och jordiga toner. Sommelierens favorit — otroligt mångsidigt matvin.'
  },

  'Syrah': {
    name: 'Syrah',
    synonyms: ['Shiraz'],
    color: 'red',
    body: 5,
    tannin: 4,
    acidity: 3,
    fruitProfile: ['björnbär', 'blåbär', 'svarta plommon', 'svarta oliver'],
    secondaryAromas: ['svartpeppar', 'rök', 'lakrits', 'charkuteri', 'violer'],
    keyRegions: ['Rhône', 'Barossa Valley', 'McLaren Vale', 'Languedoc', 'Washington State'],
    blendPartners: ['Grenache', 'Mourvèdre', 'Viognier'],
    foodAffinities: ['grillat kött', 'vilt', 'lamm', 'charkuteri', 'starka ostar', 'gryta'],
    servingTempC: [16, 18],
    decanting: 'recommended',
    agingPotential: 'long',
    swedenPopularity: 'very-common',
    description: 'Mörk och kryddig med svartpeppar och mörka bär. Syrah från Rhône är elegant, Shiraz från Australien är kraftigare.'
  },

  'Grenache': {
    name: 'Grenache',
    synonyms: ['Garnacha', 'Cannonau'],
    color: 'red',
    body: 4,
    tannin: 2,
    acidity: 2,
    fruitProfile: ['körsbär', 'hallon', 'jordgubbar', 'röda plommon'],
    secondaryAromas: ['lavendel', 'garrigue', 'kryddor', 'karamell'],
    keyRegions: ['Rhône', 'Priorat', 'Sardinien', 'Languedoc', 'Châteauneuf-du-Pape'],
    blendPartners: ['Syrah', 'Mourvèdre', 'Tempranillo', 'Carignan'],
    foodAffinities: ['grillat lamm', 'ratatouille', 'chorizo', 'kryddiga rätter', 'paella'],
    servingTempC: [15, 17],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'common',
    description: 'Generös och varm med röda bär och örter. Ryggraden i södra Rhônes och Spaniens bästa viner.'
  },

  'Tempranillo': {
    name: 'Tempranillo',
    synonyms: ['Tinta de Toro', 'Tinto Fino', 'Cencibel', 'Aragonez'],
    color: 'red',
    body: 4,
    tannin: 3,
    acidity: 3,
    fruitProfile: ['körsbär', 'plommon', 'fikon', 'torkade bär'],
    secondaryAromas: ['läder', 'tobak', 'vanilj', 'ek', 'kryddor'],
    keyRegions: ['Rioja', 'Ribera del Duero', 'Toro', 'Douro'],
    blendPartners: ['Grenache', 'Graciano', 'Mazuelo', 'Touriga Nacional'],
    foodAffinities: ['lamm', 'grillat fläsk', 'chorizo', 'manchego', 'paella'],
    servingTempC: [16, 18],
    decanting: 'recommended',
    agingPotential: 'long',
    swedenPopularity: 'very-common',
    description: 'Spaniens ädla druva med körsbär, läder och vanilj. Gran Reserva visar otrolig komplexitet.'
  },

  'Nebbiolo': {
    name: 'Nebbiolo',
    synonyms: ['Spanna', 'Chiavennasca'],
    color: 'red',
    body: 4,
    tannin: 5,
    acidity: 5,
    fruitProfile: ['körsbär', 'hallon', 'rosenblad', 'torkade bär'],
    secondaryAromas: ['tjära', 'rosor', 'tryffel', 'läder', 'kryddor', 'lakrits'],
    keyRegions: ['Barolo', 'Barbaresco', 'Langhe', 'Roero', 'Valtellina'],
    blendPartners: [],
    foodAffinities: ['tryffel', 'vilt', 'braserat kött', 'risotto', 'hårda ostar', 'pasta med köttragu'],
    servingTempC: [16, 18],
    decanting: 'recommended',
    agingPotential: 'long',
    swedenPopularity: 'common',
    description: 'Piemontes kung — ljus färg men enorm tannin och syra. Tjära, rosor och tryffel. Kräver tid eller dekantering.'
  },

  'Sangiovese': {
    name: 'Sangiovese',
    synonyms: ['Brunello', 'Morellino', 'Prugnolo Gentile', 'Nielluccio'],
    color: 'red',
    body: 3,
    tannin: 4,
    acidity: 4,
    fruitProfile: ['körsbär', 'plommon', 'röda vinbär', 'tomat'],
    secondaryAromas: ['ek', 'läder', 'tobak', 'torkade örter', 'te'],
    keyRegions: ['Chianti', 'Montalcino', 'Montepulciano', 'Bolgheri'],
    blendPartners: ['Cabernet Sauvignon', 'Merlot', 'Canaiolo'],
    foodAffinities: ['pasta', 'pizza', 'tomat-rätter', 'kalvkött', 'viltfågel', 'parmesan'],
    servingTempC: [16, 18],
    decanting: 'optional',
    agingPotential: 'long',
    swedenPopularity: 'very-common',
    description: 'Toscanas själ — körsbär, tomat och örter med fast syra. Perfekt till italienskt kök.'
  },

  'Malbec': {
    name: 'Malbec',
    synonyms: ['Côt', 'Auxerrois'],
    color: 'red',
    body: 5,
    tannin: 4,
    acidity: 3,
    fruitProfile: ['plommon', 'björnbär', 'blåbär', 'svarta körsbär'],
    secondaryAromas: ['choklad', 'violer', 'kaffe', 'ek', 'läder'],
    keyRegions: ['Mendoza', 'Cahors', 'Salta', 'Uco Valley'],
    blendPartners: ['Cabernet Sauvignon', 'Merlot', 'Bonarda'],
    foodAffinities: ['biff', 'grillat kött', 'empanadas', 'hårda ostar'],
    servingTempC: [16, 18],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'very-common',
    description: 'Mörk och fruktig med mogna plommon och choklad. Argentinas flaggskepp — fantastisk till grillar.'
  },

  'Cabernet Franc': {
    name: 'Cabernet Franc',
    synonyms: ['Bouchet', 'Breton'],
    color: 'red',
    body: 3,
    tannin: 3,
    acidity: 4,
    fruitProfile: ['hallon', 'körsbär', 'röda vinbär', 'paprika'],
    secondaryAromas: ['violer', 'grafitmineral', 'gröna toner', 'tobak'],
    keyRegions: ['Loire', 'Saint-Émilion', 'Friuli', 'Finger Lakes'],
    blendPartners: ['Cabernet Sauvignon', 'Merlot'],
    foodAffinities: ['kyckling', 'fläsk', 'grönsaker', 'getost', 'charkuteri'],
    servingTempC: [14, 16],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'common',
    description: 'Elegantare och lättare än Cabernet Sauvignon med hallon, violer och en grön kryddighet. Naturvinsfavorit från Loire.'
  },

  'Gamay': {
    name: 'Gamay',
    synonyms: ['Gamay Noir'],
    color: 'red',
    body: 2,
    tannin: 1,
    acidity: 4,
    fruitProfile: ['körsbär', 'hallon', 'jordgubbar', 'banan'],
    secondaryAromas: ['violer', 'peppar', 'jord'],
    keyRegions: ['Beaujolais', 'Loire', 'Schweiz'],
    blendPartners: ['Pinot Noir'],
    foodAffinities: ['charkuteri', 'kyckling', 'lax', 'vegetariskt', 'sushi'],
    servingTempC: [12, 14],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'common',
    description: 'Lätt, fruktig och livlig. Beaujolais cru-viner (Morgon, Fleurie) visar överraskande djup. Serveras gärna svalt.'
  },

  'Mourvèdre': {
    name: 'Mourvèdre',
    synonyms: ['Monastrell', 'Mataro'],
    color: 'red',
    body: 5,
    tannin: 4,
    acidity: 3,
    fruitProfile: ['björnbär', 'blåbär', 'svarta plommon'],
    secondaryAromas: ['kött', 'läder', 'garrigue', 'svartpeppar', 'jord'],
    keyRegions: ['Bandol', 'Rhône', 'Jumilla', 'Barossa Valley'],
    blendPartners: ['Grenache', 'Syrah', 'Cinsault'],
    foodAffinities: ['vilt', 'grillat lamm', 'gryta', 'starka kryddor'],
    servingTempC: [16, 18],
    decanting: 'recommended',
    agingPotential: 'long',
    swedenPopularity: 'niche',
    description: 'Mörk, köttigt och vild med toner av garrigue. Ger rygg och djup i GSM-blends. Bandol är referensen.'
  },

  'Carignan': {
    name: 'Carignan',
    synonyms: ['Carignane', 'Cariñena', 'Mazuelo'],
    color: 'red',
    body: 4,
    tannin: 4,
    acidity: 3,
    fruitProfile: ['körsbär', 'plommon', 'örter'],
    secondaryAromas: ['garrigue', 'lakrits', 'jord', 'kryddor'],
    keyRegions: ['Languedoc', 'Priorat', 'Sardinien'],
    blendPartners: ['Grenache', 'Syrah', 'Mourvèdre'],
    foodAffinities: ['gryta', 'lamm', 'medelhavskök', 'korv'],
    servingTempC: [15, 17],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'niche',
    description: 'Rustik och jordig med hög tannin. Gamla stockar ger koncentrerade, komplexa viner. Populär i naturvin.'
  },

  'Cinsault': {
    name: 'Cinsault',
    synonyms: ['Cinsaut'],
    color: 'red',
    body: 2,
    tannin: 1,
    acidity: 3,
    fruitProfile: ['jordgubbar', 'körsbär', 'hallon'],
    secondaryAromas: ['blommor', 'kryddor'],
    keyRegions: ['Languedoc', 'Sydafrika', 'Libanon'],
    blendPartners: ['Grenache', 'Syrah', 'Carignan'],
    foodAffinities: ['sallad', 'fisk', 'lätt lunch', 'charkuteri'],
    servingTempC: [12, 15],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'niche',
    description: 'Lätt och blommig med jordgubbar. Gör utmärkta rosé-viner. Ofta i naturvinssammanhang.'
  },

  'Nero d\'Avola': {
    name: 'Nero d\'Avola',
    synonyms: ['Calabrese'],
    color: 'red',
    body: 4,
    tannin: 3,
    acidity: 3,
    fruitProfile: ['plommon', 'körsbär', 'mörka bär'],
    secondaryAromas: ['choklad', 'kryddor', 'örter'],
    keyRegions: ['Sicilien'],
    blendPartners: ['Frappato', 'Syrah'],
    foodAffinities: ['pasta', 'grillat kött', 'aubergine', 'sicilianskt kök'],
    servingTempC: [15, 17],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'common',
    description: 'Siciliens stolthet — mörk och generös med mogna plommon och choklad. Bra prisläge.'
  },

  'Barbera': {
    name: 'Barbera',
    synonyms: [],
    color: 'red',
    body: 3,
    tannin: 2,
    acidity: 5,
    fruitProfile: ['körsbär', 'plommon', 'hallon'],
    secondaryAromas: ['kryddor', 'ek', 'örter'],
    keyRegions: ['Piemonte', 'Lombardiet'],
    blendPartners: [],
    foodAffinities: ['pizza', 'pasta', 'tomatsås', 'charkuteri', 'svamp'],
    servingTempC: [14, 16],
    decanting: 'no',
    agingPotential: 'medium',
    swedenPopularity: 'common',
    description: 'Hög syra, låg tannin och saftiga körsbär. Piemontes vardagsvin — fantastisk till tomatsås.'
  },

  'Dolcetto': {
    name: 'Dolcetto',
    synonyms: [],
    color: 'red',
    body: 3,
    tannin: 3,
    acidity: 2,
    fruitProfile: ['plommon', 'björnbär', 'körsbär'],
    secondaryAromas: ['mandel', 'lakrits'],
    keyRegions: ['Piemonte'],
    blendPartners: [],
    foodAffinities: ['pasta', 'pizza', 'antipasti', 'vitello tonnato'],
    servingTempC: [14, 16],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'niche',
    description: 'Mjuk och fruktig med bittermandel-finish. Piemontes lunchvin — dricks ungt och svalt.'
  },

  'Aglianico': {
    name: 'Aglianico',
    synonyms: [],
    color: 'red',
    body: 5,
    tannin: 5,
    acidity: 5,
    fruitProfile: ['körsbär', 'plommon', 'mörka bär'],
    secondaryAromas: ['rök', 'choklad', 'läder', 'tjära', 'kryddor'],
    keyRegions: ['Taurasi', 'Aglianico del Vulture', 'Kampanien', 'Basilicata'],
    blendPartners: [],
    foodAffinities: ['braserat kött', 'vilt', 'tryffel', 'starka ostar'],
    servingTempC: [16, 18],
    decanting: 'recommended',
    agingPotential: 'long',
    swedenPopularity: 'niche',
    description: 'Syditaliens Nebbiolo — enorm struktur med hög tannin och syra. Behöver tid. Taurasi är referensen.'
  },

  'Touriga Nacional': {
    name: 'Touriga Nacional',
    synonyms: [],
    color: 'red',
    body: 5,
    tannin: 4,
    acidity: 3,
    fruitProfile: ['björnbär', 'svarta vinbär', 'violer'],
    secondaryAromas: ['rosor', 'lavendel', 'kryddor', 'choklad'],
    keyRegions: ['Douro', 'Dão', 'Alentejo'],
    blendPartners: ['Touriga Franca', 'Tinta Roriz', 'Tinta Cão'],
    foodAffinities: ['grillat kött', 'vilt', 'starka kryddor', 'hårda ostar'],
    servingTempC: [16, 18],
    decanting: 'recommended',
    agingPotential: 'long',
    swedenPopularity: 'niche',
    description: 'Portugals ädlaste druva — intensiv med violer och mörka bär. Huvuddruvan i de bästa portvinerna och torra Douro-vinerna.'
  },

  'Zweigelt': {
    name: 'Zweigelt',
    synonyms: ['Blauer Zweigelt', 'Rotburger'],
    color: 'red',
    body: 3,
    tannin: 2,
    acidity: 3,
    fruitProfile: ['körsbär', 'hallon', 'plommon'],
    secondaryAromas: ['kryddor', 'peppar'],
    keyRegions: ['Österrike', 'Burgenland'],
    blendPartners: ['Blaufränkisch', 'Sankt Laurent'],
    foodAffinities: ['fläsk', 'kyckling', 'wiener schnitzel', 'svamp'],
    servingTempC: [14, 16],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'niche',
    description: 'Österrikes mest odlade röda druva — saftig med körsbär och låg tannin. Mångsidig matvin.'
  },

  'Blaufränkisch': {
    name: 'Blaufränkisch',
    synonyms: ['Lemberger', 'Kékfrankos'],
    color: 'red',
    body: 4,
    tannin: 4,
    acidity: 4,
    fruitProfile: ['björnbär', 'körsbär', 'blåbär'],
    secondaryAromas: ['peppar', 'mineral', 'kryddor', 'jord'],
    keyRegions: ['Burgenland', 'Mittelburgenland', 'Sopron'],
    blendPartners: ['Zweigelt', 'Sankt Laurent'],
    foodAffinities: ['vilt', 'lamm', 'grillat kött', 'starka ostar'],
    servingTempC: [16, 18],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'niche',
    description: 'Österrikes kvalitetsdruva — peppar, mörka bär och fast struktur. Jämförs ibland med Syrah.'
  },

  'Pinotage': {
    name: 'Pinotage',
    synonyms: [],
    color: 'red',
    body: 4,
    tannin: 3,
    acidity: 3,
    fruitProfile: ['plommon', 'björnbär', 'banan', 'röda bär'],
    secondaryAromas: ['rök', 'choklad', 'kaffe', 'tjära'],
    keyRegions: ['Stellenbosch', 'Swartland', 'Paarl'],
    blendPartners: ['Shiraz', 'Cabernet Sauvignon'],
    foodAffinities: ['grillat kött', 'braai', 'biltong', 'kryddiga rätter'],
    servingTempC: [15, 17],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'niche',
    description: 'Sydafrikas egen korsning (Pinot Noir × Cinsault). Rökig, mörk och unik. Tydlig terroir-druva.'
  },

  'Zinfandel': {
    name: 'Zinfandel',
    synonyms: ['Primitivo', 'Tribidrag', 'Crljenak Kaštelanski'],
    color: 'red',
    body: 5,
    tannin: 3,
    acidity: 3,
    fruitProfile: ['björnbär', 'blåbär', 'russin', 'körsbär'],
    secondaryAromas: ['peppar', 'kryddor', 'choklad', 'lakrits'],
    keyRegions: ['Kalifornien', 'Puglia', 'Sonoma', 'Paso Robles'],
    blendPartners: ['Petite Sirah', 'Carignan'],
    foodAffinities: ['bbq', 'burger', 'pizza', 'kryddiga rätter', 'starka ostar'],
    servingTempC: [15, 17],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'common',
    description: 'Kraftig, fruktbomb med höga alkoholgrader. Primitivo i Puglia, Zinfandel i Kalifornien — samma druva.'
  },

  'Mencía': {
    name: 'Mencía',
    synonyms: ['Jaen'],
    color: 'red',
    body: 3,
    tannin: 3,
    acidity: 4,
    fruitProfile: ['hallon', 'körsbär', 'granatäpple'],
    secondaryAromas: ['violer', 'mineral', 'örter', 'peppar'],
    keyRegions: ['Bierzo', 'Ribeira Sacra', 'Valdeorras'],
    blendPartners: [],
    foodAffinities: ['fläsk', 'fågel', 'svamp', 'pulpo', 'tapas'],
    servingTempC: [14, 16],
    decanting: 'optional',
    agingPotential: 'medium',
    swedenPopularity: 'niche',
    description: 'Nordspaniens Pinot Noir — elegant med mineral, violer och röda bär. Bierzo är epicentrum.'
  },

  'Trousseau': {
    name: 'Trousseau',
    synonyms: ['Bastardo'],
    color: 'red',
    body: 2,
    tannin: 2,
    acidity: 4,
    fruitProfile: ['hallon', 'körsbär', 'röda vinbär'],
    secondaryAromas: ['kryddor', 'jord', 'blommor'],
    keyRegions: ['Jura', 'Arbois'],
    blendPartners: ['Poulsard', 'Pinot Noir'],
    foodAffinities: ['charkuteri', 'ost', 'kyckling', 'svamp'],
    servingTempC: [12, 14],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'niche',
    description: 'Juras eleganta druva — lätt, kryddig och jordig. Kultfavorit i naturvinsvärden.'
  },

  'Poulsard': {
    name: 'Poulsard',
    synonyms: ['Ploussard'],
    color: 'red',
    body: 1,
    tannin: 1,
    acidity: 4,
    fruitProfile: ['hallon', 'jordgubbar', 'röda vinbär'],
    secondaryAromas: ['rosor', 'te', 'jord'],
    keyRegions: ['Jura', 'Arbois', 'Pupillin'],
    blendPartners: ['Trousseau', 'Pinot Noir'],
    foodAffinities: ['charkuteri', 'comté', 'fondue', 'sallad'],
    servingTempC: [10, 13],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'niche',
    description: 'Extremt lätt med nästan rosé-aktig färg. Juras signatur — halvtransparent, delikat, jordig.'
  },

  // ═══════════════════════════════════════════
  // WHITE GRAPES
  // ═══════════════════════════════════════════

  'Chardonnay': {
    name: 'Chardonnay',
    synonyms: ['Morillon'],
    color: 'white',
    body: 4,
    tannin: 0,
    acidity: 3,
    fruitProfile: ['äpple', 'citron', 'persika', 'tropisk frukt'],
    secondaryAromas: ['smör', 'vanilj', 'ek', 'hasselnöt', 'mineral'],
    keyRegions: ['Bourgogne', 'Champagne', 'Kalifornien', 'Margaret River', 'Chablis'],
    blendPartners: ['Pinot Noir', 'Pinot Meunier'],
    foodAffinities: ['hummer', 'kyckling', 'fisk i smörsås', 'risotto', 'mjuka ostar'],
    servingTempC: [10, 13],
    decanting: 'no',
    agingPotential: 'medium',
    swedenPopularity: 'very-common',
    description: 'Kameleonten — mineraldrivet i Chablis, smörrikt i Kalifornien. Världens mest mångsidiga vita druva.'
  },

  'Sauvignon Blanc': {
    name: 'Sauvignon Blanc',
    synonyms: ['Fumé Blanc'],
    color: 'white',
    body: 2,
    tannin: 0,
    acidity: 5,
    fruitProfile: ['grapefrukt', 'krusbär', 'passionsfrukt', 'citron'],
    secondaryAromas: ['gräs', 'fläder', 'mineral', 'grön paprika'],
    keyRegions: ['Marlborough', 'Sancerre', 'Pouilly-Fumé', 'Bordeaux', 'Styrien'],
    blendPartners: ['Sémillon'],
    foodAffinities: ['skaldjur', 'getost', 'sallad', 'asiatiskt', 'sparris', 'ceviche'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'very-common',
    description: 'Fräsch och aromatisk med krusbär och citrus. Nyzeeländsk stil är tropisk, Loire är mineraldriven.'
  },

  'Riesling': {
    name: 'Riesling',
    synonyms: ['Rheinriesling', 'Weisser Riesling'],
    color: 'white',
    body: 2,
    tannin: 0,
    acidity: 5,
    fruitProfile: ['lime', 'äpple', 'persika', 'aprikos'],
    secondaryAromas: ['petroleum', 'mineral', 'honung', 'ingefära'],
    keyRegions: ['Mosel', 'Alsace', 'Rheingau', 'Clare Valley', 'Österrike'],
    blendPartners: [],
    foodAffinities: ['asiatiskt', 'thai', 'indiskt', 'fläsk', 'skaldjur', 'kryddiga rätter', 'anka'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'long',
    swedenPopularity: 'very-common',
    description: 'Laserexakt syra med otrolig klarhet. Från stentorr till söt. Åldras magnifikt — petroleum och honung.'
  },

  'Pinot Grigio': {
    name: 'Pinot Grigio',
    synonyms: ['Pinot Gris', 'Grauburgunder', 'Ruländer'],
    color: 'white',
    body: 3,
    tannin: 0,
    acidity: 3,
    fruitProfile: ['päron', 'äpple', 'citron', 'persika'],
    secondaryAromas: ['mandel', 'honung', 'kryddor'],
    keyRegions: ['Alto Adige', 'Alsace', 'Oregon', 'Pfalz'],
    blendPartners: [],
    foodAffinities: ['fisk', 'sallad', 'lätt pasta', 'antipasti', 'sushi'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'very-common',
    description: 'Pinot Grigio (lätt, fräsch) vs Pinot Gris (rikare, Alsace-stil). Populär aperitif.'
  },

  'Gewürztraminer': {
    name: 'Gewürztraminer',
    synonyms: ['Gewürz', 'Traminer'],
    color: 'white',
    body: 4,
    tannin: 0,
    acidity: 2,
    fruitProfile: ['lychee', 'ros', 'mango', 'passionsfrukt'],
    secondaryAromas: ['kryddor', 'ingefära', 'kanel', 'muskot'],
    keyRegions: ['Alsace', 'Alto Adige', 'Pfalz', 'Nya Zeeland'],
    blendPartners: [],
    foodAffinities: ['asiatiskt', 'indiskt', 'foie gras', 'starka ostar', 'thai'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'medium',
    swedenPopularity: 'common',
    description: 'Exotisk och aromatisk med lychee och rosor. Bästa följeslagaren till kryddstarkt asiatiskt kök.'
  },

  'Viognier': {
    name: 'Viognier',
    synonyms: [],
    color: 'white',
    body: 4,
    tannin: 0,
    acidity: 2,
    fruitProfile: ['aprikos', 'persika', 'mango', 'päron'],
    secondaryAromas: ['blommor', 'honung', 'kryddor'],
    keyRegions: ['Condrieu', 'Rhône', 'Languedoc', 'Kalifornien', 'Australien'],
    blendPartners: ['Marsanne', 'Roussanne', 'Syrah'],
    foodAffinities: ['hummer', 'kräftor', 'kyckling i gräddsås', 'kryddiga rätter'],
    servingTempC: [10, 12],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'common',
    description: 'Fyllig och blommig med aprikos och persika. Condrieu är referensen — dyr men magnifik.'
  },

  'Chenin Blanc': {
    name: 'Chenin Blanc',
    synonyms: ['Steen', 'Pineau de la Loire'],
    color: 'white',
    body: 3,
    tannin: 0,
    acidity: 5,
    fruitProfile: ['äpple', 'päron', 'kvitte', 'honung'],
    secondaryAromas: ['vax', 'lanolin', 'blommor', 'mineral'],
    keyRegions: ['Loire', 'Vouvray', 'Savennières', 'Swartland', 'Stellenbosch'],
    blendPartners: [],
    foodAffinities: ['fisk', 'kyckling', 'fläsk', 'asiatiskt', 'ostar', 'fruktdesserter'],
    servingTempC: [8, 11],
    decanting: 'no',
    agingPotential: 'long',
    swedenPopularity: 'common',
    description: 'Från knastertorr till honigsöt. Loireskarablig syra med äpple och vax. Sydafrikas stolthet bland vita.'
  },

  'Grüner Veltliner': {
    name: 'Grüner Veltliner',
    synonyms: ['Grüner', 'GruVe'],
    color: 'white',
    body: 2,
    tannin: 0,
    acidity: 4,
    fruitProfile: ['citron', 'äpple', 'grapefrukt'],
    secondaryAromas: ['vitpeppar', 'lins', 'mineral', 'örter'],
    keyRegions: ['Wachau', 'Kamptal', 'Kremstal', 'Wien'],
    blendPartners: [],
    foodAffinities: ['wiener schnitzel', 'sparris', 'sushi', 'fisk', 'sallad'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'medium',
    swedenPopularity: 'common',
    description: 'Österrikes flaggskepp — fräscht med vitpeppar och citrus. Otroligt mångsidigt matvin. Smaragd-kvalitet visar djup.'
  },

  'Albariño': {
    name: 'Albariño',
    synonyms: ['Alvarinho'],
    color: 'white',
    body: 2,
    tannin: 0,
    acidity: 4,
    fruitProfile: ['persika', 'aprikos', 'citron', 'grapefrukt'],
    secondaryAromas: ['havsalt', 'mineral', 'blommor'],
    keyRegions: ['Rías Baixas', 'Vinho Verde'],
    blendPartners: ['Loureiro', 'Treixadura'],
    foodAffinities: ['skaldjur', 'fisk', 'ceviche', 'tapas', 'sushi'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'common',
    description: 'Atlantens vita — salt mineral, persika och citrus. Perfekt till skaldjur. Galiciens bästa.'
  },

  'Verdejo': {
    name: 'Verdejo',
    synonyms: [],
    color: 'white',
    body: 2,
    tannin: 0,
    acidity: 4,
    fruitProfile: ['citron', 'krusbär', 'fänkål', 'tropisk frukt'],
    secondaryAromas: ['örter', 'bittermandel', 'gräs'],
    keyRegions: ['Rueda'],
    blendPartners: ['Sauvignon Blanc'],
    foodAffinities: ['tapas', 'fisk', 'sallad', 'skaldjur'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'common',
    description: 'Spaniens svar på Sauvignon Blanc — örtigt, fräscht och prisvärt. Rueda dominerar.'
  },

  'Vermentino': {
    name: 'Vermentino',
    synonyms: ['Rolle', 'Favorita'],
    color: 'white',
    body: 2,
    tannin: 0,
    acidity: 3,
    fruitProfile: ['citron', 'lime', 'äpple', 'persika'],
    secondaryAromas: ['mandel', 'salt', 'örter', 'blommor'],
    keyRegions: ['Sardinien', 'Ligurien', 'Provence', 'Korsika'],
    blendPartners: [],
    foodAffinities: ['fisk', 'skaldjur', 'pasta pesto', 'sallad'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'common',
    description: 'Medelhavets vita — salt, citrus och mandel. Sardisk Vermentino di Gallura har mest karaktär.'
  },

  'Assyrtiko': {
    name: 'Assyrtiko',
    synonyms: [],
    color: 'white',
    body: 3,
    tannin: 0,
    acidity: 5,
    fruitProfile: ['citron', 'lime', 'äpple'],
    secondaryAromas: ['havsalt', 'vulkanmineral', 'rök', 'honung'],
    keyRegions: ['Santorini', 'Attika', 'Makedonien'],
    blendPartners: ['Athiri', 'Aidani'],
    foodAffinities: ['fisk', 'bläckfisk', 'feta', 'medelhavskök', 'skaldjur'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'medium',
    swedenPopularity: 'niche',
    description: 'Santorinis vulkandruva — knivskarp syra med havsalt och mineral. En av Europas mest spännande vita.'
  },

  'Muscadet': {
    name: 'Muscadet',
    synonyms: ['Melon de Bourgogne'],
    color: 'white',
    body: 1,
    tannin: 0,
    acidity: 4,
    fruitProfile: ['citron', 'äpple', 'päron'],
    secondaryAromas: ['jäst', 'bröd', 'havsalt', 'mineral'],
    keyRegions: ['Muscadet-Sèvre et Maine', 'Loire'],
    blendPartners: [],
    foodAffinities: ['ostron', 'musslor', 'skaldjur', 'fisk'],
    servingTempC: [7, 9],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'niche',
    description: 'Knivskarpt och mineraldrivet. Sur lie ger jästighet. Det enda rätta valet till ostron.'
  },

  'Marsanne': {
    name: 'Marsanne',
    synonyms: [],
    color: 'white',
    body: 4,
    tannin: 0,
    acidity: 2,
    fruitProfile: ['äpple', 'persika', 'aprikos'],
    secondaryAromas: ['mandel', 'vax', 'honung'],
    keyRegions: ['Rhône', 'Hermitage', 'Saint-Joseph', 'Australien'],
    blendPartners: ['Roussanne', 'Viognier'],
    foodAffinities: ['kyckling', 'fisk', 'gräddsåser', 'ostar'],
    servingTempC: [10, 12],
    decanting: 'no',
    agingPotential: 'medium',
    swedenPopularity: 'niche',
    description: 'Rund och vaxartad med mandel och persika. Norra Rhônes vita — bäst från Hermitage.'
  },

  'Roussanne': {
    name: 'Roussanne',
    synonyms: [],
    color: 'white',
    body: 3,
    tannin: 0,
    acidity: 3,
    fruitProfile: ['päron', 'persika', 'örter'],
    secondaryAromas: ['te', 'honung', 'blommor'],
    keyRegions: ['Rhône', 'Savoie', 'Languedoc'],
    blendPartners: ['Marsanne', 'Grenache Blanc'],
    foodAffinities: ['fågel', 'fisk', 'asiatiskt', 'ostar'],
    servingTempC: [10, 12],
    decanting: 'no',
    agingPotential: 'medium',
    swedenPopularity: 'niche',
    description: 'Aromatisk och teig med honung och örter. Ger elegans till Rhône-blends.'
  },

  'Torrontés': {
    name: 'Torrontés',
    synonyms: [],
    color: 'white',
    body: 2,
    tannin: 0,
    acidity: 3,
    fruitProfile: ['ros', 'lychee', 'persika', 'citrus'],
    secondaryAromas: ['blommor', 'muskat', 'honung'],
    keyRegions: ['Salta', 'La Rioja (Argentina)', 'Cafayate'],
    blendPartners: [],
    foodAffinities: ['asiatiskt', 'kryddiga rätter', 'sushi', 'sallad'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'niche',
    description: 'Argentinas Gewürztraminer-alternativ — blommig, aromatisk med ros och lychee.'
  },

  'Sémillon': {
    name: 'Sémillon',
    synonyms: [],
    color: 'white',
    body: 3,
    tannin: 0,
    acidity: 2,
    fruitProfile: ['citron', 'fikon', 'persika', 'honung'],
    secondaryAromas: ['vax', 'lanolin', 'nötter', 'toast'],
    keyRegions: ['Bordeaux', 'Hunter Valley', 'Sauternes'],
    blendPartners: ['Sauvignon Blanc', 'Muscadelle'],
    foodAffinities: ['foie gras', 'blåmögelost', 'skaldjur', 'kyckling'],
    servingTempC: [10, 12],
    decanting: 'no',
    agingPotential: 'long',
    swedenPopularity: 'niche',
    description: 'Fyllig och vaxartad. Torr Sémillon åldras otroligt. I Sauternes skapar den himmelsk söt vin.'
  },

  'Savagnin': {
    name: 'Savagnin',
    synonyms: ['Naturé', 'Traminer'],
    color: 'white',
    body: 3,
    tannin: 0,
    acidity: 5,
    fruitProfile: ['äpple', 'citron', 'nötter'],
    secondaryAromas: ['curry', 'valnöt', 'jäst', 'oxidation'],
    keyRegions: ['Jura', 'Château-Chalon', 'Arbois'],
    blendPartners: ['Chardonnay'],
    foodAffinities: ['comté', 'vin jaune-rätter', 'kyckling i gräddsås', 'svamp'],
    servingTempC: [12, 14],
    decanting: 'no',
    agingPotential: 'long',
    swedenPopularity: 'niche',
    description: 'Juras signatur. Ouillé-stil (frisk) populär i naturvin. Vin jaune-stil (oxidativ) med nötter och curry.'
  },

  'Furmint': {
    name: 'Furmint',
    synonyms: [],
    color: 'white',
    body: 3,
    tannin: 0,
    acidity: 5,
    fruitProfile: ['äpple', 'päron', 'lime', 'aprikos'],
    secondaryAromas: ['rök', 'mineral', 'honung', 'kryddor'],
    keyRegions: ['Tokaj', 'Somló'],
    blendPartners: ['Hárslevelű', 'Sárga Muskotály'],
    foodAffinities: ['foie gras', 'fisk', 'asiatiskt', 'desserter'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'long',
    swedenPopularity: 'niche',
    description: 'Ungerns stolthet — vulkanisk mineral och skärande syra. Tokaji Aszú är legendarisk. Torra Furmint-viner ökar.'
  },

  'Godello': {
    name: 'Godello',
    synonyms: ['Gouveio'],
    color: 'white',
    body: 3,
    tannin: 0,
    acidity: 3,
    fruitProfile: ['äpple', 'persika', 'citrus'],
    secondaryAromas: ['mineral', 'örter', 'blommor'],
    keyRegions: ['Valdeorras', 'Bierzo', 'Ribeira Sacra'],
    blendPartners: [],
    foodAffinities: ['fisk', 'skaldjur', 'tapas', 'kyckling'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'medium',
    swedenPopularity: 'niche',
    description: 'Galiciens andra juvel efter Albariño. Mer kropp och komplexitet. Valdeorras och Bierzo producerar de bästa.'
  },

  'Garganega': {
    name: 'Garganega',
    synonyms: [],
    color: 'white',
    body: 2,
    tannin: 0,
    acidity: 3,
    fruitProfile: ['mandel', 'citron', 'äpple', 'persika'],
    secondaryAromas: ['blommor', 'mineral', 'honung'],
    keyRegions: ['Soave', 'Veneto'],
    blendPartners: ['Trebbiano'],
    foodAffinities: ['fisk', 'risotto', 'lätt pasta', 'antipasti'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'common',
    description: 'Soaves huvuddruva — mandelaktig med citrus. Soave Classico visar fin mineral. Recioto di Soave är söt.'
  },

  'Müller-Thurgau': {
    name: 'Müller-Thurgau',
    synonyms: ['Rivaner'],
    color: 'white',
    body: 1,
    tannin: 0,
    acidity: 2,
    fruitProfile: ['äpple', 'persika', 'muskat'],
    secondaryAromas: ['blommor', 'örter'],
    keyRegions: ['Franken', 'Pfalz', 'Österrike', 'Nya Zeeland'],
    blendPartners: [],
    foodAffinities: ['sallad', 'fisk', 'aperitif', 'sushi'],
    servingTempC: [7, 9],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'common',
    description: 'Lättdrucket med muskat-ton. Tyskt vardagsvin. Prisvärt och okomplicerat.'
  },

  'Fiano': {
    name: 'Fiano',
    synonyms: [],
    color: 'white',
    body: 3,
    tannin: 0,
    acidity: 3,
    fruitProfile: ['päron', 'hasselnöt', 'citrus', 'persika'],
    secondaryAromas: ['honung', 'rök', 'kryddor'],
    keyRegions: ['Kampanien', 'Fiano di Avellino', 'Puglia'],
    blendPartners: [],
    foodAffinities: ['skaldjur', 'pasta', 'fisk', 'ostar'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'medium',
    swedenPopularity: 'niche',
    description: 'Syditaliens finaste vita — hasselnöt, honung och citrus. Fiano di Avellino är referensen.'
  },

  'Greco': {
    name: 'Greco',
    synonyms: ['Greco di Tufo'],
    color: 'white',
    body: 3,
    tannin: 0,
    acidity: 4,
    fruitProfile: ['citron', 'äpple', 'persika'],
    secondaryAromas: ['mandel', 'mineral', 'rök'],
    keyRegions: ['Kampanien', 'Greco di Tufo'],
    blendPartners: [],
    foodAffinities: ['fisk', 'skaldjur', 'pasta', 'mozzarella'],
    servingTempC: [8, 10],
    decanting: 'no',
    agingPotential: 'medium',
    swedenPopularity: 'niche',
    description: 'Kampaniens mineraliska vita med citrus och mandel. Fint alternativ till Chablis.'
  },

  'Trebbiano': {
    name: 'Trebbiano',
    synonyms: ['Ugni Blanc'],
    color: 'white',
    body: 1,
    tannin: 0,
    acidity: 4,
    fruitProfile: ['citron', 'äpple', 'päron'],
    secondaryAromas: ['mandel', 'mineral'],
    keyRegions: ['Abruzzo', 'Toscana', 'Cognac'],
    blendPartners: ['Garganega', 'Malvasia'],
    foodAffinities: ['fisk', 'pizza', 'sallad', 'antipasti'],
    servingTempC: [7, 9],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'common',
    description: 'Italiens mest odlade vita — neutral, fräsch och lätt. Bättre som destillat (Cognac) än ensam.'
  },

  'Glera': {
    name: 'Glera',
    synonyms: ['Prosecco'],
    color: 'white',
    body: 1,
    tannin: 0,
    acidity: 3,
    fruitProfile: ['äpple', 'päron', 'citrus'],
    secondaryAromas: ['blommor', 'mandel'],
    keyRegions: ['Valdobbiadene', 'Conegliano', 'Veneto'],
    blendPartners: [],
    foodAffinities: ['aperitif', 'sushi', 'sallad', 'lätta förrätter'],
    servingTempC: [6, 8],
    decanting: 'no',
    agingPotential: 'drink-young',
    swedenPopularity: 'very-common',
    description: 'Proseccos druva — lättbubblig med äpple och blommor. Aperitifens bästa vän.'
  },
};

// ═══════════════════════════════════════════
// LOOKUP FUNCTIONS
// ═══════════════════════════════════════════

/** Normalize grape name for matching (case-insensitive + synonym lookup) */
export function findGrape(name: string): GrapeProfile | null {
  const normalized = name.trim().toLowerCase();

  // Direct match
  for (const [key, grape] of Object.entries(GRAPE_ENCYCLOPEDIA)) {
    if (key.toLowerCase() === normalized) return grape;
  }

  // Synonym match
  for (const grape of Object.values(GRAPE_ENCYCLOPEDIA)) {
    if (grape.synonyms.some(s => s.toLowerCase() === normalized)) return grape;
  }

  return null;
}

/** Get all grapes matching a food context */
export function grapesForFood(food: string): GrapeProfile[] {
  const normalized = food.toLowerCase();
  return Object.values(GRAPE_ENCYCLOPEDIA).filter(grape =>
    grape.foodAffinities.some(f => f.toLowerCase().includes(normalized))
  );
}

/** Get all grapes matching a region */
export function grapesForRegion(region: string): GrapeProfile[] {
  const normalized = region.toLowerCase();
  return Object.values(GRAPE_ENCYCLOPEDIA).filter(grape =>
    grape.keyRegions.some(r => r.toLowerCase().includes(normalized))
  );
}

/** Calculate taste similarity between two grapes (0-1) */
export function grapeSimilarity(a: GrapeProfile, b: GrapeProfile): number {
  let score = 0;
  const maxScore = 20;

  // Body similarity (0-4 diff → 4-0 points)
  score += Math.max(0, 4 - Math.abs(a.body - b.body));

  // Tannin similarity
  score += Math.max(0, 4 - Math.abs(a.tannin - b.tannin));

  // Acidity similarity
  score += Math.max(0, 4 - Math.abs(a.acidity - b.acidity));

  // Same color
  if (a.color === b.color) score += 4;

  // Shared regions
  const sharedRegions = a.keyRegions.filter(r =>
    b.keyRegions.some(br => br.toLowerCase() === r.toLowerCase())
  );
  score += Math.min(4, sharedRegions.length * 2);

  return score / maxScore;
}
