/**
 * AUTO-LOADED MARKET DATA ENDPOINT
 * 
 * GET /api/market/auto-load
 * Returns: Aggregated market data (BTC, ETH) with quality scores
 * 
 * This endpoint is called automatically by frontend on page load
 * and periodically refreshed (every 60 seconds).
 * 
 * No user action required.
 */

import type { Request, Response } from 'express';
import { getAggregator } from '../../lib/dataSources/aggregator';
import { createErrorResponse } from '../errorHandler';

export async function handleAutoLoadMarketData(req: Request, res: Response) {
  try {
    const aggregator = getAggregator();

    // Fetch both BTC and ETH in parallel
    const [btcResult, ethResult] = await Promise.allSettled([
      aggregator.aggregate('BTC'),
      aggregator.aggregate('ETH'),
    ]);

    // Check if at least one succeeded
    if (btcResult.status === 'rejected' && ethResult.status === 'rejected') {
      return res.status(503).json(
        createErrorResponse(
          'Market data unavailable',
          'SERVICE_UNAVAILABLE',
          'Both BTC and ETH aggregation failed'
        )
      );
    }

    const btcData = btcResult.status === 'fulfilled' ? btcResult.value : null;
    const ethData = ethResult.status === 'fulfilled' ? ethResult.value : null;

    // Calculate overall quality
    const qualityScores = [
      btcData?.qualityScore || 0,
      ethData?.qualityScore || 0,
    ].filter((s) => s > 0);

    const overallQuality =
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0;

    // Get all unique sources
    const allSources = Array.from(
      new Set([
        ...(btcData?.sources || []),
        ...(ethData?.sources || []),
      ])
    );

    res.json({
      success: true,
      data: {
        btc: btcData || null,
        eth: ethData || null,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        quality: Math.round(overallQuality),
        sources: allSources,
        isHealthy: overallQuality >= 50,
      },
    });
  } catch (error) {
    console.error('[AutoLoad] Error:', error);
    res.status(500).json(
      createErrorResponse(
        'Failed to load market data',
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    );
  }
}

// ============================================================================

/**
 * MANUAL-REQUEST: DETAILED OBSERVATIONS
 * 
 * GET /api/market/observations?userId=...
 * Returns: Historical observations for user
 * 
 * This endpoint is called ONLY when user requests details.
 * Not auto-loaded.
 */

export async function handleGetObservations(req: Request, res: Response) {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json(
        createErrorResponse('Missing userId', 'VALIDATION_ERROR', 'userId query param required')
      );
    }

    // TODO: Query from Supabase observationLog
    // For now, return mock
    const mockObservations = [
      {
        id: 'obs_1738267200000',
        userId,
        timestamp: new Date().toISOString(),
        asset: 'BTC',
        observedBehavior: 'Bitcoin +3.2%, Ethereum +1.8%, BTC leading',
        sentiment: 42,
        sources: ['coingecko', 'fearGreed'],
      },
    ];

    res.json({
      success: true,
      data: {
        observations: mockObservations,
        count: mockObservations.length,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        note: 'Requires Supabase integration for production',
      },
    });
  } catch (error) {
    console.error('[GetObservations] Error:', error);
    res.status(500).json(
      createErrorResponse(
        'Failed to fetch observations',
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    );
  }
}

// ============================================================================

/**
 * MANUAL-REQUEST: LEARNED PATTERNS
 * 
 * GET /api/market/patterns?userId=...
 * Returns: Learned patterns from historical outcomes
 * 
 * This endpoint is called ONLY when user requests patterns.
 * Not auto-loaded.
 */

export async function handleGetLearnedPatterns(req: Request, res: Response) {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json(
        createErrorResponse('Missing userId', 'VALIDATION_ERROR', 'userId query param required')
      );
    }

    // TODO: Query from Supabase learnedPatterns
    // For now, return mock
    const mockPatterns = [
      {
        id: 'pat_1',
        name: 'Fed Restrictive to Sentiment Drop',
        assetCategory: 'BTC',
        occurrences: 3,
        successRate: 0.67,
        description:
          'When Fed Funds Rate > 5%, market sentiment drops 5-10 points within 24h',
        lastObservedAt: new Date().toISOString(),
        confidence: 'middel',
      },
    ];

    res.json({
      success: true,
      data: {
        patterns: mockPatterns,
        count: mockPatterns.length,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        note: 'Requires learning engine implementation',
      },
    });
  } catch (error) {
    console.error('[GetPatterns] Error:', error);
    res.status(500).json(
      createErrorResponse(
        'Failed to fetch patterns',
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    );
  }
}

// ============================================================================

/**
 * MANUAL-REQUEST: DETAILED ANALYSIS
 * 
 * GET /api/market/analysis?userId=...&asset=BTC
 * Returns: Deep-dive analysis with OpenAI
 * 
 * This endpoint is called ONLY when user requests analysis.
 * Not auto-loaded.
 */

