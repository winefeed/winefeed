import type { MarketPriceQuery, WineSearcherResponse } from './types';

const WINE_SEARCHER_API_BASE = 'https://www.wine-searcher.com/api';
const API_KEY = process.env.WINE_SEARCHER_API_KEY;

export class WineSearcherClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || API_KEY || '';

    if (!this.apiKey) {
      console.warn('Wine-Searcher API key not configured');
    }
  }

  /**
   * Hämtar marknadspriser för ett vin från Wine-Searcher
   * Returnerar första 24 återförsäljare sorterade efter lägsta pris
   */
  async getMarketPrices(query: MarketPriceQuery): Promise<WineSearcherResponse | null> {
    if (!this.apiKey) {
      throw new Error('Wine-Searcher API key is required');
    }

    try {
      // Bygg query-parametrar
      const params = new URLSearchParams({
        api_key: this.apiKey,
        winename: query.lwin || query.winename,
      });

      if (query.vintage) {
        params.append('vintage', query.vintage);
      }

      if (query.currencycode) {
        params.append('currencycode', query.currencycode);
      }

      // Market Price API endpoint (exakt URL kan variera - justera efter dokumentation)
      const url = `${WINE_SEARCHER_API_BASE}/market-price?${params.toString()}`;

      console.log('Calling Wine-Searcher API:', url.replace(this.apiKey, '***'));

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Wine-Searcher API error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      return data as WineSearcherResponse;

    } catch (error) {
      console.error('Error calling Wine-Searcher API:', error);
      return null;
    }
  }

  /**
   * Söker priser baserat på LWIN-kod
   */
  async getPricesByLWIN(lwin: string, currencycode: 'SEK' | 'EUR' | 'USD' = 'SEK'): Promise<WineSearcherResponse | null> {
    return this.getMarketPrices({
      winename: `LWIN${lwin}`,
      lwin,
      currencycode,
    });
  }

  /**
   * Söker priser baserat på vinnamn och årgång
   */
  async getPricesByName(
    winename: string,
    vintage?: string,
    currencycode: 'SEK' | 'EUR' | 'USD' = 'SEK'
  ): Promise<WineSearcherResponse | null> {
    return this.getMarketPrices({
      winename,
      vintage,
      currencycode,
    });
  }

  /**
   * Hämtar lägsta pris för ett vin
   */
  async getLowestPrice(query: MarketPriceQuery): Promise<number | null> {
    const response = await this.getMarketPrices(query);

    if (!response || !response.results || response.results.length === 0) {
      return null;
    }

    return response.results[0].price;
  }
}

// Singleton instance
export const wineSearcherClient = new WineSearcherClient();
