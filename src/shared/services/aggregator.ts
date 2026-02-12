/**
 * Central Data Aggregator
 * 
 * Orchestrates all data sources and combines them into rich, multi-source observations.
 * This is the heart of the observation layer.
 */

import type {
  AggregatedMarketData,
  DataSourceObservation,
  AggregatorConfig,
  SourceHealth,
  DataSourceName,
} from './types';

import { fetchCoinGeckoPrice, fetchCoinGeckoGlobal } from './coingecko';
import { fetchFearGreedIndex } from './fearGreed';
import { fetchFredMacroData, interpretMacroContext } from './fred';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: AggregatorConfig = {
  enabledSources: ['coingecko', 'fearGreed', 'fred'],
  cacheDurationMs: 60000,
  timeoutMs: 30000,
  retryAttempts: 1,
  logVerbose: false,
};

// ============================================================================
// AGGREGATOR INSTANCE
// ============================================================================

class DataAggregator {
  private config: AggregatorConfig;
  private sourceHealth: Map<DataSourceName, SourceHealth>;

  constructor(config: Partial<AggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sourceHealth = new Map();
  }

  /**
   * Main aggregation entry point
   * Fetches data from all enabled sources and combines them
   */
  async aggregate(asset: 'BTC' | 'ETH'): Promise<AggregatedMarketData> {
    const timestamp = new Date().toISOString();
    const sources: DataSourceName[] = [];

    // Map asset to CoinGecko ID
    const assetId = asset === 'BTC' ? 'bitcoin' : 'ethereum';

    if (this.config.logVerbose) {
      console.log(`[Aggregator] Starting aggregation for ${asset}`);
    }

    // Fetch all enabled sources in parallel
    const [priceResult, globalResult, sentimentResult, macroResult] =
      await Promise.allSettled([
        fetchCoinGeckoPrice(assetId),
        fetchCoinGeckoGlobal(),
        this.config.enabledSources.includes('fearGreed')
          ? fetchFearGreedIndex()
          : Promise.reject('fearGreed disabled'),
        this.config.enabledSources.includes('fred')
          ? fetchFredMacroData()
          : Promise.reject('fred disabled'),
      ]);

    // Extract price data (required)
    if (priceResult.status !== 'fulfilled' || !priceResult.value.success) {
      throw new Error(
        `Failed to fetch price data: ${priceResult.status === 'fulfilled' ? priceResult.value.error : 'timeout'}`
      );
    }

    const price = priceResult.value;
    sources.push('coingecko');

    if (
      globalResult.status === 'fulfilled' &&
      globalResult.value.success &&
      globalResult.value.data
    ) {
      sources.push('coingecko'); // Same source, already listed
    }

    // Extract sentiment (optional)
    let sentiment = { value: 50, classification: 'Neutral' as const };
    if (sentimentResult.status === 'fulfilled' && sentimentResult.value.success) {
      sentiment = {
        value: sentimentResult.value.data!.value,
        classification: sentimentResult.value.data!.classification,
      };
      sources.push('fearGreed');
    }

    // Extract macro (optional)
    let macro = undefined;
    if (macroResult.status === 'fulfilled' && macroResult.value.success) {
      macro = macroResult.value.data;
      sources.push('fred');
    }

    // Unique sources
    const uniqueSources = Array.from(new Set(sources));

    // Build aggregated data
    const aggregated: AggregatedMarketData = {
      timestamp,
      asset,
      price: {
        usd: price.data!.priceUSD,
        source: 'coingecko',
      },
      momentum: {
        change24h: price.data!.change24hPercent,
        change7d: price.data!.change7dPercent,
        sparkline7d: price.data!.sparkline7d,
      },
      volatility: {
        high24h: price.data!.priceUSD * (1 + price.data!.change24hPercent / 100), // Estimated
        low24h: price.data!.priceUSD * (1 - price.data!.change24hPercent / 100), // Estimated
        range: price.data!.priceUSD * (Math.abs(price.data!.change24hPercent) / 100),
        rangePercent: Math.abs(price.data!.change24hPercent),
      },
      volume: {
        volume24h: price.data!.volume24hUSD,
        trend: price.data!.change24hPercent > 2 ? 'increasing' : 'decreasing',
      },
      sentiment: {
        fearGreedValue: sentiment.value,
        fearGreedClassification: sentiment.classification,
        trendDirection:
          sentimentResult.status === 'fulfilled' &&
          sentimentResult.value.data?.trend
            ? sentimentResult.value.data.trend
            : 'flat',
      },
      macro:
        macro !== undefined
          ? {
              fedRatePercent: macro.fedFundsRatePercent,
              inflation: macro.cpiYoyPercent,
              riskAssetTrend:
                macro.fedFundsRatePercent > 5 ? 'declining' : 'rising',
            }
          : undefined,
      sources: uniqueSources as DataSourceName[],
      qualityScore: (uniqueSources.length / this.config.enabledSources.length) * 100,
    };

    if (this.config.logVerbose) {
      console.log(`[Aggregator] Aggregation complete:`, {
        asset,
        price: aggregated.price.usd,
        sentiment: aggregated.sentiment.fearGreedValue,
        sources: aggregated.sources,
        qualityScore: aggregated.qualityScore,
      });
    }

    return aggregated;
  }

