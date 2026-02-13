/**
 * Wine Import Validation
 *
 * Validates wine data from Excel/CSV imports.
 * Ensures all required fields are present and valid.
 */

// ============================================================================
// Types
// ============================================================================

export type WineColor = 'red' | 'white' | 'rose' | 'sparkling' | 'fortified' | 'orange';
export type PackagingType = 'bottle' | 'keg' | 'bag_in_box' | 'can' | 'tetra' | 'other';
export type WineLocation = 'domestic' | 'eu' | 'non_eu';

export interface RawWineRow {
  wine_name?: string;
  producer?: string;
  region?: string;
  color?: string;
  vintage?: string | number;
  grape?: string;
  price?: string | number;
  moq?: string | number;
  alcohol_pct?: string | number;
  bottle_size_ml?: string | number;
  organic?: string | boolean;
  biodynamic?: string | boolean;
  description?: string;
  sku?: string;
  case_size?: string | number;
  appellation?: string;
  country?: string;
  packaging_type?: string;
  location?: string;
}

export interface ValidatedWine {
  wine_name: string;
  producer: string;
  region: string;
  color: WineColor;
  vintage: string;
  grape: string;
  price: number;
  moq: number;
  alcohol_pct: number | null;
  bottle_size_ml: number;
  organic: boolean;
  biodynamic: boolean;
  description: string | null;
  sku: string | null;
  case_size: number;
  appellation: string | null;
  country: string | null;
  packaging_type: PackagingType;
  location: WineLocation;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data: ValidatedWine | null;
}

export interface WinePreviewRow {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  data: ValidatedWine | null;
  raw: RawWineRow;
}

export interface ImportPreview {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  validRows: WinePreviewRow[];
  invalidRows: WinePreviewRow[];
}

// ============================================================================
// Constants
// ============================================================================

const VALID_COLORS: WineColor[] = ['red', 'white', 'rose', 'sparkling', 'fortified', 'orange'];

// Color aliases for fuzzy matching
const COLOR_ALIASES: Record<string, WineColor> = {
  'red': 'red',
  'röd': 'red',
  'rött': 'red',
  'rouge': 'red',
  'rosso': 'red',
  'tinto': 'red',

  'white': 'white',
  'vit': 'white',
  'vitt': 'white',
  'blanc': 'white',
  'bianco': 'white',
  'blanco': 'white',

  'rose': 'rose',
  'rosé': 'rose',
  'rosa': 'rose',
  'ros': 'rose',
  'rosado': 'rose',

  'sparkling': 'sparkling',
  'mousserande': 'sparkling',
  'champagne': 'sparkling',
  'cava': 'sparkling',
  'prosecco': 'sparkling',
  'spumante': 'sparkling',
  'sekt': 'sparkling',
  'cremant': 'sparkling',
  'crémant': 'sparkling',
  'pet-nat': 'sparkling',
  'petnat': 'sparkling',
  'pet nat': 'sparkling',

  'fortified': 'fortified',
  'starkvin': 'fortified',
  'sherry': 'fortified',
  'port': 'fortified',
  'porto': 'fortified',
  'madeira': 'fortified',
  'marsala': 'fortified',
  'pastis': 'fortified',
  'vermouth': 'fortified',
  'vermut': 'fortified',
  'armagnac': 'fortified',
  'cognac': 'fortified',
  'grappa': 'fortified',

  'orange': 'orange',
};

const VALID_PACKAGING_TYPES: PackagingType[] = ['bottle', 'keg', 'bag_in_box', 'can', 'tetra', 'other'];

// Packaging type aliases for fuzzy matching
const PACKAGING_ALIASES: Record<string, PackagingType> = {
  'bottle': 'bottle',
  'flaska': 'bottle',
  'bottles': 'bottle',
  'flask': 'bottle',

  'keg': 'keg',
  'fat': 'keg',
  'draft': 'keg',
  'draught': 'keg',
  'kegs': 'keg',

  'bag_in_box': 'bag_in_box',
  'bag-in-box': 'bag_in_box',
  'bib': 'bag_in_box',
  'box': 'bag_in_box',

  'can': 'can',
  'cans': 'can',
  'burk': 'can',

  'tetra': 'tetra',
  'tetra_pak': 'tetra',
  'tetrapak': 'tetra',

  'other': 'other',
  'annat': 'other',
  'övrigt': 'other',
};

