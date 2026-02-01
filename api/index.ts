import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { kv } from '@vercel/kv';

type ApiRequest = {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (payload: any) => void;
  setHeader?: (name: string, value: string | string[]) => void;
};

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void;

type CookieMap = Record<string, string>;

function parseCookies(cookieHeader?: string): CookieMap {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<CookieMap>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function createSessionId() {
  return crypto.randomUUID();
}

function buildSessionCookie(userId: string) {
  const secure = process.env.NODE_ENV === 'production';
  const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
  return [
    `aio_uid=${encodeURIComponent(userId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${thirtyDaysInSeconds}`,
    secure ? 'Secure' : ''
  ]
    .filter(Boolean)
    .join('; ');
}

function buildClearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production';
  return [
    'aio_uid=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : ''
  ]
    .filter(Boolean)
    .join('; ');
}

function getSessionUserId(req: ApiRequest) {
  const cookieHeader = req.headers?.cookie;
  const cookieValue = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
  const cookies = parseCookies(cookieValue);
  return cookies.aio_uid || '';
}

type SupabaseUserResponse = {
  id: string;
  email?: string;
};

async function fetchSupabaseUser(accessToken: string): Promise<SupabaseUserResponse> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL of SUPABASE_ANON_KEY ontbreekt.');
  }

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY
    }
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase auth error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as SupabaseUserResponse;
  return data;
}

type UserProfile = {
  displayName: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
  location?: string;
  bio?: string;
  emailUpdatesOptIn?: boolean;
  strategies: string[];
  primaryGoal: 'growth' | 'income' | 'preserve' | 'learn';
  timeHorizon: 'lt1y' | '1-3y' | '3-7y' | '7y+';
  riskTolerance: number;
  maxDrawdownComfort: '5' | '10' | '20' | '30' | '50';
  rebalancing: 'none' | 'quarterly' | 'monthly';
  panicSellLikelihood: 'low' | 'medium' | 'high';
  startAmountRange: '0-500' | '500-2k' | '2k-10k' | '10k-50k' | '50k+';
  monthlyContributionRange: '0' | '1-100' | '100-500' | '500-2k' | '2k+';
  knowledgeLevel: 'beginner' | 'intermediate' | 'advanced';
  assetPreference: Array<'crypto' | 'etf' | 'stocks' | 'mixed'>;
  excludedAssets?: string[];
  ethicalConstraints?: string;
  advisorMode: 'conservative' | 'balanced' | 'aggressive';
  explanationDepth: 'short' | 'normal' | 'deep';
};

type UserMeta = {
  createdAt: string;
  updatedAt: string;
  onboardingComplete: boolean;
};

async function getProfile(userId: string) {
  const profile = (await kv.get(`user:${userId}:profile`)) as UserProfile | null;
  const meta = (await kv.get(`user:${userId}:meta`)) as UserMeta | null;
  return { profile, meta };
}

async function upsertProfile(userId: string, profile: UserProfile) {
  const now = new Date().toISOString();
  const meta: UserMeta = {
    createdAt: now,
    updatedAt: now,
    onboardingComplete: true
  };
  await kv.set(`user:${userId}:profile`, profile);
  await kv.set(`user:${userId}:meta`, meta);
  return { profile, meta };
}

type ExchangeId = 'bitvavo' | 'kraken' | 'coinbase' | 'bybit';
type ConnectionStatus = 'connected' | 'needs_reauth' | 'error' | 'disconnected';
type AuthMethod = 'apiKey' | 'oauth';

type ApiKeyCredentials = {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  extra?: Record<string, string>;
};

type OAuthCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
};

type ExchangeCredentials = ApiKeyCredentials | OAuthCredentials;