export async function handleGetDetailedAnalysis(req: Request, res: Response) {
  try {
    const { userId, asset } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json(
        createErrorResponse('Missing userId', 'VALIDATION_ERROR', 'userId query param required')
      );
    }

    if (!asset || (asset !== 'BTC' && asset !== 'ETH')) {
      return res.status(400).json(
        createErrorResponse(
          'Invalid asset',
          'VALIDATION_ERROR',
          'asset must be BTC or ETH'
        )
      );
    }

    // TODO: Call OpenAI with aggregated data + observations
    // For now, return mock
    const mockAnalysis = `
Gedetailleerde analyse voor ${asset} — ${new Date().toLocaleString('nl-NL')}

**Huidige situatie:**
Bitcoin beweegt +3.2% in 24h, sentiment is Fear (42).
Fed rate blijft op 5.33%, inflatie moderert naar 4.2%.

**Wat we zien:**
- Prijs sterker dan sentiment (positieve divergence)
- On-chain: wallets met >100 BTC groeien (+2%)
- Volume 20% boven gemiddelde

**Historisch patroon:**
Dit patroon zagen we op 15 januari en 22 januari.
Beide keren steeg BTC door na 3-5 dagen.

**Waarom geen predictie:**
We beschrijven wat we zien, niet wat gaat gebeuren.
Jij beslist wat je ermee doet.
    `;

    res.json({
      success: true,
      data: {
        asset,
        analysis: mockAnalysis,
        sources: ['coingecko', 'fearGreed', 'fred', 'glassnode'],
      },
      metadata: {
        timestamp: new Date().toISOString(),
        generatedBy: 'OpenAI + Data Aggregator',
        note: 'Requires OpenAI integration for production',
      },
    });
  } catch (error) {
    console.error('[GetAnalysis] Error:', error);
    res.status(500).json(
      createErrorResponse(
        'Failed to fetch analysis',
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    );
  }
}

// ============================================================================

/**
 * MANUAL-REQUEST: COMPARISON (BTC vs ETH)
 * 
 * GET /api/market/comparison
 * Returns: Side-by-side comparison of BTC and ETH
 * 
 * This endpoint is called ONLY on user request.
 */

export async function handleGetComparison(req: Request, res: Response) {
  try {
    const aggregator = getAggregator();

    const [btcData, ethData] = await Promise.all([
      aggregator.aggregate('BTC'),
      aggregator.aggregate('ETH'),
    ]);

    const comparison = {
      btc: {
        price: btcData.price.usd,
        change24h: btcData.momentum.change24h,
        sentiment: btcData.sentiment.fearGreedValue,
        volume: btcData.volume.volume24h,
      },
      eth: {
        price: ethData.price.usd,
        change24h: ethData.momentum.change24h,
        sentiment: ethData.sentiment.fearGreedValue,
        volume: ethData.volume.volume24h,
      },
      analysis: {
        btcLeading: btcData.momentum.change24h > ethData.momentum.change24h,
        momentumDelta: btcData.momentum.change24h - ethData.momentum.change24h,
        sentimentDelta: btcData.sentiment.fearGreedValue - ethData.sentiment.fearGreedValue,
        volumeRatio: (btcData.volume.volume24h / ethData.volume.volume24h).toFixed(2),
      },
    };

    res.json({
      success: true,
      data: comparison,
      metadata: {
        timestamp: new Date().toISOString(),
        interpretation:
          comparison.analysis.btcLeading
            ? 'Bitcoin leidt momentum'
            : 'Ethereum sneller dan Bitcoin',
      },
    });
  } catch (error) {
    console.error('[GetComparison] Error:', error);
    res.status(500).json(
      createErrorResponse(
        'Failed to fetch comparison',
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    );
  }
}

// ============================================================================

/**
 * MANUAL-REQUEST: SOURCE HEALTH
 * 
 * GET /api/market/sources-health
 * Returns: Health status of all data sources
 * 
 * Useful for diagnostics and understanding data reliability.
 */

export async function handleGetSourcesHealth(req: Request, res: Response) {
  try {
    const aggregator = getAggregator();
    const health = aggregator.getSourceHealth();

    const healthReport = Array.from(health.values()).map((h) => ({
      source: h.source,
      healthy: h.isHealthy,
      lastSuccess: h.lastSuccessfulFetch,
      lastFailure: h.lastFailure || 'Never',
      successRate: `${h.successRate.toFixed(1)}%`,
      avgResponseTime: `${h.avgResponseTimeMs}ms`,
    }));

    res.json({
      success: true,
      data: {
        sources: healthReport,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[SourcesHealth] Error:', error);
    res.status(500).json(
      createErrorResponse(
        'Failed to fetch sources health',
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    );
  }
}
