/**
 * CENTRALIZED DATA SERVICE
 * 
 * Single source of truth for all static and dynamic content.
 * - Auto-loaded data: Market observations, aggregated data
 * - Manual-request data: Detailed analysis, learning insights
 * - Consolidated content: Tips, education, market context
 */

import { getAggregator } from '../dataSources/aggregator';
import { withTimeout, API_TIMEOUT_MS, autoLoadRateLimiter } from '../lib/rateLimiter';
import type { AggregatedMarketData } from '../dataSources/types';
import type { MarketObservation } from '../lib/observation/types';

// ============================================================================
// CONSOLIDATED STATIC DATA (Single Source)
// ============================================================================

export const contentLibrary = {
  /**
   * Education snippets — used once, consolidated
   * Shows in: Today.tsx, Dashboard.tsx, Settings.tsx
   */
  educationTips: [
    {
      id: 'edu_stablecoin',
      title: 'Wat is een stablecoin?',
      detail: 'Een munt die gekoppeld is aan een vaste waarde, vaak de euro of dollar.',
      category: 'basics',
    },
    {
      id: 'edu_wallet',
      title: 'Wat is een wallet?',
      detail: 'Een digitale plek om je munten te bewaren. Soms bij een platform, soms los.',
      category: 'basics',
    },
    {
      id: 'edu_diversify',
      title: 'Waarom spreiden?',
      detail: 'Door te verdelen over meerdere munten voorkom je grote schommelingen in 1 keer.',
      category: 'risk',
    },
    {
      id: 'edu_patience',
      title: 'Waarom een lange adem?',
      detail: 'Rustige opbouw geeft je meer tijd om te leren en minder druk op snelle keuzes.',
      category: 'mindset',
    },
    {
      id: 'edu_volatility',
      title: 'Wat betekent volatiliteit?',
      detail: 'Hoe snel prijzen op en neer bewegen in korte tijd.',
      category: 'concepts',
    },
    {
      id: 'edu_altcoins',
      title: 'Wat zijn altcoins?',
      detail: 'Alle munten naast Bitcoin en Ethereum. Vaak bewegelijker en minder stabiel.',
      category: 'concepts',
    },
    {
      id: 'edu_dca',
      title: 'Wat is spreiden over tijd?',
      detail: 'Regelmatig kleine stappen nemen in plaats van alles in een keer.',
      category: 'strategy',
    },
  ],

  /**
   * Market context — explains market dynamics
   */
  marketContexts: [
    {
      id: 'ctx_volume',
      title: 'Waar de rust vandaan komt',
      detail: 'Veel handelsvolume blijft bij de grotere munten, wat voor minder verrassingen zorgt.',
    },
    {
      id: 'ctx_signals',
      title: 'De markt luistert naar kleine signalen',
      detail: 'Kort nieuws zorgt voor korte bewegingen, maar zelden voor een blijvende omslag.',
    },
    {
      id: 'ctx_patience',
      title: 'Meer wachten dan jagen',
      detail: 'Geduld is hier sterker dan haste.',
    },
  ],

  /**
   * Default market updates (fallback)
   */
  defaultMarketUpdates: [
    {
      id: 'upd_movements',
      title: 'Bewegingen blijven klein, richting wordt gezocht',
      detail: 'De grotere munten bewegen in korte golven, zonder duidelijke versnelling.',
    },
    {
      id: 'upd_altcoins',
      title: 'Altcoins reageren sneller dan de basis',
      detail: 'Kleinere munten laten sneller beweging zien, terwijl Bitcoin en Ethereum rustiger blijven.',
    },
    {
      id: 'upd_stable',
      title: 'Stablecoins houden de onderlaag kalm',
      detail: 'De stabiele munten bewegen nauwelijks, waardoor veel handel vertraagd blijft.',
    },
    {
      id: 'upd_peaks',
      title: 'Korte pieken, terug naar het midden',
      detail: 'Na kleine uitschieters zakt de markt meestal snel terug naar het normale tempo.',
    },
  ],

  /**
   * Dashboard-specific context
   */
  dashboardUpdates: [
    {
      id: 'dash_pace',
      title: 'Tempo blijft gelijkmatig',
      detail: 'Het algemene tempo blijft laag, met vooral afwachtende bewegingen.',
    },
    {
      id: 'dash_focus',
      title: 'Focus op bekende munten',
      detail: 'De meeste aandacht blijft bij de grotere en stabielere munten.',
    },
    {
      id: 'dash_spikes',
      title: 'Kleine pieken, snel terug',
      detail: 'Er zijn korte bewegingen, maar het tempo zakt steeds terug.',
    },
  ],
};

// ============================================================================
// AUTO-LOADED DATA (Real-time aggregator)
// ============================================================================

export interface AutoLoadedData {
  marketData: {
    btc: AggregatedMarketData;
    eth: AggregatedMarketData;
  };
  timestamp: string;
  quality: number;
  sources: string[];
  lastUpdated: string;
}

/**
 * Fetch auto-loaded market data
 * Called on page load and on user request only (no auto-refresh)
 * 
 * PROTECTED BY:
 * - Rate limiting (3 requests per 5 min)
 * - Timeout (15 seconds)
 */