type ExchangeConnection = {
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

type Account = {
  id: string;
  userId: string;
  exchange: ExchangeId;
  accountId: string;
  name?: string;
  type?: string;
  currency?: string;
};

type Balance = {
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

type Position = {
  id: string;
  userId: string;
  exchange: ExchangeId;
  symbol: string;
  quantity: number;
  entryPrice?: number;
  unrealizedPnl?: number;
  updatedAt: string;
};

type Transaction = {
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

type Order = {
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

type MarketCandle = {
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

type ConnectorCapabilities = {
  supportsPositions: boolean;
  supportsOAuth: boolean;
  supportsApiKeys: boolean;
};

type ConnectorConnectResult = {
  ok: boolean;
  scopes: string[];
  message?: string;
};

type FetchParams = {
  since?: string;
  until?: string;
  cursor?: string;
};

type MarketDataParams = {
  symbols: string[];
  interval: string;
};

interface ExchangeConnector {
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

class ExchangeError extends Error {
  code: string;
  constructor(message: string, code = 'EXCHANGE_ERROR') {
    super(message);
    this.code = code;
  }
}

class AuthError extends ExchangeError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR');
  }
}

class RateLimitError extends ExchangeError {
  constructor(message = 'Rate limit hit') {
    super(message, 'RATE_LIMIT');
  }
}

class ExchangeDownError extends ExchangeError {
  constructor(message = 'Exchange unavailable') {
    super(message, 'EXCHANGE_DOWN');
  }
}

class ValidationError extends ExchangeError {
  constructor(message = 'Validation error') {
    super(message, 'VALIDATION_ERROR');
  }
}

class StorageError extends ExchangeError {
  constructor(message = 'Storage error') {
    super(message, 'STORAGE_ERROR');
  }
}

const EXCHANGE_CONFIG: Record<
  ExchangeId,
  {
    baseUrl: string;
    name: string;
    capabilities: ConnectorCapabilities;
    timeoutMs: number;
  }
> = {
  bitvavo: {
    baseUrl: 'https://api.bitvavo.com/v2',
    name: 'Bitvavo',
    timeoutMs: 12_000,
    capabilities: {
      supportsPositions: false,
      supportsOAuth: false,
      supportsApiKeys: true
    }
  },
  kraken: {
    baseUrl: 'https://api.kraken.com/0',
    name: 'Kraken',
    timeoutMs: 12_000,
    capabilities: {
      supportsPositions: true,
      supportsOAuth: false,
      supportsApiKeys: true
    }
  },
  coinbase: {
    baseUrl: 'https://api.exchange.coinbase.com',
    name: 'Coinbase',
    timeoutMs: 12_000,
    capabilities: {
      supportsPositions: false,
      supportsOAuth: true,
      supportsApiKeys: true
    }
  },
  bybit: {
    baseUrl: 'https://api.bybit.com/v5',
    name: 'Bybit',
    timeoutMs: 12_000,
    capabilities: {
      supportsPositions: true,
      supportsOAuth: false,
      supportsApiKeys: true
    }
  }
};

class BitvavoConnector implements ExchangeConnector {
  id = 'bitvavo' as const;
  name = EXCHANGE_CONFIG.bitvavo.name;
  capabilities = EXCHANGE_CONFIG.bitvavo.capabilities;

  async connect(credentials: ExchangeCredentials): Promise<ConnectorConnectResult> {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    return { ok: true, scopes: ['read'] };
  }

  async fetchAccounts(): Promise<Account[]> {
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    return [];
  }

  async fetchPositions(): Promise<Position[]> {
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    return [];
  }

  async fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]> {
    const symbol = params.symbols[0] || 'BTC-EUR';
    const interval = params.interval || '1h';
    const url = `${EXCHANGE_CONFIG.bitvavo.baseUrl}/${symbol}/candles?interval=${interval}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return [];
    }
    const data = (await resp.json()) as Array<[number, number, number, number, number, number]>;
    return data.map((row) => ({
      exchange: this.id,
      symbol,
      interval,
      time: new Date(row[0]).toISOString(),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5]
    }));
  }
}

function intervalToMinutes(interval: string) {
  if (interval === '1h') return 60;
  if (interval === '4h') return 240;
  if (interval === '1d') return 1440;
  return 60;
}

class KrakenConnector implements ExchangeConnector {
  id = 'kraken' as const;
  name = EXCHANGE_CONFIG.kraken.name;
  capabilities = EXCHANGE_CONFIG.kraken.capabilities;

  async connect(credentials: ExchangeCredentials): Promise<ConnectorConnectResult> {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    return { ok: true, scopes: ['read'] };
  }

  async fetchAccounts(): Promise<Account[]> {
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    return [];
  }

  async fetchPositions(): Promise<Position[]> {
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    return [];
  }

  async fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]> {
    const symbol = params.symbols[0] || 'XBT/EUR';
    const interval = intervalToMinutes(params.interval || '1h');
    const url = `${EXCHANGE_CONFIG.kraken.baseUrl}/public/OHLC?pair=${encodeURIComponent(
      symbol
    )}&interval=${interval}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return [];
    }
    const payload = (await resp.json()) as { result?: Record<string, any> };
    const key = Object.keys(payload.result || {}).find((k) => k !== 'last');
    const rows = key ? (payload.result?.[key] as Array<any>) : [];
    return rows.map((row) => ({
      exchange: this.id,
      symbol,
      interval: `${interval}m`,
      time: new Date(Number(row[0]) * 1000).toISOString(),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[6])
    }));
  }
}

function intervalToGranularity(interval: string) {
  if (interval === '1h') return 3600;
  if (interval === '4h') return 14400;
  if (interval === '1d') return 86400;
  return 3600;
}

class CoinbaseConnector implements ExchangeConnector {
  id = 'coinbase' as const;
  name = EXCHANGE_CONFIG.coinbase.name;
  capabilities = EXCHANGE_CONFIG.coinbase.capabilities;

  async connect(credentials: ExchangeCredentials): Promise<ConnectorConnectResult> {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    return { ok: true, scopes: ['read'] };
  }

  async fetchAccounts(): Promise<Account[]> {
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    return [];
  }

  async fetchPositions(): Promise<Position[]> {
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    return [];
  }

  async fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]> {
    const symbol = params.symbols[0] || 'BTC-EUR';
    const granularity = intervalToGranularity(params.interval || '1h');
    const url = `${EXCHANGE_CONFIG.coinbase.baseUrl}/products/${symbol}/candles?granularity=${granularity}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return [];
    }
    const data = (await resp.json()) as Array<[number, number, number, number, number, number]>;
    return data.map((row) => ({
      exchange: this.id,
      symbol,
      interval: `${granularity}s`,
      time: new Date(row[0] * 1000).toISOString(),
      low: row[1],
      high: row[2],
      open: row[3],
      close: row[4],
      volume: row[5]
    }));
  }
}

function intervalToBybit(interval: string) {
  if (interval === '1h') return '60';
  if (interval === '4h') return '240';
  if (interval === '1d') return 'D';
  return '60';
}

class BybitConnector implements ExchangeConnector {
  id = 'bybit' as const;
  name = EXCHANGE_CONFIG.bybit.name;
  capabilities = EXCHANGE_CONFIG.bybit.capabilities;

  async connect(credentials: ExchangeCredentials): Promise<ConnectorConnectResult> {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    return { ok: true, scopes: ['read'] };
  }

  async fetchAccounts(): Promise<Account[]> {
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    return [];
  }

  async fetchPositions(): Promise<Position[]> {
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    return [];
  }

  async fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]> {
    const symbol = (params.symbols[0] || 'BTCUSDT').replace('-', '');
    const interval = intervalToBybit(params.interval || '1h');
    const url = `${EXCHANGE_CONFIG.bybit.baseUrl}/market/kline?category=spot&symbol=${symbol}&interval=${interval}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return [];
    }
    const payload = (await resp.json()) as { result?: { list?: string[][] } };
    const rows = payload.result?.list || [];
    return rows.map((row) => ({
      exchange: this.id,
      symbol,
      interval,
      time: new Date(Number(row[0])).toISOString(),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5])
    }));
  }
}

