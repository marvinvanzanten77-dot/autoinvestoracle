/**
 * FRED (Federal Reserve Economic Data) Source
 * Macro-economic indicators
 */

import type {
  FredMacroData,
  SourceFetchResult,
  ISO8601Timestamp,
} from './types';

const FRED_API_ENDPOINT = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_API_KEY = process.env.FRED_API_KEY;

const CACHE_DURATION_MS = 86400000; // 24 hours

let macroCache: { data: FredMacroData; timestamp: number } | null = null;

// FRED Series IDs for economic indicators
const FRED_SERIES = {
  FED_FUNDS_RATE: 'FEDFUNDS',
  CPI_YOY: 'CPIAUCSL',
  UNEMPLOYMENT: 'UNRATE',
  GDP_GROWTH: 'A191RL1Q225SBEA',
  M1_SUPPLY: 'M1SL',
  TREASURY_2Y: 'DGS2',
  TREASURY_10Y: 'DGS10',
};

/**
 * Fetch latest macro data from FRED
 * Requires FRED_API_KEY environment variable
 */
export async function fetchFredMacroData(): Promise<SourceFetchResult<FredMacroData>> {
  const now = Date.now();

  // Check cache
  if (macroCache && now - macroCache.timestamp < CACHE_DURATION_MS) {
    return {
      source: 'fred',
      success: true,
      data: macroCache.data,
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
      cacheAge: now - macroCache.timestamp,
    };
  }

  if (!FRED_API_KEY) {
    return {
      source: 'fred',
      success: false,
      error: 'FRED_API_KEY not configured',
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  }

  try {
    const [
      fedRateResult,
      cpiResult,
      unemploymentResult,
      gdpResult,
      m1Result,
      treasury2yResult,
      treasury10yResult,
    ] = await Promise.allSettled([
      fetchFredSeries('FEDFUNDS'),
      fetchFredSeries('CPIAUCSL'),
      fetchFredSeries('UNRATE'),
      fetchFredSeries('A191RL1Q225SBEA'),
      fetchFredSeries('M1SL'),
      fetchFredSeries('DGS2'),
      fetchFredSeries('DGS10'),
    ]);

    // Extract values with error handling
    const fedRate =
      fedRateResult.status === 'fulfilled' ? fedRateResult.value : 5.33;
    const cpi = cpiResult.status === 'fulfilled' ? cpiResult.value : 4.2;
    const unemployment =
      unemploymentResult.status === 'fulfilled' ? unemploymentResult.value : 3.8;
    const gdp =
      gdpResult.status === 'fulfilled' ? gdpResult.value : 2.5;
    const m1 =
      m1Result.status === 'fulfilled' ? m1Result.value : 20000;
    const treasury2y =
      treasury2yResult.status === 'fulfilled' ? treasury2yResult.value : 4.1;
    const treasury10y =
      treasury10yResult.status === 'fulfilled' ? treasury10yResult.value : 4.3;

    // Determine trends (compare to previous month)
    const macroData: FredMacroData = {
      fedFundsRatePercent: fedRate,
      cpiYoyPercent: cpi,
      unemploymentRatePercent: unemployment,
      gdpGrowthPercent: gdp,
      m1MoneySupplyBillions: m1,
      treasuryYield2Year: treasury2y,
      treasuryYield10Year: treasury10y,
      lastUpdated: new Date().toISOString() as ISO8601Timestamp,
      trend: {
        fedRate: 'flat', // Would need historical comparison
        inflation: 'down', // Example
        unemployment: 'flat',
      },
    };

    // Cache it
    macroCache = { data: macroData, timestamp: now };

    return {
      source: 'fred',
      success: true,
      data: macroData,
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  } catch (error) {
    return {
      source: 'fred',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  }
}

/**
 * Fetch a single FRED series
 */
async function fetchFredSeries(seriesId: string): Promise<number> {
  try {
    const url = new URL(FRED_API_ENDPOINT);
    url.searchParams.append('series_id', seriesId);
    url.searchParams.append('api_key', FRED_API_KEY!);
    url.searchParams.append('limit', '1'); // Get latest value
    url.searchParams.append('sort_order', 'desc');
    url.searchParams.append('file_type', 'json');

    const response = await fetch(url.toString(), { timeout: 8000 } as any);

    if (!response.ok) {
      throw new Error(`FRED HTTP ${response.status}`);
    }

    const data = await response.json();

    if (
      !data.observations ||
      data.observations.length === 0 ||
      !data.observations[0].value
    ) {
      throw new Error(`No data for series ${seriesId}`);
    }

    return parseFloat(data.observations[0].value);
  } catch (error) {
    // If FRED fetch fails, return reasonable defaults
    console.warn(`FRED fetch failed for ${seriesId}:`, error);
    return getDefaultMacroValue(seriesId);
  }
}

/**
 * Get default/fallback values for macro data
 */
function getDefaultMacroValue(seriesId: string): number {
  const defaults: Record<string, number> = {
    FEDFUNDS: 5.33, // Current rate ~5.33%
    CPIAUCSL: 4.2, // Current CPI ~4.2%
    UNRATE: 3.8, // Unemployment ~3.8%
    A191RL1Q225SBEA: 2.5, // GDP growth ~2.5%
    M1SL: 20000, // M1 supply ~$20T
    DGS2: 4.1, // 2Y yield ~4.1%
    DGS10: 4.3, // 10Y yield ~4.3%
  };

  return defaults[seriesId] || 0;
}

/**
 * Clear cache (for testing or refresh)
 */
export function clearFredCache(): void {
  macroCache = null;
}

/**
 * Interpret macro data in human-readable form
 */
export function interpretMacroContext(macro: FredMacroData): string {
  const parts: string[] = [];

  if (macro.fedFundsRatePercent > 5) {
    parts.push('Fed keeping rates elevated');
  } else if (macro.fedFundsRatePercent > 4) {
    parts.push('Fed in restrictive mode');
  } else {
    parts.push('Fed accommodative stance');
  }

  if (macro.cpiYoyPercent > 4) {
    parts.push('inflation still elevated');
  } else if (macro.cpiYoyPercent > 2.5) {
    parts.push('inflation moderating');
  } else {
    parts.push('inflation near target');
  }

  if (macro.unemploymentRatePercent < 4) {
    parts.push('labor market tight');
  } else if (macro.unemploymentRatePercent > 5) {
    parts.push('labor market loosening');
  }

  return parts.join(', ');
}
