/**
 * Matching Agent — Golden Pairs
 *
 * Iconic food+wine pairings that every sommelier knows.
 * These are so well-established that they get a score boost
 * without needing style-distance calculation.
 *
 * Food keywords are in Swedish (matching food_pairing in the parser).
 */

export interface GoldenPair {
  food: string;           // Swedish keyword (same format as food_pairing in parser)
  grape?: string[];       // Matching grapes (any of these = golden match)
  region?: string[];      // Matching regions
  color?: string;         // If color-specific
  score_boost: number;    // Extra points (5-15) on top of normal scoring
  reason: string;         // Swedish explanation for the match (shown to user)
}

export const GOLDEN_PAIRS: GoldenPair[] = [

  // ============================================================================
  // SVENSKA KLASSIKER
  // ============================================================================

  {
    food: 'toast skagen',
    grape: ['Chardonnay', 'Riesling'],
    region: ['bourgogne', 'chablis', 'champagne'],
    color: 'white',
    score_boost: 12,
    reason: 'Toast Skagen med sin krämiga räkröra lyfts av mineralisk Chablis eller elegant Champagne.',
  },
  {
    food: 'toast skagen',
    region: ['champagne'],
    color: 'sparkling',
    score_boost: 14,
    reason: 'Champagne och Toast Skagen — en av Sveriges mest älskade lyxkombinationer.',
  },
  {
    food: 'wallenbergare',
    grape: ['Chardonnay', 'Pinot Noir'],
    region: ['bourgogne'],
    color: 'white',
    score_boost: 10,
    reason: 'Wallenbergarens smör och kalvfärs möter vit Bourgogne med perfekt balans av fyllig elegans.',
  },
  {
    food: 'köttbullar',
    grape: ['Sangiovese', 'Barbera', 'Pinot Noir'],
    region: ['toscana', 'piemonte', 'bourgogne'],
    color: 'red',
    score_boost: 10,
    reason: 'Svenska köttbullar med lingon och gräddsås vill ha ett rött med bra syra — Sangiovese eller Barbera.',
  },
  {
    food: 'surströmming',
    grape: ['Riesling', 'Grüner Veltliner'],
    region: ['alsace', 'pfalz'],
    color: 'white',
    score_boost: 8,
    reason: 'Surströmmings intensiva smak kräver ett aromatiskt vin med hög syra — torr Riesling står pall.',
  },
  {
    food: 'gravlax',
    grape: ['Riesling', 'Grüner Veltliner', 'Sauvignon Blanc'],
    region: ['alsace', 'wachau', 'loire'],
    color: 'white',
    score_boost: 12,
    reason: 'Gravlaxens dill och sötma i hovmästarsås matchar Rieslings aromatik och syra perfekt.',
  },
  {
    food: 'janssons frestelse',
    grape: ['Chardonnay', 'Pinot Gris'],
    region: ['bourgogne', 'alsace', 'champagne'],
    color: 'white',
    score_boost: 10,
    reason: 'Janssons krämiga potatis och ansjovis vill ha fylligt vitt med syra — Bourgogne eller Alsace.',
  },
  {
    food: 'janssons frestelse',
    region: ['champagne'],
    color: 'sparkling',
    score_boost: 11,
    reason: 'Champagne skär genom Janssons krämighet och lyfter ansjovisen.',
  },
  {
    food: 'älggryta',
    grape: ['Pinot Noir', 'Syrah', 'Nebbiolo'],
    region: ['bourgogne', 'rhône', 'piemonte'],
    color: 'red',
    score_boost: 12,
    reason: 'Mörkare vilt som älg kräver struktur och jordiga toner — Pinot Noir från Bourgogne är klassikern.',
  },
  {
    food: 'viltgryta',
    grape: ['Pinot Noir', 'Syrah', 'Nebbiolo', 'Xinomavro'],
    region: ['bourgogne', 'rhône', 'piemonte', 'naoussa'],
    color: 'red',
    score_boost: 12,
    reason: 'Viltgryta med svamp och rotfrukter kräver jordiga, strukturerade röda viner.',
  },
  {
    food: 'kräftor',
    grape: ['Riesling', 'Sauvignon Blanc'],
    region: ['alsace', 'mosel'],
    color: 'white',
    score_boost: 10,
    reason: 'Kräftskiva med dill och Västerbottensost kräver aromatiskt vitt — Riesling eller Sauvignon Blanc.',
  },
  {
    food: 'smörgåsbord',
    grape: ['Riesling', 'Grüner Veltliner', 'Pinot Noir'],
    region: ['alsace', 'champagne', 'bourgogne'],
    score_boost: 10,
    reason: 'Smörgåsbordets mångfald kräver mångsidiga viner — Riesling, bubbel eller lätt Pinot Noir.',
  },
  {
    food: 'smörgåsbord',
    region: ['champagne'],
    color: 'sparkling',
    score_boost: 13,
    reason: 'Champagne är det ultimata smörgåsbordsvinet — fungerar med allt från sill till köttbullar.',
  },
  {
    food: 'sill',
    grape: ['Riesling', 'Grüner Veltliner'],
    region: ['alsace', 'mosel', 'wachau'],
    color: 'white',
    score_boost: 10,
    reason: 'Inlagd sill med sina sötma- och syratoner matchar perfekt med aromatisk Riesling.',
  },
  {
    food: 'ärtsoppa',
    grape: ['Riesling'],
    region: ['alsace', 'pfalz'],
    color: 'white',
    score_boost: 8,
    reason: 'Ärtsoppans fyllighet och rökiga fläsk matchar Rieslings syra och frukt.',
  },
  {
    food: 'raggmunk',
    grape: ['Riesling', 'Grüner Veltliner'],
    color: 'white',
    score_boost: 8,
    reason: 'Raggmunk med fläsk och lingon vill ha ett vitt vin med bra syra och frukt.',
  },
  {
    food: 'blodpudding',
    grape: ['Gamay', 'Pinot Noir'],
    region: ['beaujolais', 'bourgogne'],
    color: 'red',
    score_boost: 8,
    reason: 'Blodpuddingens rustika smaker möter fruktdriven Gamay eller lätt Pinot Noir.',
  },
  {
    food: 'pyttipanna',
    grape: ['Gamay', 'Pinot Noir', 'Barbera'],
    color: 'red',
    score_boost: 8,
    reason: 'Pytt i panna med rödbetor och ägg — lättsamt rött med god syra.',
  },

  // ============================================================================
  // INTERNATIONELLA IKONER — SKALDJUR & FISK
  // ============================================================================

  {
    food: 'ostron',
    grape: ['Chardonnay', 'Melon de Bourgogne'],
    region: ['chablis', 'champagne', 'muscadet'],
    score_boost: 15,
    reason: 'Ostron och Chablis/Champagne — en av världens mest ikoniska matpairingar.',
  },
  {
    food: 'musslor',
    grape: ['Melon de Bourgogne', 'Picpoul'],
    region: ['muscadet', 'picpoul de pinet'],
    color: 'white',
    score_boost: 12,
    reason: 'Moules frites med Muscadet — Frankrikes mest klassiska bistropar.',
  },
  {
    food: 'bouillabaisse',
    region: ['provence', 'bandol', 'cassis'],
    color: 'rose',
    score_boost: 12,
    reason: 'Bouillabaisse med Provence-rosé — Medelhavet i ett glas och en skål.',
  },
  {
    food: 'bouillabaisse',
    grape: ['Vermentino', 'Rolle'],
    region: ['provence', 'cassis'],
    color: 'white',
    score_boost: 10,
    reason: 'Vit Cassis eller Vermentino med bouillabaisse — kryddigt och mineraliskt.',
  },
  {
    food: 'ceviche',
    grape: ['Albariño', 'Txakoli', 'Sauvignon Blanc'],
    region: ['rías baixas', 'txakoli'],
    color: 'white',
    score_boost: 12,
    reason: 'Ceviches citrus och chili möter Albariños saltkristall och friskhet.',
  },
  {
    food: 'sushi',
    grape: ['Riesling', 'Grüner Veltliner', 'Champagne'],
    region: ['mosel', 'wachau', 'champagne'],
    score_boost: 12,
    reason: 'Sushi kräver precision — Riesling, Grüner Veltliner eller Champagne levererar.',
  },
  {
    food: 'sashimi',
    grape: ['Riesling', 'Grüner Veltliner', 'Albariño'],
    color: 'white',
    score_boost: 11,
    reason: 'Sashimis rena smaker lyfts av mineraliska vita viner med hög syra.',
  },
  {
    food: 'hummer',
    grape: ['Chardonnay'],
    region: ['bourgogne', 'meursault', 'puligny-montrachet', 'champagne'],
    score_boost: 13,
    reason: 'Hummer och vit Bourgogne — smörig lyx möter smörig lyx.',
  },

  // ============================================================================
  // INTERNATIONELLA IKONER — KÖTT
  // ============================================================================

  {
    food: 'steak',
    grape: ['Cabernet Sauvignon', 'Malbec'],
    region: ['bordeaux', 'napa valley', 'mendoza'],
    color: 'red',
    score_boost: 13,
    reason: 'Steak och Cabernet Sauvignon — tanninernas klassiska partner till grillat kött.',
  },
  {
    food: 'biff',
    grape: ['Cabernet Sauvignon', 'Malbec'],
    region: ['bordeaux', 'napa valley', 'mendoza'],
    color: 'red',
    score_boost: 13,
    reason: 'Biff med Cabernet eller Malbec — kraftfullt kött kräver kraftfullt vin.',
  },
  {
    food: 'entrecôte',
    grape: ['Cabernet Sauvignon', 'Malbec', 'Syrah'],
    region: ['bordeaux', 'napa valley', 'mendoza', 'rhône'],
    color: 'red',
    score_boost: 13,
    reason: 'Entrecôte med Bordeaux-blend eller argentinsk Malbec — en tidlös kombination.',
  },
  {
    food: 'entrecote',
    grape: ['Cabernet Sauvignon', 'Malbec', 'Syrah'],
    region: ['bordeaux', 'napa valley', 'mendoza', 'rhône'],
    color: 'red',
    score_boost: 13,
    reason: 'Entrecôte med Bordeaux-blend eller argentinsk Malbec — en tidlös kombination.',
  },
  {
    food: 'tartar',
    grape: ['Gamay', 'Pinot Noir'],
    region: ['beaujolais', 'bourgogne'],
    color: 'red',
    score_boost: 11,
    reason: 'Biff tartar med sin råa elegans matchar fruktdriven Beaujolais eller lätt Bourgogne.',
  },
  {
    food: 'lamm',
    grape: ['Cabernet Sauvignon', 'Syrah', 'Nebbiolo', 'Tempranillo'],
    region: ['bordeaux', 'rioja', 'barolo', 'rhône'],
    color: 'red',
    score_boost: 12,
    reason: 'Lamm och Bordeaux/Rioja/Barolo — ett tretal som definierar klassisk matparing.',
  },
  {
    food: 'lammracks',
    grape: ['Cabernet Sauvignon', 'Nebbiolo'],
    region: ['bordeaux', 'barolo'],
    color: 'red',
    score_boost: 13,
    reason: 'Rosastekt lammracks med Barolo eller Bordeaux — sommelierens paradpar.',
  },
  {
    food: 'anka',
    grape: ['Pinot Noir'],
    region: ['bourgogne', 'alsace'],
    color: 'red',
    score_boost: 12,
    reason: 'Anka och Pinot Noir — fettet i ankan och syran i Bourgogne dansar tillsammans.',
  },
  {
    food: 'and',
    grape: ['Pinot Noir'],
    region: ['bourgogne'],
    color: 'red',
    score_boost: 12,
    reason: 'And och Pinot Noir — fettet i anden och syran i Bourgogne dansar tillsammans.',
  },
  {
    food: 'grillat',
    grape: ['Malbec', 'Zinfandel', 'Shiraz', 'Tempranillo'],
    region: ['mendoza', 'barossa', 'rioja'],
    color: 'red',
    score_boost: 10,
    reason: 'BBQ och grillat kött kräver fruktdrivna röda med kryddighet — Malbec, Zinfandel eller Shiraz.',
  },
  {
    food: 'bbq',
    grape: ['Malbec', 'Zinfandel', 'Shiraz'],
    region: ['mendoza', 'barossa', 'paso robles'],
    color: 'red',
    score_boost: 10,
    reason: 'BBQ med rökiga smaker matchar perfekt med Malbec eller Zinfandel.',
  },
  {
    food: 'bourgignon',
    grape: ['Pinot Noir'],
    region: ['bourgogne'],
    color: 'red',
    score_boost: 14,
    reason: 'Boeuf bourguignon tillagas med Bourgogne — och ska drickas med Bourgogne.',
  },
  {
    food: 'cassoulet',
    grape: ['Malbec', 'Tannat'],
    region: ['cahors', 'madiran', 'languedoc'],
    color: 'red',
    score_boost: 12,
    reason: 'Cassoulet från sydvästra Frankrike med Cahors — regionens egen Malbec till regionens egen gryta.',
  },

  // ============================================================================
  // INTERNATIONELLA IKONER — OST
  // ============================================================================

  {
    food: 'chèvre',
    grape: ['Sauvignon Blanc'],
    region: ['sancerre', 'loire', 'pouilly-fumé'],
    color: 'white',
    score_boost: 15,
    reason: 'Chèvre och Sancerre — Loire-dalens mest berömda par, syra möter syra.',
  },
  {
    food: 'getost',
    grape: ['Sauvignon Blanc'],
    region: ['sancerre', 'loire'],
    color: 'white',
    score_boost: 14,
    reason: 'Getost och Sancerre — en kombination som definierar terroir-paring.',
  },
  {
    food: 'manchego',
    grape: ['Tempranillo', 'Garnacha'],
    region: ['rioja', 'ribera del duero', 'la mancha'],
    color: 'red',
    score_boost: 11,
    reason: 'Manchego och Rioja — Spaniens nationalpar.',
  },
  {
    food: 'parmesan',
    grape: ['Lambrusco', 'Nebbiolo', 'Sangiovese'],
    region: ['emilia-romagna', 'barolo', 'toscana'],
    score_boost: 11,
    reason: 'Parmigiano Reggiano med Lambrusco eller Barolo — Italiens stolthet i två glaspar.',
  },
  {
    food: 'blåmögelost',
    grape: ['Sémillon', 'Sauvignon Blanc'],
    region: ['sauternes', 'banyuls', 'porto'],
    score_boost: 13,
    reason: 'Blåmögelost och Sauternes — den söta och salta kontrasten som aldrig sviker.',
  },
  {
    food: 'roquefort',
    region: ['sauternes', 'banyuls'],
    score_boost: 14,
    reason: 'Roquefort och Sauternes — Frankrikes mest ikoniska ost-vin-par.',
  },
  {
    food: 'stilton',
    region: ['porto'],
    score_boost: 12,
    reason: 'Stilton och portvin — den brittiska julklassikern.',
  },
  {
    food: 'comté',
    grape: ['Chardonnay', 'Savagnin'],
    region: ['jura', 'bourgogne'],
    color: 'white',
    score_boost: 10,
    reason: 'Comté och Jura-vin — Franche-Comtés egna terroir-par.',
  },
  {
    food: 'burrata',
    grape: ['Vermentino', 'Fiano'],
    region: ['puglia', 'toscana'],
    color: 'white',
    score_boost: 10,
    reason: 'Burrata med sin krämighet matchar perfekt med fräscha italienska vita viner.',
  },

  // ============================================================================
  // INTERNATIONELLA IKONER — ITALIENSKT
  // ============================================================================

  {
    food: 'pizza',
    grape: ['Sangiovese', 'Barbera', 'Montepulciano'],
    region: ['chianti', 'toscana', 'abruzzo'],
    color: 'red',
    score_boost: 12,
    reason: 'Pizza och Chianti — Toscanas mest folkliga och älskade kombination.',
  },
  {
    food: 'pasta',
    grape: ['Sangiovese', 'Barbera', 'Montepulciano'],
    region: ['chianti', 'toscana', 'piemonte'],
    color: 'red',
    score_boost: 10,
    reason: 'Pasta med tomatsås och Sangiovese — syra möter syra i perfekt harmoni.',
  },
  {
    food: 'risotto',
    grape: ['Cortese', 'Garganega', 'Chardonnay'],
    region: ['gavi', 'soave', 'piemonte'],
    color: 'white',
    score_boost: 10,
    reason: 'Risotto med Gavi eller Soave — norditaliensk elegans i två former.',
  },
  {
    food: 'tryffel',
    grape: ['Nebbiolo'],
    region: ['barolo', 'barbaresco', 'piemonte'],
    color: 'red',
    score_boost: 15,
    reason: 'Vit tryffel och Barolo — Piemontes mest magiska och tidlösa kombination.',
  },
  {
    food: 'truffle',
    grape: ['Nebbiolo'],
    region: ['barolo', 'barbaresco'],
    color: 'red',
    score_boost: 15,
    reason: 'Tryffel och Barolo/Barbaresco — sommeliervärldens heliga par.',
  },
  {
    food: 'osso buco',
    grape: ['Nebbiolo', 'Barbera'],
    region: ['barolo', 'piemonte'],
    color: 'red',
    score_boost: 11,
    reason: 'Osso buco med sin gremolata och gelatin matchar Barolos tanniner och syra.',
  },
  {
    food: 'carbonara',
    grape: ['Frascati', 'Verdicchio', 'Trebbiano'],
    region: ['lazio', 'marche'],
    color: 'white',
    score_boost: 9,
    reason: 'Carbonaras ägg och guanciale vill ha fräscht, lokalt vitt från Lazio.',
  },
  {
    food: 'lasagne',
    grape: ['Sangiovese', 'Barbera'],
    region: ['chianti', 'emilia-romagna'],
    color: 'red',
    score_boost: 10,
    reason: 'Lasagne med Chianti — italiensk söndagslunch på riktigt.',
  },

  // ============================================================================
  // INTERNATIONELLA IKONER — FRANSKA KLASSIKER
  // ============================================================================

  {
    food: 'foie gras',
    region: ['sauternes', 'alsace'],
    grape: ['Sémillon', 'Gewürztraminer'],
    score_boost: 14,
    reason: 'Foie gras och Sauternes — den franska gastronomieras mest berömda par.',
  },
  {
    food: 'coq au vin',
    grape: ['Pinot Noir'],
    region: ['bourgogne'],
    color: 'red',
    score_boost: 13,
    reason: 'Coq au vin tillagas i Bourgogne och dricks med Bourgogne — logiskt och gudomligt.',
  },
  {
    food: 'confit de canard',
    grape: ['Malbec', 'Tannat'],
    region: ['cahors', 'madiran', 'sud-ouest'],
    color: 'red',
    score_boost: 11,
    reason: 'Confiterad anka från sydvästra Frankrike med Cahors — regionens självklara par.',
  },
  {
    food: 'escargot',
    grape: ['Chardonnay', 'Aligoté'],
    region: ['bourgogne', 'chablis'],
    color: 'white',
    score_boost: 10,
    reason: 'Escargot med vitlökssmör och Bourgogne Aligoté — Burgundisk bistroklassiker.',
  },
  {
    food: 'ratatouille',
    region: ['provence', 'côtes du rhône', 'languedoc'],
    grape: ['Grenache', 'Syrah', 'Mourvèdre'],
    color: 'red',
    score_boost: 9,
    reason: 'Ratatouille med Provence-rött eller Côtes du Rhône — Sydfrankrike på tallriken och i glaset.',
  },

  // ============================================================================
  // INTERNATIONELLA IKONER — ASIATISKT
  // ============================================================================

  {
    food: 'thai',
    grape: ['Riesling', 'Gewürztraminer', 'Torrontés'],
    region: ['alsace', 'mosel'],
    color: 'white',
    score_boost: 12,
    reason: 'Thaimat med Riesling eller Gewürztraminer — aromatik och restsötma tämjer chilin.',
  },
  {
    food: 'curry',
    grape: ['Gewürztraminer', 'Riesling', 'Viognier'],
    region: ['alsace'],
    color: 'white',
    score_boost: 11,
    reason: 'Indisk curry med off-dry Gewürztraminer — kryddorna i maten möter kryddorna i druvan.',
  },
  {
    food: 'indiskt',
    grape: ['Gewürztraminer', 'Riesling'],
    region: ['alsace', 'pfalz'],
    color: 'white',
    score_boost: 11,
    reason: 'Indisk mat med Gewürztraminer — klassisk sommelierlösning för kryddstark mat.',
  },
  {
    food: 'dim sum',
    grape: ['Riesling', 'Champagne'],
    region: ['mosel', 'champagne'],
    score_boost: 9,
    reason: 'Dim sum med Riesling eller Champagne — lättsamt och elegant.',
  },
  {
    food: 'peking-anka',
    grape: ['Pinot Noir', 'Riesling'],
    region: ['bourgogne', 'alsace'],
    score_boost: 10,
    reason: 'Pekinganka med hoisin och Pinot Noir — sött möter jordigt.',
  },

  // ============================================================================
  // INTERNATIONELLA IKONER — SÖTSAKER & DESSERT
  // ============================================================================

  {
    food: 'choklad',
    grape: ['Touriga Nacional'],
    region: ['porto', 'banyuls', 'maury'],
    score_boost: 13,
    reason: 'Mörk choklad och portvin eller Banyuls — sötma och intensitet i perfekt symbios.',
  },
  {
    food: 'crème brûlée',
    region: ['sauternes', 'tokaji'],
    grape: ['Sémillon', 'Furmint'],
    score_boost: 11,
    reason: 'Crème brûlées karamell och vanilj möter Sauternes honung och aprikoser.',
  },
  {
    food: 'tarte tatin',
    grape: ['Chenin Blanc'],
    region: ['loire', 'vouvray'],
    score_boost: 10,
    reason: 'Tarte Tatin med Vouvray — Loire-dalens egen äppeldessert med eget vin.',
  },
  {
    food: 'pannacotta',
    grape: ['Moscato'],
    region: ['piemonte', 'asti'],
    score_boost: 9,
    reason: 'Pannacotta med Moscato d\'Asti — lätt sötma och bubblor från Piemonte.',
  },
  {
    food: 'tiramisu',
    grape: ['Moscato'],
    region: ['asti', 'marsala'],
    score_boost: 9,
    reason: 'Tiramisu med Moscato d\'Asti eller Marsala — italiensk dessert med italienskt sött.',
  },

  // ============================================================================
  // INTERNATIONELLA IKONER — SPANSKA & PORTUGISISKA
  // ============================================================================

  {
    food: 'tapas',
    grape: ['Tempranillo', 'Garnacha', 'Albariño'],
    region: ['rioja', 'rías baixas', 'jerez'],
    score_boost: 10,
    reason: 'Tapas med Rioja eller sherry — Spaniens mest klassiska kombination.',
  },
  {
    food: 'paella',
    grape: ['Garnacha', 'Monastrell', 'Albariño'],
    region: ['valencia', 'jumilla', 'rías baixas'],
    score_boost: 10,
    reason: 'Paella med spanskt rosé eller Albariño — solens och havets smaker.',
  },
  {
    food: 'jamón',
    grape: ['Tempranillo', 'Garnacha'],
    region: ['rioja', 'jerez'],
    score_boost: 12,
    reason: 'Jamón ibérico med Rioja gran reserva eller Fino sherry — Spaniens stolthet.',
  },
  {
    food: 'ibérico',
    grape: ['Tempranillo'],
    region: ['rioja', 'ribera del duero', 'jerez'],
    score_boost: 12,
    reason: 'Ibérico-kött med Rioja eller Ribera del Duero — spansk terroir i perfektion.',
  },
  {
    food: 'bacalhau',
    grape: ['Alvarinho', 'Encruzado'],
    region: ['vinho verde', 'dão'],
    color: 'white',
    score_boost: 11,
    reason: 'Bacalhau med Vinho Verde — Portugals nationalrätt med Portugals fräschaste vin.',
  },

  // ============================================================================
  // FLER SOMMELIERKLASSIKER
  // ============================================================================

  {
    food: 'vitlökssmör',
    grape: ['Chardonnay', 'Vermentino'],
    region: ['bourgogne'],
    color: 'white',
    score_boost: 8,
    reason: 'Vitlökssmör och fyllig Chardonnay — smör på smör med balans.',
  },
  {
    food: 'fläsk',
    grape: ['Chenin Blanc', 'Riesling', 'Pinot Noir'],
    region: ['loire', 'alsace', 'bourgogne'],
    score_boost: 8,
    reason: 'Fläsk med Chenin Blanc eller lätt Pinot Noir — sötma och syra i balans.',
  },
  {
    food: 'pulled pork',
    grape: ['Zinfandel', 'Malbec', 'Shiraz'],
    region: ['paso robles', 'mendoza', 'barossa'],
    color: 'red',
    score_boost: 10,
    reason: 'Pulled pork med Zinfandel — rökiga, söta smaker möter fruktdriven krydda.',
  },
  {
    food: 'korv',
    grape: ['Gamay', 'Barbera', 'Dolcetto'],
    region: ['beaujolais', 'piemonte'],
    color: 'red',
    score_boost: 8,
    reason: 'Korv med Beaujolais — bistrons enklaste och mest glädjefyllda par.',
  },
  {
    food: 'charkuterier',
    grape: ['Gamay', 'Barbera', 'Dolcetto', 'Cabernet Franc'],
    region: ['beaujolais', 'loire', 'piemonte'],
    color: 'red',
    score_boost: 9,
    reason: 'Charkuterier med lättsamma röda — frukt och salt i harmonisk balans.',
  },
  {
    food: 'skinka',
    grape: ['Gamay', 'Pinot Noir', 'Riesling'],
    region: ['beaujolais', 'alsace'],
    score_boost: 8,
    reason: 'Skinka med Beaujolais eller Riesling — klassisk enkel kombination.',
  },
  {
    food: 'sardiner',
    grape: ['Albariño', 'Vinho Verde', 'Muscadet'],
    region: ['rías baixas', 'vinho verde', 'muscadet'],
    color: 'white',
    score_boost: 10,
    reason: 'Grillade sardiner med Albariño — Atlantkustens enklaste nöje.',
  },
  {
    food: 'tonfisk',
    grape: ['Pinot Noir', 'Vermentino'],
    region: ['bourgogne', 'provence'],
    score_boost: 9,
    reason: 'Tonfisk — tillräckligt köttig för lätt Pinot Noir eller mineralisk Vermentino.',
  },
  {
    food: 'lax',
    grape: ['Chardonnay', 'Pinot Noir'],
    region: ['bourgogne', 'oregon'],
    score_boost: 10,
    reason: 'Lax med Bourgogne (vitt eller rött) — fiskens fett möter vinets elegans.',
  },
  {
    food: 'torsk',
    grape: ['Albariño', 'Chablis', 'Vermentino'],
    region: ['chablis', 'rías baixas'],
    color: 'white',
    score_boost: 10,
    reason: 'Torsk med Chablis eller Albariño — mineralisk precision till milt kött.',
  },
  {
    food: 'salade niçoise',
    grape: ['Vermentino', 'Grenache'],
    region: ['provence'],
    color: 'rose',
    score_boost: 10,
    reason: 'Salade Niçoise och Provence-rosé — den franska rivierans lunch.',
  },
  {
    food: 'moussaka',
    grape: ['Xinomavro', 'Agiorgitiko'],
    region: ['naoussa', 'nemea'],
    color: 'red',
    score_boost: 10,
    reason: 'Moussaka med grekiskt rött — aubergine, lamm och Xinomavro i medelhavssol.',
  },
  {
    food: 'gyros',
    grape: ['Agiorgitiko', 'Xinomavro'],
    region: ['nemea', 'naoussa'],
    color: 'red',
    score_boost: 8,
    reason: 'Gyros med grekiskt rött — folklig mat med folkligt vin.',
  },
  {
    food: 'kebab',
    grape: ['Öküzgözü', 'Syrah', 'Tempranillo'],
    region: ['rhône', 'rioja'],
    color: 'red',
    score_boost: 8,
    reason: 'Kebab med kryddigt rött — Syrah eller turkisk Öküzgözü.',
  },
  {
    food: 'falafel',
    grape: ['Sauvignon Blanc', 'Vermentino'],
    color: 'white',
    score_boost: 8,
    reason: 'Falafel med fräscht vitt vin — syra och örter i samspel.',
  },
  {
    food: 'hummus',
    grape: ['Sauvignon Blanc', 'Grüner Veltliner'],
    color: 'white',
    score_boost: 7,
    reason: 'Hummus med Grüner Veltliner — krämigt möter krispigt.',
  },
];

