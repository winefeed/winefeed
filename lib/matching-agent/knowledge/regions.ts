/**
 * WINE REGION HIERARCHY
 *
 * Country → Region → Subregion with climate, terroir, typical grapes,
 * price tiers, and key characteristics.
 *
 * Used by: pre-scorer (region proximity), AI re-ranker (prompt context),
 *          smart-query (fallback cascade)
 */

export interface SubRegion {
  name: string;
  /** Key grapes grown here */
  grapes: string[];
  /** Climate description */
  climate: 'cool' | 'moderate' | 'warm' | 'hot' | 'continental' | 'mediterranean' | 'oceanic';
  /** Soil / terroir */
  terroir: string;
  /** Price tier of typical wines */
  priceTier: 'budget' | 'mid' | 'premium' | 'luxury';
  /** Key wine style */
  style: string;
}

export interface WineRegion {
  name: string;
  country: string;
  /** Primary grape varieties */
  grapes: string[];
  /** Notable subregions */
  subRegions: SubRegion[];
  /** Overall climate */
  climate: string;
  /** Key wine styles */
  styles: string[];
  /** Swedish market relevance */
  swedenRelevance: 'high' | 'medium' | 'low';
}

export const REGION_HIERARCHY: Record<string, WineRegion[]> = {
  // ═══════════════════════════════════════════
  // FRANCE
  // ═══════════════════════════════════════════
  'Frankrike': [
    {
      name: 'Bordeaux',
      country: 'Frankrike',
      grapes: ['Cabernet Sauvignon', 'Merlot', 'Cabernet Franc', 'Sémillon', 'Sauvignon Blanc'],
      climate: 'Oceaniskt, milt med atlantisk påverkan',
      styles: ['Kraftiga röda blends', 'Torra vita', 'Söta Sauternes'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Médoc', grapes: ['Cabernet Sauvignon', 'Merlot'], climate: 'oceanic', terroir: 'Grus och sand', priceTier: 'premium', style: 'Kraftig, tanninrik röd' },
        { name: 'Saint-Émilion', grapes: ['Merlot', 'Cabernet Franc'], climate: 'oceanic', terroir: 'Kalksten och lera', priceTier: 'premium', style: 'Rund, generös röd' },
        { name: 'Pauillac', grapes: ['Cabernet Sauvignon'], climate: 'oceanic', terroir: 'Grus', priceTier: 'luxury', style: 'Klassisk, koncentrerad' },
        { name: 'Margaux', grapes: ['Cabernet Sauvignon', 'Merlot'], climate: 'oceanic', terroir: 'Fin grus', priceTier: 'luxury', style: 'Elegant, parfymerad' },
        { name: 'Pomerol', grapes: ['Merlot', 'Cabernet Franc'], climate: 'oceanic', terroir: 'Lera och grus', priceTier: 'luxury', style: 'Sammetig, koncentrerad' },
        { name: 'Pessac-Léognan', grapes: ['Cabernet Sauvignon', 'Sauvignon Blanc', 'Sémillon'], climate: 'oceanic', terroir: 'Grus', priceTier: 'premium', style: 'Elegant röd och vit' },
        { name: 'Sauternes', grapes: ['Sémillon', 'Sauvignon Blanc'], climate: 'oceanic', terroir: 'Grus och kalk', priceTier: 'premium', style: 'Söt, botrytisvin' },
        { name: 'Entre-Deux-Mers', grapes: ['Sauvignon Blanc', 'Sémillon'], climate: 'oceanic', terroir: 'Kalk och lera', priceTier: 'budget', style: 'Fräsch vit' },
      ],
    },
    {
      name: 'Bourgogne',
      country: 'Frankrike',
      grapes: ['Pinot Noir', 'Chardonnay', 'Gamay', 'Aligoté'],
      climate: 'Kontinentalt med kalla vintrar',
      styles: ['Elegant Pinot Noir', 'Mineraldrivet Chardonnay', 'Chablis'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Chablis', grapes: ['Chardonnay'], climate: 'cool', terroir: 'Kimmeridge-kalk', priceTier: 'mid', style: 'Mineraldrivet, stål, citrus' },
        { name: 'Côte de Nuits', grapes: ['Pinot Noir'], climate: 'continental', terroir: 'Kalksten', priceTier: 'luxury', style: 'Komplex, jordigt, Pinot Noir' },
        { name: 'Côte de Beaune', grapes: ['Chardonnay', 'Pinot Noir'], climate: 'continental', terroir: 'Kalksten och märgel', priceTier: 'premium', style: 'Rikt Chardonnay, elegant Pinot' },
        { name: 'Côte Chalonnaise', grapes: ['Pinot Noir', 'Chardonnay'], climate: 'continental', terroir: 'Kalk och lera', priceTier: 'mid', style: 'Prisvärt Bourgogne' },
        { name: 'Mâconnais', grapes: ['Chardonnay'], climate: 'moderate', terroir: 'Kalksten', priceTier: 'mid', style: 'Fruktig Chardonnay, Pouilly-Fuissé' },
        { name: 'Beaujolais', grapes: ['Gamay'], climate: 'moderate', terroir: 'Granit', priceTier: 'mid', style: 'Lätt, fruktig röd' },
      ],
    },
    {
      name: 'Rhône',
      country: 'Frankrike',
      grapes: ['Syrah', 'Grenache', 'Mourvèdre', 'Viognier', 'Marsanne', 'Roussanne'],
      climate: 'Norra: kontinentalt, Södra: medelhav',
      styles: ['Elegant Syrah (norr)', 'Generösa GSM-blends (söder)'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Côte-Rôtie', grapes: ['Syrah', 'Viognier'], climate: 'continental', terroir: 'Granit', priceTier: 'luxury', style: 'Elegant Syrah med blommor' },
        { name: 'Hermitage', grapes: ['Syrah', 'Marsanne'], climate: 'continental', terroir: 'Granit', priceTier: 'luxury', style: 'Kraftfull Syrah, komplex vit' },
        { name: 'Saint-Joseph', grapes: ['Syrah'], climate: 'continental', terroir: 'Granit och gnejs', priceTier: 'mid', style: 'Medellång, elegant Syrah' },
        { name: 'Condrieu', grapes: ['Viognier'], climate: 'continental', terroir: 'Granit', priceTier: 'premium', style: 'Aromatisk, blommig vit' },
        { name: 'Châteauneuf-du-Pape', grapes: ['Grenache', 'Syrah', 'Mourvèdre'], climate: 'mediterranean', terroir: 'Galets roulés (runda stenar)', priceTier: 'premium', style: 'Kraftig, varm röd' },
        { name: 'Gigondas', grapes: ['Grenache', 'Syrah'], climate: 'mediterranean', terroir: 'Kalksten', priceTier: 'mid', style: 'Generös röd, mini-Châteauneuf' },
        { name: 'Côtes du Rhône', grapes: ['Grenache', 'Syrah', 'Mourvèdre'], climate: 'mediterranean', terroir: 'Varierat', priceTier: 'budget', style: 'Allround röd' },
      ],
    },
    {
      name: 'Loire',
      country: 'Frankrike',
      grapes: ['Chenin Blanc', 'Sauvignon Blanc', 'Cabernet Franc', 'Gamay', 'Melon de Bourgogne'],
      climate: 'Svalt oceaniskt till kontinentalt',
      styles: ['Mineraldrivna vita', 'Eleganta röda', 'Mousserande', 'Naturvin'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Sancerre', grapes: ['Sauvignon Blanc'], climate: 'cool', terroir: 'Flinta och kalksten', priceTier: 'mid', style: 'Mineralisk Sauvignon Blanc' },
        { name: 'Pouilly-Fumé', grapes: ['Sauvignon Blanc'], climate: 'cool', terroir: 'Flinta', priceTier: 'mid', style: 'Rökig, mineralisk vit' },
        { name: 'Vouvray', grapes: ['Chenin Blanc'], climate: 'moderate', terroir: 'Tuffeau (kalksten)', priceTier: 'mid', style: 'Torr till söt Chenin' },
        { name: 'Chinon', grapes: ['Cabernet Franc'], climate: 'moderate', terroir: 'Tuffeau och grus', priceTier: 'mid', style: 'Elegant Cabernet Franc' },
        { name: 'Muscadet', grapes: ['Melon de Bourgogne'], climate: 'oceanic', terroir: 'Granit och gnejs', priceTier: 'budget', style: 'Skarp, jästig vit' },
        { name: 'Anjou', grapes: ['Chenin Blanc', 'Cabernet Franc', 'Gamay'], climate: 'moderate', terroir: 'Skiffer och kalksten', priceTier: 'mid', style: 'Naturvincentrum' },
      ],
    },
    {
      name: 'Jura',
      country: 'Frankrike',
      grapes: ['Savagnin', 'Chardonnay', 'Poulsard', 'Trousseau', 'Pinot Noir'],
      climate: 'Kontinentalt, svalt',
      styles: ['Oxidativa vin jaune', 'Fräscha ouillé-viner', 'Naturvin'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Arbois', grapes: ['Savagnin', 'Poulsard', 'Trousseau'], climate: 'continental', terroir: 'Kalk och märgel', priceTier: 'mid', style: 'Naturvin-centrum' },
        { name: 'Château-Chalon', grapes: ['Savagnin'], climate: 'continental', terroir: 'Blå märgel', priceTier: 'premium', style: 'Vin jaune, oxidativt' },
      ],
    },
    {
      name: 'Alsace',
      country: 'Frankrike',
      grapes: ['Riesling', 'Gewürztraminer', 'Pinot Gris', 'Muscat', 'Pinot Noir'],
      climate: 'Kontinentalt, skyddat av Vogeserna',
      styles: ['Aromatiska vita', 'Grand Cru', 'Vendange Tardive'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Grand Cru', grapes: ['Riesling', 'Gewürztraminer', 'Pinot Gris'], climate: 'continental', terroir: 'Granit, kalksten, sandsten', priceTier: 'premium', style: 'Koncentrerad, platspecifik' },
      ],
    },
    {
      name: 'Languedoc-Roussillon',
      country: 'Frankrike',
      grapes: ['Grenache', 'Syrah', 'Mourvèdre', 'Carignan', 'Cinsault'],
      climate: 'Medelhav, varmt och torrt',
      styles: ['Generösa röda', 'Prisvärd kvalitet', 'Naturvin'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Minervois', grapes: ['Syrah', 'Grenache', 'Carignan'], climate: 'mediterranean', terroir: 'Kalksten', priceTier: 'budget', style: 'Kryddig röd' },
        { name: 'Corbières', grapes: ['Carignan', 'Grenache', 'Syrah'], climate: 'hot', terroir: 'Skiffer och kalksten', priceTier: 'budget', style: 'Rustik röd' },
        { name: 'Pic Saint-Loup', grapes: ['Syrah', 'Grenache', 'Mourvèdre'], climate: 'mediterranean', terroir: 'Kalksten', priceTier: 'mid', style: 'Elegant Languedoc' },
        { name: 'Faugères', grapes: ['Syrah', 'Grenache', 'Mourvèdre', 'Carignan'], climate: 'mediterranean', terroir: 'Skiffer', priceTier: 'mid', style: 'Mineraliskt, skiffermark' },
      ],
    },
    {
      name: 'Provence',
      country: 'Frankrike',
      grapes: ['Grenache', 'Cinsault', 'Mourvèdre', 'Rolle'],
      climate: 'Medelhav, soligt',
      styles: ['Rosé', 'Bandol röd'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Bandol', grapes: ['Mourvèdre'], climate: 'mediterranean', terroir: 'Kalksten', priceTier: 'premium', style: 'Kraftig röd, komplex rosé' },
        { name: 'Côtes de Provence', grapes: ['Grenache', 'Cinsault', 'Rolle'], climate: 'mediterranean', terroir: 'Kalksten och skiffer', priceTier: 'mid', style: 'Blek, elegant rosé' },
      ],
    },
    {
      name: 'Champagne',
      country: 'Frankrike',
      grapes: ['Chardonnay', 'Pinot Noir', 'Pinot Meunier'],
      climate: 'Svalt kontinentalt, nordligaste franska vinregion',
      styles: ['Mousserande', 'Blanc de Blancs', 'Blanc de Noirs', 'Rosé'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Côte des Blancs', grapes: ['Chardonnay'], climate: 'cool', terroir: 'Krita', priceTier: 'premium', style: 'Blanc de Blancs, elegant' },
        { name: 'Montagne de Reims', grapes: ['Pinot Noir'], climate: 'cool', terroir: 'Krita och lera', priceTier: 'premium', style: 'Kraftig, strukturerad' },
        { name: 'Vallée de la Marne', grapes: ['Pinot Meunier'], climate: 'cool', terroir: 'Lera', priceTier: 'mid', style: 'Fruktig, tillgänglig' },
      ],
    },
  ],

  // ═══════════════════════════════════════════
  // ITALY
  // ═══════════════════════════════════════════
  'Italien': [
    {
      name: 'Piemonte',
      country: 'Italien',
      grapes: ['Nebbiolo', 'Barbera', 'Dolcetto', 'Arneis', 'Cortese'],
      climate: 'Kontinentalt med dimma (nebbia)',
      styles: ['Barolo och Barbaresco', 'Barbera', 'Moscato d\'Asti'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Barolo', grapes: ['Nebbiolo'], climate: 'continental', terroir: 'Kalk och märgel', priceTier: 'luxury', style: 'Tjära, rosor, kraftfull tannin' },
        { name: 'Barbaresco', grapes: ['Nebbiolo'], climate: 'continental', terroir: 'Kalk och sand', priceTier: 'premium', style: 'Elegant Nebbiolo, snabbare mognad' },
        { name: 'Langhe', grapes: ['Nebbiolo', 'Barbera', 'Dolcetto'], climate: 'continental', terroir: 'Kalk och lera', priceTier: 'mid', style: 'Prisvärt Piemonte' },
        { name: 'Roero', grapes: ['Nebbiolo', 'Arneis'], climate: 'continental', terroir: 'Sand', priceTier: 'mid', style: 'Lättare Nebbiolo, fräsch Arneis' },
      ],
    },
    {
      name: 'Toscana',
      country: 'Italien',
      grapes: ['Sangiovese', 'Cabernet Sauvignon', 'Merlot', 'Vermentino'],
      climate: 'Medelhav med höjdvariation',
      styles: ['Chianti', 'Brunello', 'Super Tuscans', 'Bolgheri'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Chianti Classico', grapes: ['Sangiovese'], climate: 'moderate', terroir: 'Galestro och alberese', priceTier: 'mid', style: 'Körsbär, tomat, örter' },
        { name: 'Montalcino', grapes: ['Sangiovese'], climate: 'warm', terroir: 'Kalk, lera, skiffer', priceTier: 'premium', style: 'Kraftfull Brunello, lång mognad' },
        { name: 'Montepulciano', grapes: ['Sangiovese'], climate: 'moderate', terroir: 'Kalk och sand', priceTier: 'mid', style: 'Vino Nobile, generös' },
        { name: 'Bolgheri', grapes: ['Cabernet Sauvignon', 'Merlot', 'Cabernet Franc'], climate: 'mediterranean', terroir: 'Kust, grus och lera', priceTier: 'luxury', style: 'Super Tuscan, internationell' },
        { name: 'Maremma', grapes: ['Sangiovese', 'Vermentino'], climate: 'warm', terroir: 'Kust, varierat', priceTier: 'mid', style: 'Modern, generös' },
      ],
    },
    {
      name: 'Veneto',
      country: 'Italien',
      grapes: ['Corvina', 'Rondinella', 'Garganega', 'Glera'],
      climate: 'Alpint till medelhav',
      styles: ['Amarone', 'Valpolicella', 'Soave', 'Prosecco'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Valpolicella', grapes: ['Corvina', 'Rondinella'], climate: 'moderate', terroir: 'Vulkanisk och kalksten', priceTier: 'mid', style: 'Körsbär, kryddor' },
        { name: 'Amarone', grapes: ['Corvina', 'Rondinella'], climate: 'moderate', terroir: 'Kalk', priceTier: 'premium', style: 'Torkade druvor, kraftig, hög alkohol' },
        { name: 'Soave', grapes: ['Garganega'], climate: 'moderate', terroir: 'Vulkanisk basalt', priceTier: 'budget', style: 'Mandelaktig vit' },
        { name: 'Prosecco', grapes: ['Glera'], climate: 'moderate', terroir: 'Kalk och lera', priceTier: 'budget', style: 'Lättbubblig aperitif' },
      ],
    },
    {
      name: 'Sicilien',
      country: 'Italien',
      grapes: ['Nero d\'Avola', 'Nerello Mascalese', 'Grillo', 'Carricante'],
      climate: 'Medelhav, varmt',
      styles: ['Mörka röda', 'Etna-viner (eleganta)', 'Fräscha vita'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Etna', grapes: ['Nerello Mascalese', 'Carricante'], climate: 'moderate', terroir: 'Vulkanisk lava', priceTier: 'premium', style: 'Elegant, mineralisk, Bourgogne-liknande' },
        { name: 'Cerasuolo di Vittoria', grapes: ['Nero d\'Avola', 'Frappato'], climate: 'hot', terroir: 'Kalksten och sand', priceTier: 'mid', style: 'Fruktigt och lätt' },
      ],
    },
    {
      name: 'Kampanien',
      country: 'Italien',
      grapes: ['Aglianico', 'Fiano', 'Greco', 'Falanghina'],
      climate: 'Medelhav med höjdvariation',
      styles: ['Kraftiga röda', 'Aromatiska vita'],
      swedenRelevance: 'low',
      subRegions: [
        { name: 'Taurasi', grapes: ['Aglianico'], climate: 'moderate', terroir: 'Vulkanisk', priceTier: 'premium', style: 'Syditaliens Barolo' },
        { name: 'Fiano di Avellino', grapes: ['Fiano'], climate: 'moderate', terroir: 'Vulkanisk', priceTier: 'mid', style: 'Hasselnöt och honung' },
      ],
    },
  ],

  // ═══════════════════════════════════════════
  // SPAIN
  // ═══════════════════════════════════════════
  'Spanien': [
    {
      name: 'Rioja',
      country: 'Spanien',
      grapes: ['Tempranillo', 'Garnacha', 'Graciano', 'Viura'],
      climate: 'Kontinentalt med atlantiskt inflytande',
      styles: ['Crianza', 'Reserva', 'Gran Reserva', 'Modern stil'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Rioja Alta', grapes: ['Tempranillo'], climate: 'continental', terroir: 'Kalk och lera', priceTier: 'mid', style: 'Klassisk, elegant' },
        { name: 'Rioja Alavesa', grapes: ['Tempranillo'], climate: 'continental', terroir: 'Kalksten', priceTier: 'mid', style: 'Fruktig, modern' },
        { name: 'Rioja Oriental', grapes: ['Garnacha'], climate: 'warm', terroir: 'Lera och alluvial', priceTier: 'budget', style: 'Generös, rund' },
      ],
    },
    {
      name: 'Ribera del Duero',
      country: 'Spanien',
      grapes: ['Tempranillo', 'Cabernet Sauvignon'],
      climate: 'Extremt kontinentalt, hög höjd (800m+)',
      styles: ['Kraftig Tempranillo', 'Eklagrade röda'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Ribera del Duero', grapes: ['Tempranillo'], climate: 'continental', terroir: 'Kalk och sand', priceTier: 'mid', style: 'Koncentrerad, kraftig' },
      ],
    },
    {
      name: 'Priorat',
      country: 'Spanien',
      grapes: ['Garnacha', 'Cariñena', 'Cabernet Sauvignon', 'Syrah'],
      climate: 'Medelhav, extremt torrt',
      styles: ['Kraftiga mineralröda'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Priorat', grapes: ['Garnacha', 'Cariñena'], climate: 'hot', terroir: 'Llicorella (skiffer)', priceTier: 'premium', style: 'Mineral, koncentrerat, gamla stockar' },
      ],
    },
    {
      name: 'Rías Baixas',
      country: 'Spanien',
      grapes: ['Albariño'],
      climate: 'Atlantiskt, svalt',
      styles: ['Fräscha vita med havskaraktär'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Val do Salnés', grapes: ['Albariño'], climate: 'oceanic', terroir: 'Granit', priceTier: 'mid', style: 'Salt, mineralisk, citrus' },
      ],
    },
    {
      name: 'Bierzo',
      country: 'Spanien',
      grapes: ['Mencía', 'Godello'],
      climate: 'Atlantiskt inflytande, bergigt',
      styles: ['Elegant Mencía', 'Mineralisk Godello'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Bierzo', grapes: ['Mencía'], climate: 'moderate', terroir: 'Skiffer och kvarts', priceTier: 'mid', style: 'Elegant röd, mineral' },
      ],
    },
    {
      name: 'Rueda',
      country: 'Spanien',
      grapes: ['Verdejo', 'Sauvignon Blanc'],
      climate: 'Kontinentalt, högt (700m)',
      styles: ['Fräscha vita'],
      swedenRelevance: 'high',
      subRegions: [],
    },
    {
      name: 'Jerez',
      country: 'Spanien',
      grapes: ['Palomino', 'Pedro Ximénez'],
      climate: 'Varmt medelhav med atlantisk vind',
      styles: ['Fino', 'Manzanilla', 'Amontillado', 'Oloroso', 'Palo Cortado', 'PX'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Sanlúcar de Barrameda', grapes: ['Palomino'], climate: 'mediterranean', terroir: 'Albariza (kalksten)', priceTier: 'mid', style: 'Manzanilla — salt, torr' },
      ],
    },
  ],

  // ═══════════════════════════════════════════
  // GERMANY / AUSTRIA
  // ═══════════════════════════════════════════
  'Tyskland': [
    {
      name: 'Mosel',
      country: 'Tyskland',
      grapes: ['Riesling'],
      climate: 'Svalt kontinentalt, branta sluttningar',
      styles: ['Trocken', 'Feinherb', 'Spätlese', 'Auslese'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Mittelmosel', grapes: ['Riesling'], climate: 'cool', terroir: 'Skiffer', priceTier: 'mid', style: 'Lätt, elegant, skifferpräglad' },
      ],
    },
    {
      name: 'Rheingau',
      country: 'Tyskland',
      grapes: ['Riesling'],
      climate: 'Tempererat, Rhenfloden',
      styles: ['Torra till söta Riesling'],
      swedenRelevance: 'medium',
      subRegions: [],
    },
    {
      name: 'Pfalz',
      country: 'Tyskland',
      grapes: ['Riesling', 'Pinot Noir', 'Grauburgunder'],
      climate: 'Varmast i Tyskland',
      styles: ['Fylligare Riesling', 'Tyska Pinot Noir'],
      swedenRelevance: 'medium',
      subRegions: [],
    },
  ],

  'Österrike': [
    {
      name: 'Wachau',
      country: 'Österrike',
      grapes: ['Grüner Veltliner', 'Riesling'],
      climate: 'Donaudalen, terrassodlat',
      styles: ['Steinfeder (lätt)', 'Federspiel (medium)', 'Smaragd (kraftig)'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Wachau', grapes: ['Grüner Veltliner', 'Riesling'], climate: 'continental', terroir: 'Gnejs och granit', priceTier: 'premium', style: 'Mineral, koncentrerad' },
      ],
    },
    {
      name: 'Burgenland',
      country: 'Österrike',
      grapes: ['Blaufränkisch', 'Zweigelt', 'Sankt Laurent'],
      climate: 'Pannoniskt, varmt',
      styles: ['Kraftiga röda', 'Söta TBA'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Mittelburgenland', grapes: ['Blaufränkisch'], climate: 'continental', terroir: 'Lera och kalksten', priceTier: 'mid', style: 'Peppar, mörka bär' },
        { name: 'Neusiedlersee', grapes: ['Zweigelt'], climate: 'warm', terroir: 'Sand och lera', priceTier: 'mid', style: 'Fruktig röd, söt vin' },
      ],
    },
  ],

  // ═══════════════════════════════════════════
  // PORTUGAL
  // ═══════════════════════════════════════════
  'Portugal': [
    {
      name: 'Douro',
      country: 'Portugal',
      grapes: ['Touriga Nacional', 'Touriga Franca', 'Tinta Roriz', 'Tinta Cão'],
      climate: 'Kontinentalt, extrema temperaturer',
      styles: ['Kraftiga röda', 'Portvin', 'Torra vita'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Douro Superior', grapes: ['Touriga Nacional'], climate: 'hot', terroir: 'Skiffer', priceTier: 'mid', style: 'Kraftig och mörk' },
        { name: 'Cima Corgo', grapes: ['Touriga Nacional', 'Touriga Franca'], climate: 'warm', terroir: 'Skiffer', priceTier: 'premium', style: 'Komplex, koncentrerad' },
      ],
    },
    {
      name: 'Alentejo',
      country: 'Portugal',
      grapes: ['Aragonez', 'Trincadeira', 'Alicante Bouschet'],
      climate: 'Varmt medelhav, platt',
      styles: ['Generösa röda', 'Modern stil'],
      swedenRelevance: 'medium',
      subRegions: [],
    },
    {
      name: 'Vinho Verde',
      country: 'Portugal',
      grapes: ['Alvarinho', 'Loureiro', 'Arinto'],
      climate: 'Atlantiskt, svalt och fuktigt',
      styles: ['Fräscha, lätta vita med lätt spritzig'],
      swedenRelevance: 'medium',
      subRegions: [],
    },
  ],

  // ═══════════════════════════════════════════
  // NEW WORLD (highlights)
  // ═══════════════════════════════════════════
  'Argentina': [
    {
      name: 'Mendoza',
      country: 'Argentina',
      grapes: ['Malbec', 'Cabernet Sauvignon', 'Bonarda', 'Torrontés'],
      climate: 'Öken med andbevattning, hög höjd',
      styles: ['Kraftig Malbec', 'Höjd-Cabernet'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Uco Valley', grapes: ['Malbec', 'Cabernet Franc'], climate: 'continental', terroir: 'Alluvial, kalksten', priceTier: 'premium', style: 'Elegant, hög höjd' },
        { name: 'Luján de Cuyo', grapes: ['Malbec'], climate: 'warm', terroir: 'Alluvial', priceTier: 'mid', style: 'Klassisk, generös Malbec' },
      ],
    },
  ],

  'Chile': [
    {
      name: 'Central Valley',
      country: 'Chile',
      grapes: ['Cabernet Sauvignon', 'Carmenère', 'Sauvignon Blanc', 'País'],
      climate: 'Medelhav med kustpåverkan',
      styles: ['Prisvärd Cabernet', 'Carmenère', 'Kust-Sauvignon Blanc'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Maipo Valley', grapes: ['Cabernet Sauvignon'], climate: 'warm', terroir: 'Alluvial', priceTier: 'mid', style: 'Klassisk Cab, eucalyptus' },
        { name: 'Colchagua', grapes: ['Carmenère', 'Syrah'], climate: 'warm', terroir: 'Lera och granit', priceTier: 'mid', style: 'Generös röd' },
        { name: 'Casablanca', grapes: ['Sauvignon Blanc', 'Chardonnay', 'Pinot Noir'], climate: 'cool', terroir: 'Granit', priceTier: 'mid', style: 'Fräscha vita, elegant Pinot' },
      ],
    },
  ],

  'Sydafrika': [
    {
      name: 'Western Cape',
      country: 'Sydafrika',
      grapes: ['Chenin Blanc', 'Pinotage', 'Syrah', 'Cabernet Sauvignon'],
      climate: 'Medelhav med kustpåverkan',
      styles: ['Chenin Blanc', 'Bordeaux-blends', 'Pinotage', 'Syrah'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Stellenbosch', grapes: ['Cabernet Sauvignon', 'Pinotage'], climate: 'moderate', terroir: 'Granit och sandsten', priceTier: 'mid', style: 'Kraftig röd, Bordeaux-stil' },
        { name: 'Swartland', grapes: ['Chenin Blanc', 'Syrah', 'Grenache'], climate: 'warm', terroir: 'Granit och skiffer', priceTier: 'mid', style: 'Naturvin, gamla Chenin' },
        { name: 'Constantia', grapes: ['Sauvignon Blanc'], climate: 'cool', terroir: 'Granit', priceTier: 'premium', style: 'Fräsch vit, historisk' },
      ],
    },
  ],

  'Australien': [
    {
      name: 'South Australia',
      country: 'Australien',
      grapes: ['Shiraz', 'Cabernet Sauvignon', 'Grenache', 'Riesling'],
      climate: 'Varmt medelhav till svalt',
      styles: ['Kraftig Shiraz', 'Eleganta Adelaide Hills', 'Clare Valley Riesling'],
      swedenRelevance: 'high',
      subRegions: [
        { name: 'Barossa Valley', grapes: ['Shiraz', 'Grenache'], climate: 'warm', terroir: 'Sand och lera', priceTier: 'mid', style: 'Kraftig, fruktdriven Shiraz' },
        { name: 'McLaren Vale', grapes: ['Shiraz', 'Grenache'], climate: 'mediterranean', terroir: 'Sand och kalk', priceTier: 'mid', style: 'Choklad, mörka bär' },
        { name: 'Clare Valley', grapes: ['Riesling'], climate: 'moderate', terroir: 'Skiffer och kalksten', priceTier: 'mid', style: 'Torr, citrus, lime' },
        { name: 'Adelaide Hills', grapes: ['Sauvignon Blanc', 'Pinot Noir', 'Chardonnay'], climate: 'cool', terroir: 'Sand och lera', priceTier: 'mid', style: 'Svalt klimat, elegant' },
      ],
    },
  ],

  'Nya Zeeland': [
    {
      name: 'Marlborough',
      country: 'Nya Zeeland',
      grapes: ['Sauvignon Blanc', 'Pinot Noir'],
      climate: 'Svalt maritim',
      styles: ['Aromatisk Sauvignon Blanc', 'Elegant Pinot Noir'],
      swedenRelevance: 'high',
      subRegions: [],
    },
    {
      name: 'Central Otago',
      country: 'Nya Zeeland',
      grapes: ['Pinot Noir'],
      climate: 'Kontinentalt, sydligaste vinregion',
      styles: ['Fruktdriven Pinot Noir'],
      swedenRelevance: 'medium',
      subRegions: [],
    },
  ],

  'USA': [
    {
      name: 'Kalifornien',
      country: 'USA',
      grapes: ['Cabernet Sauvignon', 'Chardonnay', 'Pinot Noir', 'Zinfandel'],
      climate: 'Medelhav, stor variation kust till inland',
      styles: ['Kraftig Napa Cab', 'Sonoma Pinot', 'Santa Barbara elegans'],
      swedenRelevance: 'medium',
      subRegions: [
        { name: 'Napa Valley', grapes: ['Cabernet Sauvignon'], climate: 'warm', terroir: 'Vulkanisk och alluvial', priceTier: 'luxury', style: 'Mörk, koncentrerad Cab' },
        { name: 'Sonoma', grapes: ['Pinot Noir', 'Chardonnay', 'Zinfandel'], climate: 'moderate', terroir: 'Varierat', priceTier: 'premium', style: 'Elegant, kustpåverkad' },
        { name: 'Paso Robles', grapes: ['Zinfandel', 'Syrah', 'Cabernet Sauvignon'], climate: 'warm', terroir: 'Kalksten', priceTier: 'mid', style: 'Kraftig, fruktdriven' },
        { name: 'Santa Barbara', grapes: ['Pinot Noir', 'Chardonnay', 'Syrah'], climate: 'cool', terroir: 'Kalksten och skiffer', priceTier: 'premium', style: 'Elegant, kustpåverkad' },
      ],
    },
    {
      name: 'Oregon',
      country: 'USA',
      grapes: ['Pinot Noir', 'Pinot Gris', 'Chardonnay'],
      climate: 'Svalt kontinentalt, liknande Bourgogne',
      styles: ['Elegant Pinot Noir'],
      swedenRelevance: 'low',
      subRegions: [
        { name: 'Willamette Valley', grapes: ['Pinot Noir'], climate: 'cool', terroir: 'Vulkanisk basalt och sediment', priceTier: 'premium', style: 'Bourgogne-liknande Pinot' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════
// LOOKUP FUNCTIONS
// ═══════════════════════════════════════════

/** Get all regions for a country */
export function getRegionsForCountry(country: string): WineRegion[] {
  const normalized = country.toLowerCase();
  for (const [key, regions] of Object.entries(REGION_HIERARCHY)) {
    if (key.toLowerCase() === normalized) return regions;
  }
  // Try English → Swedish mapping
  const countryMap: Record<string, string> = {
    france: 'Frankrike', italy: 'Italien', spain: 'Spanien',
    germany: 'Tyskland', austria: 'Österrike', portugal: 'Portugal',
    argentina: 'Argentina', chile: 'Chile', 'south africa': 'Sydafrika',
    australia: 'Australien', 'new zealand': 'Nya Zeeland', usa: 'USA',
  };
  const mapped = countryMap[normalized];
  if (mapped) return REGION_HIERARCHY[mapped] || [];
  return [];
}

/** Find a region by name (searches all countries) */
export function findRegion(regionName: string): WineRegion | null {
  const normalized = regionName.toLowerCase();
  for (const regions of Object.values(REGION_HIERARCHY)) {
    for (const region of regions) {
      if (region.name.toLowerCase() === normalized) return region;
      for (const sub of region.subRegions) {
        if (sub.name.toLowerCase() === normalized) {
          // Return parent region with info about the subregion
          return region;
        }
      }
    }
  }
  return null;
}

/** Find a subregion by name */
export function findSubRegion(name: string): { region: WineRegion; subRegion: SubRegion } | null {
  const normalized = name.toLowerCase();
  for (const regions of Object.values(REGION_HIERARCHY)) {
    for (const region of regions) {
      for (const sub of region.subRegions) {
        if (sub.name.toLowerCase() === normalized) {
          return { region, subRegion: sub };
        }
      }
    }
  }
  return null;
}

/** Check if regionA is parent of or same as regionB */
export function isRegionRelated(regionA: string, regionB: string): boolean {
  const a = regionA.toLowerCase();
  const b = regionB.toLowerCase();
  if (a === b) return true;

  for (const regions of Object.values(REGION_HIERARCHY)) {
    for (const region of regions) {
      const regionLow = region.name.toLowerCase();
      const subNames = region.subRegions.map(s => s.name.toLowerCase());

      // A is parent region, B is subregion
      if (regionLow === a && subNames.includes(b)) return true;
      // B is parent region, A is subregion
      if (regionLow === b && subNames.includes(a)) return true;
      // Both are subregions of same region
      if (subNames.includes(a) && subNames.includes(b)) return true;
    }
  }
  return false;
}

/** Get country name (Swedish) for a region */
export function getCountryForRegion(regionName: string): string | null {
  const normalized = regionName.toLowerCase();
  for (const [country, regions] of Object.entries(REGION_HIERARCHY)) {
    for (const region of regions) {
      if (region.name.toLowerCase() === normalized) return country;
      for (const sub of region.subRegions) {
        if (sub.name.toLowerCase() === normalized) return country;
      }
    }
  }
  return null;
}
