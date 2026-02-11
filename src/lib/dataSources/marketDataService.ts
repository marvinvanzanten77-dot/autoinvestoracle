/**
 * Market Data Service
 * Fetches from local cache first, falls back to CoinGecko
 * Provides constant availability for agent and ChatGPT
 */

export interface MarketPrice {
  asset: string;
  priceEUR: number;
  priceUSD: number;
  change24hEUR: number;
  change24hUSD: number;
  change7dEUR?: number;
  change7dUSD?: number;
  marketCapEUR?: number;
  marketCapUSD?: number;
  volume24hEUR?: number;
  volume24hUSD?: number;
  fearGreedIndex?: number;
  fearGreedClassification?: string;
  lastUpdated: string;
  cacheAge?: number;
}

export interface MarketDataResponse {
  prices: Record<string, MarketPrice>;
  fearGreedIndex?: number;
  fearGreedClassification?: string;
  source: 'cache' | 'coingecko' | 'hybrid';
  timestamp: string;
  cacheInfo?: {
    assets: number;
    oldestDataSecs: number;
    newestDataSecs: number;
  };
}

/**
 * Get current market prices (from cache)
 */
export async function getMarketPrices(assets?: string[]): Promise<MarketDataResponse> {
  try {
    // Try cache first
    const params = new URLSearchParams();
    if (assets && assets.length > 0) {
      params.append('asset', assets[0]); // Single asset
    }
    params.append('freshOnly', 'true'); // Get fresh data (< 10 mins old)

    const cacheResponse = await fetch(`/api/market-data?${params.toString()}`);
    
    if (!cacheResponse.ok) {
      throw new Error(`Cache fetch failed: ${cacheResponse.status}`);
    }

    const cacheData = (await cacheResponse.json()) as any;
    
    if (cacheData.status === 'success' && cacheData.data && Object.keys(cacheData.data).length > 0) {
      return {
        prices: cacheData.data,
        source: 'cache',
        timestamp: cacheData.timestamp,
        cacheInfo: cacheData.cacheInfo,
        fearGreedIndex: Object.values(cacheData.data)[0]?.fearGreedIndex as number,
        fearGreedClassification: Object.values(cacheData.data)[0]?.fearGreedClassification as string,
      };
    }

    throw new Error('No cached data available');
  } catch (error) {
    console.warn('[MarketDataService] Cache failed, returning empty:', error);
    return {
      prices: {},
      source: 'cache',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get price for specific asset
 */
export async function getAssetPrice(asset: string): Promise<MarketPrice | null> {
  try {
    const response = await getMarketPrices([asset]);
    return response.prices[asset.toUpperCase()] || null;
  } catch (error) {
    console.error('[MarketDataService] Error getting asset price:', error);
    return null;
  }
}

/**
 * Get fear & greed index
 */
export async function getFearGreedIndex(): Promise<{
  index: number;
  classification: string;
}> {
  try {
    const response = await getMarketPrices();
    return {
      index: response.fearGreedIndex || 50,
      classification: response.fearGreedClassification || 'Neutral',
    };
  } catch (error) {
    console.error('[MarketDataService] Error getting fear greed:', error);
    return {
      index: 50,
      classification: 'Neutral',
    };
  }
}

/**
 * Format prices for display/logging
 */
export function formatPriceData(prices: Record<string, MarketPrice>): string {
  return Object.entries(prices)
    .map(([asset, data]) => 
      `${asset}: €${data.priceEUR.toFixed(2)} (${data.change24hEUR > 0 ? '+' : ''}${data.change24hEUR.toFixed(2)}%)`
    )
    .join(' | ');
}