export async function fetchAutoLoadedData(): Promise<AutoLoadedData> {
  try {
    // Check rate limit first
    const limitCheck = autoLoadRateLimiter.check();
    if (!limitCheck.allowed) {
      const error = new Error(limitCheck.reason || 'Rate limited');
      (error as any).isRateLimited = true;
      (error as any).waitMs = limitCheck.waitMs;
      throw error;
    }

    const aggregator = getAggregator();

    // Fetch with timeout protection
    const [btcData, ethData] = await withTimeout(
      Promise.all([
        aggregator.aggregate('BTC'),
        aggregator.aggregate('ETH'),
      ]),
      API_TIMEOUT_MS,
      'Market data aggregation'
    );

    return {
      marketData: {
        btc: btcData,
        eth: ethData,
      },
      timestamp: new Date().toISOString(),
      quality: Math.min(btcData.qualityScore, ethData.qualityScore),
      sources: Array.from(new Set([...btcData.sources, ...ethData.sources])),
      lastUpdated: new Date().toLocaleTimeString('nl-NL'),
    };
  } catch (error) {
    console.error('[DataService] Auto-load failed:', error);
    throw error;
  }
}

// ============================================================================
// MANUAL-REQUEST DATA (On-demand, detailed)
// ============================================================================

export interface ManualRequestData {
  observations?: MarketObservation[];
  detailedAnalysis?: string;
  learnedPatterns?: any[];
  timestamp: string;
}

/**
 * Fetch detailed market observations
 * Call on user request only (not auto-loaded)
 */
export async function fetchDetailedObservations(userId: string): Promise<ManualRequestData> {
  try {
    const response = await fetch(`/api/observations?userId=${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      observations: data.observations || [],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[DataService] Detailed observations failed:', error);
    return { timestamp: new Date().toISOString() };
  }
}

/**
 * Fetch learned patterns
 * Call on user request only (not auto-loaded)
 */
export async function fetchLearnedPatterns(userId: string): Promise<ManualRequestData> {
  try {
    const response = await fetch(`/api/patterns?userId=${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      learnedPatterns: data.patterns || [],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[DataService] Learned patterns failed:', error);
    return { timestamp: new Date().toISOString() };
  }
}

/**
 * Fetch detailed market analysis
 * Call on user request only (not auto-loaded)
 */
export async function fetchDetailedAnalysis(userId: string, asset: 'BTC' | 'ETH'): Promise<ManualRequestData> {
  try {
    const response = await fetch(`/api/analysis?userId=${userId}&asset=${asset}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      detailedAnalysis: data.analysis,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[DataService] Detailed analysis failed:', error);
    return { timestamp: new Date().toISOString() };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get education tips by category
 */
export function getEducationByCategory(category: string) {
  return contentLibrary.educationTips.filter((tip) => tip.category === category);
}

/**
 * Get limited education tips (for cards)
 */
export function getLimitedEducation(limit: number = 3) {
  return contentLibrary.educationTips.slice(0, limit);
}

/**
 * Get market context
 */
export function getMarketContext() {
  return contentLibrary.marketContexts;
}

/**
 * Get dashboard-specific updates
 */
export function getDashboardUpdates() {
  return contentLibrary.dashboardUpdates;
}

/**
 * Get market updates with fallback
 */
export function getMarketUpdates() {
  return contentLibrary.defaultMarketUpdates;
}

/**
 * Transform aggregated data to human-readable format
 */
export function formatAggregatedData(data: AggregatedMarketData) {
  return {
    price: `$${data.price.usd.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`,
    change24h: `${data.momentum.change24h > 0 ? '+' : ''}${data.momentum.change24h.toFixed(2)}%`,
    sentiment: `${data.sentiment.fearGreedClassification} (${data.sentiment.fearGreedValue})`,
    volume: `$${(data.volume.volume24h / 1e9).toFixed(2)}B`,
    volatility: `${data.volatility.rangePercent.toFixed(1)}%`,
    sources: data.sources.join(', '),
    quality: `${Math.round(data.qualityScore)}%`,
  };
}

// ============================================================================
// CACHING (optional, for client-side)
// ============================================================================

let autoLoadCache: { data: AutoLoadedData; timestamp: number } | null = null;
const CACHE_DURATION_MS = 300000; // 5 minutes (conservative, no auto-refresh)

/**
 * Cached version of auto-loaded data
 * Only fetches if cache is stale (5 min) and user is active
 * 
 * IMPORTANT: Does NOT auto-refresh. User must trigger via app interaction.
 * This prevents excessive API calls and OpenAI costs.
 */
export async function getAutoLoadedDataCached(): Promise<AutoLoadedData> {
  const now = Date.now();

  if (autoLoadCache && now - autoLoadCache.timestamp < CACHE_DURATION_MS) {
    // Use cache if available and fresh
    return autoLoadCache.data;
  }

  // Cache expired or missing - fetch fresh data
  const data = await fetchAutoLoadedData();
  autoLoadCache = { data, timestamp: now };
  return data;
}

/**
 * Clear auto-load cache (for manual refresh)
 */
export function clearAutoLoadCache() {
  autoLoadCache = null;
}

/**
 * Force refresh auto-load data (user triggered)
 */
export async function refreshAutoLoadedData(): Promise<AutoLoadedData> {
  clearAutoLoadCache();
  return getAutoLoadedDataCached();
}
