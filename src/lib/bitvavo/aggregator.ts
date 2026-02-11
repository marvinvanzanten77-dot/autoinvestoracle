/**
 * BITVAVO DATA AGGREGATOR
 * Comprehensive data fetching and caching system
 * 
 * Combines:
 * - REST API for state queries (bootstrap)
 * - WebSocket for real-time updates
 * - Intelligent caching and rate limiting
 */

import { BitvavaWebSocket, TickerUpdate, OrderBookUpdate, AccountUpdate } from './websocket';
import { BITVAVO_REST_CONFIG, BITVAVO_PUBLIC_ENDPOINTS, BITVAVO_PRIVATE_ENDPOINTS } from './API_REFERENCE';

export interface AggregatedData {
  balance: BalanceData[];
  markets: MarketData[];
  tickers: Map<string, TickerData>;
  orderBooks: Map<string, OrderBookData>;
  openOrders: OrderData[];
  trades: TradeData[];
  deposits: TransactionData[];
  withdrawals: TransactionData[];
  lastUpdated: {
    balance: number;
    markets: number;
    tickers: Record<string, number>;
    orders: number;
  };
}

export interface BalanceData {
  symbol: string;
  available: number;
  inOrder: number;
  totalAmount: number;
  priceEUR?: number;
  estimatedValueEUR?: number;
}

export interface MarketData {
  market: string;
  base: string;
  quote: string;
  status: 'trading' | 'halted';
  minOrderSize: number;
  maxOrderSize: number;
  maker: number;
  taker: number;
  canDeposit: boolean;
  canWithdraw: boolean;
}

export interface TickerData {
  market: string;
  price: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export interface OrderBookData {
  market: string;
  bids: Array<{ price: number; amount: number }>;
  asks: Array<{ price: number; amount: number }>;
  timestamp: number;
}

export interface OrderData {
  orderId: string;
  market: string;
  created: number;
  amount: number;
  amountRemaining: number;
  price: number;
  filledAmount: number;
  filledCost: number;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  status: string;
}

export interface TradeData {
  id: string;
  orderId: string;
  market: string;
  amount: number;
  price: number;
  side: 'buy' | 'sell';
  fee: number;
  feeCurrency: string;
  timestamp: number;
}

export interface TransactionData {
  id: string;
  symbol: string;
  amount: number;
  status: string;
  timestamp: number;
  address?: string;
  txHash?: string;
}

export class BitvavaDataAggregator {
  private ws: BitvavaWebSocket;
  private data: AggregatedData;
  private apiKey: string;
  private apiSecret: string;
  private makeRequest: (method: string, path: string, body?: any) => Promise<any>;

  // Cache TTLs (milliseconds)
  private CACHE_TTL = {
    BALANCE: 5 * 60 * 1000,        // 5 minutes
    MARKETS: 60 * 60 * 1000,       // 1 hour (metadata stable)
    ORDERS: 10 * 1000,             // 10 seconds (frequent changes)
    TRADES: 30 * 60 * 1000,        // 30 minutes
    TRANSACTIONS: 60 * 60 * 1000,  // 1 hour
  };

  constructor(
    apiKey: string,
    apiSecret: string,
    makeRequest: (method: string, path: string, body?: any) => Promise<any>
  ) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.makeRequest = makeRequest;
    this.ws = new BitvavaWebSocket(apiKey, apiSecret);

    this.data = {
      balance: [],
      markets: [],
      tickers: new Map(),
      orderBooks: new Map(),
      openOrders: [],
      trades: [],
      deposits: [],
      withdrawals: [],
      lastUpdated: {
        balance: 0,
        markets: 0,
        tickers: {},
        orders: 0,
      },
    };
  }

