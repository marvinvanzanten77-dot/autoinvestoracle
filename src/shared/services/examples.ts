/**
 * DATA-AGGREGATOR EXAMPLES & USAGE
 * 
 * Practical examples of how to use the multi-source data aggregator
 * in different parts of the application.
 */

// ============================================================================
// EXAMPLE 1: Basic aggregation in API endpoint
// ============================================================================

import { getAggregator } from '../dataSources/aggregator';
import { generateObservation } from '../observation/generator';

/**
 * Usage in /api/market-scan endpoint
 */
export async function exampleMarketScanEndpoint(userId: string) {
  const aggregator = getAggregator();

  try {
    // Aggregate data for Bitcoin
    const bitcoinData = await aggregator.aggregate('BTC');

    // Generate human-readable observation strings
    const observationStrings = aggregator.generateObservationStrings(bitcoinData);

    // Check data quality
    const qualityCheck = aggregator.getQualityAssessment(bitcoinData);

    return {
      success: true,
      data: bitcoinData,
      observations: observationStrings,
      quality: qualityCheck,
      sources: bitcoinData.sources,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// EXAMPLE 2: Creating observation with aggregated data
// ============================================================================

/**
 * Usage in observation generator
 */
export async function exampleCreateObservation(userId: string) {
  const rawData = {
    range: '24h' as const,
    changes: {
      bitcoin: 3.2,
      ethereum: 1.8,
      stablecoins: -0.1,
      altcoins: 2.5,
    },
    volatility: {
      level: 'matig' as const,
    },
    exchanges: [
      { name: 'kraken', prices: { bitcoin: 45000, ethereum: 2500 }, volume: 50000000 },
      { name: 'bitvavo', prices: { bitcoin: 44950, ethereum: 2495 }, volume: 30000000 },
    ],
  };

  // Generate observation with aggregated data
  const observation = await generateObservation(userId, rawData, 'BTC');

  console.log('Observation created:');
  console.log('- Behavior:', observation.observedBehavior);
  console.log('- Price USD:', observation.dataSources?.priceData.usd);
  console.log('- Sentiment:', observation.dataSources?.sentiment.fearGreedValue);
  console.log('- Sources used:', observation.dataSources?.sources);
  console.log('- Quality score:', observation.dataSources?.quality);

  return observation;
}

// ============================================================================
// EXAMPLE 3: Multi-asset comparison
// ============================================================================

/**
 * Aggregate data for multiple assets and compare
 */
export async function exampleMultiAssetComparison() {
  const aggregator = getAggregator();

  try {
    const [btcData, ethData] = await Promise.all([
      aggregator.aggregate('BTC'),
      aggregator.aggregate('ETH'),
    ]);

    const comparison = {
      btc: {
        price: btcData.price.usd,
        momentum: btcData.momentum.change24h,
        sentiment: btcData.sentiment.fearGreedValue,
      },
      eth: {
        price: ethData.price.usd,
        momentum: ethData.momentum.change24h,
        sentiment: ethData.sentiment.fearGreedValue,
      },
      analysis: {
        btcLeading: btcData.momentum.change24h > ethData.momentum.change24h,
        correlationStrength: Math.abs(btcData.momentum.change24h - ethData.momentum.change24h),
        macroContext: btcData.macro?.riskAssetTrend,
      },
    };

    return comparison;
  } catch (error) {
    console.error('Multi-asset comparison failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 4: Using aggregator with caching
// ============================================================================

/**
 * Create custom aggregator with different cache settings
 */
export function exampleCustomAggregator() {
  const customAggregator = require('../dataSources/aggregator').createAggregator({
    enabledSources: ['coingecko', 'fearGreed', 'fred'],
    cacheDurationMs: 300000, // 5 minutes
    timeoutMs: 15000,
    retryAttempts: 2,
    logVerbose: true,
  });

  return customAggregator;
}

// ============================================================================
// EXAMPLE 5: Error handling and fallbacks
// ============================================================================

/**
 * Robust aggregation with graceful degradation
 */
export async function exampleRobustAggregation(asset: 'BTC' | 'ETH') {
  const aggregator = getAggregator();

  try {
    const data = await aggregator.aggregate(asset);

    // Check if we have critical data
    if (data.qualityScore < 50) {
      console.warn('Low data quality score:', data.qualityScore);
      console.warn('Missing sources:', data.sources);
      // Could still use the data, but flag it as low-confidence
    }

    // Check data freshness (should be recent)
    const dataAge = Date.now() - new Date(data.timestamp).getTime();
    if (dataAge > 300000) {
      // 5 minutes old
      console.warn('Data is stale:', dataAge / 1000, 'seconds old');
    }

    return {
      data,
      warnings: data.qualityScore < 50 ? 'Low quality' : undefined,
    };
  } catch (error) {
    console.error('Aggregation failed completely:', error);

    // Return minimal fallback data
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      fallback: {
        price: 45000,
        sentiment: 50,
        sources: [],
      },
    };
  }
}

// ============================================================================
// EXAMPLE 6: Scheduled aggregation for cron jobs
// ============================================================================

/**
 * Usage in cron.ts for scheduled market scans
 */
export async function exampleScheduledAggregation(userId: string) {
  const aggregator = getAggregator();

  console.log('[Cron] Starting scheduled market aggregation');

  try {
    // Aggregate current market state
    const btcData = await aggregator.aggregate('BTC');
    const ethData = await aggregator.aggregate('ETH');

    // Generate observations
    const btcObservation = await generateObservation(
      userId,
      {
        range: '24h',
        changes: {
          bitcoin: btcData.momentum.change24h,
          ethereum: ethData.momentum.change24h,
          stablecoins: 0,
          altcoins: 0,
        },
        volatility: { level: 'matig' },
      },
      'BTC'
    );

    // Log observations and generate tickets
    console.log('[Cron] Observation generated:', btcObservation.observedBehavior);

    return {
      success: true,
      observations: [btcObservation],
      dataSources: btcData.sources,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Cron] Scheduled aggregation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// EXAMPLE 7: Source health monitoring
// ============================================================================

/**
 * Monitor which data sources are healthy
 */
export function exampleSourceHealthMonitoring() {
  const aggregator = getAggregator();

  // After some aggregations, check health
  const healthMap = aggregator.getSourceHealth();

  const healthReport = {
    timestamp: new Date().toISOString(),
    sources: Array.from(healthMap.values()).map((health) => ({
      name: health.source,
      healthy: health.isHealthy,
      lastSuccess: health.lastSuccessfulFetch,
      successRate: `${health.successRate.toFixed(1)}%`,
      avgResponseTime: `${health.avgResponseTimeMs}ms`,
    })),
  };

  return healthReport;
}

// ============================================================================
// EXAMPLE 8: Generating multi-source observation strings
// ============================================================================

/**
 * Generate human-readable descriptions from aggregated data
 */
export async function exampleObservationStrings() {
  const aggregator = getAggregator();
  const btcData = await aggregator.aggregate('BTC');

  const strings = aggregator.generateObservationStrings(btcData);

  const humanReadable = `
Market Observation Report - ${new Date().toISOString()}

Price: ${strings.priceContext}
Sentiment: ${strings.sentimentContext}
Volume: ${strings.volumeContext}
Volatility: ${strings.volatilityContext}
Macro Context: ${strings.macroContext}

Quality: ${btcData.qualityScore.toFixed(0)}% (${btcData.sources.length}/${btcData.sources.length} sources available)
  `;

  return humanReadable;
}

// ============================================================================
// EXAMPLE 9: Performance monitoring
// ============================================================================

/**
 * Measure aggregation performance
 */
export async function examplePerformanceMonitoring() {
  const aggregator = getAggregator();
  const startTime = Date.now();

  try {
    const data = await aggregator.aggregate('BTC');
    const duration = Date.now() - startTime;

    return {
      success: true,
      duration: `${duration}ms`,
      sourcesQueried: data.sources.length,
      dataQuality: data.qualityScore,
      performance: {
        fast: duration < 2000,
        acceptable: duration < 5000,
        slow: duration >= 5000,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    };
  }
}

// ============================================================================
// EXAMPLE 10: Integration with tickets
// ============================================================================

/**
 * Generate tickets based on multi-source observation
 */
export async function exampleTicketGenerationWithAggregation(userId: string) {
  const aggregator = getAggregator();
  const { generateTicketsFromObservation } = require('../observation/ticketGenerator');

  try {
    // Get aggregated market data
    const btcData = await aggregator.aggregate('BTC');

    // Create observation with aggregated data
    const observation = await generateObservation(
      userId,
      {
        range: '24h',
        changes: {
          bitcoin: btcData.momentum.change24h,
          ethereum: 0,
          stablecoins: 0,
          altcoins: 0,
        },
        volatility: { level: 'matig' },
      },
      'BTC'
    );

    // Generate tickets from observation
    const tickets = generateTicketsFromObservation(userId, observation);

    return {
      success: true,
      observation,
      tickets,
      sources: btcData.sources,
      dataQuality: btcData.qualityScore,
    };
  } catch (error) {
    console.error('Ticket generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
