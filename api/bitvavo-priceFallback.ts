/**
 * BITVAVO PRICE FALLBACK
 * 
 * Falls back to REST API polling when WebSocket unavailable
 * Used on server-side when ws package not installed or network issues
 */

export class BitvavoPriceFallback {
  private lastFetch = 0;
  private fetchInterval = 30 * 1000; // 30 seconds
  private prices: Map<string, number> = new Map();

  /**
   * Fetch prices via REST API fallback
   * Uses public endpoint that requires no authentication
   */
  async fetchPrices(apiKey: string, apiSecret: string): Promise<Map<string, number>> {
    const now = Date.now();
    
    // Don't fetch too frequently
    if (now - this.lastFetch < this.fetchInterval) {
      console.log('[Bitvavo] Using cached prices (fallback)');
      return this.prices;
    }

    console.log('[Bitvavo] Fetching prices via REST fallback...');

    try {
      // Use /markets endpoint which returns trading pairs
      // We'll build a price map from market data
      const timestamp = now;
      const message = timestamp + 'GET/v2/markets';
      
      const { createHmac } = await import('crypto');
      const signature = createHmac('sha256', apiSecret)
        .update(message)
        .digest('hex');

      const response = await fetch('https://api.bitvavo.com/v2/markets', {
        method: 'GET',
        headers: {
          'Bitvavo-Access-Key': apiKey,
          'Bitvavo-Access-Timestamp': timestamp.toString(),
          'Bitvavo-Access-Signature': signature,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const markets: any[] = await response.json();
      console.log('[Bitvavo] Fetched', markets.length, 'markets');

      // Parse market pairs and extract price info
      for (const market of markets) {
        if (market.market && market.price) {
          const [base, quote] = market.market.split('-');
          if (quote === 'EUR') {
            this.prices.set(market.market, Number(market.price) || 0);
          }
        }
      }

      this.lastFetch = now;
      console.log('[Bitvavo] Price fallback updated:', this.prices.size, 'prices cached');

      return this.prices;
    } catch (err) {
      console.error('[Bitvavo] Price fallback failed:', err);
      return this.prices; // Return stale cache on error
    }
  }

  /**
   * Get cached prices without fetching
   */
  getCachedPrices(): Map<string, number> {
    return this.prices;
  }

  /**
   * Check if cache is fresh
   */
  isFresh(): boolean {
    return Date.now() - this.lastFetch < this.fetchInterval;
  }
}

// Singleton instance
let fallback: BitvavoPriceFallback | null = null;

export function getBitvavoPriceFallback(): BitvavoPriceFallback {
  if (!fallback) {
    fallback = new BitvavoPriceFallback();
  }
  return fallback;
}