function createConnector(exchange: ExchangeId): ExchangeConnector {
  switch (exchange) {
    case 'bitvavo':
      return new BitvavoConnector();
    case 'kraken':
      return new KrakenConnector();
    case 'coinbase':
      return new CoinbaseConnector();
    case 'bybit':
      return new BybitConnector();
    default:
      throw new Error(`Unsupported exchange: ${exchange}`);
  }
}

const KEY_LENGTH = 32;

type EncryptedPayload = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw) {
    throw new Error('ENCRYPTION_KEY ontbreekt.');
  }
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  const buf = Buffer.from(trimmed, 'base64');
  if (buf.length !== KEY_LENGTH) {
    throw new Error('ENCRYPTION_KEY moet 32 bytes (base64 of hex) zijn.');
  }
  return buf;
}

function encryptString(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedPayload = {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64')
  };
  return JSON.stringify(payload);
}

function decryptString(payload: string): string {
  const key = getKey();
  const parsed = JSON.parse(payload) as EncryptedPayload;
  const iv = Buffer.from(parsed.iv, 'base64');
  const tag = Buffer.from(parsed.tag, 'base64');
  const data = Buffer.from(parsed.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

type StorageDriver = 'kv' | 'file';

type StorageAdapter = {
  listConnections(userId: string): Promise<ExchangeConnection[]>;
  getConnection(userId: string, exchange: string): Promise<ExchangeConnection | null>;
  saveConnection(userId: string, connection: ExchangeConnection): Promise<void>;
  deleteConnection(userId: string, exchange: string): Promise<void>;
  saveAccounts(userId: string, accounts: Account[]): Promise<void>;
  saveBalances(userId: string, balances: Balance[]): Promise<void>;
  savePositions(userId: string, positions: Position[]): Promise<void>;
  saveTransactions(userId: string, transactions: Transaction[]): Promise<void>;
  saveOrders(userId: string, orders: Order[]): Promise<void>;
  saveMarketCandles(userId: string, candles: MarketCandle[]): Promise<void>;
  listBalances(userId: string): Promise<Balance[]>;
  listTransactions(userId: string, since?: string, until?: string): Promise<Transaction[]>;
  listPositions(userId: string): Promise<Position[]>;
};

type StoreData = {
  connections: ExchangeConnection[];
  accounts: Account[];
  balances: Balance[];
  positions: Position[];
  transactions: Transaction[];
  orders: Order[];
  marketCandles: MarketCandle[];
};

const EMPTY_STORE: StoreData = {
  connections: [],
  accounts: [],
  balances: [],
  positions: [],
  transactions: [],
  orders: [],
  marketCandles: []
};

const dataFile = path.join(process.cwd(), '.data', 'exchange-store.json');

async function ensureFileStore() {
  const dir = path.dirname(dataFile);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readFileStore(userId: string): Promise<StoreData> {
  await ensureFileStore();
  const raw = await fs.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(raw || '{}') as Record<string, StoreData>;
  return parsed[userId] || { ...EMPTY_STORE };
}

async function writeFileStore(userId: string, data: StoreData) {
  await ensureFileStore();
  const raw = await fs.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(raw || '{}') as Record<string, StoreData>;
  parsed[userId] = data;
  await fs.writeFile(dataFile, JSON.stringify(parsed, null, 2), 'utf8');
}

async function readKvStore(userId: string): Promise<StoreData> {
  const data = (await kv.get(`exchange:${userId}:store`)) as StoreData | null;
  return data || { ...EMPTY_STORE };
}

async function writeKvStore(userId: string, data: StoreData) {
  await kv.set(`exchange:${userId}:store`, data);
}

function buildAdapter(driver: StorageDriver): StorageAdapter {
  const read = driver === 'kv' ? readKvStore : readFileStore;
  const write = driver === 'kv' ? writeKvStore : writeFileStore;

  return {
    async listConnections(userId) {
      const store = await read(userId);
      return store.connections;
    },
    async getConnection(userId, exchange) {
      const store = await read(userId);
      return store.connections.find((c) => c.exchange === exchange) || null;
    },
    async saveConnection(userId, connection) {
      const store = await read(userId);
      const next = store.connections.filter((c) => c.exchange !== connection.exchange);
      next.push(connection);
      await write(userId, { ...store, connections: next });
    },
    async deleteConnection(userId, exchange) {
      const store = await read(userId);
      const next = store.connections.filter((c) => c.exchange !== exchange);
      await write(userId, { ...store, connections: next });
    },
    async saveAccounts(userId, accounts) {
      const store = await read(userId);
      await write(userId, { ...store, accounts });
    },
    async saveBalances(userId, balances) {
      const store = await read(userId);
      await write(userId, { ...store, balances });
    },
    async savePositions(userId, positions) {
      const store = await read(userId);
      await write(userId, { ...store, positions });
    },
    async saveTransactions(userId, transactions) {
      const store = await read(userId);
      await write(userId, { ...store, transactions });
    },
    async saveOrders(userId, orders) {
      const store = await read(userId);
      await write(userId, { ...store, orders });
    },
    async saveMarketCandles(userId, candles) {
      const store = await read(userId);
      await write(userId, { ...store, marketCandles: candles });
    },
    async listBalances(userId) {
      const store = await read(userId);
      return store.balances;
    },
    async listTransactions(userId, since, until) {
      const store = await read(userId);
      return store.transactions.filter((tx) => {
        if (since && tx.timestamp < since) return false;
        if (until && tx.timestamp > until) return false;
        return true;
      });
    },
    async listPositions(userId) {
      const store = await read(userId);
      return store.positions;
    }
  };
}

function getStorageAdapter(): StorageAdapter {
  const driver = (process.env.STORAGE_DRIVER || 'file') as StorageDriver;
  return buildAdapter(driver === 'kv' ? 'kv' : 'file');
}

function encryptSecrets(payload: Record<string, string>) {
  return encryptString(JSON.stringify(payload));
}

function decryptSecrets(blob: string) {
  try {
    return JSON.parse(decryptString(blob)) as Record<string, string>;
  } catch {
    throw new StorageError('Kon secrets niet ontsleutelen.');
  }
}

type SyncResult = {
  ok: boolean;
  message?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 800): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries) throw err;
      await sleep(delayMs * attempt);
    }
  }
}

