/**
 * Data Sources - Type Definitions
 * 
 * Defines interfaces for all external data sources.
 * Each source produces typed, observable data (no predictions).
 */

// ============================================================================
// SOURCE METADATA
// ============================================================================

export type DataSourceName =
  | 'coingecko'
  | 'fearGreed'
  | 'glassnode'
  | 'fred'
  | 'kraken'
  | 'bitvavo'
  | 'cmc';

export interface DataSourceConfig {
  name: DataSourceName;
  endpoint: string;
  updateFrequencyMs: number;
  rateLimitPerHour: number;
  requiresAuth: boolean;
  apiKeyEnvVar?: string;
  fallbackValue?: unknown;
}

export interface SourceFetchResult<T> {
  source: DataSourceName;
  success: boolean;
  data?: T;
  error?: string;
  fetchedAt: ISO8601Timestamp;
  cacheAge?: number; // ms since cache refresh
}

// ============================================================================
// COINGECKO
// ============================================================================

export interface CoinGeckoMarketData {
  priceUSD: number;
  change24hPercent: number;
  change7dPercent: number;
  marketCapUSD: number;
  volume24hUSD: number;
  ath: number;
  athChangePercent: number;
  circSupply: number;
  totalSupply: number;
  sparkline7d: number[];
}

export interface CoinGeckoSource {
  [assetId: string]: CoinGeckoMarketData;
}

// ============================================================================
// FEAR & GREED INDEX
// ============================================================================

export interface FearGreedData {
  value: number; // 0-100
  classification: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  timestamp: ISO8601Timestamp;
  trend: 'up' | 'down' | 'flat';
  trendPoints: number; // Change from previous day
  history: FearGreedHistoryPoint[];
}

export interface FearGreedHistoryPoint {
  date: string; // YYYY-MM-DD
  value: number;
  classification: string;
}

// ============================================================================
// GLASSNODE ON-CHAIN
// ============================================================================

export interface GlassnodeOnChainData {
  asset: 'BTC' | 'ETH';
  activeAddresses24h: number;
  activeAddressesChange: number; // percent
  transactionVolume24h: number;
  meanTransactionValue: number;
  whaleTransactions: number; // >1000 BTC / >32000 ETH
  supplyCirculating: number;
  supplyLocked: number; // in DeFi, staking, etc
  supplyLockedPercent: number;
  hodlerPercentageGains: number; // % HODLing at profit
  largeTransactions: number; // >100 BTC / >1000 ETH
  liquidityScore: number; // 0-100 (higher = more liquid)
}

// ============================================================================
// FRED (FEDERAL RESERVE ECONOMIC DATA)
// ============================================================================

export interface FredMacroData {
  fedFundsRatePercent: number;
  cpiYoyPercent: number;
  unemploymentRatePercent: number;
  gdpGrowthPercent: number;
  m1MoneySupplyBillions: number;
  treasuryYield2Year: number;
  treasuryYield10Year: number;
  lastUpdated: ISO8601Timestamp;
  trend: {
    fedRate: 'up' | 'down' | 'flat';
    inflation: 'up' | 'down' | 'flat';
    unemployment: 'up' | 'down' | 'flat';
  };
}

// ============================================================================
// KRAKEN PUBLIC
// ============================================================================

export interface KrakenTickerData {
  pair: string; // e.g., XXBTZUSD
  last: number;
  volume24h: number;
  volumeWeighted: number;
  low24h: number;
  high24h: number;
  change24h: number;
  changePercent24h: number;
  bid: number;
  ask: number;
}

// ============================================================================
// BITVAVO PUBLIC
// ============================================================================

export interface BitvavoMarketData {
  market: string; // e.g., BTC-EUR
  price: number;
  volume24h: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  timestamp: ISO8601Timestamp;
}

// ============================================================================
// COMBINED AGGREGATED DATA
// ============================================================================

export interface AggregatedMarketData {
  timestamp: ISO8601Timestamp;
  asset: 'BTC' | 'ETH';
  
  // Price & Volume (CoinGecko + Exchange)
  price: {
    usd: number;
    source: 'coingecko' | 'kraken' | 'bitvavo';
  };
  
  momentum: {
    change24h: number;
    change7d: number;
    sparkline7d: number[];
  };
  
  volatility: {
    high24h: number;
    low24h: number;
    range: number;
    rangePercent: number;
  };
  
  volume: {
    volume24h: number;
    volumeWeighted?: number;
    trend: 'increasing' | 'decreasing' | 'flat';
  };
  
  sentiment: {
    fearGreedValue: number;
    fearGreedClassification: string;
    trendDirection: 'up' | 'down' | 'flat';
  };
  
  onChain?: {
    activeAddresses24h: number;
    whaleActivityChange: number;
    liquidityScore: number;
    hodlerProfitPercent: number;
  };
  
  macro?: {
    fedRatePercent: number;
    inflation: number;
    riskAssetTrend: 'rising' | 'declining' | 'neutral';
  };
  
  // Metadata
  sources: DataSourceName[];
  qualityScore: number; // 0-100, how many sources available
}

// ============================================================================
// OBSERVATION ENRICHMENT
// ============================================================================

export interface DataSourceObservation {
  priceContext: string; // "Bitcoin +3.2%, trending below 50-day average"
  sentimentContext: string; // "Fear dominant (35), down 5 points"
  onChainContext?: string; // "Whales accumulating, activity +2%"
  macroContext?: string; // "Fed holding rates, inflation moderating"
  volumeContext: string; // "Volume 20% below average"
  volatilityContext: string; // "Range $1200, volatility moderate"
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type ISO8601Timestamp = string; // YYYY-MM-DDTHH:mm:ssZ

export interface SourceHealth {
  source: DataSourceName;
  lastSuccessfulFetch: ISO8601Timestamp;
  lastFailure?: ISO8601Timestamp;
  successRate: number; // percent
  avgResponseTimeMs: number;
  isHealthy: boolean;
}

export interface AggregatorConfig {
  enabledSources: DataSourceName[];
  cacheDurationMs: number;
  timeoutMs: number;
  retryAttempts: number;
  logVerbose: boolean;
}
