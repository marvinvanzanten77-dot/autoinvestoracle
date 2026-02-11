/**
 * UNIFIED CONTEXT SERVICE
 * 
 * Single source of truth for:
 * - Market data (current + historical)
 * - Market predictions
 * - User profile & preferences
 * - Exchange connections
 * - Trading history
 * - Agent state
 * 
 * Used by:
 * - Agent (all tabs)
 * - ChatGPT chat function
 * - Dashboard updates
 * - Cron jobs
 */

import type { ChatContext, ChatMessage } from '../api/chat';

// ============================================================================
// DATA SOURCES INDEX
// ============================================================================

export interface DataSourceIndex {
  // Market Data Sources
  market: {
    realtime: string[]; // CoinGecko, Fred, Fear & Greed
    historical: string[]; // 30-day aggregation
    predictions: string[]; // Trend analysis
  };
  // Educational Sources
  education: {
    strategies: string[];
    riskManagement: string[];
    technicalAnalysis: string[];
  };
  // User Resources
  resources: {
    settings: string[];
    preferences: string[];
    notifications: string[];
  };
}

/**
 * Complete data source registry - always available
 */
export const DATA_SOURCES: DataSourceIndex = {
  market: {
    realtime: [
      'CoinGecko API (free)',
      'Fred.StLouis (economic indicators)',
      'Fear & Greed Index',
      'Bitvavo market data'
    ],
    historical: [
      'execution_outcomes table (trades)',
      'agent_activities table (observations)',
      'pattern_learning table (discovered patterns)'
    ],
    predictions: [
      'Technical analysis (moving averages, MACD, RSI)',
      'Volatility trends (30-day rolling average)',
      'Market sentiment (Fear & Greed scoring)'
    ]
  },
  education: {
    strategies: [
      'DCA (Dollar Cost Averaging)',
      'Grid Trading',
      'Momentum Trading',
      'Buy & Hold'
    ],
    riskManagement: [
      'Position sizing (max % per trade)',
      'Stop loss triggers',
      'Daily loss limits',
      'Portfolio rebalancing'
    ],
    technicalAnalysis: [
      'Support/Resistance levels',
      'Trend identification',
      'Momentum indicators',
      'Volume analysis'
    ]
  },
  resources: {
    settings: [
      'Risk profile (voorzichtig, gebalanceerd, actief)',
      'Max position size',
      'Daily loss limit',
      'Preferred assets'
    ],
    preferences: [
      'Email notifications',
      'Alert frequency',
      'Digest schedule',
      'Market scan intervals'
    ],
    notifications: [
      'Execution alerts',
      'Volatility warnings',
      'Daily summaries',
      'Pattern discoveries'
    ]
  }
};

// ============================================================================
// UNIFIED CONTEXT TYPE
// ============================================================================

export interface UnifiedContext {
  // User Identity
  userId: string;
  sessionId: string;
  timestamp: string;

  // User Profile & Preferences
  profile: {
    displayName?: string;
    email?: string;
    avatar?: string;
    strategy?: string;
    primaryGoal?: string;
    timeHorizon?: string;
    knowledgeLevel?: string;
    riskProfile?: 'voorzichtig' | 'gebalanceerd' | 'actief';
    maxPositionSize?: number; // percentage
    dailyLossLimit?: number; // percentage
  };

  // Notification Preferences
  preferences: {
    emailOnExecution?: boolean;
    emailOnAlert?: boolean;
    emailOnDailySummary?: boolean;
    digestFrequency?: 'daily' | 'weekly' | 'never';
    marketScanInterval?: '1h' | '6h' | '24h' | 'manual';
    volatilityAlertThreshold?: number; // percentage
  };

  // Market Data (Real-Time & Historical)
  market: {
    // Real-time
    currentPrices?: Record<string, number>;
    volatilityLevel?: number; // 0-100
    volatilityLabel?: string; // 'low', 'medium', 'high', 'extreme'
    sentiment?: number; // 0-100, fear to greed
    lastUpdate?: string;

    // Historical (past 30 days)
    priceChanges?: {
      bitcoin: number;
      ethereum: number;
      stablecoins: number;
      altcoins: number;
    };
    volatilityHistory?: number[]; // array of daily volatility
    trendDirection?: 'bull' | 'sideways' | 'bear';
    lastScan?: string;

    // Predictions
    predictions?: {
      shortTerm?: string; // 1-7 days
      mediumTerm?: string; // 1-4 weeks
      confidence?: number; // 0-100
    };

    // Market observations
    recentObservations?: string[];
  };