function logEvent(payload: Record<string, unknown>) {
  console.log(JSON.stringify(payload));
}

async function syncExchange(userId: string, exchange: ExchangeId): Promise<SyncResult> {
  const storage = getStorageAdapter();
  const connection = await storage.getConnection(userId, exchange);
  if (!connection) {
    return { ok: false, message: 'Geen verbinding gevonden.' };
  }

  const connector = createConnector(exchange);
  const credentials = decryptSecrets(connection.encryptedSecrets);

  try {
    const accounts = await withRetry(() => connector.fetchAccounts(userId, credentials as any));
    const balances = await withRetry(() => connector.fetchBalances(userId, credentials as any));
    const positions = await withRetry(() => connector.fetchPositions(userId, credentials as any));
    const transactions = await withRetry(() =>
      connector.fetchTransactions(userId, credentials as any, {})
    );
    const orders = await withRetry(() => connector.fetchOrders(userId, credentials as any, {}));

    await storage.saveAccounts(userId, accounts);
    await storage.saveBalances(userId, balances);
    await storage.savePositions(userId, positions);
    await storage.saveTransactions(userId, transactions);
    await storage.saveOrders(userId, orders);

    await storage.saveConnection(userId, {
      ...connection,
      lastSyncAt: new Date().toISOString(),
      status: 'connected',
      errorCode: undefined,
      updatedAt: new Date().toISOString()
    });

    logEvent({
      exchange,
      userId,
      endpoint: 'sync',
      status: 'ok',
      duration: 'n/a'
    });

    return { ok: true };
  } catch (err) {
    const code =
      err instanceof RateLimitError
        ? 'RATE_LIMIT'
        : err instanceof ExchangeDownError
          ? 'EXCHANGE_DOWN'
          : 'UNKNOWN';
    await storage.saveConnection(userId, {
      ...connection,
      status: code === 'RATE_LIMIT' ? 'needs_reauth' : 'error',
      errorCode: code,
      updatedAt: new Date().toISOString()
    });
    logEvent({
      exchange,
      userId,
      endpoint: 'sync',
      status: 'error',
      errorCode: code
    });
    return { ok: false, message: 'Sync mislukt.' };
  }
}

type MarketRange = '1h' | '24h' | '7d';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINS = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  stablecoins: ['tether', 'usd-coin'],
  altcoins: ['solana', 'cardano']
};

const cache = new Map<string, { timestamp: number; payload: unknown }>();

function averageSeries(seriesList: [number, number][][]) {
  const minLength = Math.min(...seriesList.map((series) => series.length));
  return Array.from({ length: minLength }, (_, idx) => {
    const ts = seriesList[0][idx][0];
    const avg =
      seriesList.reduce((sum, series) => sum + series[idx][1], 0) / seriesList.length;
    return [ts, avg] as [number, number];
  });
}

function toPercentSeries(series: [number, number][]) {
  if (series.length === 0) return [];
  const base = series[0][1];
  return series.map(([ts, price]) => ({
    ts,
    value: ((price - base) / base) * 100
  }));
}

function resamplePercentSeries(
  series: Array<{ ts: number; value: number }>,
  points: number
) {
  if (series.length <= 1 || points <= 1) return series;
  const start = series[0].ts;
  const end = series[series.length - 1].ts;
  const step = (end - start) / (points - 1);
  const result: Array<{ ts: number; value: number }> = [];

  let cursor = 0;
  for (let i = 0; i < points; i++) {
    const target = start + step * i;
    while (cursor < series.length - 1 && series[cursor + 1].ts < target) {
      cursor += 1;
    }
    const left = series[cursor];
    const right = series[Math.min(cursor + 1, series.length - 1)];
    if (right.ts === left.ts) {
      result.push({ ts: target, value: left.value });
    } else {
      const ratio = (target - left.ts) / (right.ts - left.ts);
      const value = left.value + (right.value - left.value) * ratio;
      result.push({ ts: target, value });
    }
  }
  return result;
}

async function fetchMarketSparkline(ids: string[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const resp = await fetch(
    `${COINGECKO_BASE}/coins/markets?vs_currency=eur&ids=${ids.join(',')}&sparkline=true`,
    {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'AutoInvestOracle/1.0'
      }
    }
  );
  clearTimeout(timeout);
  if (!resp.ok) {
    throw new Error(`CoinGecko error ${resp.status}`);
  }
  const data = (await resp.json()) as Array<{
    id: string;
    sparkline_in_7d?: { price?: number[] };
  }>;
  return data;
}

