/**
 * Fear & Greed Index Data Source
 * Tracks market sentiment
 */

import type {
  FearGreedData,
  SourceFetchResult,
  ISO8601Timestamp,
} from './types';

const FEAR_GREED_ENDPOINT = 'https://api.alternative.me/fng';
const CACHE_DURATION_MS = 3600000; // 1 hour

let fearGreedCache: { data: FearGreedData; timestamp: number } | null = null;

/**
 * Fetch Fear & Greed index
 * Returns current value (0-100) and classification
 */
export async function fetchFearGreedIndex(): Promise<SourceFetchResult<FearGreedData>> {
  const now = Date.now();

  // Check cache
  if (fearGreedCache && now - fearGreedCache.timestamp < CACHE_DURATION_MS) {
    return {
      source: 'fearGreed',
      success: true,
      data: fearGreedCache.data,
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
      cacheAge: now - fearGreedCache.timestamp,
    };
  }

  try {
    const url = new URL(FEAR_GREED_ENDPOINT);
    url.searchParams.append('limit', '365'); // Get 1 year history
    url.searchParams.append('format', 'json');

    const response = await fetch(url.toString(), { timeout: 8000 } as any);
    if (!response.ok) {
      throw new Error(`Fear & Greed HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('No Fear & Greed data returned');
    }

    const current = data.data[0];
    const previous = data.data[1];

    // Convert timestamp
    const timestamp = new Date(parseInt(current.timestamp) * 1000).toISOString();

    // Calculate trend
    const trendValue = parseInt(current.value);
    const prevValue = parseInt(previous.value);
    const trend = trendValue > prevValue ? 'up' : trendValue < prevValue ? 'down' : 'flat';
    const trendPoints = trendValue - prevValue;

    // Map value to classification
    const classification = classifyFearGreed(trendValue);

    // Build history
    const history = data.data
      .slice(0, 30) // Last 30 days
      .reverse()
      .map((point: any) => ({
        date: new Date(parseInt(point.timestamp) * 1000)
          .toISOString()
          .split('T')[0],
        value: parseInt(point.value),
        classification: classifyFearGreed(parseInt(point.value)),
      }));

    const fearGreedData: FearGreedData = {
      value: trendValue,
      classification,
      timestamp,
      trend,
      trendPoints,
      history,
    };

    // Cache it
    fearGreedCache = { data: fearGreedData, timestamp: now };

    return {
      source: 'fearGreed',
      success: true,
      data: fearGreedData,
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  } catch (error) {
    return {
      source: 'fearGreed',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString() as ISO8601Timestamp,
    };
  }
}

/**
 * Classify fear/greed value into categories
 */
function classifyFearGreed(
  value: number
): 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed' {
  if (value < 25) return 'Extreme Fear';
  if (value < 45) return 'Fear';
  if (value < 55) return 'Neutral';
  if (value < 75) return 'Greed';
  return 'Extreme Greed';
}

/**
 * Clear cache (for testing or refresh)
 */
export function clearFearGreedCache(): void {
  fearGreedCache = null;
}
