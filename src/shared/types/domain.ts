/**
 * Domain Types - Central location for all domain model types
 * Imported by: Feature index files, API handlers, components
 */

// ===== MARKET DATA =====
export interface Price {
  asset: string;
  current: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
  volume24h?: number;
  timestamp: Date;
}

export interface MarketData {
  prices: Price[];
  timestamp: Date;
  source: 'coingecko' | 'exchange' | 'aggregate';
}

export interface Trend {
  asset: string;
  direction: 'up' | 'down' | 'stable';
  strength: number; // 0-100
  timeframe: '1h' | '24h' | '7d';
  signal?: string;
}

// ===== PORTFOLIO =====
export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  valueInEur?: number;
}

export interface Position {
  asset: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface Portfolio {
  userId: string;
  balances: Balance[];
  positions: Position[];
  totalValueInEur: number;
  totalCostInEur: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  timestamp: Date;
}

export interface Allocation {
  asset: string;
  percentage: number;
  valueInEur: number;
  recommended?: number;
}

// ===== EXCHANGES =====
export interface ExchangeCredentials {
  apiKey: string;
  secretKey: string;
  passphrase?: string; // For some exchanges like Kraken
}

export interface ExchangeConnection {
  exchangeName: 'bitvavo' | 'kraken' | 'coinbase' | 'bybit';
  userId: string;
  credentials: ExchangeCredentials;
  isConnected: boolean;
  lastSyncAt?: Date;
  syncStatus: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
}

export interface ExchangeStatus {
  exchangeName: string;
  isConnected: boolean;
  lastSyncAt?: Date;
  balanceSnapshot?: {
    total: number;
    change24h: number;
    timestamp: Date;
  };
  isHealthy: boolean;
  errorCount: number;
}

// ===== AGENT SETTINGS =====
export interface AgentSettings {
  userId: string;
  
  // Monitoring
  monitoringInterval: number; // minutes
  alertOnVolatility: boolean;
  volatilityThreshold: number; // percentage
  
  // Analysis
  analysisDepth: 'basic' | 'advanced' | 'expert';
  
  // Trading
  autoTrade: boolean;
  riskPerTrade: number; // percentage
  maxDailyLoss: number; // percentage
  confidenceThreshold: number; // 0-100
  
  // Execution
  orderLimit: number; // max orders per day
  tradingStrategy: 'conservative' | 'balanced' | 'aggressive';
  
  // Safety
  enableStopLoss: boolean;
  stopLossPercent: number;
}

export interface ProfileSettings {
  userId: string;
  email: string;
  fullName: string;
  agentSettings: AgentSettings;
  notificationPreferences?: {
    emailOnTrade: boolean;
    emailOnAlert: boolean;
    emailOnDailyReport: boolean;
  };
}

export interface UserSettings extends ProfileSettings {
  theme?: 'light' | 'dark';
  language?: 'nl' | 'en';
}

// ===== OBSERVATIONS & REPORTS =====
export interface MarketObservation {
  id: string;
  userId: string;
  timestamp: Date;
  range: '1h' | '24h' | '7d';
  assetCategory: string;
  
  marketContext: string;
  volatilityLevel: 'low' | 'medium' | 'high';
  observedBehavior: string;
  
  relativeMomentum?: Record<string, number>;
  exchangeAnomalies?: Array<{
    exchange: string;
    anomaly: string;
  }>;
  
  dataSources: Record<string, string>;
  source: string;
}

export interface AgentSuggestion {
  type: 'BUY' | 'SELL' | 'HOLD' | 'REBALANCE' | 'STOP_LOSS' | 'MONITOR';
  asset: string;
  rationale: string;
  confidence: number; // 0-100
  targetPrice?: number;
  stopLossPrice?: number;
  timeframe?: string;
}

export interface AgentReport {
  id: string;
  userId: string;
  reportedAt: Date;
  
  periodFrom: Date;
  periodTo: Date;
  periodDurationMinutes: number;
  
  observationsCount: number;
  suggestionsCount: number;
  executionsCount: number;
  mainTheme?: string;
  
  observations: MarketObservation[];
  suggestions: AgentSuggestion[];
  
  agentMood: 'bullish' | 'bearish' | 'cautious';
  recommendedAction?: string;
  overallConfidence: number; // 0-100
  
  shouldNotify: boolean;
  notificationSent?: Date;
}

export interface ExecutionOutcome {
  id: string;
  userId: string;
  observationId?: string;
  
  predictedAction: string;
  predictedAsset: string;
  predictedConfidence: number;
  predictedAt: Date;
  
  actualOutcome: string;
  actualResult?: string;
  durationHours?: number;
  profitLossPercent?: number;
  
  wasSignificant: boolean;
  patternIdentified?: string;
  
  createdAt: Date;
  recordedAt?: Date;
}

export interface LearnedPattern {
  id: string;
  userId: string;
  
  patternType: string;
  description: string;
  
  successCount: number;
  failCount: number;
  averageReturnPercent: number;
  
  triggerCondition: Record<string, any>;
  marketContext?: Record<string, any>;
  
  active: boolean;
  confidenceScore: number;
  
  firstObserved: Date;
  lastObserved?: Date;
}

// ===== NOTIFICATIONS =====
export interface Notification {
  id: string;
  userId: string;
  
  type: 'agent-report' | 'action-executed' | 'alert' | 'info';
  title: string;
  message: string;
  data?: Record<string, any>;
  
  read: boolean;
  readAt?: Date;
  dismissed: boolean;
  dismissedAt?: Date;
  
  createdAt: Date;
  expiresAt: Date;
}

// ===== ACADEMY =====
export interface AcademyModule {
  id: string;
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  lessons: AcademyLesson[];
  estimatedHours: number;
}

export interface AcademyLesson {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  videoUrl?: string;
  durationMinutes: number;
  quiz?: {
    questions: QuizQuestion[];
    passingScore: number;
  };
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

// ===== API RESPONSES =====
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: Date;
}

export interface ApiPaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