// ============================================================================
// LOOKUP HELPERS
// ============================================================================

/** Pre-computed index for fast food keyword lookup */
const GOLDEN_INDEX: Map<string, GoldenPair[]> = new Map();

function ensureIndex(): Map<string, GoldenPair[]> {
  if (GOLDEN_INDEX.size > 0) return GOLDEN_INDEX;
  for (const pair of GOLDEN_PAIRS) {
    const key = pair.food.toLowerCase();
    const existing = GOLDEN_INDEX.get(key) || [];
    existing.push(pair);
    GOLDEN_INDEX.set(key, existing);
  }
  return GOLDEN_INDEX;
}

/**
 * Find all golden pairs for a given food keyword.
 * Returns empty array if no golden pair exists.
 */
export function findGoldenPairs(foodKeyword: string): GoldenPair[] {
  const index = ensureIndex();
  return index.get(foodKeyword.toLowerCase()) || [];
}

/**
 * Check if a wine matches any golden pair for the given food keywords.
 * Returns the best (highest boost) matching pair, or null.
 */
export function matchGoldenPair(
  foodKeywords: string[],
  wineGrape: string | null,
  wineRegion: string | null,
  wineColor: string | null,
): { pair: GoldenPair; boost: number } | null {
  const index = ensureIndex();
  let bestMatch: { pair: GoldenPair; boost: number } | null = null;

  for (const food of foodKeywords) {
    const pairs = index.get(food.toLowerCase());
    if (!pairs) continue;

    for (const pair of pairs) {
      // Check if wine matches this golden pair
      let matches = false;

      // Color check (if pair specifies color, wine must match)
      if (pair.color && wineColor && pair.color !== wineColor) continue;

      // Grape match
      if (pair.grape && wineGrape) {
        const wineGrapeLower = wineGrape.toLowerCase();
        if (pair.grape.some(g => wineGrapeLower.includes(g.toLowerCase()))) {
          matches = true;
        }
      }

      // Region match
      if (pair.region && wineRegion) {
        const wineRegionLower = wineRegion.toLowerCase();
        if (pair.region.some(r => wineRegionLower.includes(r.toLowerCase()))) {
          matches = true;
        }
      }

      // Must match at least grape or region (not just color)
      if (!matches) continue;

      // Take highest boost
      if (!bestMatch || pair.score_boost > bestMatch.boost) {
        bestMatch = { pair, boost: pair.score_boost };
      }
    }
  }

  return bestMatch;
}