  /**
   * Generate human-readable observation strings from aggregated data
   */
  generateObservationStrings(data: AggregatedMarketData): DataSourceObservation {
    const priceDirection = data.momentum.change24h > 0 ? '📈' : '📉';
    const priceChange = Math.abs(data.momentum.change24h).toFixed(2);

    // Price context
    const priceContext = `${data.asset} ${priceDirection} ${priceChange}% in 24h (${data.price.usd.toFixed(
      0
    )} USD), 7d: ${data.momentum.change7d.toFixed(2)}%`;

    // Sentiment context
    const sentimentEmoji =
      data.sentiment.fearGreedValue < 25
        ? '😱'
        : data.sentiment.fearGreedValue < 45
          ? '😟'
          : data.sentiment.fearGreedValue < 55
            ? '😐'
            : data.sentiment.fearGreedValue < 75
              ? '😊'
              : '🚀';

    const sentimentContext = `Sentiment ${sentimentEmoji} ${data.sentiment.fearGreedClassification} (${data.sentiment.fearGreedValue})`;

    // Volume context
    const volumeContext = `Volume: $${(data.volume.volume24h / 1e9).toFixed(2)}B, trend: ${data.volume.trend}`;

    // Volatility context
    const volatilityContext = `Range: $${data.volatility.range.toFixed(0)} (${data.volatility.rangePercent.toFixed(1)}%)`;

    // Macro context
    let macroContext = '';
    if (data.macro) {
      macroContext = `Fed Rate: ${data.macro.fedRatePercent.toFixed(2)}%, Inflation: ${data.macro.inflation.toFixed(1)}%, Asset trend: ${data.macro.riskAssetTrend}`;
    }

    // On-chain context (stub for future)
    const onChainContext = undefined;

    return {
      priceContext,
      sentimentContext,
      volumeContext,
      volatilityContext,
      macroContext,
      onChainContext,
    };
  }

  /**
   * Check if all critical sources are healthy
   */
  getQualityAssessment(data: AggregatedMarketData): {
    isHealthy: boolean;
    assessment: string;
  } {
    if (data.qualityScore >= 80) {
      return {
        isHealthy: true,
        assessment: 'All data sources operational',
      };
    } else if (data.qualityScore >= 50) {
      return {
        isHealthy: true,
        assessment: 'Some data sources unavailable, observation still valid',
      };
    } else {
      return {
        isHealthy: false,
        assessment: 'Critical data sources unavailable, observation unreliable',
      };
    }
  }

  /**
   * Update source health tracking
   */
  recordSourceHealth(source: DataSourceName, success: boolean): void {
    const health = this.sourceHealth.get(source) || {
      source,
      lastSuccessfulFetch: new Date().toISOString(),
      successRate: 100,
      avgResponseTimeMs: 0,
      isHealthy: true,
    };

    if (success) {
      health.lastSuccessfulFetch = new Date().toISOString();
    } else {
      health.lastFailure = new Date().toISOString();
    }

    // Simple success rate tracking
    health.successRate = health.successRate * 0.95 + (success ? 5 : 0);

    this.sourceHealth.set(source, health);
  }

  /**
   * Get health status of all sources
   */
  getSourceHealth(): Map<DataSourceName, SourceHealth> {
    return this.sourceHealth;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let aggregatorInstance: DataAggregator | null = null;

export function createAggregator(
  config?: Partial<AggregatorConfig>
): DataAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new DataAggregator(config);
  }
  return aggregatorInstance;
}

export function getAggregator(): DataAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new DataAggregator();
  }
  return aggregatorInstance;
}

export { DataAggregator };