  // Exchange Connections
  exchanges: {
    connected: string[]; // ['bitvavo', 'kraken', ...]
    activePlatform?: string;
    availableAssets?: string[];
    balances?: Array<{
      exchange: string;
      total: number;
      assets?: Record<string, number>;
    }>;
  };

  // Trading History & Performance
  trading: {
    totalExecutions?: number;
    winRate?: number; // 0-1
    averageProfit?: number;
    totalProfit?: number;
    recentTrades?: Array<{
      id: string;
      symbol: string;
      direction: 'buy' | 'sell';
      profit: number;
      timestamp: string;
    }>;
    topAssets?: Array<{
      symbol: string;
      winRate: number;
      avgProfit: number;
    }>;
  };

  // Agent State
  agent: {
    isActive?: boolean;
    lastActivity?: string;
    currentMode?: 'readonly' | 'trading';
    recentAlerts?: Array<{
      id: string;
      title: string;
      description: string;
      type: 'alert' | 'analysis' | 'monitoring';
      timestamp: string;
    }>;
  };

  // Data Sources (always available)
  dataSources?: DataSourceIndex;
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Build unified context from multiple sources
 * 
 * This is the main function that both agent and ChatGPT use to get
 * complete market awareness and user state
 */
export async function buildUnifiedContext(
  userId: string,
  sessionId: string
): Promise<UnifiedContext> {
  const timestamp = new Date().toISOString();

  // Fetch from Supabase in parallel for performance
  const [profile, preferences, marketData, exchanges, trading, agentState] =
    await Promise.allSettled([
      fetchUserProfile(userId),
      fetchUserPreferences(userId),
      fetchMarketData(userId),
      fetchExchangeConnections(userId),
      fetchTradingPerformance(userId),
      fetchAgentState(userId)
    ]);

  const context: UnifiedContext = {
    userId,
    sessionId,
    timestamp,
    profile: extractResult(profile),
    preferences: extractResult(preferences),
    market: extractResult(marketData),
    exchanges: extractResult(exchanges),
    trading: extractResult(trading),
    agent: extractResult(agentState),
    dataSources: DATA_SOURCES
  };

  return context;
}

/**
 * Convert unified context to ChatGPT chat context format
 * Used for chat API calls
 */
export function unifiedToChatContext(context: UnifiedContext): ChatContext {
  return {
    profile: context.profile,
    market: context.market
      ? {
          volatilityLabel: context.market.volatilityLabel,
          volatilityLevel: context.market.volatilityLevel?.toString(),
          lastScan: context.market.lastScan,
          changes: context.market.priceChanges
        }
      : undefined,
    exchanges: context.exchanges
  };
}

/**
 * Get focused context for agent decision-making
 */
export function getAgentContext(context: UnifiedContext) {
  return {
    userId: context.userId,
    profile: {
      riskProfile: context.profile.riskProfile,
      maxPositionSize: context.profile.maxPositionSize,
      maxDrawdown: context.profile.primaryGoal ? 0.1 : 0.05,
      allowedAssets: context.exchanges.availableAssets
    },
    market: {
      volatility: context.market.volatilityLevel || 50,
      sentiment: context.market.sentiment || 50,
      trendDirection: context.market.trendDirection,
      recentObservations: context.market.recentObservations || []
    },
    portfolio: {
      totalValue: context.exchanges.balances?.[0]?.total || 0,
      balances: context.exchanges.balances || []
    },
    trading: context.trading
  };
}

/**
 * Get market data for dashboards and analysis
 */
export function getMarketSnapshot(context: UnifiedContext) {
  return {
    current: {
      volatility: context.market.volatilityLevel,
      sentiment: context.market.sentiment,
      trend: context.market.trendDirection,
      timestamp: context.market.lastUpdate
    },
    changes: context.market.priceChanges,
    observations: context.market.recentObservations,
    predictions: context.market.predictions
  };
}

/**
 * Get available resources and data sources
 */
export function getAvailableResources(context: UnifiedContext) {
  return {
    dataSources: context.dataSources || DATA_SOURCES,
    marketData: context.market.currentPrices,
    tradingHistory: context.trading,
    educationalResources: DATA_SOURCES.education,
    settingsAvailable: DATA_SOURCES.resources.settings
  };
}

// ============================================================================
// DATA FETCHERS (from Supabase + APIs)
// ============================================================================

async function fetchUserProfile(userId: string) {
  try {
    const resp = await fetch(`/api/user/profile?userId=${userId}`);
    if (!resp.ok) return {};
    return resp.json();
  } catch {
    return {};
  }
}

async function fetchUserPreferences(userId: string) {
  try {
    const resp = await fetch(`/api/user/notification-preferences?userId=${userId}`);
    if (!resp.ok) return {};
    return resp.json();
  } catch {
    return {
      emailOnExecution: true,
      emailOnAlert: true,
      emailOnDailySummary: false,
      digestFrequency: 'daily',
      marketScanInterval: 'manual',
      volatilityAlertThreshold: 5
    };
  }
}

async function fetchMarketData(userId: string) {
  try {
    const [current, historical] = await Promise.all([
      fetch('/api/market-summary?range=1h').then(r => r.json()),
      fetch('/api/market-summary?range=7d').then(r => r.json())
    ]);

    return {
      currentPrices: current.prices,
      volatilityLevel: current.volatility,
      volatilityLabel: current.volatilityLabel,
      sentiment: current.sentiment,
      lastUpdate: new Date().toISOString(),
      priceChanges: {
        bitcoin: current.changes?.bitcoin || 0,
        ethereum: current.changes?.ethereum || 0,
        stablecoins: current.changes?.stablecoins || 0,
        altcoins: current.changes?.altcoins || 0
      },
      trendDirection: historicalToTrend(historical),
      recentObservations: current.observations || []
    };
  } catch {
    return {
      volatilityLevel: 50,
      volatilityLabel: 'medium',
      sentiment: 50,
      priceChanges: { bitcoin: 0, ethereum: 0, stablecoins: 0, altcoins: 0 }
    };
  }
}

async function fetchExchangeConnections(userId: string) {
  try {
    const resp = await fetch(`/api/exchanges/status?userId=${userId}`);
    if (!resp.ok) return { connected: [] };
    return resp.json();
  } catch {
    return { connected: [] };
  }
}

async function fetchTradingPerformance(userId: string) {
  try {
    const resp = await fetch(`/api/trading/performance?userId=${userId}`);
    if (!resp.ok) return {};
    return resp.json();
  } catch {
    return {
      totalExecutions: 0,
      winRate: 0,
      averageProfit: 0,
      topAssets: []
    };
  }
}

async function fetchAgentState(userId: string) {
  try {
    const resp = await fetch(`/api/agent/state?userId=${userId}`);
    if (!resp.ok) return { isActive: false };
    return resp.json();
  } catch {
    return {
      isActive: false,
      currentMode: 'readonly',
      recentAlerts: []
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractResult<T>(promise: PromiseSettledResult<T>): T | object {
  if (promise.status === 'fulfilled') {
    return promise.value;
  }
  return {};
}

function historicalToTrend(historical: any): 'bull' | 'sideways' | 'bear' {
  if (!historical?.changes) return 'sideways';
  const avg = (
    (historical.changes.bitcoin || 0) +
    (historical.changes.ethereum || 0) +
    (historical.changes.altcoins || 0)
  ) / 3;
  if (avg > 2) return 'bull';
  if (avg < -2) return 'bear';
  return 'sideways';
}

// ============================================================================
// CACHE (optional, 5-minute TTL)
// ============================================================================

const contextCache = new Map<string, { context: UnifiedContext; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function buildUnifiedContextWithCache(
  userId: string,
  sessionId: string
): Promise<UnifiedContext> {
  const cacheKey = userId;
  const cached = contextCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.context;
  }

  const context = await buildUnifiedContext(userId, sessionId);
  contextCache.set(cacheKey, { context, timestamp: Date.now() });

  return context;
}

export function clearContextCache(userId: string) {
  contextCache.delete(userId);
}

export function clearAllContextCache() {
  contextCache.clear();
}
