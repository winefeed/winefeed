/**
 * Food Scan Agent — Types
 */

/** A menu item from Wolt */
export interface WoltMenuItem {
  name: string;
  description?: string;
  price?: number;
  category?: string;
}

/** A Wolt venue search result */
export interface WoltVenue {
  slug: string;
  name: string;
  city: string;
  address?: string;
}

/** Analysis result for a single dish */
export interface DishAnalysis {
  dish_name: string;
  dish_name_original: string;
  matched: boolean;
  match_key?: string;
  colors: string[];
  regions: string[];
  grapes: string[];
  confidence: number;
  method: 'exact' | 'fuzzy' | 'decompose' | 'category' | 'ai' | 'none';
}

/** Result of scanning a restaurant menu */
export interface ScanResult {
  restaurant_name: string;
  wolt_slug?: string;
  city?: string;
  scan_source: 'wolt' | 'manual' | 'trend';
  total_dishes: number;
  matched_dishes: number;
  unmatched_dishes: number;
  dishes: DishAnalysis[];
}

/** Result of scanning trends */
export interface TrendScanResult {
  source: string;
  recipes_found: number;
  new_dishes: number;
  dishes: DishAnalysis[];
}

/** A food pairing suggestion row from DB */
export interface FoodPairingSuggestion {
  id: string;
  dish_name: string;
  dish_name_original: string | null;
  source: string;
  source_detail: string | null;
  suggested_colors: string[];
  suggested_regions: string[];
  suggested_grapes: string[];
  confidence: number;
  categorization_method: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'duplicate';
  approved_colors: string[];
  approved_regions: string[];
  approved_grapes: string[];
  reviewed_by: string | null;
  reviewed_at: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

/** A food scan result row from DB */
export interface FoodScanResultRow {
  id: string;
  restaurant_id: string | null;
  restaurant_name: string;
  wolt_slug: string | null;
  city: string | null;
  scan_source: string;
  total_dishes: number;
  matched_dishes: number;
  unmatched_dishes: number;
  dishes_json: DishAnalysis[];
  scanned_at: string;
}
