/**
 * Matching Agent — Types
 *
 * Shared types for the wine matching pipeline:
 * fritext parse → lookup → smart query → pre-score → AI re-rank
 */

/** Result of AI-parsing free text into structured wine criteria */
export interface ParsedFritext {
  food_pairing: string[];        // ["lamm", "fisk"]
  style: string[];               // ["elegant", "naturvin"]
  occasion: string | null;       // "nyårsfest"
  implied_color: string | null;  // "red", "white", "sparkling", etc.
  implied_country: string | null;
  implied_region: string | null;
  implied_grapes: string[];
  organic: boolean;
  biodynamic: boolean;
  price_sensitivity: 'budget' | 'premium' | 'any';
}

/** Empty ParsedFritext — used as fallback when parsing fails */
export const EMPTY_PARSED: ParsedFritext = {
  food_pairing: [],
  style: [],
  occasion: null,
  implied_color: null,
  implied_country: null,
  implied_region: null,
  implied_grapes: [],
  organic: false,
  biodynamic: false,
  price_sensitivity: 'any',
};

/** Score breakdown per category (max sum = 100) */
export interface ScoreBreakdown {
  price: number;        // 0-25
  color: number;        // 0-20
  region: number;       // 0-20
  grape: number;        // 0-15
  food: number;         // 0-10
  availability: number; // 0-10
}

/** A wine with its deterministic pre-score */
export interface ScoredWine {
  wine: SupplierWineRow;
  score: number;           // 0-100
  breakdown: ScoreBreakdown;
}

/** Raw supplier_wines row from Supabase */
export interface SupplierWineRow {
  id: string;
  supplier_id: string;
  name: string;
  producer: string;
  country: string;
  region: string | null;
  appellation: string | null;
  vintage: number | null;
  grape: string | null;
  color: string | null;
  price_ex_vat_sek: number;
  alcohol_pct: number | null;
  bottle_size_ml: number | null;
  organic: boolean;
  biodynamic: boolean;
  description: string | null;
  sku: string | null;
  stock_qty: number | null;
  min_order_qty: number | null;
  moq: number | null;
  case_size: number | null;
  lead_time_days: number | null;
  delivery_areas: string[] | null;
  is_active: boolean;
}

/** Structured filters from the UI (chips, dropdowns) */
export interface StructuredFilters {
  color?: string;
  budget_min?: number;
  budget_max?: number;
  country?: string;
  grape?: string;
  certifications?: string[];
  antal_flaskor?: number;
  leverans_ort?: string;
}

/** Pipeline input */
export interface MatchingAgentInput {
  fritext: string;
  structuredFilters: StructuredFilters;
  restaurantContext?: string;
}

/** Pipeline options (with sensible defaults) */
export interface MatchingAgentOptions {
  enableParsing: boolean;
  enablePreScoring: boolean;
  enableAIRerank: boolean;
  maxDbResults: number;
  preScoreTopN: number;
  finalTopN: number;
}

export const DEFAULT_OPTIONS: MatchingAgentOptions = {
  enableParsing: true,
  enablePreScoring: true,
  enableAIRerank: true,
  maxDbResults: 100,
  preScoreTopN: 15,
  finalTopN: 10,
};

/** Merged preferences from parsed fritext + lookup tables */
export interface MergedPreferences {
  colors: string[];
  countries: string[];
  regions: string[];
  grapes: string[];
  food_pairing: string[];
  occasion: string | null;
  style: string[];
  organic: boolean;
  biodynamic: boolean;
  price_sensitivity: 'budget' | 'premium' | 'any';
}

/** Supplier info for response */
export interface SupplierInfo {
  id: string;
  namn: string;
  kontakt_email: string | null;
  min_order_bottles: number | null;
  provorder_enabled: boolean;
  provorder_fee_sek: number;
}

/** Pipeline result */
export interface MatchingAgentResult {
  wines: ScoredWine[];
  suppliersMap: Record<string, SupplierInfo>;
  parsed: ParsedFritext;
  preferences: MergedPreferences;
  timing: Record<string, number>;
  totalDbMatches: number;
}
