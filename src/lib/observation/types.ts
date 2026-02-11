/**
 * OBSERVATIE-LAAG
 * 
 * Dit systeem observeert markten en leert van patronen.
 * Het is GEEN predictie-engine en GEEN trading-systeem.
 * 
 * Doel: Vastleggen wat gezien wordt, onder welke omstandigheden,
 * op welke exchanges, en later terugzien welke patronen werkelijk voorkwamen.
 * 
 * De markt = dataset
 * Andere spelers = onbetaalde onderzoekers
 * Deze app = kennis-extractor
 */

export type AssetCategory = 'BTC' | 'ETH' | 'STABLE' | 'ALT';
export type MarketContext = 'laag-volatiel' | 'matig-volatiel' | 'hoog-volatiel' | 'trend-up' | 'trend-down' | 'range-bound';
export type ConfidenceLevel = 'laag' | 'middel' | 'hoog';

/**
 * Observatie — wat zien we gebeuren in de markt?
 * Dit is NIET een trade-signaal, maar een feitelijke waarneming.
 * 
 * Gevoed door multi-source data-aggregator:
 * - CoinGecko (prijs, volume, momentum)
 * - Fear & Greed Index (sentiment)
 * - FRED (macro-economische context)
 * - On-chain data (toekomstig)
 */
export type MarketObservation = {
  id: string;
  userId: string;
  
  // Timing & context
  timestamp: string;
  range: '1h' | '24h' | '7d';
  
  // Wat zagen we?
  assetCategory: AssetCategory;
  exchanges: string[]; // 'kraken', 'bitvavo', 'coinbase', 'bybit'
  
  // Marktcontext op moment van observatie
  marketContext: MarketContext;
  volatilityLevel: 'rustig' | 'matig' | 'hoog';
  
  // De waarneming zelf (niet-predictief)
  observedBehavior: string; // "Bitcoin +3.2%, ETH -1.1%, volume omhoog op Kraken"
  relativeMomentum: {
    btcVsEth?: number; // percent
    priceVsStable?: number; // percent
    exchangeSpread?: number; // percent difference
  };
  
  // Multi-source data aggregatie
  dataSources: {
    sources: string[]; // ['coingecko', 'fearGreed', 'fred']
    priceData: {
      usd: number;
      change24h: number;
      change7d: number;
    };
    sentiment: {
      fearGreedValue: number;
      classification: string;
    };
    macro?: {
      fedRatePercent: number;
      inflation: number;
    };
    quality: number; // 0-100, percentage of available sources
  };
  
  // Optioneel: exchange-afwijkingen
  exchangeAnomalies?: Array<{
    exchange: string;
    anomaly: string; // "Prijs 2.5% hoger dan gemiddelde"
    confidence: ConfidenceLevel;
  }>;
  
  // Created metadata
  source: 'manual-scan' | 'api-monitor' | 'alert' | 'scheduled-aggregation';
  
  // Placeholder voor latere uitkomst
  outcomeLoggedAt?: string;
  outcome?: {
    what_happened: string;
    duration: string;
    was_significant: boolean;
    pattern_broken: boolean;
  };
};

/**
 * Ticket — informatief advies zonder dwang
 * Dit is wat we gebruikers tonen, NIET iets wat gaat handelen.
 */
export type Ticket = {
  id: string;
  userId: string;
  
  // Type ticket
  type: 'observatie' | 'advies' | 'opportuniteit' | 'execution';
  
  // Inhoud
  title: string;
  description: string;
  confidence: ConfidenceLevel;
  
  // Geldigheidsduur
  validUntil: string; // ISO datetime
  priority: 'low' | 'medium' | 'high'; // hoog = "let op", niet "doe iets"
  
  // Tracering
  createdAt: string;
  relatedObservationId?: string;
  relatedProposalId?: string;
  
  // Wat valt op?
  pattern: string; // "Stablecoins stijgen terwijl BTC daalt = risico-afbouw"
  context: string; // "Dit patroon zagen we ook op 15-jan en 8-feb"
  
  // GEEN execution fields
  // GEEN "recommendedAction" in sense van "koop/verkoop"
  // GEEN "expectedReturn"
};

/**
 * Learning Pool — verzamel patronen voor analyse
 * Nadat observaties hun geldigheid verloren hebben,
 * worden ze geclassificeerd.
 */
export type LearnedPattern = {
  id: string;
  
  // Pattern
  name: string; // "Stabiel Rally na Fed Hawkish"
  assetCategory: AssetCategory;
  marketContext: MarketContext;
  
  // Statistieken
  occurrences: number;
  successRate: number; // 0-1
  averageDuration: string;
  exchanges: string[];
  
  // Beschrijving
  description: string;
  historicalExamples: Array<{
    date: string;
    observation_id: string;
    outcome: string;
  }>;
  
  // Geldigheid
  lastObservedAt: string;
  confidence: ConfidenceLevel; // hoe zeker zijn we van dit patroon?
  
  // GEEN trade signal hier
  // Dit is enkel categorisering van wat werkelijk gebeurde
};
