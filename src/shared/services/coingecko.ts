/**
 * CoinGecko Data Source
 * Fetches live market prices and sentiment indicators
 */

import type {
  CoinGeckoMarketData,
  CoinGeckoSource,
  SourceFetchResult,
  ISO8601Timestamp,
} from './types';

const COINGECKO_ENDPOINT = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION_MS = 60000; // 1 minute

let priceCache: Map<string, { data: CoinGeckoMarketData; timestamp: number }> =
  new Map();

/**
 * Fetch current price and market data for an asset
 */
export async function fetchCoinGeckoPrice(
  assetId: string // 'bitcoin', 'ethereum'
): Promise<SourceFetchResult<CoinGeckoMarketData>> {
  const now = Date.now();
  const cacheKey = `price:${assetId}`;
  
  // Check cache
  const cached = priceCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
    return {
      source: 'coingecko',
      success: true,
      data: cached.data,
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
      cacheAge: now - cached.timestamp,
    };
  }

  try {
    const url = new URL(`${COINGECKO_ENDPOINT}/simple/price`);
    url.searchParams.append('ids', assetId);
    url.searchParams.append('vs_currencies', 'usd');
    url.searchParams.append('include_market_cap', 'true');
    url.searchParams.append('include_24hr_vol', 'true');
    url.searchParams.append('include_24hr_change', 'true');
    url.searchParams.append('include_ath', 'true');
    url.searchParams.append('include_circulating_supply', 'true');
    url.searchParams.append('include_sparkline', 'true');

    const response = await fetch(url.toString(), { timeout: 8000 } as any);
    if (!response.ok) {
      throw new Error(`CoinGecko HTTP ${response.status}`);
    }

    const data = await response.json();
    const assetData = data[assetId];

    if (!assetData) {
      throw new Error(`Asset ${assetId} not found`);
    }

    const marketData: CoinGeckoMarketData = {
      priceUSD: assetData.usd,
      change24hPercent: assetData.usd_24h_change,
      change7dPercent: assetData.usd_7d_change || 0,
      marketCapUSD: assetData.usd_market_cap,
      volume24hUSD: assetData.usd_24h_vol,
      ath: assetData.ath?.usd || assetData.usd,
      athChangePercent: assetData.ath_change_percentage?.usd || 0,
      circSupply: assetData.circulating_supply || 0,
      totalSupply: assetData.total_supply || 0,
      sparkline7d: assetData.sparkline_7d?.usd || [],
    };

    // Cache it
    priceCache.set(cacheKey, { data: marketData, timestamp: now });

    return {
      source: 'coingecko',
      success: true,
      data: marketData,
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  } catch (error) {
    return {
      source: 'coingecko',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  }
}

/**
 * Fetch multiple assets at once (more efficient)
 */
export async function fetchCoinGeckoPrices(
  assetIds: string[]
): Promise<SourceFetchResult<CoinGeckoSource>> {
  try {
    const url = new URL(`${COINGECKO_ENDPOINT}/simple/price`);
    url.searchParams.append('ids', assetIds.join(','));
    url.searchParams.append('vs_currencies', 'usd');
    url.searchParams.append('include_market_cap', 'true');
    url.searchParams.append('include_24hr_vol', 'true');
    url.searchParams.append('include_24hr_change', 'true');
    url.searchParams.append('include_ath', 'true');
    url.searchParams.append('include_sparkline', 'true');

    const response = await fetch(url.toString(), { timeout: 10000 } as any);
    if (!response.ok) {
      throw new Error(`CoinGecko HTTP ${response.status}`);
    }

    const data = await response.json();
    const result: CoinGeckoSource = {};

    for (const assetId of assetIds) {
      const assetData = data[assetId];
      if (assetData) {
        result[assetId] = {
          priceUSD: assetData.usd,
          change24hPercent: assetData.usd_24h_change,
          change7dPercent: assetData.usd_7d_change || 0,
          marketCapUSD: assetData.usd_market_cap,
          volume24hUSD: assetData.usd_24h_vol,
          ath: assetData.ath?.usd || assetData.usd,
          athChangePercent: assetData.ath_change_percentage?.usd || 0,
          circSupply: assetData.circulating_supply || 0,
          totalSupply: assetData.total_supply || 0,
          sparkline7d: assetData.sparkline_7d?.usd || [],
        };
      }
    }

    return {
      source: 'coingecko',
      success: true,
      data: result,
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  } catch (error) {
    return {
      source: 'coingecko',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  }
}

/**
 * Get global market data (total market cap, BTC dominance)
 */
export async function fetchCoinGeckoGlobal(): Promise<
  SourceFetchResult<{
    totalMarketCapUSD: number;
    btcDominance: number;
    altDominance: number;
    btcDominanceChange24h: number;
  }>
> {
  try {
    const url = `${COINGECKO_ENDPOINT}/global`;
    const response = await fetch(url, { timeout: 8000 } as any);

    if (!response.ok) {
      throw new Error(`CoinGecko global HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      source: 'coingecko',
      success: true,
      data: {
        totalMarketCapUSD: data.data.total_market_cap.usd,
        btcDominance: data.data.btc_dominance,
        altDominance: 100 - data.data.btc_dominance,
        btcDominanceChange24h: data.data.btc_dominance_24h_change || 0,
      },
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  } catch (error) {
    return {
      source: 'coingecko',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  }
}

/**
 * Clear price cache (for testing or refresh)
 */
export function clearPriceCache(): void {
  priceCache.clear();
}
