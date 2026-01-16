import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Quote Request Router Service
 *
 * Matches quote requests to suitable suppliers based on:
 * - Wine catalog match (region, country, style)
 * - Budget compatibility
 * - Lead time capability
 * - Minimum order quantity
 *
 * Returns scored list of supplier IDs with match reasons.
 */

export interface QuoteRequestInput {
  id: string;
  fritext: string;
  budget_per_flaska?: number;
  antal_flaskor?: number;
  leverans_senast?: string;  // ISO date
  specialkrav?: string[];
}

export interface SupplierMatch {
  supplierId: string;
  matchScore: number;  // 0-100
  matchReasons: string[];
  supplierName: string;
  catalogSize: number;
}

export interface RoutingResult {
  quoteRequestId: string;
  matches: SupplierMatch[];
  totalSuppliersEvaluated: number;
  routingTimestamp: string;
}

export class QuoteRequestRouter {
  /**
   * Main routing function
   * Returns top N matched suppliers sorted by score
   */
  static async routeQuoteRequest(
    quoteRequest: QuoteRequestInput,
    options: {
      maxMatches?: number;  // Default: 10
      minScore?: number;    // Default: 20 (0-100)
    } = {}
  ): Promise<RoutingResult> {
    const maxMatches = options.maxMatches || 10;
    const minScore = options.minScore || 20;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Step 1: Get all active suppliers
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('id, namn, type, is_active, normalleveranstid_dagar')
      .eq('is_active', true);

    if (suppliersError || !suppliers || suppliers.length === 0) {
      return {
        quoteRequestId: quoteRequest.id,
        matches: [],
        totalSuppliersEvaluated: 0,
        routingTimestamp: new Date().toISOString(),
      };
    }

    // Step 2: For each supplier, calculate match score
    const matches: SupplierMatch[] = [];

    for (const supplier of suppliers) {
      const match = await this.scoreSupplierMatch(supabase, quoteRequest, supplier);

      if (match.matchScore >= minScore) {
        matches.push(match);
      }
    }

    // Step 3: Sort by score (descending) and take top N
    matches.sort((a, b) => b.matchScore - a.matchScore);
    const topMatches = matches.slice(0, maxMatches);

    return {
      quoteRequestId: quoteRequest.id,
      matches: topMatches,
      totalSuppliersEvaluated: suppliers.length,
      routingTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Score a single supplier against a quote request
   */
  private static async scoreSupplierMatch(
    supabase: any,
    quoteRequest: QuoteRequestInput,
    supplier: any
  ): Promise<SupplierMatch> {
    let score = 0;
    const reasons: string[] = [];

    // Get supplier's wine catalog
    const { data: wines } = await supabase
      .from('supplier_wines')
      .select('*')
      .eq('supplier_id', supplier.id)
      .eq('is_active', true);

    const catalogSize = wines?.length || 0;

    if (catalogSize === 0) {
      // No wines = no match
      return {
        supplierId: supplier.id,
        matchScore: 0,
        matchReasons: ['no_catalog'],
        supplierName: supplier.namn,
        catalogSize: 0,
      };
    }

    // Extract keywords from fritext
    const keywords = this.extractKeywords(quoteRequest.fritext);

    // Score 1: Region/Country/Style Match (0-30 points)
    const regionScore = this.scoreRegionMatch(wines, keywords);
    score += regionScore;
    if (regionScore > 0) {
      reasons.push(`region_match:${regionScore.toFixed(0)}pts`);
    }

    // Score 2: Budget Match (0-25 points)
    if (quoteRequest.budget_per_flaska) {
      const budgetScore = this.scoreBudgetMatch(
        wines,
        quoteRequest.budget_per_flaska
      );
      score += budgetScore;
      if (budgetScore > 0) {
        reasons.push(`budget_match:${budgetScore.toFixed(0)}pts`);
      }
    }

    // Score 3: Lead Time Match (0-20 points)
    if (quoteRequest.leverans_senast) {
      const leadTimeScore = this.scoreLeadTimeMatch(
        supplier.normalleveranstid_dagar,
        quoteRequest.leverans_senast
      );
      score += leadTimeScore;
      if (leadTimeScore > 0) {
        reasons.push(`lead_time_ok:${leadTimeScore.toFixed(0)}pts`);
      }
    }

    // Score 4: Minimum Order Quantity Match (0-15 points)
    if (quoteRequest.antal_flaskor) {
      const qtyScore = this.scoreMinOrderQuantity(
        wines,
        quoteRequest.antal_flaskor
      );
      score += qtyScore;
      if (qtyScore > 0) {
        reasons.push(`min_order_ok:${qtyScore.toFixed(0)}pts`);
      }
    }

    // Score 5: Catalog Size Bonus (0-10 points)
    const catalogBonus = Math.min(10, catalogSize / 10);
    score += catalogBonus;
    reasons.push(`catalog_size:${catalogSize}`);

    return {
      supplierId: supplier.id,
      matchScore: Math.round(score),
      matchReasons: reasons,
      supplierName: supplier.namn,
      catalogSize,
    };
  }

  /**
   * Extract keywords from fritext
   */
  private static extractKeywords(fritext: string): string[] {
    const text = fritext.toLowerCase();
    const keywords: string[] = [];

    // Common wine regions
    const regions = [
      'bordeaux', 'bourgogne', 'burgundy', 'champagne', 'rhône', 'rhone',
      'loire', 'provence', 'alsace', 'toscana', 'tuscany', 'piedmont',
      'piemonte', 'veneto', 'sicilia', 'rioja', 'ribera del duero',
      'priorat', 'douro', 'alentejo', 'napa', 'sonoma', 'barossa',
      'marlborough', 'mendoza', 'stellenbosch'
    ];

    // Common wine countries
    const countries = [
      'frankrike', 'france', 'italien', 'italy', 'spanien', 'spain',
      'portugal', 'tyskland', 'germany', 'österrike', 'austria',
      'usa', 'australien', 'australia', 'nya zeeland', 'new zealand',
      'chile', 'argentina', 'sydafrika', 'south africa'
    ];

    // Common wine styles/grapes
    const styles = [
      'röd', 'rött', 'red', 'vit', 'vitt', 'white', 'rosé', 'rose',
      'mousserande', 'sparkling', 'champagne',
      'cabernet', 'merlot', 'pinot noir', 'syrah', 'shiraz',
      'chardonnay', 'sauvignon blanc', 'riesling', 'nebbiolo',
      'sangiovese', 'tempranillo', 'malbec', 'grenache'
    ];

    // Extract matches
    regions.forEach(region => {
      if (text.includes(region)) keywords.push(region);
    });

    countries.forEach(country => {
      if (text.includes(country)) keywords.push(country);
    });

    styles.forEach(style => {
      if (text.includes(style)) keywords.push(style);
    });

    return keywords;
  }

  /**
   * Score region/country/style match
   */
  private static scoreRegionMatch(wines: any[], keywords: string[]): number {
    if (keywords.length === 0) return 15; // Neutral score if no keywords

    let matches = 0;
    const totalWines = wines.length;

    wines.forEach(wine => {
      const wineText = `${wine.name} ${wine.country} ${wine.region || ''} ${wine.grape || ''}`.toLowerCase();

      keywords.forEach(keyword => {
        if (wineText.includes(keyword)) {
          matches++;
        }
      });
    });

    // Score based on percentage of matches
    const matchPercentage = (matches / (totalWines * keywords.length)) * 100;
    return Math.min(30, matchPercentage * 0.3);
  }

  /**
   * Score budget match
   */
  private static scoreBudgetMatch(wines: any[], budgetSek: number): number {
    const budgetOre = budgetSek * 100; // Convert to öre

    // Find wines within budget (+/- 20%)
    const withinBudget = wines.filter(wine => {
      const price = wine.price_ex_vat_sek;
      return price >= budgetOre * 0.8 && price <= budgetOre * 1.2;
    });

    const matchPercentage = (withinBudget.length / wines.length) * 100;
    return Math.min(25, matchPercentage * 0.25);
  }

  /**
   * Score lead time match
   */
  private static scoreLeadTimeMatch(
    supplierLeadTimeDays: number,
    requestedDeliveryDate: string
  ): number {
    const deliveryDate = new Date(requestedDeliveryDate);
    const today = new Date();
    const daysUntilDelivery = Math.floor(
      (deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDelivery < supplierLeadTimeDays) {
      return 0; // Cannot meet deadline
    }

    if (daysUntilDelivery >= supplierLeadTimeDays * 2) {
      return 20; // Plenty of time
    }

    // Proportional score
    return 10 + ((daysUntilDelivery - supplierLeadTimeDays) / supplierLeadTimeDays) * 10;
  }

  /**
   * Score minimum order quantity match
   */
  private static scoreMinOrderQuantity(wines: any[], requestedQty: number): number {
    // Find wines where minOrderQty <= requestedQty
    const availableWines = wines.filter(
      wine => wine.min_order_qty <= requestedQty
    );

    if (availableWines.length === 0) return 0;

    const matchPercentage = (availableWines.length / wines.length) * 100;
    return Math.min(15, matchPercentage * 0.15);
  }

  /**
   * Utility: Get routing statistics
   */
  static async getRoutingStats(quoteRequestId: string) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: assignments } = await supabase
      .from('quote_request_assignments')
      .select('*')
      .eq('quote_request_id', quoteRequestId);

    if (!assignments) {
      return {
        totalAssignments: 0,
        sent: 0,
        viewed: 0,
        responded: 0,
        expired: 0,
        averageScore: 0,
      };
    }

    return {
      totalAssignments: assignments.length,
      sent: assignments.filter(a => a.status === 'SENT').length,
      viewed: assignments.filter(a => a.status === 'VIEWED').length,
      responded: assignments.filter(a => a.status === 'RESPONDED').length,
      expired: assignments.filter(a => a.status === 'EXPIRED').length,
      averageScore:
        assignments.reduce((sum, a) => sum + (a.match_score || 0), 0) / assignments.length,
    };
  }
}
