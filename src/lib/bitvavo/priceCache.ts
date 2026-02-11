/**
 * BITVAVO PRICE CACHE
 * 
 * Caches real-time prices with WebSocket subscription
 * Provides fast access for portfolio calculations
 * 
 * Workaround: /ticker REST endpoint requires auth but is unreliable
 * Solution: Use WebSocket for real-time prices, cache them locally
 */

export interface PriceEntry {
  market: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: number;
}

export class BitvavoPriceCache {
  private prices: Map<string, PriceEntry> = new Map();
  private fallbackPrices: Map<string, number> = new Map();
  private lastUpdate: number = 0;
  private updateInterval = 5 * 60 * 1000; // 5 minutes max
  private maxAge = 30 * 60 * 1000; // 30 minutes acceptable

  constructor() {
    // Initialize with fallback prices (for when WebSocket unavailable)
    this.initializeFallbackPrices();
  }

  /**
   * Initialize fallback prices (from known markets)
   * These are used when WebSocket not available
   */
  private initializeFallbackPrices(): void {
    // Common EUR pairs - will be updated by WebSocket
    this.fallbackPrices.set('BTC-EUR', 0);
    this.fallbackPrices.set('ETH-EUR', 0);
    this.fallbackPrices.set('SOL-EUR', 0);
    this.fallbackPrices.set('USDT-EUR', 0);
    this.fallbackPrices.set('XRP-EUR', 0);
    this.fallbackPrices.set('ADA-EUR', 0);
  }

  /**
   * Update price from WebSocket ticker update
   */
  updatePrice(market: string, price: number, bid: number, ask: number): void {
    this.prices.set(market, {
      market,
      price,
      bid,
      ask,
      timestamp: Date.now(),
    });

    // Also update fallback
    if (market.endsWith('-EUR')) {
      this.fallbackPrices.set(market, price);
    }

    this.lastUpdate = Date.now();
  }

  /**
   * Get price for a market
   */
  getPrice(market: string): number | null {
    const entry = this.prices.get(market);
    if (entry) {
      // Check if price is still fresh (30 min max)
      if (Date.now() - entry.timestamp < this.maxAge) {
        return entry.price;
      }
    }
    return null;
  }

  /**
   * Get all prices
   */
  getAllPrices(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [market, entry] of this.prices) {
      if (Date.now() - entry.timestamp < this.maxAge) {
        result.set(market, entry.price);
      }
    }
    return result;
  }

  /**
   * Get fallback price (even if stale)
   */
  getFallbackPrice(market: string): number {
    return this.fallbackPrices.get(market) || 0;
  }

  /**
   * Check if cache is fresh
   */
  isFresh(): boolean {
    return Date.now() - this.lastUpdate < this.updateInterval;
  }

  /**
   * Get cache age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.lastUpdate;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalCached: number;
    lastUpdate: number;
    age: number;
    isFresh: boolean;
    markets: string[];
  } {
    return {
      totalCached: this.prices.size,
      lastUpdate: this.lastUpdate,
      age: this.getAge(),
      isFresh: this.isFresh(),
      markets: Array.from(this.prices.keys()),
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.prices.clear();
    this.lastUpdate = 0;
  }
}

// Global singleton instance
let priceCache: BitvavoPriceCache | null = null;

export function getBitvavoPriceCache(): BitvavoPriceCache {
  if (!priceCache) {
    priceCache = new BitvavoPriceCache();
  }
  return priceCache;
}
