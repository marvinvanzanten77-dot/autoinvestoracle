/**
 * BITVAVO READ-ONLY MODULE
 * 
 * Proposer/Scanner path: Can fetch market data, prices, but NOT place orders.
 * Enforces strict read-only access. Cannot access trading key secrets.
 * 
 * Used by: scanScheduler.ts, marketData handlers
 */

export type BitvavoReadonlyConfig = {
  apiKey: string;
  apiSecret: string;
  apiUrl?: string;
};

export type MarketCandle = {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

export type TickerData = {
  market: string;
  last: string;
  bid: string;
  ask: string;
  volume24h: string;
  volumeQuote24h: string;
  high24h: string;
  low24h: string;
  percentChange24h: string;
};

export type OrderBook = {
  market: string;
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
};

export class BitvavoReadonly {
  private apiKey: string;
  private apiSecret: string;
  private apiUrl: string;

  constructor(config: BitvavoReadonlyConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.apiUrl = config.apiUrl || 'https://api.bitvavo.com/v2';

    // Sanity check: if trading keys somehow present in env, IGNORE them
    if (process.env.BITVAVO_TRADE_KEY || process.env.BITVAVO_TRADE_SECRET) {
      console.warn(
        '[BitvavoReadonly] WARNING: Trading keys detected in environment. ' +
        'BitvavoReadonly will IGNORE them. Use BitvavoTrade module for execution.'
      );
    }
  }

  /**
   * Fetch market ticker data (no secrets in response)
   */
  async getTicker(market: string): Promise<TickerData | null> {
    try {
      // In production: sign request with apiKey/apiSecret for rate limiting
      const response = await fetch(`${this.apiUrl}/ticker?market=${market}`);
      if (!response.ok) {
        console.error(`[BitvavoReadonly] getTicker failed: ${response.status}`);
        return null;
      }
      const data = await response.json();
      return data as TickerData;
    } catch (err) {
      console.error('[BitvavoReadonly] getTicker error:', err);
      return null;
    }
  }

  /**
   * Fetch candlestick data for volatility analysis
   */
  async getCandles(
    market: string,
    interval: string = '1h',
    limit: number = 24
  ): Promise<MarketCandle[]> {
    try {
      const response = await fetch(
        `${this.apiUrl}/candles?market=${market}&interval=${interval}&limit=${limit}`
      );
      if (!response.ok) {
        console.error(`[BitvavoReadonly] getCandles failed: ${response.status}`);
        return [];
      }
      const data = await response.json();
      return data as MarketCandle[];
    } catch (err) {
      console.error('[BitvavoReadonly] getCandles error:', err);
      return [];
    }
  }

  /**
   * Fetch order book (no execution capability)
   */
  async getOrderBook(market: string): Promise<OrderBook | null> {
    try {
      const response = await fetch(`${this.apiUrl}/orderbook?market=${market}`);
      if (!response.ok) {
        console.error(`[BitvavoReadonly] getOrderBook failed: ${response.status}`);
        return null;
      }
      const data = await response.json();
      return data as OrderBook;
    } catch (err) {
      console.error('[BitvavoReadonly] getOrderBook error:', err);
      return null;
    }
  }

  /**
   * Calculate volatility from candlestick data
   * Volatility = coefficient of variation of closes over period
   */
  async calculateVolatility(market: string): Promise<number> {
    const candles = await this.getCandles(market, '1h', 24);
    if (candles.length === 0) return 0;

    const closes = candles.map((c) => parseFloat(c.close));
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
    const variance = closes.reduce((a, c) => a + Math.pow(c - mean, 2), 0) / closes.length;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / mean) * 100; // coefficient of variation as percentage

    return Math.min(100, cv); // Cap at 100%
  }

  /**
   * Calculate price movement over period
   */
  async getPriceMovement(market: string, hours: number = 1): Promise<number> {
    const candles = await this.getCandles(market, '1h', hours + 1);
    if (candles.length < 2) return 0;

    const oldPrice = parseFloat(candles[0].close);
    const newPrice = parseFloat(candles[candles.length - 1].close);
    const movement = ((newPrice - oldPrice) / oldPrice) * 100;

    return movement;
  }

  /**
   * INTENTIONALLY UNAVAILABLE: placeOrder
   * This module cannot place orders. Use BitvavoTrade for execution.
   */
  placeOrder(): never {
    throw new Error(
      '[BitvavoReadonly] EXECUTION FORBIDDEN: placeOrder() not available. ' +
      'Use BitvavoTrade module for order execution. ' +
      'Key separation enforces: Scanner/Proposer = readonly, Executor = trading-key only.'
    );
  }

  /**
   * INTENTIONALLY UNAVAILABLE: cancelOrder
   */
  cancelOrder(): never {
    throw new Error(
      '[BitvavoReadonly] EXECUTION FORBIDDEN: cancelOrder() not available. ' +
      'Key separation: Scanner module cannot modify orders.'
    );
  }

  /**
   * Helper: Check if trading keys are somehow leaking into config
   */
  private validateKeySeparation(): void {
    if (this.apiKey.includes('TRADE') || this.apiKey.includes('trade')) {
      throw new Error(
        '[BitvavoReadonly] SECURITY VIOLATION: Trading key detected in readonly module. ' +
        'This should never happen. Check environment variable loading.'
      );
    }
  }
}

// Singleton instance for scanner/proposer use
let readonlyInstance: BitvavoReadonly | null = null;

export function getBitvavoReadonly(): BitvavoReadonly {
  if (!readonlyInstance) {
    const apiKey = process.env.BITVAVO_READONLY_KEY;
    const apiSecret = process.env.BITVAVO_READONLY_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error(
        '[BitvavoReadonly] Missing BITVAVO_READONLY_KEY or BITVAVO_READONLY_SECRET'
      );
    }

    readonlyInstance = new BitvavoReadonly({
      apiKey,
      apiSecret
    });
  }

  return readonlyInstance;
}

export function resetBitvavoReadonly(): void {
  readonlyInstance = null;
}