function seriesFromSparkline(prices: number[]) {
  const totalMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const count = prices.length;
  if (count === 0) return [];
  const step = totalMs / Math.max(count - 1, 1);
  const start = now - totalMs;
  return prices.map((price, idx) => [start + idx * step, price] as [number, number]);
}

function buildDefaultPayload(range: MarketRange) {
  return {
    range,
    updatedAt: new Date().toISOString(),
    changes: {
      bitcoin: 0,
      ethereum: 0,
      stablecoins: 0,
      altcoins: 0
    },
    volatility: {
      level: 'rustig',
      label: 'Rustig tempo',
      detail: 'Geen actuele data beschikbaar; laat later nog eens laden.'
    },
    series: [] as Array<{
      time: string;
      bitcoin: number;
      ethereum: number;
      stablecoins: number;
      altcoins: number;
    }>
  };
}

async function buildMarketScanFromSparkline(range: MarketRange) {
  const ids = [
    COINS.bitcoin,
    COINS.ethereum,
    ...COINS.stablecoins,
    ...COINS.altcoins
  ];
  const rows = await fetchMarketSparkline(ids);
  const map = new Map<string, [number, number][]>();
  rows.forEach((row) => {
    const prices = row.sparkline_in_7d?.price || [];
    map.set(row.id, seriesFromSparkline(prices));
  });

  const btc = map.get(COINS.bitcoin) || [];
  const eth = map.get(COINS.ethereum) || [];
  if (btc.length === 0 || eth.length === 0) {
    return buildDefaultPayload(range);
  }
  const stableSeries = COINS.stablecoins.map((id) => map.get(id)).filter(Boolean) as [number, number][][];
  const altSeries = COINS.altcoins.map((id) => map.get(id)).filter(Boolean) as [number, number][][];

  const stable = stableSeries.length ? averageSeries(stableSeries) : btc;
  const alt = altSeries.length ? averageSeries(altSeries) : eth;

  const windowMs =
    range === '1h' ? 60 * 60 * 1000 : range === '24h' ? 24 * 60 * 60 * 1000 : null;
  const cutoff = windowMs ? Date.now() - windowMs : null;
  const filter = (series: [number, number][]) =>
    cutoff ? series.filter(([ts]) => ts >= cutoff) : series;

  const btcP = toPercentSeries(filter(btc));
  const ethP = toPercentSeries(filter(eth));
  const stableP = toPercentSeries(filter(stable));
  const altP = toPercentSeries(filter(alt));

  const targetPoints = range === '1h' ? 60 : null;
  const btcFinal = targetPoints ? resamplePercentSeries(btcP, targetPoints) : btcP;
  const ethFinal = targetPoints ? resamplePercentSeries(ethP, targetPoints) : ethP;
  const stableFinal = targetPoints ? resamplePercentSeries(stableP, targetPoints) : stableP;
  const altFinal = targetPoints ? resamplePercentSeries(altP, targetPoints) : altP;

  const minLength = Math.min(
    btcFinal.length,
    ethFinal.length,
    stableFinal.length,
    altFinal.length
  );
  const series = Array.from({ length: minLength }, (_, idx) => ({
    time: new Date(btcFinal[idx].ts).toISOString(),
    bitcoin: Number(btcFinal[idx].value.toFixed(2)),
    ethereum: Number(ethFinal[idx].value.toFixed(2)),
    stablecoins: Number(stableFinal[idx].value.toFixed(2)),
    altcoins: Number(altFinal[idx].value.toFixed(2))
  }));

  const last = series[series.length - 1] || {
    bitcoin: 0,
    ethereum: 0,
    stablecoins: 0,
    altcoins: 0
  };

  const avgAbs =
    (Math.abs(last.bitcoin) +
      Math.abs(last.ethereum) +
      Math.abs(last.stablecoins) +
      Math.abs(last.altcoins)) /
    4;

  const volatility =
    avgAbs >= 4
      ? {
          level: 'hoog',
          label: 'Onrustig tempo',
          detail: 'De bewegingen zijn vandaag duidelijk groter dan normaal.'
        }
      : avgAbs >= 2
        ? {
            level: 'matig',
            label: 'Licht onrustig',
            detail: 'Er is wat meer beweging, maar geen extreme uitschieters.'
          }
        : {
            level: 'rustig',
            label: 'Rustig tempo',
            detail: 'Geen sterke uitschieters zichtbaar in de afgelopen uren.'
          };

  return {
    range,
    updatedAt: new Date().toISOString(),
    changes: {
      bitcoin: last.bitcoin,
      ethereum: last.ethereum,
      stablecoins: last.stablecoins,
      altcoins: last.altcoins
    },
    volatility,
    series
  };
}

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatContext = {
  profile?: {
    displayName?: string;
    strategy?: string;
    primaryGoal?: string;
    timeHorizon?: string;
    knowledgeLevel?: string;
    startAmountRange?: string;
  };
  market?: {
    volatilityLabel?: string;
    volatilityLevel?: string;
    lastScan?: string;
    changes?: {
      bitcoin: number;
      ethereum: number;
      stablecoins: number;
      altcoins: number;
    };
  };
};

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function formatChatContext(context?: ChatContext) {
  if (!context) return '';
  const lines: string[] = [];
  if (context.profile) {
    const profileParts = [
      context.profile.displayName ? `Naam: ${context.profile.displayName}` : null,
      context.profile.strategy ? `Strategie: ${context.profile.strategy}` : null,
      context.profile.primaryGoal ? `Doel: ${context.profile.primaryGoal}` : null,
      context.profile.timeHorizon ? `Horizon: ${context.profile.timeHorizon}` : null,
      context.profile.knowledgeLevel ? `Kennisniveau: ${context.profile.knowledgeLevel}` : null,
      context.profile.startAmountRange ? `Startbedrag: ${context.profile.startAmountRange}` : null
    ].filter(Boolean);
    if (profileParts.length > 0) {
      lines.push('Gebruikersprofiel:', ...profileParts);
    }
  }
  if (context.market) {
    const marketParts = [
      context.market.lastScan ? `Laatste check: ${context.market.lastScan}` : null,
      context.market.volatilityLabel ? `Tempo: ${context.market.volatilityLabel}` : null,
      context.market.changes
        ? `Bewegingen (%): BTC ${context.market.changes.bitcoin}, ETH ${context.market.changes.ethereum}, Stable ${context.market.changes.stablecoins}, Alt ${context.market.changes.altcoins}`
        : null
    ].filter(Boolean);
    if (marketParts.length > 0) {
      lines.push('Marktcontext:', ...marketParts);
    }
  }
  return lines.length > 0 ? lines.join('\n') : '';
}