const VALID_LOCATIONS: WineLocation[] = ['domestic', 'eu', 'non_eu'];

// Location aliases for fuzzy matching
const LOCATION_ALIASES: Record<string, WineLocation> = {
  'domestic': 'domestic',
  'sweden': 'domestic',
  'sverige': 'domestic',
  'swedish': 'domestic',
  'svenskt': 'domestic',
  'inrikes': 'domestic',

  'eu': 'eu',
  'europe': 'eu',
  'europa': 'eu',
  'european': 'eu',
  'europeiskt': 'eu',

  'non_eu': 'non_eu',
  'non-eu': 'non_eu',
  'noneu': 'non_eu',
  'outside_eu': 'non_eu',
  'utanför_eu': 'non_eu',
  'third_country': 'non_eu',
  'tredjeland': 'non_eu',
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Normalize color input to valid wine_color enum
 */
function normalizeColor(input: string | undefined): WineColor | null {
  if (!input) return null;

  const normalized = input.toLowerCase().trim();

  // Direct match
  if (VALID_COLORS.includes(normalized as WineColor)) {
    return normalized as WineColor;
  }

  // Alias match
  if (COLOR_ALIASES[normalized]) {
    return COLOR_ALIASES[normalized];
  }

  return null;
}

/**
 * Normalize packaging type input
 */
function normalizePackagingType(input: string | undefined): PackagingType {
  if (!input) return 'bottle'; // Default to bottle

  const normalized = input.toLowerCase().trim().replace(/[-\s]/g, '_');

  // Direct match
  if (VALID_PACKAGING_TYPES.includes(normalized as PackagingType)) {
    return normalized as PackagingType;
  }

  // Alias match
  if (PACKAGING_ALIASES[normalized]) {
    return PACKAGING_ALIASES[normalized];
  }

  return 'bottle'; // Default to bottle if unknown
}

/**
 * Normalize location input
 * Defaults to 'domestic' if not specified
 */
function normalizeLocation(input: string | undefined): WineLocation {
  if (!input) return 'domestic'; // Default to domestic

  const normalized = input.toLowerCase().trim().replace(/[-\s]/g, '_');

  // Direct match
  if (VALID_LOCATIONS.includes(normalized as WineLocation)) {
    return normalized as WineLocation;
  }

  // Alias match
  if (LOCATION_ALIASES[normalized]) {
    return LOCATION_ALIASES[normalized];
  }

  return 'domestic'; // Default to domestic if unknown
}

/**
 * Normalize vintage input
 * Accepts: "2022", 2022, "NV", "nv", "N/V"
 */
function normalizeVintage(input: string | number | undefined): string | null {
  if (input === undefined || input === null || input === '') return null;

  const str = String(input).trim().toUpperCase();

  // NV variants
  if (['NV', 'N/V', 'N.V.', 'NON-VINTAGE', 'NONVINTAGE', 'SA'].includes(str)) {
    return 'NV';
  }

  // Year (4 digits)
  if (/^\d{4}$/.test(str)) {
    const year = parseInt(str, 10);
    if (year >= 1800 && year <= 2100) {
      return str;
    }
  }

  return null;
}

/**
 * Normalize boolean input
 * Accepts: true, false, "yes", "no", "ja", "nej", "1", "0", "x"
 */
function normalizeBoolean(input: string | boolean | undefined): boolean {
  if (typeof input === 'boolean') return input;
  if (!input) return false;

  const str = String(input).toLowerCase().trim();
  return ['true', 'yes', 'ja', '1', 'x', 'sant'].includes(str);
}

/**
 * Normalize numeric input
 * Handles units like "750 ml", "75 cl", "0.75 l"
 */
function normalizeNumber(input: string | number | undefined): number | null {
  if (input === undefined || input === null || input === '') return null;

  if (typeof input === 'number') return input;

  // Remove units and extra whitespace
  let cleaned = String(input)
    .replace(/\s*(ml|cl|l|liter|litre|%|kr|sek)\s*/gi, '')
    .replace(',', '.')
    .trim();

  const num = parseFloat(cleaned);

  return isNaN(num) ? null : num;
}

/**
 * Normalize price (handle Swedish format: "1 234,56")
 */
function normalizePrice(input: string | number | undefined): number | null {
  if (input === undefined || input === null || input === '') return null;

  if (typeof input === 'number') return input;

  // Remove spaces and currency symbols
  let cleaned = String(input)
    .replace(/\s/g, '')
    .replace(/SEK|kr|:-/gi, '')
    .trim();

  // Handle Swedish comma as decimal separator
  // If there's a comma followed by exactly 2 digits at the end, treat as decimal
  if (/,\d{2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  } else {
    // Otherwise remove commas (thousand separators)
    cleaned = cleaned.replace(/,/g, '');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Validate a single wine row
 */
export function validateWineRow(row: RawWineRow, rowNumber: number): ValidationResult {
  const errors: string[] = [];

  // Required fields
  const wine_name = row.wine_name?.trim();
  const producer = row.producer?.trim();
  const region = row.region?.trim();
  const grape = row.grape?.trim();
  const colorInput = row.color?.trim();
  const vintageInput = row.vintage;
  const priceInput = row.price;
  const moqInput = row.moq;

  // Validate required fields
  if (!wine_name) errors.push('Saknar wine_name');
  if (!producer) errors.push('Saknar producer');
  if (!region) errors.push('Saknar region');
  if (!grape) errors.push('Saknar grape');

  // Validate and normalize color
  const color = normalizeColor(colorInput);
  if (!colorInput) {
    errors.push('Saknar color');
  } else if (!color) {
    errors.push(`Ogiltig color: "${colorInput}". Giltiga: ${VALID_COLORS.join(', ')}`);
  }

  // Validate and normalize vintage (empty = NV)
  const vintage = normalizeVintage(vintageInput) || 'NV';
  if (vintageInput !== undefined && vintageInput !== null && vintageInput !== '' && !normalizeVintage(vintageInput)) {
    errors.push(`Ogiltig vintage: "${vintageInput}". Förväntat: årtal (t.ex. 2022) eller NV`);
  }

  // Validate price
  const price = normalizePrice(priceInput);
  if (priceInput === undefined || priceInput === null || priceInput === '') {
    errors.push('Saknar price');
  } else if (price === null) {
    errors.push(`Ogiltigt price: "${priceInput}". Förväntat: positivt tal`);
  }

  // Validate MOQ
  const moq = normalizeNumber(moqInput);
  if (moqInput === undefined || moqInput === null || moqInput === '') {
    errors.push('Saknar moq');
  } else if (moq === null || moq <= 0 || !Number.isInteger(moq)) {
    errors.push(`Ogiltigt moq: "${moqInput}". Förväntat: positivt heltal`);
  }

  // Optional fields
  const alcohol_pct = normalizeNumber(row.alcohol_pct);
  if (row.alcohol_pct !== undefined && row.alcohol_pct !== '' && alcohol_pct !== null) {
    if (alcohol_pct < 0 || alcohol_pct > 100) {
      errors.push(`Ogiltig alcohol_pct: "${row.alcohol_pct}". Förväntat: 0-100`);
    }
  }

  const bottle_size_ml = normalizeNumber(row.bottle_size_ml) ?? 750;
  if (bottle_size_ml <= 0) {
    errors.push(`Ogiltig bottle_size_ml: "${row.bottle_size_ml}". Förväntat: positivt tal`);
  }

  const case_size = normalizeNumber(row.case_size) ?? 6;
  if (case_size <= 0 || !Number.isInteger(case_size)) {
    errors.push(`Ogiltig case_size: "${row.case_size}". Förväntat: positivt heltal`);
  }

  // If there are errors, return invalid result
  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  // Return validated data
  return {
    valid: true,
    errors: [],
    data: {
      wine_name: wine_name!,
      producer: producer!,
      region: region!,
      color: color!,
      vintage: vintage!,
      grape: grape!,
      price: price!,
      moq: Math.round(moq!),
      alcohol_pct: alcohol_pct !== null && alcohol_pct >= 0 && alcohol_pct <= 100 ? alcohol_pct : null,
      bottle_size_ml: Math.round(bottle_size_ml),
      organic: normalizeBoolean(row.organic),
      biodynamic: normalizeBoolean(row.biodynamic),
      description: row.description?.trim() || null,
      sku: row.sku?.trim() || null,
      case_size: Math.round(case_size),
      appellation: row.appellation?.trim() || null,
      country: row.country?.trim() || null,
      packaging_type: normalizePackagingType(row.packaging_type),
      location: normalizeLocation(row.location),
    },
  };
}

/**
 * Validate an array of wine rows
 */
export function validateWineRows(rows: RawWineRow[]): ImportPreview {
  const validRows: WinePreviewRow[] = [];
  const invalidRows: WinePreviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // Excel rows start at 1, plus header row
    const result = validateWineRow(rows[i], rowNumber);

    const previewRow: WinePreviewRow = {
      rowNumber,
      valid: result.valid,
      errors: result.errors,
      data: result.data,
      raw: rows[i],
    };

    if (result.valid) {
      validRows.push(previewRow);
    } else {
      invalidRows.push(previewRow);
    }
  }

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    validRows,
    invalidRows,
  };
}

// Column name aliases — exported for use by catalog-agent column mapper
export const COLUMN_ALIASES: Record<string, string[]> = {
  wine_name: ['wine_name', 'wine name', 'winename', 'name', 'vinnamn', 'produkt', 'product'],
  producer: ['producer', 'producent', 'winery', 'vingård', 'chateau', 'domaine'],
  region: ['region', 'område', 'area'],
  color: ['color', 'colour', 'färg', 'wine_type', 'vintyp'],
  vintage: ['vintage', 'årgång', 'year', 'år'],
  grape: ['grape', 'grapes', 'druva', 'druvor', 'variety', 'varieties', 'cepage'],
  price: ['price', 'pris', 'price_per_bottle', 'bottle_price', 'flaskpris', 'sek'],
  moq: ['moq', 'min_order', 'min_qty', 'minimum', 'minimum_order', 'minsta_order'],
  alcohol_pct: ['alcohol_pct', 'alcohol', 'abv', 'alk', 'alkohol', 'alcohol_%', 'vol'],
  bottle_size_ml: ['bottle_size_ml', 'bottle_size', 'ml', 'storlek', 'flaskstorlek'],
  organic: ['organic', 'ekologisk', 'eko'],
  biodynamic: ['biodynamic', 'biodynamisk'],
  description: ['description', 'beskrivning', 'notes', 'smakbeskrivning', 'tasting_notes'],
  sku: ['sku', 'article', 'artikelnr', 'artikelnummer', 'article_number', 'product_code'],
  case_size: ['case_size', 'kartong', 'case', 'per_case', 'bottles_per_case'],
  appellation: ['appellation', 'aoc', 'doc', 'docg', 'igt'],
  country: ['country', 'land'],
  packaging_type: ['packaging_type', 'packaging', 'format', 'förpackning', 'typ_förpackning'],
  location: ['location', 'warehouse', 'lager', 'lagerplats', 'origin', 'ursprung'],
};

/**
 * Map column headers to standard field names
 * Handles variations like "Wine Name", "wine_name", "Vinnamn", etc.
 *
 * Uses two-pass matching:
 * 1. Exact match (normalized header === normalized alias)
 * 2. Substring match (normalized header includes normalized alias)
 * This prevents false matches like "case_size" matching "size" alias for bottle_size_ml.
 */
export function normalizeColumnHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  const aliases = COLUMN_ALIASES;

  for (const header of headers) {
    const normalized = header.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');

    // Pass 1: Exact match
    let matched = false;
    for (const [field, fieldAliases] of Object.entries(aliases)) {
      if (fieldAliases.some(alias => normalized === alias.replace(/[^a-z0-9_]/g, '_'))) {
        mapping[header] = field;
        matched = true;
        break;
      }
    }

    // Pass 2: Substring match (fallback for fuzzy headers)
    if (!matched) {
      for (const [field, fieldAliases] of Object.entries(aliases)) {
        if (fieldAliases.some(alias => normalized.includes(alias.replace(/[^a-z0-9_]/g, '_')))) {
          mapping[header] = field;
          break;
        }
      }
    }
  }

  return mapping;
}
