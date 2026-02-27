import { createHmac, randomBytes, createCipheriv, createDecipheriv, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { kv } from '@vercel/kv';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// BITVAVO PRICE CACHE (Inline for Vercel compatibility)
// ============================================================================

class BitvavoPriceCache {
  private prices: Map<string, number> = new Map();
  private lastUpdate: number = 0;
  private maxAge = 30 * 60 * 1000; // 30 minutes acceptable

  updatePrice(market: string, price: number): void {
    this.prices.set(market, price);
    this.lastUpdate = Date.now();
  }

  getPrice(market: string): number | null {
    const price = this.prices.get(market);
    if (price && Date.now() - this.lastUpdate < this.maxAge) {
      return price;
    }
    return null;
  }

  getAllPrices(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [market, price] of this.prices) {
      if (Date.now() - this.lastUpdate < this.maxAge) {
        result.set(market, price);
      }
    }
    return result;
  }

  getAge(): number {
    return Date.now() - this.lastUpdate;
  }

  isFresh(): boolean {
    return this.getAge() < 5 * 60 * 1000; // 5 minutes
  }

  clear(): void {
    this.prices.clear();
    this.lastUpdate = 0;
  }
}

// Singleton price cache
let priceCacheInstance: BitvavoPriceCache | null = null;

function getBitvavoPriceCache(): BitvavoPriceCache {
  if (!priceCacheInstance) {
    priceCacheInstance = new BitvavoPriceCache();
  }
  return priceCacheInstance;
}

// ============================================================================
// BITVAVO PRICE FALLBACK (Inline for Vercel compatibility)
// ============================================================================

class BitvavoPriceFallback {
  private lastFetch = 0;
  private fetchInterval = 30 * 1000; // 30 seconds
  private prices: Map<string, number> = new Map();

  async fetchPrices(apiKey: string, apiSecret: string): Promise<Map<string, number>> {
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetch;
    
    // Force refresh if cache is empty OR interval has passed
    const hasValidCache = this.prices.size > 0 && timeSinceLastFetch < this.fetchInterval;
    
    if (hasValidCache) {
      return this.prices;
    }

    try {
      // Use CoinGecko - simple, reliable, no auth needed
      const resp = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana,ethereum,ripple,cardano,polkadot,chainlink,dogecoin&vs_currencies=eur'
      );

      if (resp.ok) {
        const data: any = await resp.json();
        
        // Map CoinGecko to Bitvavo markets
        const map: Record<string, string> = {
          bitcoin: 'BTC-EUR', solana: 'SOL-EUR', ethereum: 'ETH-EUR',
          ripple: 'XRP-EUR', cardano: 'ADA-EUR', polkadot: 'DOT-EUR',
          chainlink: 'LINK-EUR', dogecoin: 'DOGE-EUR'
        };

        for (const [id, market] of Object.entries(map)) {
          if (data[id]?.eur) {
            this.prices.set(market, Number(data[id].eur));
          }
        }

        this.lastFetch = now;
      }
    } catch (err) {
      console.error('[Price] CoinGecko error:', err instanceof Error ? err.message : err);
    }

    return this.prices;
  }

  getCachedPrices(): Map<string, number> {
    return this.prices;
  }
}

// Singleton fallback instance
let priceFallbackInstance: BitvavoPriceFallback | null = null;

function getBitvavoPriceFallback(): BitvavoPriceFallback {
  if (!priceFallbackInstance) {
    priceFallbackInstance = new BitvavoPriceFallback();
  }
  return priceFallbackInstance;
}

// ============================================================================

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

function getSupabaseClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL of SUPABASE_ANON_KEY ontbreekt.');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

  // IMPORTANT: Also save email to Supabase user_profiles table
  // This ensures email is persisted and can be fetched by email service
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey && profile.email) {
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          email: profile.email,
          display_name: profile.displayName,
          updated_at: now
        })
        .eq('user_id', userId);
      console.log(`[API] Saved email for user ${userId} to Supabase`);
    } catch (err) {
      console.warn(`[API] Failed to save email to Supabase for user ${userId}:`, err);
      // Don't fail the entire operation if Supabase save fails
    }
  }

  // Parallel writes om race conditions te voorkomen
  await Promise.all([
    kv.set(`user:${userId}:profile`, profile),
    kv.set(`user:${userId}:meta`, meta)
  ]);
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
  priceEUR?: number;  // Current EUR price per unit
  estimatedValue?: number;  // total * priceEUR in EUR
  updatedAt: string;
};

type PriceSnapshot = {
  asset: string;
  exchange: string;
  quantity: number;
  estimatedValue: number; // Voor display purposes
  timestamp: string;
};