  /**
   * Initialize aggregator with WebSocket connection and initial data
   */
  async initialize(): Promise<void> {
    console.log('[BitvavaDataAggregator] Initializing...');

    try {
      // Connect WebSocket for realtime updates
      await this.ws.connect();
      this.setupWebSocketCallbacks();

      // Bootstrap with REST API calls
      await Promise.all([
        this.fetchAndCacheBalance(),
        this.fetchAndCacheMarkets(),
        this.fetchAndCacheOpenOrders(),
        this.fetchAndCacheTrades(),
      ]);

      console.log('[BitvavaDataAggregator] Initialization complete');
    } catch (err) {
      console.error('[BitvavaDataAggregator] Initialization error:', err);
      throw err;
    }
  }

  /**
   * Setup WebSocket callbacks for realtime updates
   */
  private setupWebSocketCallbacks(): void {
    // Subscribe to account updates
    this.ws.subscribeAccount((update: AccountUpdate) => {
      console.log('[BitvavaDataAggregator] Account update:', update.event);

      if (update.event === 'order') {
        // Re-fetch orders when new order event
        this.fetchAndCacheOpenOrders().catch(err =>
          console.error('[BitvavaDataAggregator] Error fetching orders:', err)
        );
      }

      if (update.event === 'balanceUpdate') {
        // Re-fetch balance on account changes
        this.fetchAndCacheBalance().catch(err =>
          console.error('[BitvavaDataAggregator] Error fetching balance:', err)
        );
      }
    });

    // Subscribe to ticker for main trading pairs
    const mainPairs = ['BTC-EUR', 'ETH-EUR', 'SOL-EUR', 'USDT-EUR'];
    for (const market of mainPairs) {
      this.ws.subscribeTicker(market, (update: TickerUpdate) => {
        this.data.tickers.set(update.market, {
          market: update.market,
          price: update.price,
          bid: update.bid,
          ask: update.ask,
          high24h: update.high24h,
          low24h: update.low24h,
          volume24h: update.volume24h,
          timestamp: update.timestamp,
        });
        this.data.lastUpdated.tickers[update.market] = Date.now();
      });
    }
  }

  /**
   * Fetch and cache balance data
   */
  async fetchAndCacheBalance(): Promise<BalanceData[]> {
    const now = Date.now();
    if (now - this.data.lastUpdated.balance < this.CACHE_TTL.BALANCE) {
      console.log('[BitvavaDataAggregator] Using cached balance (fresh)');
      return this.data.balance;
    }

    try {
      console.log('[BitvavaDataAggregator] Fetching balance from API...');
      const response = await this.makeRequest('GET', '/balance');
      
      if (!Array.isArray(response)) {
        throw new Error('Invalid balance response format');
      }

      this.data.balance = response.map((bal: any) => ({
        symbol: bal.symbol,
        available: Number(bal.available || 0),
        inOrder: Number(bal.inOrder || bal.held || 0),
        totalAmount: Number(bal.totalAmount || bal.available || 0) + Number(bal.inOrder || bal.held || 0),
      }));

      this.data.lastUpdated.balance = now;

      // Enrich with prices from ticker data
      this.enrichBalanceWithPrices();

      console.log('[BitvavaDataAggregator] Balance fetched:', this.data.balance.length, 'assets');
      return this.data.balance;
    } catch (err) {
      console.error('[BitvavaDataAggregator] Balance fetch error:', err);
      return this.data.balance;
    }
  }

  /**
   * Enrich balance data with current prices
   */
  private enrichBalanceWithPrices(): void {
    for (const balance of this.data.balance) {
      // Try EUR pair first
      const eurTicker = this.data.tickers.get(`${balance.symbol}-EUR`);
      if (eurTicker) {
        balance.priceEUR = eurTicker.price;
        balance.estimatedValueEUR = balance.totalAmount * eurTicker.price;
        continue;
      }

      // Try USDT pair and convert
      const usdtTicker = this.data.tickers.get(`${balance.symbol}-USDT`);
      const eurUsdtTicker = this.data.tickers.get('USDT-EUR');
      if (usdtTicker && eurUsdtTicker) {
        balance.priceEUR = usdtTicker.price * eurUsdtTicker.price;
        balance.estimatedValueEUR = balance.totalAmount * balance.priceEUR;
        continue;
      }

      // No price data
      balance.priceEUR = 0;
      balance.estimatedValueEUR = 0;
    }
  }

