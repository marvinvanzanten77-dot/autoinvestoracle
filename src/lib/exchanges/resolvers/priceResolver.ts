/**
 * PRICE RESOLVER UTILITY
 * 
 * Intelligently resolves ANY asset to EUR price using available trading pairs.
 * 
 * Strategy:
 * 1. Build conversion graph from all available pairs (BTC-EUR, SOL-USDT, etc)
 * 2. For each asset, find best path to EUR:
 *    - Direct: BTC-EUR ✓
 *    - Single hop: SOL-USDT then USDT-EUR ✓
 *    - Multi-hop: XRP-BTC then BTC-EUR ✓
 * 3. Cache all prices (TTL 5 min) for performance
 * 
 * Example:
 * ```
 * const resolver = new PriceResolver(marketsData);
 * const btcPrice = resolver.getPrice('BTC'); // 55699.00 EUR
 * const solPrice = resolver.getPrice('SOL'); // 142.50 EUR (via USDT)
 * ```
 */

export interface MarketData {
  market: string;      // "BTC-EUR"
  price: string;       // "55699.00"
  status: string;
}

export interface ConversionPath {
  fromAsset: string;
  toAsset: string;
  path: string[];      // ['SOL', 'USDT', 'EUR']
  rates: number[];     // [0.0018, 1.05]  (multiply these to get conversion)
  hops: number;        // 2 (number of conversions needed)
}

export class PriceResolver {
  private pairs: Map<string, number> = new Map(); // "BTC-EUR" -> 55699
  private cache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  private conversionGraph: Map<string, Map<string, number>> = new Map(); // base -> quote -> rate
  private targetCurrency = 'EUR';

  constructor(marketsData: MarketData[]) {
    console.log('[PriceResolver] Initializing with', marketsData.length, 'market pairs');
    this.buildConversionGraph(marketsData);
    this.logGraphSummary();
  }

  /**
   * Build conversion graph from all available pairs.
   * Example: BTC-EUR, SOL-USDT, USDT-EUR creates paths:
   *   BTC -> EUR (direct)
   *   SOL -> USDT -> EUR (indirect)
   */
  private buildConversionGraph(marketsData: MarketData[]): void {
    for (const market of marketsData) {
      if (!market.market || !market.price) continue;

      const [base, quote] = market.market.split('-');
      const rate = Number(market.price);

      // Store bidirectional rates for flexibility
      if (!this.conversionGraph.has(base)) {
        this.conversionGraph.set(base, new Map());
      }
      this.conversionGraph.get(base)!.set(quote, rate);

      // Also store reverse for flexibility
      if (!this.conversionGraph.has(quote)) {
        this.conversionGraph.set(quote, new Map());
      }
      if (rate > 0) {
        this.conversionGraph.get(quote)!.set(base, 1 / rate);
      }

      // Store direct pairs for quick access
      this.pairs.set(`${base}-${quote}`, rate);
      if (rate > 0) {
        this.pairs.set(`${quote}-${base}`, 1 / rate);
      }
    }
  }

  /**
   * Get price for any asset in EUR, using intelligent conversion if needed.
   * Returns 0 if no conversion path found.
   */
  public getPrice(asset: string): number {
    asset = asset.toUpperCase();

    // Check cache first
    const cached = this.cache.get(asset);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`[PriceResolver] Cache hit: ${asset} = €${cached.price.toFixed(4)}`);
      return cached.price;
    }

    // If asking for EUR itself, return 1.0
    if (asset === this.targetCurrency) {
      this.setCached(asset, 1.0);
      return 1.0;
    }

    // Try direct path first (e.g., BTC-EUR)
    const directRate = this.pairs.get(`${asset}-${this.targetCurrency}`);
    if (directRate !== undefined && directRate > 0) {
      console.log(`[PriceResolver] Direct path: ${asset}-${this.targetCurrency} = €${directRate.toFixed(4)}`);
      this.setCached(asset, directRate);
      return directRate;
    }

    // Try indirect paths using BFS (breadth-first search)
    const path = this.findConversionPath(asset, this.targetCurrency);
    if (path) {
      const rate = this.calculateRate(path);
      console.log(
        `[PriceResolver] Conversion path: ${path.join(' → ')} = €${rate.toFixed(4)}`
      );
      this.setCached(asset, rate);
      return rate;
    }

    // No path found
    console.warn(`[PriceResolver] ⚠️ No conversion path found for ${asset}`);
    this.setCached(asset, 0);
    return 0;
  }

  /**
   * Find shortest conversion path from asset to target (EUR).
   * Uses BFS for efficiency.
   */
  private findConversionPath(
    fromAsset: string,
    toAsset: string,
    maxDepth = 3
  ): string[] | null {
    const from = fromAsset.toUpperCase();
    const to = toAsset.toUpperCase();

    if (from === to) return [from];

    const queue: { asset: string; path: string[] }[] = [{ asset: from, path: [from] }];
    const visited = new Set<string>([from]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      // Depth limit
      if (current.path.length > maxDepth + 1) continue;

      // Get neighbors (assets this one can convert to)
      const neighbors = this.conversionGraph.get(current.asset)?.keys() || [];

      for (const neighbor of neighbors) {
        if (neighbor === to) {
          return [...current.path, to];
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({
            asset: neighbor,
            path: [...current.path, neighbor],
          });
        }
      }
    }

    return null;
  }

  /**
   * Calculate final exchange rate from a conversion path.
   * Example: ['SOL', 'USDT', 'EUR'] with rates [0.002, 1.05] = 0.0021
   */
  private calculateRate(path: string[]): number {
    let rate = 1.0;

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      const hopRate = this.conversionGraph.get(from)?.get(to);

      if (hopRate === undefined || hopRate <= 0) {
        console.warn(`[PriceResolver] Invalid rate in path: ${from} -> ${to}`);
        return 0;
      }

      rate *= hopRate;
    }

    return rate;
  }

  /**
   * Cache price with timestamp
   */
  private setCached(asset: string, price: number): void {
    this.cache.set(asset, { price, timestamp: Date.now() });
  }

  /**
   * Log summary of conversion graph for debugging
   */
  private logGraphSummary(): void {
    const currencies = Array.from(this.conversionGraph.keys());
    const directEurPairs = currencies.filter(c =>
      this.conversionGraph.get(c)?.has('EUR')
    );

    console.log('[PriceResolver] Graph summary:', {
      total_currencies: currencies.length,
      currencies: currencies.slice(0, 10).join(', ') + (currencies.length > 10 ? '...' : ''),
      direct_eur_pairs: directEurPairs.length,
      eur_pairs: directEurPairs.join(', '),
    });
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('[PriceResolver] Cache cleared');
  }

  /**
   * Get all resolved prices (for debugging)
   */
  public getAllPrices(assets: string[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const asset of assets) {
      result[asset] = this.getPrice(asset);
    }
    return result;
  }
}