async function generateChatReply(messages: ChatMessage[], context?: ChatContext) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ontbreekt.');
  }

  const contextMessage = formatChatContext(context);

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'Je bent een rustige crypto-assistent. Je geeft geen advies of besluiten, alleen uitleg en opties in mensentaal.'
        },
        ...(contextMessage
          ? [
              {
                role: 'system',
                content:
                  `Context (alleen gebruiken om te verduidelijken, nooit om te adviseren):\n${contextMessage}`
              }
            ]
          : []),
        ...messages
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as OpenAIChatResponse;
  return data.choices?.[0]?.message?.content?.trim() || 'Geen antwoord beschikbaar.'
}

async function generateSummary(input: {
  range: '1h' | '24h' | '7d';
  changes: {
    bitcoin: number;
    ethereum: number;
    stablecoins: number;
    altcoins: number;
  };
}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ontbreekt.');
  }

  const prompt = [
    `Vat in mensentaal samen wat er is gebeurd in de cryptomarkt.`,
    `Periode: ${input.range}.`,
    `Bewegingen:`,
    `- Bitcoin: ${input.changes.bitcoin}%`,
    `- Ethereum: ${input.changes.ethereum}%`,
    `- Stablecoins: ${input.changes.stablecoins}%`,
    `- Altcoins: ${input.changes.altcoins}%`,
    ``,
    `Regels:`,
    `- Geen advies of voorspellingen.`,
    `- 2 zinnen, rustig en duidelijk.`
  ].join('\n');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Je bent een rustige crypto-observator. Je geeft geen advies of voorspellingen.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as OpenAIChatResponse;
  return data.choices?.[0]?.message?.content?.trim() || 'Geen samenvatting beschikbaar.';
}

function fallbackSummary(input: {
  range: '1h' | '24h' | '7d';
  changes: {
    bitcoin: number;
    ethereum: number;
    stablecoins: number;
    altcoins: number;
  };
}) {
  const btc = input.changes.bitcoin;
  const eth = input.changes.ethereum;
  const stable = input.changes.stablecoins;
  const alt = input.changes.altcoins;
  return `In de afgelopen ${input.range} zien we beperkte bewegingen. Bitcoin ${btc >= 0 ? 'stijgt' : 'daalt'} licht (${btc}%), Ethereum ${eth >= 0 ? 'stijgt' : 'daalt'} met ${Math.abs(eth)}%, stablecoins blijven vrijwel stabiel (${stable}%) en altcoins bewegen ${alt >= 0 ? 'licht omhoog' : 'licht omlaag'} (${alt}%).`;
}

type AllocationItem = {
  label: string;
  pct: number;
  rationale: string;
};

function normalizeAllocation(items: AllocationItem[]) {
  const total = items.reduce((sum, item) => sum + item.pct, 0);
  if (!total) return items;
  return items.map((item) => ({
    ...item,
    pct: Math.round((item.pct / total) * 100)
  }));
}

function fallbackAllocation(): { allocation: AllocationItem[]; note: string } {
  return {
    allocation: [
      {
        label: 'Bitcoin',
        pct: 40,
        rationale: 'Meest gevestigde munt, rustiger profiel.'
      },
      {
        label: 'Ethereum',
        pct: 30,
        rationale: 'Sterke basis, breed gebruik.'
      },
      {
        label: 'Stablecoins',
        pct: 20,
        rationale: 'Dempt schommelingen en houdt ruimte.'
      },
      {
        label: 'Altcoins',
        pct: 10,
        rationale: 'Kleine positie voor spreiding.'
      }
    ],
    note: 'Dit is een neutrale verdeling als veilige fallback.'
  };
}

async function generateAllocation(input: {
  amount: number;
  strategy: string;
  goals?: string[];
  knowledge?: string;
  changes?: {
    bitcoin: number;
    ethereum: number;
    stablecoins: number;
    altcoins: number;
  };
}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ontbreekt.');
  }

  const prompt = [
    `Je maakt een verdeling van een crypto saldo over potjes.`,
    `Strategie: ${input.strategy}.`,
    `Doelen: ${input.goals?.join(', ') || 'niet opgegeven'}.`,
    `Kennisniveau: ${input.knowledge || 'niet opgegeven'}.`,
    `Marktbewegingen (sinds start):`,
    `- Bitcoin: ${input.changes?.bitcoin ?? 0}%`,
    `- Ethereum: ${input.changes?.ethereum ?? 0}%`,
    `- Stablecoins: ${input.changes?.stablecoins ?? 0}%`,
    `- Altcoins: ${input.changes?.altcoins ?? 0}%`,
    ``,
    `Geef JSON met exact deze vorm:`,
    `{ "allocation": [ { "label": "Bitcoin|Ethereum|Stablecoins|Altcoins", "pct": number, "rationale": "korte zin" } ], "note": "korte toelichting" }`,
    `Regels:`,
    `- Som van pct is 100.`,
    `- Gebruik alleen de 4 labels.`,
    `- Geen extra tekst buiten JSON.`,
    `- Geen advies of voorspellingen, alleen verdeling en toelichting.`
  ].join('\n');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'Je bent een rustige crypto-observator die alleen verdelingen geeft in JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as OpenAIChatResponse;
  const content = data.choices?.[0]?.message?.content?.trim() || '';
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('OpenAI response is geen JSON.');
  }
  const parsed = JSON.parse(content.slice(start, end + 1)) as {
    allocation: AllocationItem[];
    note: string;
  };
  if (!parsed.allocation || !parsed.note) {
    throw new Error('OpenAI response mist velden.');
  }
  return {
    allocation: normalizeAllocation(parsed.allocation),
    note: parsed.note
  };
}