  /**
   * Fetch and cache market metadata
   */
  async fetchAndCacheMarkets(): Promise<MarketData[]> {
    const now = Date.now();
    if (now - this.data.lastUpdated.markets < this.CACHE_TTL.MARKETS) {
      console.log('[BitvavaDataAggregator] Using cached markets (fresh)');
      return this.data.markets;
    }

    try {
      console.log('[BitvavaDataAggregator] Fetching markets from API...');
      const response = await this.makeRequest('GET', '/markets');

      if (!Array.isArray(response)) {
        throw new Error('Invalid markets response format');
      }

      this.data.markets = response.map((market: any) => ({
        market: market.market,
        base: market.base,
        quote: market.quote,
        status: market.status,
        minOrderSize: Number(market.minOrderSize || 0),
        maxOrderSize: Number(market.maxOrderSize || 0),
        maker: Number(market.maker || 0),
        taker: Number(market.taker || 0),
        canDeposit: market.canDeposit,
        canWithdraw: market.canWithdraw,
      }));

      this.data.lastUpdated.markets = now;

      // Subscribe to ticker for all markets to get prices
      for (const market of this.data.markets) {
        this.ws.subscribeTicker(market.market, (update: TickerUpdate) => {
          this.data.tickers.set(update.market, {
            market: update.market,
            price: update.price,
            bid: update.bid,
            ask: update.ask,
            high24h: update.high24h,
            low24h: update.low24h,
            volume24h: update.volume24h,
            timestamp: update.timestamp,
          });
          this.data.lastUpdated.tickers[update.market] = Date.now();
        });
      }

      console.log('[BitvavaDataAggregator] Markets fetched:', this.data.markets.length, 'markets');
      return this.data.markets;
    } catch (err) {
      console.error('[BitvavaDataAggregator] Markets fetch error:', err);
      return this.data.markets;
    }
  }

  /**
   * Fetch and cache open orders
   */
  async fetchAndCacheOpenOrders(): Promise<OrderData[]> {
    const now = Date.now();
    if (now - this.data.lastUpdated.orders < this.CACHE_TTL.ORDERS) {
      console.log('[BitvavaDataAggregator] Using cached open orders (fresh)');
      return this.data.openOrders;
    }

    try {
      console.log('[BitvavaDataAggregator] Fetching open orders from API...');
      const response = await this.makeRequest('GET', '/openOrders');

      if (!Array.isArray(response)) {
        throw new Error('Invalid open orders response format');
      }

      this.data.openOrders = response.map((order: any) => ({
        orderId: order.orderId,
        market: order.market,
        created: order.created,
        amount: Number(order.amount || 0),
        amountRemaining: Number(order.amountRemaining || 0),
        price: Number(order.price || 0),
        filledAmount: Number(order.filledAmount || 0),
        filledCost: Number(order.filledCost || 0),
        side: order.side,
        orderType: order.orderType,
        status: order.status,
      }));

      this.data.lastUpdated.orders = now;

      console.log('[BitvavaDataAggregator] Open orders fetched:', this.data.openOrders.length);
      return this.data.openOrders;
    } catch (err) {
      console.error('[BitvavaDataAggregator] Open orders fetch error:', err);
      return this.data.openOrders;
    }
  }