type PerformanceMetrics = {
  asset: string;
  exchange: string;
  currentQuantity: number;
  previousQuantity: number;
  quantityChange: number;
  quantityChangePercent: number;
  periodStart: string;
  periodEnd: string;
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
  setCredentials(credentials: ExchangeCredentials): void;
  fetchAccounts(): Promise<Account[]>;
  fetchBalances(): Promise<Balance[]>;
  fetchPositions(): Promise<Position[]>;
  fetchTransactions(params: FetchParams): Promise<Transaction[]>;
  fetchOrders(params: FetchParams): Promise<Order[]>;
  fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]>;
  fetchAvailableAssets(): Promise<Array<{ symbol: string; name?: string }>>;
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
  private apiKey: string = '';
  private apiSecret: string = '';

  setCredentials(credentials: ExchangeCredentials) {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
    
    // Initialize WebSocket connection for real-time price updates
    this.initializeWebSocket();
  }

  /**
   * Initialize WebSocket connection for real-time ticker updates
   * Subscribes to major currency pairs (BTC-EUR, ETH-EUR, SOL-EUR, USDT-EUR)
   */
  private initializeWebSocket(): void {
    // Try to import WebSocket client from api directory
    // Gracefully degrade if not available (e.g., on Vercel)
    Promise.resolve()
      .then(async () => {
        try {
          const { getBitvavaWebSocket } = await import('./bitvavo-websocket');
          const ws = getBitvavaWebSocket(this.apiKey, this.apiSecret);
          const cache = getBitvavoPriceCache();

          // Connect and subscribe to ticker channel
          ws.connect()
            .then(() => {
              console.log('[Bitvavo] WebSocket connected, subscribing to ticker channels...');
              
              // Subscribe to major markets
              const markets = ['BTC-EUR', 'ETH-EUR', 'SOL-EUR', 'USDT-EUR', 'XRP-EUR', 'ADA-EUR'];
              for (const market of markets) {
                ws.subscribeTicker(market, (update) => {
                  // Update price cache with real-time price
                  cache.updatePrice(market, update.price);
                  console.log(`[Bitvavo] Price update: ${market} = €${update.price.toFixed(4)}`);
                });
              }

              console.log('[Bitvavo] WebSocket ticker subscriptions active');
            })
            .catch(err => {
              console.warn('[Bitvavo] WebSocket connection deferred:', err instanceof Error ? err.message : err);
            });

          // Handle WebSocket errors
          ws.onError((error) => {
            console.error('[Bitvavo] WebSocket error:', error.message);
          });
        } catch (err) {
          console.warn('[Bitvavo] WebSocket not available, will use REST fallback:', err instanceof Error ? err.message : err);
        }
      });
  }

  private async makeRequest(method: string, endpoint: string, body?: Record<string, unknown>) {
    const timestamp = Date.now();
    
    let bodyStr = '';
    if (body) {
      bodyStr = JSON.stringify(body);
    }

    // Bitvavo signing: HMAC-SHA256(apiSecret, timestamp + method + path + body)
    // Path must include /v2 for signing (but baseUrl already has it)
    const signingPath = `/v2${endpoint}`;
    const message = timestamp + method + signingPath + bodyStr;
    const signature = createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');

    console.log('[Bitvavo] Request:', {
      endpoint,
      method,
      timestamp,
      hasApiKey: !!this.apiKey,
      hasApiSecret: !!this.apiSecret,
      bodyStr: bodyStr ? 'has body' : 'no body',
      message: message.substring(0, 100) + '...'
    });

    // URL construction: baseUrl already contains /v2, so just append endpoint
    const fullUrl = `${EXCHANGE_CONFIG.bitvavo.baseUrl}${endpoint}`;
    console.log('[Bitvavo] FIXED-URL Fetching URL:', fullUrl);
    
    const resp = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Bitvavo-Access-Key': this.apiKey,
        'Bitvavo-Access-Timestamp': timestamp.toString(),
        'Bitvavo-Access-Signature': signature
      },
      body: bodyStr || undefined,
      signal: AbortSignal.timeout(10000)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[Bitvavo] Error response:', { 
        status: resp.status, 
        statusText: resp.statusText,
        endpoint,
        method,
        path,
        body: errText,
        url: fullUrl,
        message: `Signature might be wrong. Expected: timestamp+method+/v2{path}+body`
      });
      throw new Error(`Bitvavo API error ${resp.status}: ${errText}`);
    }

    return resp.json();
  }

  async connect(credentials: ExchangeCredentials): Promise<ConnectorConnectResult> {
    try {
      this.setCredentials(credentials);
      // Test connection by fetching accounts
      await this.makeRequest('GET', '/account');
      return { ok: true, scopes: ['read'] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Onbekende fout';
      return { ok: false, scopes: [], message: `Bitvavo verbinding mislukt: ${msg}` };
    }
  }

  async fetchAccounts(): Promise<Account[]> {
    try {
      const data = await this.makeRequest('GET', '/account');
      if (!Array.isArray(data)) {
        return [];
      }
      return data.map((acc: any) => ({
        id: acc.id || crypto.randomUUID(),
        userId: '', // Will be set by caller
        exchange: this.id,
        accountId: acc.id,
        name: acc.nickname || 'Main Account',
        type: 'spot',
        currency: 'EUR'
      }));
    } catch (err) {
      console.error('Bitvavo fetchAccounts error:', err);
      return [];
    }
  }

  async fetchBalances(): Promise<Balance[]> {
    try {
      // Step 1: Fetch balances
      const data = await this.makeRequest('GET', '/balance');
      if (!Array.isArray(data)) {
        console.error('[Bitvavo] fetchBalances: /balance returned non-array:', typeof data);
        return [];
      }
      
      const balances = data
        .filter((bal: any) => {
          const available = Number(bal.available ?? 0);
          const held = Number(bal.held ?? 0);
          return available > 0 || held > 0;
        })
        .map((bal: any) => ({
          id: crypto.randomUUID(),
          userId: '',
          exchange: this.id,
          asset: bal.symbol,
          total: Number(bal.available ?? 0) + Number(bal.held ?? 0),
          available: Number(bal.available ?? 0),
          updatedAt: new Date().toISOString()
        }));

      // Step 2: Get prices from cache (populated via WebSocket subscriptions)
      // Fallback to REST polling if WebSocket unavailable
      
      let priceMap: Record<string, number> = {};
      let pricesFromWebSocket = false;
      
      try {
        // Try to get prices from WebSocket cache first
        const cache = getBitvavoPriceCache();
        const cachedPrices = cache.getAllPrices();
        
        if (cachedPrices.size > 0) {
          // Convert Map to record
          for (const [market, price] of cachedPrices) {
            const [base, quote] = market.split('-');
            if (quote === 'EUR') {
              priceMap[base] = price;
            }
          }
          pricesFromWebSocket = true;
          
          console.log('[Bitvavo] Using prices from WebSocket cache:', {
            cachedMarkets: cachedPrices.size,
            cacheAge: cache.getAge(),
            isFresh: cache.isFresh()
          });
        }
      } catch (err) {
        console.warn('[Bitvavo] WebSocket cache unavailable:', err instanceof Error ? err.message : err);
      }

      // Fallback to REST polling if WebSocket cache empty
      if (Object.keys(priceMap).length === 0) {
        try {
          console.log('[Bitvavo] WebSocket cache empty, using REST fallback...');
          const fallback = getBitvavoPriceFallback();
          const fallbackPrices = await fallback.fetchPrices(this.apiKey, this.apiSecret);
          
          // Convert Map to record
          for (const [market, price] of fallbackPrices) {
            const [base, quote] = market.split('-');
            if (quote === 'EUR') {
              priceMap[base] = price;
            }
          }
          
          console.log('[Bitvavo] Using prices from REST fallback:', Object.keys(priceMap).length, 'assets with prices');
        } catch (err) {
          console.error('[Bitvavo] REST fallback failed:', err instanceof Error ? err.message : err);
          priceMap = {};
        }
      }

      // Step 3: Handle currency conversion
      let usdtToEurRate = priceMap['USDT'] || 1.0;

      // Step 4: Enhance balances with prices
      const enhancedBalances = balances.map(bal => {
        const priceEUR = priceMap[bal.asset] || 0;
        const estimatedValue = bal.total * priceEUR;
        
        if (priceEUR === 0) {
          console.warn(`[Bitvavo] No price available for ${bal.asset}`);
        } else {
          const source = pricesFromWebSocket ? 'WebSocket' : 'REST fallback';
          console.log(`[Bitvavo] ${bal.asset}: qty=${bal.total} × €${priceEUR.toFixed(4)} = €${estimatedValue.toFixed(2)} (from ${source})`);
        }

        return {
          ...bal,
          priceEUR,
          estimatedValue
        } as Balance;
      });

      console.log('[Bitvavo] fetchBalances complete:', {
        count: enhancedBalances.length,
        pricesAvailable: Object.keys(priceMap).length,
        source: pricesFromWebSocket ? 'WebSocket' : 'REST fallback',
        assets: enhancedBalances.map(b => `${b.asset}=€${b.priceEUR}`)
      });

      return enhancedBalances;
    } catch (err) {
      console.error('[Bitvavo API] fetchBalances error:', err);
      return [];
    }
  }

  async fetchPositions(): Promise<Position[]> {
    // Bitvavo is spot only
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    // Deposits/withdrawals endpoint: GET /v2/deposits or /v2/withdrawals
    // Requires: API key signing
    // IMPLEMENTATION NEEDED:
    // - Fetch deposits with makeRequest('GET', '/deposits')
    // - Fetch withdrawals with makeRequest('GET', '/withdrawals')
    // - Combine and map to Transaction[] format
    console.log('[Bitvavo] fetchTransactions - implement deposits/withdrawals API calls');
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // Orders endpoint: GET /v2/orders
    // Requires: API key signing
    // IMPLEMENTATION NEEDED:
    // - Fetch orders with makeRequest('GET', '/orders')
    // - Map response to Order[] format with buy/sell sides
    console.log('[Bitvavo] fetchOrders - implement orders API call');
    return [];
  }

  async fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]> {
    const symbol = params.symbols[0] || 'BTC-EUR';
    const interval = params.interval || '1h';
    const url = `${EXCHANGE_CONFIG.bitvavo.baseUrl}/${symbol}/candles?interval=${interval}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
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

  async fetchAvailableAssets(): Promise<Array<{ symbol: string; name?: string }>> {
    try {
      const resp = await fetch(`${EXCHANGE_CONFIG.bitvavo.baseUrl}/markets`, {
        signal: AbortSignal.timeout(10000)
      });
      if (!resp.ok) return [];
      const data = (await resp.json()) as Array<{ market: string; baseAsset: string; quoteAsset?: string }>;
      const assets = data.filter(m => m.quoteAsset === 'EUR').map(m => ({
        symbol: m.market,
        name: m.baseAsset
      }));
      return assets;
    } catch (err) {
      console.error('[Bitvavo] fetchAvailableAssets error:', err);
      return [];
    }
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
  private apiKey: string = '';
  private apiSecret: string = '';

  setCredentials(credentials: ExchangeCredentials) {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
  }

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

  async fetchAvailableAssets(): Promise<Array<{ symbol: string; name?: string }>> {
    try {
      const resp = await fetch(`${EXCHANGE_CONFIG.kraken.baseUrl}/public/AssetPairs`);
      if (!resp.ok) return [];
      const payload = (await resp.json()) as { result?: Record<string, any> };
      const assets = Object.entries(payload.result || {}).map(([key, value]: [string, any]) => ({
        symbol: key,
        name: value?.wsname || key
      }));
      return assets;
    } catch (err) {
      console.error('[Kraken] fetchAvailableAssets error:', err);
      return [];
    }
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
  private apiKey: string = '';
  private apiSecret: string = '';

  setCredentials(credentials: ExchangeCredentials) {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
  }

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

  async fetchAvailableAssets(): Promise<Array<{ symbol: string; name?: string }>> {
    try {
      const resp = await fetch(`${EXCHANGE_CONFIG.coinbase.baseUrl}/products`);
      if (!resp.ok) return [];
      const data = (await resp.json()) as Array<{ id: string; display_name?: string }>;
      return data.map(p => ({
        symbol: p.id,
        name: p.display_name || p.id
      }));
    } catch (err) {
      console.error('[Coinbase] fetchAvailableAssets error:', err);
      return [];
    }
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
  private apiKey: string = '';
  private apiSecret: string = '';

  setCredentials(credentials: ExchangeCredentials) {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
  }

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

  async fetchAvailableAssets(): Promise<Array<{ symbol: string; name?: string }>> {
    try {
      const resp = await fetch(`${EXCHANGE_CONFIG.bybit.baseUrl}/market/instruments-info?category=spot`);
      if (!resp.ok) return [];
      const payload = (await resp.json()) as { result?: { list?: Array<{ symbol: string; baseCoin?: string }> } };
      const assets = (payload.result?.list || []).map(a => ({
        symbol: a.symbol,
        name: a.baseCoin || a.symbol
      }));
      return assets;
    } catch (err) {
      console.error('[Bybit] fetchAvailableAssets error:', err);
      return [];
    }
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
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
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
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
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
  try {
    if (!kv) {
      return { ...EMPTY_STORE };
    }
    const raw = await kv.get(`exchange:${userId}:store`);
    if (!raw) {
      return { ...EMPTY_STORE };
    }
    // Vercel KV returns the object directly, not a string
    if (typeof raw === 'string') {
      return JSON.parse(raw) as StoreData;
    }
    return raw as StoreData;
  } catch (err) {
    console.error('[readKvStore] Error:', err);
    return { ...EMPTY_STORE };
  }
}

async function writeKvStore(userId: string, data: StoreData) {
  try {
    if (!kv) {
      throw new Error('KV store niet beschikbaar.');
    }
    // Vercel KV automatically serializes, so don't JSON.stringify here
    await kv.set(`exchange:${userId}:store`, data);
  } catch (err) {
    console.error('[writeKvStore] Error:', err);
    throw err;
  }
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

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 2,
  delayMs: number = 800
): Promise<T> {
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

  // Set credentials for connectors that need them
  if ('setCredentials' in connector) {
    (connector as any).setCredentials(credentials);
  }

  try {
    const [accounts, balances, positions, transactions, orders] = await Promise.all([
      withRetry(() => connector.fetchAccounts(), 2, 800),
      withRetry(() => connector.fetchBalances(), 2, 800),
      withRetry(() => connector.fetchPositions(), 2, 800),
      withRetry(async () => connector.fetchTransactions({}), 2, 800),
      withRetry(async () => connector.fetchOrders({}), 2, 800),
    ]);

    const accountsWithUserId = accounts.map((a) => ({ ...a, userId }));
    const balancesWithUserId = balances.map((b) => ({ ...b, userId }));
    const positionsWithUserId = positions.map((p) => ({ ...p, userId }));
    const transactionsWithUserId = transactions.map((t) => ({ ...t, userId }));
    const ordersWithUserId = orders.map((o) => ({ ...o, userId }));

    await storage.saveAccounts(userId, accountsWithUserId);
    await storage.saveBalances(userId, balancesWithUserId);
    await storage.savePositions(userId, positionsWithUserId);
    await storage.saveTransactions(userId, transactionsWithUserId);
    await storage.saveOrders(userId, ordersWithUserId);

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

type Proposal = {
  id: string;
  type: 'trade' | 'settings' | 'control';
  title: string;
  description: string;
  action: {
    type: string;
    params: Record<string, any>;
  };
  reasoning: string;
  confidence?: number; // Optional: proposal confidence score (0-100)
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  executedAt?: string;
  exchange?: string;
};

type AgentExecutionLog = {
  id: string;
  userId: string;
  exchange: string;
  type: 'monitoring' | 'analysis' | 'alert' | 'decision' | 'execution';
  status: 'success' | 'warning' | 'error';
  title: string;
  description: string;
  details?: Record<string, any>;
  timestamp: string;
  duration: number; // milliseconds
};

type ChatContext = {
  profile?: {
    displayName?: string;
    strategy?: string;
    primaryGoal?: string;
    timeHorizon?: string;
    knowledgeLevel?: string;
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
  exchanges?: {
    connected: string[];
    activePlatform?: string;
    cashSaldo?: number;
    availableAssets?: string[];
    balances?: Array<{
      exchange: string;
      total: number;
    }>;
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
    const profileParts: string[] = [
      context.profile.displayName ? `Naam: ${context.profile.displayName}` : null,
      context.profile.strategy ? `Strategie: ${context.profile.strategy}` : null,
      context.profile.primaryGoal ? `Doel: ${context.profile.primaryGoal}` : null,
      context.profile.timeHorizon ? `Horizon: ${context.profile.timeHorizon}` : null,
      context.profile.knowledgeLevel ? `Kennisniveau: ${context.profile.knowledgeLevel}` : null
    ].filter(Boolean) as string[];
    if (profileParts.length > 0) {
      lines.push('Gebruikersprofiel:', ...profileParts);
    }
  }
  if (context.market) {
    const marketParts: string[] = [
      context.market.lastScan ? `Laatste check: ${context.market.lastScan}` : null,
      context.market.volatilityLabel ? `Tempo: ${context.market.volatilityLabel}` : null,
      context.market.changes
        ? `Bewegingen (%): BTC ${context.market.changes.bitcoin}, ETH ${context.market.changes.ethereum}, Stable ${context.market.changes.stablecoins}, Alt ${context.market.changes.altcoins}`
        : null
    ].filter(Boolean) as string[];
    if (marketParts.length > 0) {
      lines.push('Marktcontext:', ...marketParts);
    }
  }
  if (context.exchanges?.connected.length) {
    const exchangeParts = [
      `Gekoppelde exchanges: ${context.exchanges.connected.join(', ')}`
    ];
    if (context.exchanges.activePlatform) {
      exchangeParts.push(`Actief platform: ${context.exchanges.activePlatform}`);
    }
    if (context.exchanges.cashSaldo !== undefined) {
      exchangeParts.push(`Beschikbare EUR/cash saldo: €${context.exchanges.cashSaldo.toFixed(2)}`);
    }
    if (context.exchanges.availableAssets?.length) {
      exchangeParts.push(`Beschikbare munten op ${context.exchanges.activePlatform || 'dit platform'}: ${context.exchanges.availableAssets.join(', ')}`);
    }
    if (context.exchanges.balances?.length) {
      const balanceSummary = context.exchanges.balances
        .map(b => `${b.exchange}: €${b.total.toFixed(2)}`)
        .join(', ');
      exchangeParts.push(`Saldi: ${balanceSummary}`);
    }
    lines.push('Exchange-gegevens:', ...exchangeParts);
  }
  return lines.length > 0 ? lines.join('\n') : '';
}

async function generateChatReply(messages: ChatMessage[], context?: ChatContext) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ontbreekt.');
  }

  const contextMessage = formatChatContext(context);
  const hasExchangeAccess = context?.exchanges?.connected?.length ?? 0 > 0;
  const activePlatform = context?.exchanges?.activePlatform;
  const availableAssets = context?.exchanges?.availableAssets ?? [];

  console.log('[generateChatReply] Context message length:', contextMessage.length);
  console.log('[generateChatReply] Has exchange access:', hasExchangeAccess);
  console.log('[generateChatReply] Active platform:', activePlatform);
  console.log('[generateChatReply] Available assets:', availableAssets.join(', '));

  const systemPrompt = hasExchangeAccess && activePlatform
    ? `Je bent een crypto-assistent die concrete voorstellen mag doen op ${activePlatform}. Je hebt toegang tot het gekoppelde account van de gebruiker. 

COMMUNICATIE:
- Geef uitleg en opties in mensentaal
- Bevestig dat je hun account op ${activePlatform} kunt zien

VOORSTELLEN GENEREREN:
- Voor concrete acties (trade, settings wijziging), wrap in:
###PROPOSAL:{JSON}###END

Format van JSON:
{
  "type": "trade" | "settings" | "control",
  "title": "Korte titel",
  "description": "Wat gaat er gebeuren",
  "action": {
    "type": "buy" | "sell" | "update_risk" | "toggle_agent",
    "params": {...specifieke parameters...}
  },
  "reasoning": "Waarom dit voorstel",
  "exchange": "bitvavo"
}

VEILIGHEID:
- Voorstellen moeten goedgekeurd worden in Trading Dashboard
- Alleen assets die beschikbaar zijn: ${availableAssets.join(', ')}
- Max 1 proposal per bericht
- Je mag ALLEEN advies geven over munten op ${activePlatform}
- Als gebruiker vragen stelt over munten niet op ${activePlatform}, wijs hen daarop
- Voorstellen moeten realistisch en verantwoord zijn`
    : `Je bent een rustige crypto-assistent. Je geeft uitleg en opties in mensentaal.`;

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
          content: systemPrompt
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
    console.error('[generateChatReply] OpenAI error:', resp.status, text);
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as OpenAIChatResponse;
  const reply = data.choices?.[0]?.message?.content?.trim() || 'Geen antwoord beschikbaar.';
  console.log('[generateChatReply] Reply length:', reply.length);
  return reply;
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

// Agent execution logging functions
async function logAgentExecution(log: AgentExecutionLog): Promise<void> {
  try {
    if (!kv) {
      console.warn('[agent/execution-log] KV not available, skipping log');
      return;
    }
    
    console.log('[agent/execution-log] Attempting to save log:', {
      userId: log.userId,
      exchange: log.exchange,
      type: log.type,
      logId: log.id
    });
    
    const historyKey = `agent:history:${log.userId}:${log.exchange}`;
    const existing = (await kv.get(historyKey)) as any;
    const logsArray = (Array.isArray(existing) ? existing : []) as AgentExecutionLog[];
    
    console.log('[agent/execution-log] Current logs count:', logsArray.length);
    
    // Add new log
    logsArray.unshift(log);
    
    // Keep only last 24 hours worth of logs
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = logsArray.filter(l => new Date(l.timestamp).getTime() > cutoffTime);
    
    console.log('[agent/execution-log] Filtered logs count:', filtered.length);
    
    // Store with 24h expiry
    await kv.set(historyKey, filtered, { ex: 86400 });
    
    console.log('[agent/execution-log] ✓ Successfully saved log:', {
      userId: log.userId,
      exchange: log.exchange,
      type: log.type,
      totalLogsNow: filtered.length
    });
  } catch (err) {
    console.error('[agent/execution-log] Error logging execution:', err);
  }
}

async function getAgentHistory(userId: string, exchange: string, hoursBack: number = 24): Promise<AgentExecutionLog[]> {
  try {
    if (!kv) {
      console.warn('[agent/history] KV not available');
      return [];
    }
    
    const historyKey = `agent:history:${userId}:${exchange}`;
    console.log('[agent/history] Fetching from key:', historyKey);
    
    const rawData = await kv.get(historyKey);
    console.log('[agent/history] Raw data from KV:', {
      type: typeof rawData,
      isArray: Array.isArray(rawData),
      value: rawData
    });
    
    const logs = (Array.isArray(rawData) ? rawData : []) as AgentExecutionLog[];
    console.log('[agent/history] Parsed logs count:', logs.length);
    
    // Filter by time window
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
    const filtered = logs.filter(l => {
      const logTime = new Date(l.timestamp).getTime();
      return logTime > cutoffTime;
    });
    
    console.log('[agent/history] Filtered logs (past', hoursBack, 'hours):', filtered.length);
    
    return filtered;
  } catch (err) {
    console.error('[agent/history] Error fetching history:', err);
    return [];
  }
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
          content: 'Je bent een crypto-allocatie-engine die verdelingen geeft in JSON.'
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

type InsightInput = {
  profile?: {
    displayName?: string;
    strategy?: string;
    primaryGoal?: string;
    timeHorizon?: string;
    knowledgeLevel?: string;
  };
  market?: {
    volatilityLevel?: string;
    volatilityLabel?: string;
    changes?: {
      bitcoin: number;
      ethereum: number;
      stablecoins: number;
      altcoins: number;
    };
  };
  currentAllocation?: Array<{ label: string; pct: number }>;
};

async function generateInsights(input: InsightInput): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ontbreekt.');
  }

  const profileInfo = input.profile
    ? `- Doelstelling: ${input.profile.primaryGoal}
- Horizon: ${input.profile.timeHorizon}
- Kennis: ${input.profile.knowledgeLevel}
- Strategie: ${input.profile.strategy}`
    : 'Geen profiel beschikbaar';

  const marketInfo = input.market
    ? `- Tempo: ${input.market.volatilityLabel}
- Bewegingen: BTC ${input.market.changes?.bitcoin}%, ETH ${input.market.changes?.ethereum}%, Stablecoins ${input.market.changes?.stablecoins}%, Altcoins ${input.market.changes?.altcoins}%`
    : 'Geen marktdata beschikbaar';

  const allocationInfo = input.currentAllocation
    ? input.currentAllocation.map((a) => `- ${a.label}: ${a.pct}%`).join('\n')
    : 'Geen allocatie beschikbaar';

  const prompt = [
    'Gegeven onderstaande profielgegevens en marktomstandigheden, presenteer relevante observaties.',
    '',
    'PROFIEL:',
    profileInfo,
    '',
    'MARKT NU:',
    marketInfo,
    '',
    'HUIDIGE ALLOCATIE:',
    allocationInfo,
    '',
    'INSTRUCTIES:',
    '- Geef GEEN directe adviezen zoals "koop nu" of "verkoop dat"',
    '- Geef WEL observaties: "Gegeven jouw horizon kun je X overwegen"',
    '- Gebruik voorwaardelijk taalgebruik: "IF..., zou..., kun je..."',
    '- Link profiel aan markt: "Met jouw kennis... en gegeven dit tempo..."',
    '- Presenteer als overwegingen, niet als bevelen',
    '- Maximaal 3-4 relevante punten',
    '- Wees duidelijk en in mensentaal'
  ].join('\n');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Je bent een crypto-observator. Je presenteert observaties en overwegingen zonder directe adviezen of voorspellingen.'
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
  return data.choices?.[0]?.message?.content?.trim() || 'Geen inzichten beschikbaar.';
}

function fallbackInsights(input: InsightInput): string {
  const observations: string[] = [];

  if (input.profile?.timeHorizon === '7y+') {
    observations.push('Met jouw lange horizon (7+ jaar) kun je typisch meer volatiliteit dragen.');
  }
  if (input.profile?.knowledgeLevel === 'beginner' && input.market?.volatilityLevel === 'hoog') {
    observations.push('Gegeven het onrustige tempo nu, merken beginners dat dit een moment is om rustig te observeren.');
  }
  if (input.market?.changes?.bitcoin && input.market.changes.bitcoin > 5) {
    observations.push('Bitcoin beweegt opvallend omhoog (+' + input.market.changes.bitcoin + '%), wat kan wijzen op marktsentiment.');
  }
  if (
    input.currentAllocation &&
    input.profile?.primaryGoal === 'preserve' &&
    input.currentAllocation.find((a) => a.label === 'Altcoins' && a.pct > 30)
  ) {
    observations.push('Je allocatie heeft veel altcoins (>30%), wat tegen je bewaardoel ingaat gezien het hogere risico.');
  }

  return observations.length > 0
    ? observations.join('\n\n')
    : 'Geen specifieke observaties beschikbaar.';
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
    const headerStr = typeof header === 'string' ? header : (Array.isArray(header) ? header[0] : '');
    const token = headerStr.startsWith('Bearer ')
      ? headerStr.slice(7)
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
  'user/notification-preferences': async (req, res) => {
    // GET: Fetch user's notification preferences
    if (req.method === 'GET') {
      const userId = getSessionUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Geen sessie.' });
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const { data: prefs, error } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error) {
          // Preferences don't exist yet - return defaults
          if (error.code === 'PGRST116') {
            return res.status(200).json({
              user_id: userId,
              email_on_execution: true,
              email_on_alert: true,
              email_on_daily_summary: false,
              sms_on_execution: false,
              push_on_execution: false,
              digest_frequency: 'daily'
            });
          }
          throw error;
        }

        res.status(200).json(prefs);
      } catch (err) {
        console.error('[notification-preferences GET] Error:', err);
        res.status(500).json({ error: 'Kon voorkeuren niet ophalen.' });
      }
    }
    // POST: Update user's notification preferences
    else if (req.method === 'POST') {
      const userId = getSessionUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Geen sessie.' });
        return;
      }
      try {
        const {
          email_on_execution,
          email_on_alert,
          email_on_daily_summary,
          sms_on_execution,
          push_on_execution,
          digest_frequency
        } = (req.body || {}) as {
          email_on_execution?: boolean;
          email_on_alert?: boolean;
          email_on_daily_summary?: boolean;
          sms_on_execution?: boolean;
          push_on_execution?: boolean;
          digest_frequency?: string;
        };

        const supabase = getSupabaseClient();
        const { data: prefs, error } = await supabase
          .from('notification_preferences')
          .upsert({
            user_id: userId,
            email_on_execution: email_on_execution !== undefined ? email_on_execution : true,
            email_on_alert: email_on_alert !== undefined ? email_on_alert : true,
            email_on_daily_summary: email_on_daily_summary !== undefined ? email_on_daily_summary : false,
            sms_on_execution: sms_on_execution !== undefined ? sms_on_execution : false,
            push_on_execution: push_on_execution !== undefined ? push_on_execution : false,
            digest_frequency: digest_frequency || 'daily',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;

        console.log(`[notification-preferences POST] Updated for user ${userId}`);
        res.status(200).json(prefs);
      } catch (err) {
        console.error('[notification-preferences POST] Error:', err);
        res.status(500).json({ error: 'Kon voorkeuren niet opslaan.' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  },
  'user/risk-level': async (req, res) => {
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
      const { riskLevel } = (req.body || {}) as { riskLevel?: string };
      if (!riskLevel || !['voorzichtig', 'gebalanceerd', 'actief'].includes(riskLevel)) {
        res.status(400).json({ error: 'Ongeldig risicoprofiel. Gebruik: voorzichtig, gebalanceerd, actief' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data: profile, error: getError } = await supabase
        .from('user_profiles')
        .select('risk_profile')
        .eq('user_id', userId)
        .single();

      if (getError && getError.code !== 'PGRST116') throw getError;

      const oldValue = profile?.risk_profile || 'gebalanceerd';

      const { data: updated, error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          risk_profile: riskLevel,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      console.log(`[user/risk-level] Updated for user ${userId}: ${oldValue} → ${riskLevel}`);
      res.status(200).json({
        success: true,
        oldValue,
        newValue: riskLevel,
        message: `Risicoprofiel bijgewerkt naar: ${riskLevel}`
      });
    } catch (err) {
      console.error('[user/risk-level] Error:', err);
      res.status(500).json({ error: 'Kon risicoprofiel niet bijwerken.' });
    }
  },
  'user/scan-interval': async (req, res) => {
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
      const { scanInterval } = (req.body || {}) as { scanInterval?: string };
      if (!scanInterval || !['1h', '6h', '24h', 'manual'].includes(scanInterval)) {
        res.status(400).json({ error: 'Ongeldig scan interval. Gebruik: 1h, 6h, 24h, manual' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data: prefs, error: getError } = await supabase
        .from('notification_preferences')
        .select('market_scan_interval')
        .eq('user_id', userId)
        .single();

      if (getError && getError.code !== 'PGRST116') throw getError;

      const oldValue = prefs?.market_scan_interval || 'manual';

      const { data: updated, error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          market_scan_interval: scanInterval,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      console.log(`[user/scan-interval] Updated for user ${userId}: ${oldValue} → ${scanInterval}`);
      res.status(200).json({
        success: true,
        oldValue,
        newValue: scanInterval,
        message: `Marktscans ingesteld op: ${scanInterval}`
      });
    } catch (err) {
      console.error('[user/scan-interval] Error:', err);
      res.status(500).json({ error: 'Kon scan interval niet bijwerken.' });
    }
  },
  'user/strategy': async (req, res) => {
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
      const { strategy } = (req.body || {}) as { strategy?: string };
      const validStrategies = ['DCA', 'Grid Trading', 'Momentum', 'Buy & Hold'];
      if (!strategy || !validStrategies.includes(strategy)) {
        res.status(400).json({ error: `Ongeldig strategie. Kies uit: ${validStrategies.join(', ')}` });
        return;
      }

      const supabase = getSupabaseClient();
      const { data: profile, error: getError } = await supabase
        .from('user_profiles')
        .select('strategy')
        .eq('user_id', userId)
        .single();

      if (getError && getError.code !== 'PGRST116') throw getError;

      const oldValue = profile?.strategy || 'Buy & Hold';

      const { data: updated, error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          strategy,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      console.log(`[user/strategy] Updated for user ${userId}: ${oldValue} → ${strategy}`);
      res.status(200).json({
        success: true,
        oldValue,
        newValue: strategy,
        message: `Strategie gewijzigd naar: ${strategy}`
      });
    } catch (err) {
      console.error('[user/strategy] Error:', err);
      res.status(500).json({ error: 'Kon strategie niet bijwerken.' });
    }
  },
  'user/position-size': async (req, res) => {
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
      const { positionSize } = (req.body || {}) as { positionSize?: number };
      if (positionSize === undefined || positionSize < 1 || positionSize > 100) {
        res.status(400).json({ error: 'Positiegrootte moet tussen 1 en 100 liggen.' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data: profile, error: getError } = await supabase
        .from('user_profiles')
        .select('max_position_size')
        .eq('user_id', userId)
        .single();

      if (getError && getError.code !== 'PGRST116') throw getError;

      const oldValue = profile?.max_position_size || 10;

      const { data: updated, error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          max_position_size: positionSize,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      console.log(`[user/position-size] Updated for user ${userId}: ${oldValue}% → ${positionSize}%`);
      res.status(200).json({
        success: true,
        oldValue,
        newValue: positionSize,
        message: `Maximale positiegrootte ingesteld op: ${positionSize}%`
      });
    } catch (err) {
      console.error('[user/position-size] Error:', err);
      res.status(500).json({ error: 'Kon positiegrootte niet bijwerken.' });
    }
  },
  'user/loss-limit': async (req, res) => {
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
      const { lossLimit } = (req.body || {}) as { lossLimit?: number };
      if (lossLimit === undefined || lossLimit < 0.5 || lossLimit > 10) {
        res.status(400).json({ error: 'Verliesgrens moet tussen 0.5 en 10 liggen.' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data: profile, error: getError } = await supabase
        .from('user_profiles')
        .select('daily_loss_limit')
        .eq('user_id', userId)
        .single();

      if (getError && getError.code !== 'PGRST116') throw getError;

      const oldValue = profile?.daily_loss_limit || 5;

      const { data: updated, error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          daily_loss_limit: lossLimit,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      console.log(`[user/loss-limit] Updated for user ${userId}: ${oldValue}% → ${lossLimit}%`);
      res.status(200).json({
        success: true,
        oldValue,
        newValue: lossLimit,
        message: `Dagelijkse verliesgrens ingesteld op: ${lossLimit}%`
      });
    } catch (err) {
      console.error('[user/loss-limit] Error:', err);
      res.status(500).json({ error: 'Kon verliesgrens niet bijwerken.' });
    }
  },
  chat: async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const userId = getSessionUserId(req);
      const { messages, context } = (req.body || {}) as {
        messages: ChatMessage[];
        context?: ChatContext;
      };
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'messages is verplicht.' });
        return;
      }
      console.log('[chat] Received context:', JSON.stringify(context, null, 2));
      console.log('[chat] Messages:', messages.length, 'messages');
      const reply = await generateChatReply(messages, context);
      console.log('[chat] Generated reply');
      
      // Check if reply contains proposal markers (e.g., ###PROPOSAL:...)
      const proposalMatch = reply.match(/###PROPOSAL:([\s\S]*?)###END/);
      let proposal: Proposal | null = null;
      let displayReply = reply;
      
      if (proposalMatch && userId) {
        try {
          const proposalData = JSON.parse(proposalMatch[1].trim());
          const proposalId = randomUUID();
          proposal = {
            id: proposalId,
            ...proposalData,
            createdAt: new Date().toISOString(),
            status: 'pending'
          };
          
          // Save proposal to KV
          const proposalKey = `user:${userId}:proposal:${proposalId}`;
          await kv.set(proposalKey, proposal);
          
          // Also add to pending list
          const pendingKey = `user:${userId}:proposals:pending`;
          const pending = ((await kv.get(pendingKey)) as string[] || []);
          await kv.set(pendingKey, [...pending, proposalId]);
          
          // Remove proposal markers from display
          displayReply = reply.replace(/###PROPOSAL:[\s\S]*?###END/, '').trim();
        } catch (e) {
          console.warn('[chat] Could not parse proposal:', e);
        }
      }
      
      res.status(200).json({ reply: displayReply, proposal, createdAt: new Date().toISOString() });
    } catch (err) {
      console.error('[chat] Error:', err);
      res.status(500).json({ error: 'Kon chat niet ophalen.' });
    }
  },
  'trading/policy': async (req, res) => {
    if (req.method === 'GET') {
      res.status(200).json({
        version: '1.0',
        status: 'coming-soon',
        message: 'Trading policy documentation is coming soon.',
        policies: {
          riskManagement: {
            title: 'Risk Management',
            description: 'Coming soon',
            maxDrawdown: 'TBD',
            positionSizing: 'TBD'
          },
          orderExecution: {
            title: 'Order Execution',
            description: 'Coming soon',
            minOrderSize: 'TBD',
            maxOrderSize: 'TBD'
          },
          compliance: {
            title: 'Compliance',
            description: 'Coming soon',
            requirements: []
          }
        },
        lastUpdated: new Date().toISOString()
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  },
  'trading/proposals': async (req, res) => {
    if (req.method === 'GET') {
      // GET: List pending proposals
      try {
        const userId = getSessionUserId(req);
        if (!userId) {
          res.status(401).json({ error: 'Geen sessie.' });
          return;
        }
        
        const pendingKey = `user:${userId}:proposals:pending`;
        const pendingIds = ((await kv.get(pendingKey)) as string[]) || [];
        
        const proposals: Proposal[] = [];
        for (const id of pendingIds) {
          const proposal = (await kv.get(`user:${userId}:proposal:${id}`)) as Proposal | null;
          if (proposal) proposals.push(proposal);
        }
        
        res.status(200).json({ proposals: proposals.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )});
      } catch (err) {
        console.error('[trading/proposals GET] Error:', err);
        res.status(500).json({ error: 'Kon proposals niet ophalen.' });
      }
    } else if (req.method === 'POST') {
      // POST: Approve/reject proposal
      try {
        const userId = getSessionUserId(req);
        if (!userId) {
          res.status(401).json({ error: 'Geen sessie.' });
          return;
        }
        
        const { proposalId, approved } = (req.body || {}) as { proposalId: string; approved: boolean };
        if (!proposalId) {
          res.status(400).json({ error: 'proposalId is verplicht.' });
          return;
        }
        
        const proposalKey = `user:${userId}:proposal:${proposalId}`;
        const proposal = (await kv.get(proposalKey)) as Proposal | null;
        
        if (!proposal) {
          res.status(404).json({ error: 'Proposal niet gevonden.' });
          return;
        }
        
        // Update proposal status
        proposal.status = approved ? 'approved' : 'rejected';
        await kv.set(proposalKey, proposal);
        
        // Remove from pending
        const pendingKey = `user:${userId}:proposals:pending`;
        const pendingIds = ((await kv.get(pendingKey)) as string[]) || [];
        await kv.set(pendingKey, pendingIds.filter(id => id !== proposalId));
        
        // If approved, EXECUTE the proposal on Bitvavo
        if (approved) {
          console.log('[trading/proposals] Executing proposal:', proposalId, proposal.action);
          
          try {
            // Get user's Bitvavo credentials from database
            const storage = getStorageAdapter();
            const exchange = proposal.exchange || 'bitvavo';
            const connection = await storage.getConnection(userId, exchange);
            
            if (!connection) {
              console.error('[trading/proposals] No exchange connection found for user');
              proposal.status = 'failed';
              await kv.set(proposalKey, proposal);
              return res.status(400).json({ 
                error: 'Geen gekoppelde exchange gevonden. Koppel eerst een exchange.' 
              });
            }
            
            // Decrypt user's API credentials
            const credentials = decryptSecrets(connection.encryptedSecrets) as any;
            const tradingKey = credentials.apiKey;
            const tradingSecret = credentials.apiSecret;
            
            if (!tradingKey || !tradingSecret) {
              console.error('[trading/proposals] Could not decrypt API credentials');
              proposal.status = 'failed';
              await kv.set(proposalKey, proposal);
              return res.status(400).json({ 
                error: 'API credentials ongeldig. Koppel de exchange opnieuw.' 
              });
            }
            
            console.log('[trading/proposals] Using credentials for user:', userId, 'exchange:', exchange);
            const action = proposal.action;
            const params = action.params || {};
            
            // Get operatorId from credentials or use default
            const operatorId = credentials.operatorId ? parseInt(credentials.operatorId, 10) : 101;
            
            // Helper function to execute Bitvavo market order with EUR amount
            const executeBitvavoOrder = async (market: string, side: 'buy' | 'sell', amountQuote: string) => {
              const timestamp = Date.now();
              // Bitvavo market order payload: market, side, orderType, amountQuote (EUR), operatorId
              const payload = {
                market,
                side,
                orderType: 'market',
                amountQuote,  // EUR amount (quote currency)
                operatorId    // Required by Bitvavo since 2025 (64-bit integer)
              };
              
              const bodyStr = JSON.stringify(payload);
              const signingPath = '/v2/order';
              const message = timestamp + 'POST' + signingPath + bodyStr;
              
              const signature = createHmac('sha256', tradingSecret)
                .update(message)
                .digest('hex');
              
              const timestampISO = new Date(timestamp).toISOString();
              console.log('[trading/proposals] Placing market order on Bitvavo:', {
                market,
                side,
                amountQuote,
                orderType: 'market',
                operatorId,
                timestamp,
                timestampISO
              });
              
              const response = await fetch('https://api.bitvavo.com/v2/order', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Bitvavo-Access-Key': tradingKey,
                  'Bitvavo-Access-Timestamp': timestamp.toString(),
                  'Bitvavo-Access-Signature': signature
                },
                body: bodyStr
              });
              
              if (!response.ok) {
                const errText = await response.text();
                let parsedError: any = {};
                try {
                  parsedError = JSON.parse(errText);
                } catch {
                  parsedError = { raw: errText };
                }
                console.error('[trading/proposals] Bitvavo API error:', {
                  status: response.status,
                  statusText: response.statusText,
                  errorCode: parsedError.errorCode,
                  error: parsedError.error || errText,
                  market,
                  side,
                  amountQuote,
                  orderType: 'market',
                  operatorId,
                  timestamp: timestampISO
                });
                return null;
              }
              
              const data = await response.json();
              console.log('[trading/proposals] Bitvavo market order placed successfully:', {
                market,
                side,
                amountQuote,
                operatorId,
                orderId: data.orderId || data.id,
                timestamp: timestampISO,
                response: data
              });
              return data;
            };
            
            // Handle different action types
            if (action.type === 'buy' || action.type === 'BUY') {
              // params should have: asset (e.g., 'BTC'), amount (EUR), currency, to_currency
              const asset = params.to_currency || params.asset || 'BTC';
              const amountEur = (params.amount || params.amountEur || '10').toString(); // EUR amount for market order
              const market = `${asset}-EUR`;
              
              console.log('[trading/proposals] Buy order params:', {
                asset,
                amountEur,
                market,
                paramsReceived: params
              });
              
              // Place market buy order with EUR amount (amountQuote)
              const orderData = await executeBitvavoOrder(market, 'buy', amountEur);
              
              console.log('[trading/proposals] Bitvavo order response:', orderData);
              
              if (orderData && (orderData.orderId || orderData.id)) {
                const orderId = orderData.orderId || orderData.id;
                console.log('[trading/proposals] ✅ Order placed successfully:', orderId);
                proposal.status = 'executed';
                proposal.executedAt = new Date().toISOString();
                (proposal as any).orderId = orderId;
                await kv.set(proposalKey, proposal);
                
                // Log execution ticket for user notification (disabled - function removed)
                // try {
                //   const { logTicket } = await import('../src/lib/observation/logger');
                // } catch (ticketErr) {
                //   console.warn('[trading/proposals] Could not log execution ticket:', ticketErr);
                // }
                
                // Optionally send email notification (async, fire-and-forget)
                // This will be sent in the background without blocking the response
                (async () => {
                  try {
                    const { sendExecutionEmail, isEmailNotificationEnabled } = await import('../src/lib/notifications/emailService');
                    
                    // Check if user has email notifications enabled
                    const emailEnabled = await isEmailNotificationEnabled(userId, 'execution');
                    if (!emailEnabled) {
                      console.log('[trading/proposals] Email notifications disabled for user:', userId);
                      return;
                    }
                    
                    // Get user email from session/profile
                    // TODO: Fetch from Supabase user profile
                    // For now: use a placeholder (in production, fetch real user email)
                    const userEmail = connection.metadata?.['userEmail'] || `user+${userId.substring(0, 8)}@auto-invest-oracle.com`;
                    
                    await sendExecutionEmail({
                      userId,
                      userEmail,
                      asset: params.to_currency || params.asset || 'BTC',
                      action: 'buy',
                      amount: parseFloat(amountEur),
                      currency: 'EUR',
                      orderId: orderId,
                      confidence: proposal.confidence || 50 // Use proposal confidence if available
                    });
                    console.log('[trading/proposals] Execution email sent for user:', userId);
                  } catch (emailErr) {
                    console.warn('[trading/proposals] Could not send execution email:', emailErr);
                    // Non-critical: don't fail the order
                  }
                })();
                
                return res.status(200).json({ 
                  success: true,
                  proposal, 
                  orderDetails: orderData,
                  message: `BTC order placed: ${orderId}`
                });
              } else {
                console.error('[trading/proposals] Order placement failed - no order ID in response:', JSON.stringify(orderData));
                proposal.status = 'failed';
                await kv.set(proposalKey, proposal);
                return res.status(500).json({ error: 'Order kon niet geplaatst worden - geen order ID in response' });
              }
            } else if (action.type === 'sell' || action.type === 'SELL') {
              // Sell order - note: for sell orders, amount is typically in base currency (BTC qty), 
              // but for market orders we might need amountQuote (EUR). Using amount as fallback.
              const asset = params.asset || 'BTC';
              const amountQuote = params.amountQuote || params.amount || '10'; // EUR amount or fallback
              const market = `${asset}-EUR`;
              
              console.log('[trading/proposals] Sell order params:', {
                asset,
                amountQuote,
                market,
                paramsReceived: params
              });
              
              const orderData = await executeBitvavoOrder(market, 'sell', amountQuote);
              
              console.log('[trading/proposals] Bitvavo sell order response:', orderData);
              
              if (orderData && (orderData.orderId || orderData.id)) {
                const orderId = orderData.orderId || orderData.id;
                console.log('[trading/proposals] ✅ Sell order placed:', orderId);
                proposal.status = 'executed';
                proposal.executedAt = new Date().toISOString();
                (proposal as any).orderId = orderId;
                await kv.set(proposalKey, proposal);
                
                // Log execution ticket for user notification (disabled - function removed)
                // try {
                //   const { logExecutionTicket } = await import('../src/lib/observation/logger');
                // } catch (ticketErr) {
                //   console.warn('[trading/proposals] Could not log execution ticket:', ticketErr);
                // }
                
                // Optionally send email notification (async, fire-and-forget)
                (async () => {
                  try {
                    const { sendExecutionEmail, isEmailNotificationEnabled } = await import('../src/lib/notifications/emailService');
                    
                    const emailEnabled = await isEmailNotificationEnabled(userId, 'execution');
                    if (!emailEnabled) {
                      console.log('[trading/proposals] Email notifications disabled for user:', userId);
                      return;
                    }
                    
                    const userEmail = connection.metadata?.['userEmail'] || `user+${userId.substring(0, 8)}@auto-invest-oracle.com`;
                    
                    await sendExecutionEmail({
                      userId,
                      userEmail,
                      asset: params.asset || 'BTC',
                      action: 'sell',
                      amount: parseFloat(amountQuote),
                      currency: 'EUR',
                      orderId: orderId,
                      confidence: proposal.confidence || 50 // Use proposal confidence if available
                    });
                    console.log('[trading/proposals] Execution email sent for user:', userId);
                  } catch (emailErr) {
                    console.warn('[trading/proposals] Could not send execution email:', emailErr);
                  }
                })();
                
                return res.status(200).json({ 
                  success: true,
                  proposal, 
                  orderDetails: orderData,
                  message: `Sell order placed: ${orderId}`
                });
              } else {
                console.error('[trading/proposals] Sell order placement failed - no order ID in response:', JSON.stringify(orderData));
                proposal.status = 'failed';
                await kv.set(proposalKey, proposal);
                return res.status(500).json({ error: 'Verkooporder kon niet geplaatst worden - geen order ID in response' });
              }
            } else {
              // Unknown action type
              console.warn('[trading/proposals] Unknown action type:', action.type);
              proposal.status = 'failed';
              await kv.set(proposalKey, proposal);
              return res.status(400).json({ error: `Onbekend actietype: ${action.type}` });
            }
          } catch (execErr) {
            console.error('[trading/proposals] Execution error:', execErr);
            proposal.status = 'failed';
            await kv.set(proposalKey, proposal);
            return res.status(500).json({ error: `Executie mislukt: ${execErr}` });
          }
        }
        
        res.status(200).json({ proposal });
      } catch (err) {
        console.error('[trading/proposals POST] Error:', err);
        res.status(500).json({ error: 'Kon proposal niet verwerken.' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
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
  insights: async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const payload = (req.body || {}) as InsightInput;
      console.log('[insights] Received input:', JSON.stringify(payload, null, 2));
      const insights = await generateInsights(payload);
      console.log('[insights] Generated insights');
      res.status(200).json({ insights, createdAt: new Date().toISOString() });
    } catch (err) {
      console.error('[insights] Error:', err);
      const payload = (req.body || {}) as InsightInput;
      const fallback = fallbackInsights(payload);
      console.log('[insights] Using fallback');
      res.status(200).json({ insights: fallback, createdAt: new Date().toISOString() });
    }
  },
  'exchanges/connect': async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const { userId: bodyUserId, exchange, method, credentials, scopes = [], apiMode = 'readonly' } =
        (req.body || {}) as {
          userId?: string;
          exchange: ExchangeId;
          method: AuthMethod;
          credentials: ExchangeCredentials;
          scopes?: string[];
          apiMode?: 'readonly' | 'trading';
        };
      const userId = bodyUserId || getSessionUserId(req);
      if (!userId || !exchange || !method || !credentials) {
        res.status(400).json({ error: 'userId, exchange, method en credentials zijn verplicht.' });
        return;
      }
      const connector = createConnector(exchange);
      console.log('[exchanges/connect] Testing', exchange, 'with credentials:', {
        exchange,
        apiMode,
        hasApiKey: !!(credentials as any)?.apiKey,
        hasApiSecret: !!(credentials as any)?.apiSecret
      });
      const result = await connector.connect(credentials);
      console.log('[exchanges/connect] Result:', result);
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
        status: 'connected',
        metadata: {
          agentMode: apiMode,
          apiMode: apiMode  // ← Store both ways for compatibility
        }
      };
      const storage = getStorageAdapter();
      await storage.saveConnection(userId, connection);
      
      // Save default agent settings for this exchange
      const defaultSettings = {
        exchange,
        apiMode,
        enabled: true,
        monitoringInterval: 5,
        alertOnVolatility: false,
        volatilityThreshold: 5,
        analysisDepth: 'basic',
        autoTrade: apiMode === 'trading',
        riskPerTrade: 2,
        maxDailyLoss: 5,
        confidenceThreshold: 70,
        orderLimit: 100,
        tradingStrategy: 'balanced',
        enableStopLoss: false,
        stopLossPercent: 5
      };
      const settingsKey = `user:${userId}:agent:${exchange}:settings`;
      await kv.set(settingsKey, defaultSettings);
      
      res.status(200).json({ ok: true, connection });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[exchanges/connect] Error:', {
        error: errorMsg,
        stack: err instanceof Error ? err.stack : undefined
      });
      res.status(500).json({ error: `Kon verbinding niet opslaan: ${errorMsg}` });
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
  'exchanges/balances': async (req, res) => {
    if (req.method && req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const userId = (req.query?.userId as string) || getSessionUserId(req);
      console.log('[exchanges/balances] REQUEST START', {
        userId,
        hasQuery: !!req.query?.userId,
        hasSession: !!getSessionUserId(req),
        timestamp: new Date().toISOString()
      });
      
      if (!userId) {
        res.status(400).json({ error: 'userId is verplicht.' });
        return;
      }
      const storage = getStorageAdapter();
      const connections = await storage.listConnections(userId);
      console.log('[exchanges/balances] Found', connections.length, 'connections for user');
      
      const allBalances: Array<Balance & { exchange: string }> = [];
      const totalValue = { btc: 0, eur: 0 };

      console.log('[exchanges/balances] Fetching for user:', userId, 'connections:', connections.length);

      for (const connection of connections) {
        if (connection.status !== 'connected') {
          console.log(`[exchanges/balances] Skipping ${connection.exchange}: status=${connection.status}`);
          continue;
        }
        
        try {
          console.log(`[exchanges/balances] Fetching from ${connection.exchange}...`);
          console.log(`[exchanges/balances] Connection details:`, {
            exchange: connection.exchange,
            status: connection.status,
            encryptedSecretsLength: connection.encryptedSecrets?.length || 0,
            accountId: (connection as any).accountId
          });
          
          const connector = createConnector(connection.exchange as ExchangeId);
          const creds = decryptSecrets(connection.encryptedSecrets) as any;
          console.log(`[exchanges/balances] Decrypted credentials:`, {
            hasApiKey: !!creds?.apiKey,
            apiKeyLength: creds?.apiKey?.length || 0,
            hasApiSecret: !!creds?.apiSecret,
            allCredsKeys: Object.keys(creds || {})
          });
          connector.setCredentials(creds);
          
          const balances = await connector.fetchBalances();
          console.log(`[exchanges/balances] Got ${balances.length} balances from ${connection.exchange}:`, {
            assets: balances.map(b => `${b.asset}:${b.total}:€${b.estimatedValue}`)
          });
          
          allBalances.push(
            ...balances.map((b) => ({
              ...b,
              userId,
              exchange: connection.exchange
            }))
          );
        } catch (err) {
          console.error(`[exchanges/balances] Error fetching ${connection.exchange}:`, err);
        }
      }

      console.log('[exchanges/balances] Returning total', allBalances.length, 'balances:', {
        byExchange: allBalances.reduce((acc, b) => {
          acc[b.exchange] = (acc[b.exchange] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      res.status(200).json({ balances: allBalances });
    } catch (err) {
      console.error('[exchanges/balances] Error:', err);
      res.status(500).json({ error: 'Kon balances niet ophalen.' });
    }
  },

  'exchanges/performance': async (req, res) => {
    if (req.method && req.method !== 'GET') {
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
      
      // Fetch balances from all connected exchanges
      const allBalances: Balance[] = [];
      for (const connection of connections) {
        if (connection.status !== 'connected') continue;
        try {
          const connector = createConnector(connection.exchange);
          const creds = decryptSecrets(connection.encryptedSecrets);
          connector.setCredentials({ apiKey: creds.apiKey, apiSecret: creds.apiSecret });
          const balances = await connector.fetchBalances();
          // Filter out stablecoins/EUR - they're not crypto assets
          const cryptoBalances = balances.filter(b => !['EUR', 'USDT', 'USDC', 'EURC'].includes(b.asset));
          allBalances.push(
            ...cryptoBalances.map((b) => ({
              ...b,
              userId,
              exchange: connection.exchange
            }))
          );
        } catch (err) {
          console.error(`[exchanges/performance] Error fetching from ${connection.exchange}:`, err);
        }
      }
      
      // Get snapshots from KV storage
      const allSnapshots: Array<PriceSnapshot & { change24h?: number }> = [];
      
      // Calculate performance per asset
      const performanceMap = new Map<string, PerformanceMetrics>();
      
      for (const balance of allBalances) {
        const key = `${balance.exchange}:${balance.asset}`;
        
        // Get previous snapshot (24h ago)
        const snapshotKey = `snapshot:${userId}:${key}`;
        const currentSnap: PriceSnapshot = {
          asset: balance.asset,
          exchange: balance.exchange,
          quantity: balance.total,
          estimatedValue: balance.total, // Placeholder
          timestamp: new Date().toISOString()
        };
        
        // For now, store current snapshot in KV
        try {
          if (kv) {
            await kv.set(snapshotKey, currentSnap, { ex: 86400 }); // 24h expiry
          }
        } catch (err) {
          console.error('[exchanges/performance] KV snapshot save failed:', err);
        }

        const previousSnapStr = kv ? await kv.get(`${snapshotKey}:previous`) : null;
        const previousSnap = previousSnapStr ? (previousSnapStr as PriceSnapshot) : null;

        if (previousSnap) {
          const change = currentSnap.quantity - previousSnap.quantity;
          const changePercent = previousSnap.quantity > 0 ? (change / previousSnap.quantity) * 100 : 0;
          
          performanceMap.set(key, {
            asset: balance.asset,
            exchange: balance.exchange,
            currentQuantity: currentSnap.quantity,
            previousQuantity: previousSnap.quantity,
            quantityChange: change,
            quantityChangePercent: changePercent,
            periodStart: previousSnap.timestamp,
            periodEnd: currentSnap.timestamp
          });
        }

        allSnapshots.push({
          ...currentSnap,
          change24h: performanceMap.get(key)?.quantityChangePercent
        });
      }

      res.status(200).json({
        snapshots: allSnapshots,
        performance: Array.from(performanceMap.values())
      });
    } catch (err) {
      console.error('[exchanges/performance] Error:', err);
      res.status(200).json({ snapshots: [], performance: [] });
    }
  },
  'exchanges/assets': async (req, res) => {
    if (req.method && req.method !== 'GET') {
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
      
      const assetsByExchange: Record<string, Array<{ symbol: string; name?: string }>> = {};
      const assetSummary: Record<string, { count: number; platforms: string[] }> = {};

      console.log('[exchanges/assets] Fetching available assets for user:', userId);

      for (const connection of connections) {
        if (connection.status !== 'connected') {
          console.log(`[exchanges/assets] Skipping ${connection.exchange}: status=${connection.status}`);
          continue;
        }
        
        try {
          console.log(`[exchanges/assets] Fetching from ${connection.exchange}...`);
          const connector = createConnector(connection.exchange);
          const assets = await connector.fetchAvailableAssets();
          assetsByExchange[connection.exchange] = assets;
          
          // Track which platforms support each asset
          assets.forEach((asset) => {
            if (!assetSummary[asset.symbol]) {
              assetSummary[asset.symbol] = { count: 0, platforms: [] };
            }
            assetSummary[asset.symbol].count += 1;
            assetSummary[asset.symbol].platforms.push(connection.exchange);
          });
          
          console.log(`[exchanges/assets] ${connection.exchange}: Found ${assets.length} assets`, {
            all: assets.map(a => a.symbol)
          });
        } catch (err) {
          console.error(`[exchanges/assets] Error fetching ${connection.exchange}:`, err);
          assetsByExchange[connection.exchange] = [];
        }
      }

      console.log('[exchanges/assets] Final summary:', {
        platforms: Object.keys(assetsByExchange),
        totalUniqueAssets: Object.keys(assetSummary).length,
        sample: Object.keys(assetSummary).slice(0, 10)
      });

      res.status(200).json({ 
        assetsByExchange,
        assetSummary: Object.entries(assetSummary)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 100)
          .reduce((acc, [symbol, data]) => {
            acc[symbol] = data;
            return acc;
          }, {} as Record<string, { count: number; platforms: string[] }>)
      });
    } catch (err) {
      console.error('[exchanges/assets] Error:', err);
      res.status(500).json({ error: 'Kon assets niet ophalen.' });
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
  'agent/status': async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Geen sessie.' });
        return;
      }
      
      const storage = getStorageAdapter();
      const connections = await storage.listConnections(userId);
      const connectedExchanges = connections.filter(c => c.status === 'connected');
      
      const agents = await Promise.all(
        connectedExchanges.map(async (conn) => {
          // Read actual settings from KV, not metadata
          const settings = (await kv.get(`user:${userId}:agent:${conn.exchange}:settings`)) as any;
          
          // Determine status based on actual settings
          let status: 'idle' | 'monitoring' | 'analyzing' | 'trading' | 'error' = 'idle';
          if (settings?.enabled) {
            if (settings?.autoTrade) {
              status = 'trading';
            } else if (settings?.monitoringInterval) {
              status = 'monitoring';
            }
          }
          
          return {
            exchange: conn.exchange,
            mode: (conn.metadata?.['agentMode'] || 'readonly') as 'readonly' | 'trading',
            enabled: settings?.enabled ?? false,
            status,
            lastActivity: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            nextAction: status === 'trading' 
              ? `Next trade check in ${settings?.confidenceThreshold}% confidence` 
              : status === 'monitoring'
              ? `Next scan in ${settings?.monitoringInterval || 5} min`
              : 'Waiting...',
            errorMessage: undefined
          };
        })
      );
      
      res.status(200).json({ agents });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon agent status niet ophalen.' });
    }
  },
  'agent/activity': async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Geen sessie.' });
        return;
      }
      
      const typeFilter = (req.query?.type as string) || '';
      const exchangeFilter = (req.query?.exchange as string) || 'bitvavo';
      
      // Get real agent execution history
      let activities = await getAgentHistory(userId, exchangeFilter, 24);
      
      // If no real data, create demo logs and save them
      if (activities.length === 0) {
        const demoLogs: AgentExecutionLog[] = [
          {
            id: crypto.randomUUID(),
            userId,
            exchange: exchangeFilter,
            type: 'monitoring',
            status: 'success',
            title: 'Monitoring aktief',
            description: 'Agent scant markt op volatiiliteit',
            details: { volatility: 2.3, priceChange: '-0.5%' },
            timestamp: new Date(Date.now() - 300000).toISOString(),
            duration: 1000
          },
          {
            id: crypto.randomUUID(),
            userId,
            exchange: exchangeFilter,
            type: 'analysis',
            status: 'success',
            title: 'Technische analyse voltooid',
            description: 'BTC analyse: bearish signal',
            details: { symbol: 'BTC-EUR', signal: 'bearish', confidence: 65 },
            timestamp: new Date(Date.now() - 600000).toISOString(),
            duration: 1500
          },
          {
            id: crypto.randomUUID(),
            userId,
            exchange: exchangeFilter,
            type: 'alert',
            status: 'success',
            title: 'Volatiliteit alert',
            description: 'Volatiliteit overschrijdt drempel (5%)',
            details: { threshold: 5, current: 6.2 },
            timestamp: new Date(Date.now() - 900000).toISOString(),
            duration: 500
          }
        ];
        
        // Save demo logs to KV
        for (const log of demoLogs) {
          await logAgentExecution(log);
        }
        
        activities = demoLogs;
      }
      
      let filtered = activities;
      if (typeFilter && typeFilter !== 'all') {
        filtered = filtered.filter(a => a.type === typeFilter);
      }
      
      res.status(200).json({ activities: filtered });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon activiteiten niet ophalen.' });
    }
  },
  'agent/history': async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Geen sessie.' });
        return;
      }
      
      const exchange = (req.query?.exchange as string) || 'bitvavo';
      const hoursBack = parseInt((req.query?.hours as string) || '24', 10);
      const typeFilter = (req.query?.type as string) || '';
      const format = (req.query?.format as string) || 'json'; // json or text
      
      // Fetch agent execution history
      let logs = await getAgentHistory(userId, exchange, hoursBack);
      
      // Filter by type if specified
      if (typeFilter && typeFilter !== 'all') {
        logs = logs.filter(log => log.type === typeFilter);
      }
      
      // If format is 'download', return as file attachment
      if (format === 'download') {
        const filename = `agent-history-${exchange}-${new Date().toISOString().split('T')[0]}.json`;
        res.status(200).json({
          filename,
          metadata: {
            userId,
            exchange,
            hoursBack,
            typeFilter: typeFilter || 'all',
            exportedAt: new Date().toISOString(),
            totalLogs: logs.length
          },
          logs: logs
        });
        return;
      }
      
      // Default: return JSON response
      res.status(200).json({
        exchange,
        hoursBack,
        count: logs.length,
        logs: logs
      });
    } catch (err) {
      console.error('[agent/history] Error:', err);
      res.status(500).json({ error: 'Kon geschiedenis niet ophalen.' });
    }
  },
  'agent/state': async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Geen sessie.' });
        return;
      }
      
      const exchange = (req.query?.exchange as string) || 'bitvavo';
      
      // CHECK CACHE FIRST (10 sec TTL) - prevents rate limit explosion
      const cacheKey = `agent:state:${userId}:${exchange}`;
      const cached = await kv.get(cacheKey) as any;
      if (cached && Date.now() - cached.cachedAt < 10000) {
        res.status(200).json(cached.data);
        return;
      }
      
      const storage = getStorageAdapter();
      const connections = await storage.listConnections(userId);
      const connection = connections.find(c => c.exchange === exchange && c.status === 'connected');
      
      if (!connection) {
        res.status(404).json({ error: 'Exchange niet verbonden.' });
        return;
      }
      
      try {
        const connector = createConnector(exchange as ExchangeId);
        const creds = decryptSecrets(connection.encryptedSecrets) as any;
        connector.setCredentials(creds);
        
        const balances = await connector.fetchBalances();
        
        console.log('[/api/agent/state] Fetched balances:', {
          count: balances.length,
          all: balances.map(b => ({
            asset: b.asset,
            total: b.total,
            available: b.available
          }))
        });
        
        const settings = (await kv.get(`user:${userId}:agent:${exchange}:settings`)) as any;
        
        // Filter out stablecoins/EUR - they're cash, not assets
        const cryptoBalances = balances.filter(b => !['EUR', 'USDT', 'USDC', 'EURC'].includes(b.asset));
        
        // Calculate portfolio metrics (crypto only, not fiat)
        const totalValue = cryptoBalances.reduce((sum, b) => sum + (b.estimatedValue || 0), 0);
        const topAssets = cryptoBalances
          .sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0))
          .slice(0, 3);
        
        console.log('[/api/agent/state] Top assets:', {
          topAssets: topAssets.map(b => `${b.asset}:${b.total}`)
        });
        
        const state = {
          exchange,
          timestamp: new Date().toISOString(),
          portfolio: {
            totalAssets: cryptoBalances.length,
            totalValue,
            topAssets: topAssets.map(b => ({
              asset: b.asset,
              amount: b.total,
              available: b.available
            }))
          },
          settings: {
            apiMode: settings?.apiMode || 'readonly',
            enabled: settings?.enabled !== false,
            monitoringInterval: settings?.monitoringInterval || 5,
            autoTrade: settings?.autoTrade || false,
            riskPerTrade: settings?.riskPerTrade || 2
          },
          healthChecks: {
            dataFresh: true,
            connectionActive: true,
            lastSync: connection.lastSyncAt || new Date().toISOString()
          }
        };
        
        // CACHE RESULT (TTL 10 sec) - prevents rate limit explosion
        await kv.setex(cacheKey, 10, JSON.stringify({
          data: state,
          cachedAt: Date.now()
        }));
        
        res.status(200).json(state);
      } catch (err) {
        console.error('[agent/state] Error fetching data:', err);
        res.status(500).json({ error: 'Kon portfolio state niet ophalen.' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon state niet ophalen.' });
    }
  },
  'agent/intent': async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Geen sessie.' });
        return;
      }
      
      const exchange = (req.query?.exchange as string) || 'bitvavo';
      
      // CHECK CACHE FIRST (15 sec TTL) - prevents rate limit explosion
      const cacheKey = `agent:intent:${userId}:${exchange}`;
      const cached = await kv.get(cacheKey) as any;
      if (cached && Date.now() - cached.cachedAt < 15000) {
        res.status(200).json(cached.data);
        return;
      }
      
      const settings = (await kv.get(`user:${userId}:agent:${exchange}:settings`)) as any;
      
      if (!settings) {
        res.status(404).json({ error: 'Settings niet gevonden.' });
        return;
      }
      
      // Calculate next check time based on hourly cron schedule
      // Portfolio check runs at minute 0 of each hour
      const now = new Date();
      const nextCheckTime = new Date(now);
      
      if (now.getMinutes() === 0 && now.getSeconds() < 10) {
        // If within first 10 seconds of hour, next check is in ~60 minutes
        nextCheckTime.setHours(nextCheckTime.getHours() + 1);
      } else if (now.getMinutes() === 0) {
        // Just missed the check, next one is in ~60 minutes
        nextCheckTime.setHours(nextCheckTime.getHours() + 1);
      } else {
        // Calculate minutes until next hour for user-facing display
        nextCheckTime.setHours(nextCheckTime.getHours() + 1);
        nextCheckTime.setMinutes(0);
        nextCheckTime.setSeconds(0);
      }
      
      // Calculate how many minutes until next check
      const minutesUntilNext = Math.round((nextCheckTime.getTime() - now.getTime()) / 60000);
      
      // READONLY ENFORCEMENT: Intent endpoint never modifies settings
      // Determine intent based on configuration (READ-ONLY)
      const intent = {
        exchange,
        timestamp: new Date().toISOString(),
        mode: settings.apiMode,
        enabled: settings.enabled !== false,
        nextAction: {
          type: settings.enabled !== false ? (settings.autoTrade ? 'prepare_trade' : 'monitor') : 'idle',
          description: 
            !settings.enabled ? 'Agent is uitgeschakeld' :
            settings.autoTrade ? 'Wacht op trading signaal met ' + settings.riskPerTrade + '% risico' :
            'Bewaakt portfolio (uurlijks)',
          reason: 
            !settings.enabled ? 'User heeft agent disabled' :
            settings.autoTrade ? 'Trading modus actief, criteria: ' + settings.tradingStrategy + ' strategie' :
            'Read-only modus: monitoring en alerts'
        },
        safetyLimits: {
          maxRiskPerTrade: settings.riskPerTrade || 2,
          maxDailyLoss: settings.maxDailyLoss || 5,
          confidenceThreshold: settings.confidenceThreshold || 70,
          enableStopLoss: settings.enableStopLoss || false
        },
        nextCheck: {
          in: minutesUntilNext,
          unit: minutesUntilNext === 1 ? 'minute' : 'minutes',
          estimatedTime: nextCheckTime.toISOString()
        }
      };
      
      // CACHE RESULT (TTL 15 sec) - prevents rate limit explosion  
      await kv.setex(cacheKey, 15, JSON.stringify({
        data: intent,
        cachedAt: Date.now()
      }));
      
      res.status(200).json(intent);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon intent niet ophalen.' });
    }
  },
  'agent/analyze': async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Geen sessie.' });
        return;
      }
      
      const { exchange, mode = 'observer' } = (req.body || {}) as {
        exchange?: string;
        mode?: 'observer' | 'planner_explainer' | 'config_chat';
      };
      
      if (!exchange) {
        res.status(400).json({ error: 'exchange is verplicht.' });
        return;
      }
      
      // Fetch current state and intent
      const storage = getStorageAdapter();
      const connections = await storage.listConnections(userId);
      const connection = connections.find(c => c.exchange === exchange && c.status === 'connected');
      
      if (!connection) {
        res.status(404).json({ error: 'Exchange niet verbonden.' });
        return;
      }
      
      try {
        const connector = createConnector(exchange as ExchangeId);
        const creds = decryptSecrets(connection.encryptedSecrets) as any;
        connector.setCredentials(creds);
        
        const balances = await connector.fetchBalances();
        const settings = (await kv.get(`user:${userId}:agent:${exchange}:settings`)) as any;
        
        // Generate AI analysis based on mode
        let analysis = '';
        
        if (mode === 'observer') {
          // OBSERVER MODE: What is the current situation?
          // SAFETY: Only safe normalized data, no raw exchange responses
          const totalValue = balances.reduce((sum, b) => sum + (b.total || 0), 0);
          const topAssets = balances
            .filter(b => b && b.asset && b.total)
            .sort((a, b) => (b.total || 0) - (a.total || 0))
            .slice(0, 1);
          const topAsset = topAssets.length > 0 ? topAssets[0] : null;
          const eurBalance = balances.find(b => b.asset === 'EUR');
          const availableCash = eurBalance?.available || 0;
          
          if (balances.length > 0 && totalValue > 0) {
            analysis = `Volgens je portfolio: je hebt ${balances.length} activa met totaalwaarde €${totalValue.toFixed(2)}. ` +
              (topAsset ? `Grootste positie: ${topAsset.asset} (€${(topAsset.total || 0).toFixed(2)}). ` : '') +
              `Je agent werkt in ${settings?.apiMode || 'monitoring'} modus.`;
          } else if (availableCash > 0) {
            analysis = `Je portfolio is leeg. Je hebt €${availableCash.toFixed(2)} beschikbaar saldo. ` +
              `${settings?.autoTrade ? 'Je agent wacht op trading signalen om dit in te zetten.' : 'Je agent observeert marktcondities.'}`;
          } else {
            analysis = `Je portfolio is leeg en je hebt geen beschikbaar saldo. ` +
              `Voeg eerst geld toe aan je account om te kunnen handelen.`;
          }
        } else if (mode === 'planner_explainer') {
          // PLANNER MODE: What will happen next and why?
          // SAFETY: Only explains existing settings, never suggests market actions
          if (!settings?.enabled) {
            analysis = `Volgens je huidige instellingen: je agent is uitgeschakeld. Je kunt dit aanpassen in Agent instellingen.`;
          } else {
            // Get available cash/EUR balance for recommendations
            const eurBalance = balances.find(b => b.asset === 'EUR');
            const availableCash = eurBalance?.available || 0;
            
            if (settings?.autoTrade) {
              analysis = `Volgens je huidige instellingen: je agent zal de volgende acties uitvoeren: ` +
                `Portfolio monitoren elk ${settings.monitoringInterval || 5} minuut. ` +
                `Bij geschikte marktcondities (gebaseerd op je regels): orders plaatsen met max ${settings.riskPerTrade || 2}% risico per trade. ` +
                `Voorzorgsmaatregel: stoppen bij ${settings.maxDailyLoss || 5}% dagelijks verlies. ` +
                (availableCash > 0 ? `Momenteel beschikbaar saldo: €${availableCash.toFixed(2)}. De agent zoekt naar trading signalen om dit in te zetten.` : `Geen beschikbaar saldo. Voeg geld toe om te beginnen met trading.`);
            } else {
              analysis = `Volgens je huidige instellingen: je agent werkt in monitoring modus. ` +
                `Het zal elk ${settings.monitoringInterval || 5} minuut je portfolio checken ` +
                `en alerts sturen als voorwaarden veranderen. Niets automatisch.`;
            }
          }
        } else if (mode === 'config_chat') {
          // CONFIG_CHAT MODE: Brief status for conversation starter
          // SAFETY: Never suggests market actions, only config changes  
          const modeLabel = settings?.apiMode === 'trading' ? 'volledig (trading)' : 'observatie (monitoring)';
          const tradeStatus = settings?.autoTrade ? 'Auto-trading is aan.' : 'Enkel monitoring.';
          analysis = `Volgens je huidige instellingen: je agent werkt in ${modeLabel} modus. ${tradeStatus} Wat wil je aanpassen?`;
        }
        
        res.status(200).json({
          mode,
          exchange,
          analysis,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('[agent/analyze] Error:', err);
        res.status(500).json({ error: 'Kon analyse niet genereren.' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kon analyse niet uitvoeren.' });
    }
  },
  'agent/settings': async (req, res) => {
    if (req.method === 'GET') {
      // GET - Retrieve current settings from Supabase
      try {
        const userId = getSessionUserId(req);
        if (!userId) {
          res.status(401).json({ error: 'Geen sessie.' });
          return;
        }
        
        const supabase = getSupabaseClient();
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(
            'agent_monitoring_interval,' +
            'agent_alert_on_volatility,' +
            'agent_volatility_threshold,' +
            'agent_analysis_depth,' +
            'agent_auto_trade,' +
            'agent_risk_per_trade,' +
            'agent_max_daily_loss,' +
            'agent_confidence_threshold,' +
            'agent_order_limit,' +
            'agent_trading_strategy,' +
            'agent_enable_stop_loss,' +
            'agent_stop_loss_percent'
          )
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        // Build settings object from profile or defaults
        const profileData = (profile && typeof profile === 'object') ? (profile as any) : {};
        const settings = {
          exchange: 'bitvavo',
          apiMode: 'readonly',
          enabled: true,
          monitoringInterval: profileData?.agent_monitoring_interval ?? 60,
          alertOnVolatility: profileData?.agent_alert_on_volatility ?? false,
          volatilityThreshold: profileData?.agent_volatility_threshold ?? 5,
          analysisDepth: profileData?.agent_analysis_depth ?? 'basic',
          autoTrade: profileData?.agent_auto_trade ?? false,
          riskPerTrade: profileData?.agent_risk_per_trade ?? 2,
          maxDailyLoss: profileData?.agent_max_daily_loss ?? 5,
          confidenceThreshold: profileData?.agent_confidence_threshold ?? 70,
          orderLimit: profileData?.agent_order_limit ?? 100,
          tradingStrategy: profileData?.agent_trading_strategy ?? 'balanced',
          enableStopLoss: profileData?.agent_enable_stop_loss ?? false,
          stopLossPercent: profileData?.agent_stop_loss_percent ?? 5
        };
        
        console.log('[agent/settings GET] Retrieved settings for user', userId, 'interval:', settings.monitoringInterval);
        res.status(200).json({ settings });
      } catch (err) {
        console.error('[agent/settings GET] Error:', err);
        res.status(500).json({ error: 'Kon instellingen niet ophalen.' });
      }
    } else if (req.method === 'POST') {
      // POST - Update settings in Supabase
      try {
        const userId = getSessionUserId(req);
        if (!userId) {
          res.status(401).json({ error: 'Geen sessie.' });
          return;
        }
        
        const supabase = getSupabaseClient();
        const updates = req.body || {};
        
        console.log('[agent/settings POST] Updating settings for user', userId, 'updates:', Object.keys(updates));
        
        // Map frontend field names to database column names
        const dbUpdates: Record<string, any> = {
          agent_settings_updated_at: new Date().toISOString()
        };
        
        if (updates.monitoringInterval !== undefined) {
          dbUpdates.agent_monitoring_interval = Math.max(1, Math.min(1440, updates.monitoringInterval));
        }
        if (updates.alertOnVolatility !== undefined) {
          dbUpdates.agent_alert_on_volatility = updates.alertOnVolatility;
        }
        if (updates.volatilityThreshold !== undefined) {
          dbUpdates.agent_volatility_threshold = updates.volatilityThreshold;
        }
        if (updates.analysisDepth !== undefined) {
          dbUpdates.agent_analysis_depth = updates.analysisDepth;
        }
        if (updates.autoTrade !== undefined) {
          dbUpdates.agent_auto_trade = updates.autoTrade;
        }
        if (updates.riskPerTrade !== undefined) {
          dbUpdates.agent_risk_per_trade = updates.riskPerTrade;
        }
        if (updates.maxDailyLoss !== undefined) {
          dbUpdates.agent_max_daily_loss = updates.maxDailyLoss;
        }
        if (updates.confidenceThreshold !== undefined) {
          dbUpdates.agent_confidence_threshold = updates.confidenceThreshold;
        }
        if (updates.orderLimit !== undefined) {
          dbUpdates.agent_order_limit = updates.orderLimit;
        }
        if (updates.tradingStrategy !== undefined) {
          dbUpdates.agent_trading_strategy = updates.tradingStrategy;
        }
        if (updates.enableStopLoss !== undefined) {
          dbUpdates.agent_enable_stop_loss = updates.enableStopLoss;
        }
        if (updates.stopLossPercent !== undefined) {
          dbUpdates.agent_stop_loss_percent = updates.stopLossPercent;
        }

        // Update profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('user_id', userId);

        if (updateError) {
          throw updateError;
        }

        // Fetch updated profile to return
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select(
            'agent_monitoring_interval,' +
            'agent_alert_on_volatility,' +
            'agent_volatility_threshold,' +
            'agent_analysis_depth,' +
            'agent_auto_trade,' +
            'agent_risk_per_trade,' +
            'agent_max_daily_loss,' +
            'agent_confidence_threshold,' +
            'agent_order_limit,' +
            'agent_trading_strategy,' +
            'agent_enable_stop_loss,' +
            'agent_stop_loss_percent'
          )
          .eq('user_id', userId)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        const profileData = (profile && typeof profile === 'object') ? (profile as any) : {};
        const settings = {
          exchange: 'bitvavo',
          apiMode: 'readonly',
          enabled: true,
          monitoringInterval: profileData?.agent_monitoring_interval ?? 60,
          alertOnVolatility: profileData?.agent_alert_on_volatility ?? false,
          volatilityThreshold: profileData?.agent_volatility_threshold ?? 5,
          analysisDepth: profileData?.agent_analysis_depth ?? 'basic',
          autoTrade: profileData?.agent_auto_trade ?? false,
          riskPerTrade: profileData?.agent_risk_per_trade ?? 2,
          maxDailyLoss: profileData?.agent_max_daily_loss ?? 5,
          confidenceThreshold: profileData?.agent_confidence_threshold ?? 70,
          orderLimit: profileData?.agent_order_limit ?? 100,
          tradingStrategy: profileData?.agent_trading_strategy ?? 'balanced',
          enableStopLoss: profileData?.agent_enable_stop_loss ?? false,
          stopLossPercent: profileData?.agent_stop_loss_percent ?? 5
        };

        console.log('[agent/settings POST] Saved settings for user', userId, 'new interval:', settings.monitoringInterval);
        res.status(200).json({ settings });
      } catch (err) {
        console.error('[agent/settings POST] Error:', err);
        console.error('[agent/settings POST] Error details:', {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined
        });
        res.status(500).json({ error: 'Kon instellingen niet opslaan.' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
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
      const client = getSupabaseClient();
      const { data: completed } = await client
        .from('academy_module_progress')
        .select('module_id')
        .eq('user_id', userId)
        .not('completed_at', 'is', null);

      const { data: badges } = await client
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

      const client = getSupabaseClient();
      const { error: completeError } = await client
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

      const { data: completed } = await client
        .from('academy_module_progress')
        .select('module_id')
        .eq('user_id', userId)
        .not('completed_at', 'is', null);

      const { data: badges } = await client
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

// Push notification endpoints
const pushRoutes = {
  'push/subscribe': async (req: any, res: any) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const { userId, subscription } = req.body;
      if (!userId || !subscription) {
        return res.status(400).json({ error: 'Missing userId or subscription' });
      }
      
      // Save subscription in Supabase
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL || '',
        process.env.VITE_SUPABASE_ANON_KEY || ''
      );
      
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subscription.endpoint,
          auth_key: subscription.keys?.auth,
          p256dh_key: subscription.keys?.p256dh,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('[Push] DB error:', error);
        return res.status(500).json({ error: 'Failed to save subscription' });
      }

      console.log('[Push] Subscription saved for user:', userId);
      res.status(200).json({ message: 'Subscribed successfully' });
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      res.status(500).json({ error: 'Subscription failed' });
    }
  },

  'push/unsubscribe': async (req: any, res: any) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      const supabase = createClient(
        process.env.VITE_SUPABASE_URL || '',
        process.env.VITE_SUPABASE_ANON_KEY || ''
      );

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('[Push] DB error:', error);
        return res.status(500).json({ error: 'Failed to delete subscription' });
      }

      console.log('[Push] Unsubscribed user:', userId);
      res.status(200).json({ message: 'Unsubscribed successfully' });
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
      res.status(500).json({ error: 'Unsubscription failed' });
    }
  },

  'push/status': async (req: any, res: any) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const userId = req.query.userId;
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      const supabase = createClient(
        process.env.VITE_SUPABASE_URL || '',
        process.env.VITE_SUPABASE_ANON_KEY || ''
      );

      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('user_id, created_at, updated_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        return res.status(200).json({ subscribed: false });
      }

      res.status(200).json({
        subscribed: !!data,
        createdAt: data?.created_at,
        updatedAt: data?.updated_at
      });
    } catch (err) {
      console.error('[Push] Status error:', err);
      res.status(500).json({ error: 'Status check failed' });
    }
  }
};

// Cron job endpoints
const cronRoutes = {
  'cron/portfolio-check': async (req: any, res: any) => {
    // Verify cron secret
    const secret = req.headers?.['x-vercel-cron-secret'] || req.body?.secret;
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret || secret !== expectedSecret) {
      console.warn('[cron] Unauthorized cron request - invalid or missing secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      console.log('[cron] Portfolio check running...');
      
      // For now, just return success
      // The actual implementation should:
      // 1. Fetch all active users with agent_status = 'running'
      // 2. For each user, check their portfolio
      // 3. Send notifications if configured
      // 4. Generate agent reports
      
      res.status(200).json({ 
        ok: true, 
        message: 'Portfolio check completed',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[cron] Portfolio check error:', err);
      res.status(500).json({ error: 'Portfolio check failed' });
    }
  },

  'cron/daily-scan': async (req: any, res: any) => {
    // Verify cron secret
    const secret = req.headers?.['x-vercel-cron-secret'] || req.body?.secret;
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret || secret !== expectedSecret) {
      console.warn('[cron] Unauthorized cron request - invalid or missing secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      console.log('[cron] Daily scan running...');
      
      // For now, just return success
      // The actual implementation should:
      // 1. Scan market data
      // 2. Generate daily reports
      // 3. Update cache
      
      res.status(200).json({ 
        ok: true, 
        message: 'Daily scan completed',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[cron] Daily scan error:', err);
      res.status(500).json({ error: 'Daily scan failed' });
    }
  },

  'cron/market-data-cache': async (req: any, res: any) => {
    // Verify cron secret
    const secret = req.headers?.['x-vercel-cron-secret'] || req.body?.secret;
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret || secret !== expectedSecret) {
      console.warn('[cron] Unauthorized cron request - invalid or missing secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      console.log('[cron] Market data cache update running...');
      
      // For now, just return success
      // The actual implementation should:
      // 1. Fetch latest market data
      // 2. Update cache with new prices
      // 3. Run every 30 minutes
      
      res.status(200).json({ 
        ok: true, 
        message: 'Market data cache updated',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[cron] Market data cache error:', err);
      res.status(500).json({ error: 'Market data cache update failed' });
    }
  }
};

// Merge cron and push routes into main routes
Object.assign(routes, cronRoutes);
Object.assign(routes, pushRoutes);

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