const routes: Record<string, Handler> = {
  'session/init': async (req, res) => {
    if (req.method && req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    let userId = getSessionUserId(req);
    if (!userId) {
      userId = createSessionId();
      res.setHeader?.('Set-Cookie', buildSessionCookie(userId));
    }
    res.status(200).json({ userId });
  },
  'session/auth': async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const header = req.headers?.authorization || '';
    const token = header.startsWith('Bearer ')
      ? header.slice(7)
      : (req.body as { accessToken?: string } | undefined)?.accessToken;
    if (!token) {
      res.status(400).json({ error: 'Access token ontbreekt.' });
      return;
    }
    try {
      const user = await fetchSupabaseUser(token);
      res.setHeader?.('Set-Cookie', buildSessionCookie(user.id));
      res.status(200).json({ userId: user.id, email: user.email });
    } catch (err) {
      console.error(err);
      res.status(401).json({ error: 'Kon sessie niet valideren.' });
    }
  },
  'session/logout': async (_req, res) => {
    res.setHeader?.('Set-Cookie', buildClearSessionCookie());
    res.status(200).json({ ok: true });
  },
  'profile/get': async (req, res) => {
    if (req.method && req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Geen sessie.' });
      return;
    }
    try {
      const data = await getProfile(userId);
      res.status(200).json({ userId, ...data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon profiel niet ophalen.' });
    }
  },
  'profile/upsert': async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Geen sessie.' });
      return;
    }
    try {
      const profile = (req.body as { profile?: UserProfile } | undefined)?.profile;
      if (!profile?.email || !profile?.displayName) {
        res.status(400).json({ error: 'displayName en email zijn verplicht.' });
        return;
      }
      const result = await upsertProfile(userId, {
        ...profile,
        email: profile.email.toLowerCase(),
        strategies: Array.isArray(profile.strategies) ? profile.strategies : []
      });
      res.status(200).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon profiel niet opslaan.' });
    }
  },
  chat: async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const { messages, context } = (req.body || {}) as {
        messages: ChatMessage[];
        context?: ChatContext;
      };
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'messages is verplicht.' });
        return;
      }
      const reply = await generateChatReply(messages, context);
      res.status(200).json({ reply, createdAt: new Date().toISOString() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon chat niet ophalen.' });
    }
  },
  'market-scan': async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const range = (req.query?.range as MarketRange) || '24h';
      const cacheKey = `market:${range}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60_000) {
        res.setHeader?.('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.status(200).json(cached.payload);
        return;
      }
      const payload = await buildMarketScanFromSparkline(range);
      cache.set(cacheKey, { timestamp: Date.now(), payload });
      res.setHeader?.('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.status(200).json(payload);
    } catch (err) {
      console.error(err);
      const range = (req.query?.range as MarketRange) || '24h';
      res.status(200).json(buildDefaultPayload(range));
    }
  },
  'market-summary': async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const { range, changes } = (req.body || {}) as {
        range: '1h' | '24h' | '7d';
        changes: {
          bitcoin: number;
          ethereum: number;
          stablecoins: number;
          altcoins: number;
        };
      };
      if (!range || !changes) {
        res.status(400).json({ error: 'range en changes zijn verplicht.' });
        return;
      }
      const summary = await generateSummary({ range, changes });
      res.status(200).json({ summary, createdAt: new Date().toISOString() });
    } catch (err) {
      console.error(err);
      const { range, changes } = (req.body || {}) as {
        range: '1h' | '24h' | '7d';
        changes: {
          bitcoin: number;
          ethereum: number;
          stablecoins: number;
          altcoins: number;
        };
      };
      if (range && changes) {
        res.status(200).json({ summary: fallbackSummary({ range, changes }), createdAt: new Date().toISOString() });
        return;
      }
      res.status(500).json({ error: 'Kon samenvatting niet ophalen.' });
    }
  },
  'portfolio-allocate': async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const { amount, strategy, goals, knowledge, changes } = (req.body || {}) as {
        amount: number;
        strategy: string;
        goals?: string[];
        knowledge?: string;
        changes?: {
          bitcoin: number;
          ethereum: number;
          stablecoins: number;
          altcoins: number;
        };
      };
      if (!amount || !strategy) {
        res.status(400).json({ error: 'amount en strategy zijn verplicht.' });
        return;
      }
      const payload = await generateAllocation({ amount, strategy, goals, knowledge, changes });
      res.status(200).json(payload);
    } catch (err) {
      console.error(err);
      res.status(200).json(fallbackAllocation());
    }
  },
  'exchanges/connect': async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const { userId: bodyUserId, exchange, method, credentials, scopes = [] } =
        (req.body || {}) as {
          userId?: string;
          exchange: ExchangeId;
          method: AuthMethod;
          credentials: ExchangeCredentials;
          scopes?: string[];
        };
      const userId = bodyUserId || getSessionUserId(req);
      if (!userId || !exchange || !method || !credentials) {
        res.status(400).json({ error: 'userId, exchange, method en credentials zijn verplicht.' });
        return;
      }
      const connector = createConnector(exchange);
      const result = await connector.connect(credentials);
      if (!result.ok) {
        res.status(400).json({ error: result.message || 'Kon niet verbinden.' });
        return;
      }
      const now = new Date().toISOString();
      const connection: ExchangeConnection = {
        id: crypto.randomUUID(),
        userId,
        exchange,
        method,
        encryptedSecrets: encryptSecrets(credentials as Record<string, string>),
        scopes: result.scopes?.length ? result.scopes : scopes,
        createdAt: now,
        updatedAt: now,
        status: 'connected'
      };
      const storage = getStorageAdapter();
      await storage.saveConnection(userId, connection);
      res.status(200).json({ ok: true, connection });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon verbinding niet opslaan.' });
    }
  },
  'exchanges/disconnect': async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const { userId: bodyUserId, exchange } = (req.body || {}) as {
        userId?: string;
        exchange: ExchangeId;
      };
      const userId = bodyUserId || getSessionUserId(req);
      if (!userId || !exchange) {
        res.status(400).json({ error: 'userId en exchange zijn verplicht.' });
        return;
      }
      const storage = getStorageAdapter();
      await storage.deleteConnection(userId, exchange);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon verbinding niet verwijderen.' });
    }
  },
  'exchanges/status': async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const userId = (req.query?.userId as string) || getSessionUserId(req);
      if (!userId) {
        res.status(400).json({ error: 'userId is verplicht.' });
        return;
      }
      const storage = getStorageAdapter();
      const connections = await storage.listConnections(userId);
      res.status(200).json({ connections });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon status niet ophalen.' });
    }
  },
  'exchanges/sync': async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const { userId: bodyUserId, exchange } = (req.body || {}) as {
        userId?: string;
        exchange: ExchangeId;
      };
      const userId = bodyUserId || getSessionUserId(req);
      if (!userId || !exchange) {
        res.status(400).json({ error: 'userId en exchange zijn verplicht.' });
        return;
      }
      const result = await syncExchange(userId, exchange);
      res.status(200).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon sync niet uitvoeren.' });
    }
  },
  'exchanges/_health': async (req, res) => {
    if (req.method && req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const sample = { apiKey: 'sample-key', apiSecret: 'sample-secret' };
    try {
      const connector = createConnector('bitvavo');
      const market = await connector.fetchMarketData({ symbols: ['BTC-EUR'], interval: '1h' });
      const encrypted = encryptSecrets(sample);
      const decrypted = decryptSecrets(encrypted);
      res.status(200).json({
        ok: true,
        marketOk: Boolean(market?.length),
        cryptoOk: decrypted.apiKey === sample.apiKey
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Health check mislukt.' });
    }
  },
  'academy/progress': async (req, res) => {
    if (req.method && req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Geen sessie.' });
      return;
    }
    try {
      const { data: completed } = await supabaseClient
        .from('academy_module_progress')
        .select('module_id')
        .eq('user_id', userId)
        .not('completed_at', 'is', null);

      const { data: badges } = await supabaseClient
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId);

      const progressMap: Record<string, boolean> = {};
      const badgeMap: Record<string, boolean> = {};

      completed?.forEach((item: any) => {
        progressMap[item.module_id] = true;
      });

      badges?.forEach((item: any) => {
        badgeMap[item.badge_id] = true;
      });

      res.status(200).json({
        progress: progressMap,
        badges: badgeMap
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon voortgang niet ophalen.' });
    }
  },
  'academy/complete-module': async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Geen sessie.' });
      return;
    }
    try {
      const { moduleId } = (req.body || {}) as { moduleId?: string };
      if (!moduleId) {
        res.status(400).json({ error: 'moduleId is verplicht.' });
        return;
      }

      const { error: completeError } = await supabaseClient
        .from('academy_module_progress')
        .upsert(
          {
            user_id: userId,
            module_id: moduleId,
            completed_at: new Date().toISOString()
          },
          { onConflict: 'user_id,module_id' }
        );

      if (completeError) throw completeError;

      const { data: completed } = await supabaseClient
        .from('academy_module_progress')
        .select('module_id')
        .eq('user_id', userId)
        .not('completed_at', 'is', null);

      const { data: badges } = await supabaseClient
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId);

      const progressMap: Record<string, boolean> = {};
      const badgeMap: Record<string, boolean> = {};

      completed?.forEach((item: any) => {
        progressMap[item.module_id] = true;
      });

      badges?.forEach((item: any) => {
        badgeMap[item.badge_id] = true;
      });

      res.status(200).json({
        progress: progressMap,
        badges: badgeMap
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon module niet afmaken.' });
    }
  }
};

function getOriginalPath(req: { headers?: Record<string, string | string[] | undefined>; url?: string }) {
  const headers = req.headers || {};
  const original = headers['x-vercel-original-path'];
  if (typeof original === 'string') return original;
  return req.url || '/api';
}

function buildQuery(url: URL) {
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const rawUrl = getOriginalPath(req);
  const base = `http://${(req.headers?.host as string) || 'localhost'}`;
  const url = new URL(rawUrl, base);
  const pathname = url.pathname;
  const pathName = pathname.replace(/^\/api\/?/, '');
  const route = pathName || '';

  const handlerFn = routes[route];
  if (!handlerFn) {
    res.status(404).json({ error: 'Route niet gevonden.' });
    return;
  }

  const nextReq: ApiRequest = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    query: buildQuery(url)
  };

  await handlerFn(nextReq, res);
}
