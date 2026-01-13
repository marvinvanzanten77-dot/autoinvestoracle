export type ExchangeId = 'bitvavo' | 'kraken' | 'coinbase' | 'bybit';
export type ConnectionStatus = 'connected' | 'needs_reauth' | 'error' | 'disconnected';
export type AuthMethod = 'apiKey' | 'oauth';

export type ApiKeyCredentials = {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  extra?: Record<string, string>;
};

export type OAuthCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
};

export type ExchangeCredentials = ApiKeyCredentials | OAuthCredentials;

export type ExchangeConnection = {
  id: string;
  userId: string;
  exchange: ExchangeId;
  method: AuthMethod;
  encryptedSecrets: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  status: ConnectionStatus;
  errorCode?: string;
  metadata?: Record<string, string>;
};

export type Account = {
  id: string;
  userId: string;
  exchange: ExchangeId;
  accountId: string;
  name?: string;
  type?: string;
  currency?: string;
};

export type Balance = {
  id: string;
  userId: string;
  exchange: ExchangeId;
  accountId?: string;
  asset: string;
  total: number;
  available?: number;
  locked?: number;
  updatedAt: string;
};

export type Position = {
  id: string;
  userId: string;
  exchange: ExchangeId;
  symbol: string;
  quantity: number;
  entryPrice?: number;
  unrealizedPnl?: number;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  userId: string;
  exchange: ExchangeId;
  type: 'deposit' | 'withdrawal' | 'trade' | 'fee' | 'transfer';
  asset: string;
  amount: number;
  fee?: number;
  status?: string;
  timestamp: string;
  rawId?: string;
};

export type Order = {
  id: string;
  userId: string;
  exchange: ExchangeId;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'other';
  price?: number;
  quantity: number;
  status?: string;
  timestamp: string;
  rawId?: string;
};

export type MarketCandle = {
  exchange: ExchangeId;
  symbol: string;
  interval: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ConnectorCapabilities = {
  supportsPositions: boolean;
  supportsOAuth: boolean;
  supportsApiKeys: boolean;
};

export type ConnectorConnectResult = {
  ok: boolean;
  scopes: string[];
  message?: string;
};

export type FetchParams = {
  since?: string;
  until?: string;
  cursor?: string;
};

export type MarketDataParams = {
  symbols: string[];
  interval: string;
};

export interface ExchangeConnector {
  id: ExchangeId;
  name: string;
  capabilities: ConnectorCapabilities;
  connect(credentials: ExchangeCredentials): Promise<ConnectorConnectResult>;
  fetchAccounts(userId: string, credentials: ExchangeCredentials): Promise<Account[]>;
  fetchBalances(userId: string, credentials: ExchangeCredentials): Promise<Balance[]>;
  fetchPositions(userId: string, credentials: ExchangeCredentials): Promise<Position[]>;
  fetchTransactions(userId: string, credentials: ExchangeCredentials, params: FetchParams): Promise<Transaction[]>;
  fetchOrders(userId: string, credentials: ExchangeCredentials, params: FetchParams): Promise<Order[]>;
  fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]>;
}

export class ExchangeError extends Error {
  code: string;
  constructor(message: string, code = 'EXCHANGE_ERROR') {
    super(message);
    this.code = code;
  }
}

export class AuthError extends ExchangeError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR');
  }
}

export class RateLimitError extends ExchangeError {
  constructor(message = 'Rate limit hit') {
    super(message, 'RATE_LIMIT');
  }
}

export class ExchangeDownError extends ExchangeError {
  constructor(message = 'Exchange unavailable') {
    super(message, 'EXCHANGE_DOWN');
  }
}

export class ValidationError extends ExchangeError {
  constructor(message = 'Validation error') {
    super(message, 'VALIDATION_ERROR');
  }
}

export class StorageError extends ExchangeError {
  constructor(message = 'Storage error') {
    super(message, 'STORAGE_ERROR');
  }
}