  /**
   * Fetch and cache recent trades
   */
  async fetchAndCacheTrades(): Promise<TradeData[]> {
    const now = Date.now();
    // Note: We fetch trades less frequently since they're historical
    if (now - this.data.lastUpdated.orders < this.CACHE_TTL.TRADES) {
      console.log('[BitvavaDataAggregator] Using cached trades (fresh)');
      return this.data.trades;
    }

    try {
      console.log('[BitvavaDataAggregator] Fetching trades from API...');
      const response = await this.makeRequest('GET', '/trades');

      if (!Array.isArray(response)) {
        throw new Error('Invalid trades response format');
      }

      this.data.trades = response.map((trade: any) => ({
        id: trade.id,
        orderId: trade.orderId,
        market: trade.market,
        amount: Number(trade.amount || 0),
        price: Number(trade.price || 0),
        side: trade.side,
        fee: Number(trade.fee || 0),
        feeCurrency: trade.feeCurrency,
        timestamp: trade.timestamp,
      }));

      console.log('[BitvavaDataAggregator] Trades fetched:', this.data.trades.length);
      return this.data.trades;
    } catch (err) {
      console.error('[BitvavaDataAggregator] Trades fetch error:', err);
      return this.data.trades;
    }
  }

  /**
   * Fetch deposit history
   */
  async fetchDepositHistory(): Promise<TransactionData[]> {
    try {
      console.log('[BitvavaDataAggregator] Fetching deposit history...');
      const response = await this.makeRequest('GET', '/depositHistory');

      if (!Array.isArray(response)) {
        throw new Error('Invalid deposit history response format');
      }

      this.data.deposits = response.map((deposit: any) => ({
        id: deposit.id,
        symbol: deposit.symbol,
        amount: Number(deposit.amount || 0),
        status: deposit.status,
        timestamp: deposit.timestamp,
        address: deposit.address,
        txHash: deposit.txHash,
      }));

      console.log('[BitvavaDataAggregator] Deposits fetched:', this.data.deposits.length);
      return this.data.deposits;
    } catch (err) {
      console.error('[BitvavaDataAggregator] Deposit history error:', err);
      return this.data.deposits;
    }
  }

  /**
   * Fetch withdrawal history
   */
  async fetchWithdrawalHistory(): Promise<TransactionData[]> {
    try {
      console.log('[BitvavaDataAggregator] Fetching withdrawal history...');
      const response = await this.makeRequest('GET', '/withdrawalHistory');

      if (!Array.isArray(response)) {
        throw new Error('Invalid withdrawal history response format');
      }

      this.data.withdrawals = response.map((withdrawal: any) => ({
        id: withdrawal.id,
        symbol: withdrawal.symbol,
        amount: Number(withdrawal.amount || 0),
        status: withdrawal.status,
        timestamp: withdrawal.timestamp,
        address: withdrawal.address,
        txHash: withdrawal.txHash,
      }));

      console.log('[BitvavaDataAggregator] Withdrawals fetched:', this.data.withdrawals.length);
      return this.data.withdrawals;
    } catch (err) {
      console.error('[BitvavaDataAggregator] Withdrawal history error:', err);
      return this.data.withdrawals;
    }
  }

  /**
   * Get all aggregated data (read-only snapshot)
   */
  getAllData(): AggregatedData {
    return {
      ...this.data,
      tickers: new Map(this.data.tickers),
      orderBooks: new Map(this.data.orderBooks),
    };
  }

  /**
   * Get balance by symbol
   */
  getBalance(symbol: string): BalanceData | undefined {
    return this.data.balance.find(b => b.symbol === symbol);
  }

  /**
   * Get market by symbol pair
   */
  getMarket(market: string): MarketData | undefined {
    return this.data.markets.find(m => m.market === market);
  }

  /**
   * Get ticker price for market
   */
  getTicker(market: string): TickerData | undefined {
    return this.data.tickers.get(market);
  }

  /**
   * Get total portfolio value in EUR
   */
  getPortfolioValueEUR(): number {
    return this.data.balance.reduce((sum, bal) => sum + (bal.estimatedValueEUR || 0), 0);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.ws.disconnect();
  }

  /**
   * Register error callback
   */
  onError(callback: (error: Error) => void): void {
    this.ws.onError(callback);
  }
}
