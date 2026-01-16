// Wine-Searcher Market Price API Types

export interface MarketPriceResult {
  merchant_name: string;
  merchant_url: string;
  price: number;
  currency: string;
  bottle_size: string;
  availability: string;
  shipping_info?: string;
}

export interface WineSearcherResponse {
  wine_name: string;
  vintage?: string;
  lwin?: string;
  results: MarketPriceResult[];
  total_results: number;
  api_calls_remaining?: number;
}

export interface MarketPriceQuery {
  winename: string;
  vintage?: string;
  currencycode?: 'USD' | 'EUR' | 'GBP' | 'SEK';
  lwin?: string;
}
