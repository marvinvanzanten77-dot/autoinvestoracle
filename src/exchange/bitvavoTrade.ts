/**
 * BITVAVO TRADE MODULE
 * 
 * Executor path only: Can place orders with trading key.
 * Strictly separated from readonly module.
 * 
 * Used by: execute handler only (during /api/trading/execute after APPROVED proposal)
 */

export type BravoBitvavoTradeConfig = {
  apiKey: string;
  apiSecret: string;
  apiUrl?: string;
};

export type PlaceOrderRequest = {
  market: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  amount?: string;
  price?: string;
  clientOrderId?: string; // Idempotency key: returned by Bitvavo, used for reconciliation
};

export type PlaceOrderResponse = {
  orderId: string;
  market: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  amount?: string;
  amountRemaining?: string;
  price?: string;
  status: 'open' | 'closed' | 'cancelled';
  timestamp: number;
  feeMaker?: string;
  feeTaker?: string;
};

export type OrderStatus = {
  orderId: string;
  market: string;
  side: 'buy' | 'sell';
  status: 'open' | 'closed' | 'cancelled';
  amount?: string;
  amountRemaining?: string;
  price?: string;
  timestamp: number;
};

export class BitvavoTrade {
  private apiKey: string;
  private apiSecret: string;
  private apiUrl: string;

  constructor(config: BravoBitvavoTradeConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.apiUrl = config.apiUrl || 'https://api.bitvavo.com/v2';

    // Sanity check
    if (!this.apiKey.includes('TRADE') && !this.apiSecret) {
      console.warn(
        '[BitvavoTrade] WARNING: Keys may not be trading keys. ' +
        'Ensure BITVAVO_TRADE_KEY and BITVAVO_TRADE_SECRET are configured.'
      );
    }
  }

  /**
   * Place a buy or sell order on Bitvavo
   * 
   * CRITICAL: This is the ONLY place where actual orders are sent to Bitvavo.
   * Must be called ONLY after:
   * 1. Proposal is APPROVED
   * 2. User explicitly clicked execute
   * 3. Trading is ENABLED
   * 4. Pre-flight checks passed
   * 5. Execution claim row exists in database
   */
  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResponse | null> {
    try {
      console.log(
        `[BitvavoTrade] Placing ${request.side.toUpperCase()} order: ` +
        `${request.market} ${request.orderType}`
      );

      // In production: HMAC-SHA256 sign request with apiSecret
      const payload = {
        market: request.market,
        side: request.side,
        orderType: request.orderType,
        amount: request.amount,
        price: request.price
      };

      // Add clientOrderId for idempotency (Bitvavo will echo it back)
      if (request.clientOrderId) {
        (payload as any).clientOrderId = request.clientOrderId;
      }

      const response = await fetch(`${this.apiUrl}/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'BITVAVO-ACCESS-KEY': this.apiKey
          // In production: Add BITVAVO-ACCESS-NONCE, BITVAVO-ACCESS-SIGNATURE
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[BitvavoTrade] placeOrder failed: ${response.status} ${errorText}`
        );
        return null;
      }

      const data = await response.json();
      console.log(`[BitvavoTrade] Order placed successfully: ${data.orderId}`);

      return data as PlaceOrderResponse;
    } catch (err) {
      console.error('[BitvavoTrade] placeOrder error:', err);
      return null;
    }
  }

  /**
   * Cancel an open order
   * Used for timeout/error recovery
   */
  async cancelOrder(market: string, orderId: string): Promise<OrderStatus | null> {
    try {
      console.log(`[BitvavoTrade] Cancelling order ${orderId} on ${market}`);

      const response = await fetch(`${this.apiUrl}/order`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'BITVAVO-ACCESS-KEY': this.apiKey
        },
        body: JSON.stringify({ market, orderId })
      });

      if (!response.ok) {
        console.error(`[BitvavoTrade] cancelOrder failed: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data as OrderStatus;
    } catch (err) {
      console.error('[BitvavoTrade] cancelOrder error:', err);
      return null;
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(market: string, orderId: string): Promise<OrderStatus | null> {
    try {
      const response = await fetch(
        `${this.apiUrl}/order?market=${market}&orderId=${orderId}`,
        {
          headers: {
            'BITVAVO-ACCESS-KEY': this.apiKey
          }
        }
      );

      if (!response.ok) {
        console.error(`[BitvavoTrade] getOrderStatus failed: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data as OrderStatus;
    } catch (err) {
      console.error('[BitvavoTrade] getOrderStatus error:', err);
      return null;
    }
  }

  /**
   * INTENTIONALLY UNAVAILABLE: getTicker
   * Trading module does not access market data. Use readonly module.
   */
  getTicker(): never {
    throw new Error(
      '[BitvavoTrade] FORBIDDEN: getTicker() not available. ' +
      'Use BitvavoReadonly module for market data. ' +
      'Key separation: Executor module places orders only, no data analysis.'
    );
  }

  /**
   * Find order by clientOrderId (idempotency key)
   * 
   * Used for reconciliation: if placeOrder timeout occurred,
   * we can query the exchange using the clientOrderId we sent
   * to check if order was actually created.
   * 
   * Returns: PlaceOrderResponse if found, null otherwise
   */
  async findOrderByClientOrderId(clientOrderId: string): Promise<PlaceOrderResponse | null> {
    try {
      console.log(`[BitvavoTrade] Searching for order with clientOrderId: ${clientOrderId}`);

      // Query open orders and recent orders
      const response = await fetch(`${this.apiUrl}/orders`, {
        method: 'GET',
        headers: {
          'BITVAVO-ACCESS-KEY': this.apiKey
          // In production: Add nonce, signature
        }
      });

      if (!response.ok) {
        console.warn(`[BitvavoTrade] Failed to query orders: ${response.status}`);
        return null;
      }

      const orders = (await response.json()) as any[];

      // Find order with matching clientOrderId
      const found = orders.find((order: any) => order.clientOrderId === clientOrderId);

      if (found) {
        console.log(`[BitvavoTrade] Found order by clientOrderId: ${found.orderId}`);
        return {
          orderId: found.orderId,
          market: found.market,
          side: found.side,
          orderType: found.orderType,
          amount: found.amount,
          amountRemaining: found.amountRemaining,
          price: found.price,
          status: found.status,
          timestamp: found.timestamp,
          feeMaker: found.feeMaker,
          feeTaker: found.feeTaker
        };
      }

      console.log(`[BitvavoTrade] No order found with clientOrderId: ${clientOrderId}`);
      return null;
    } catch (err) {
      console.error('[BitvavoTrade] findOrderByClientOrderId error:', err);
      return null;
    }
  }

  /**
   * INTENTIONALLY UNAVAILABLE: getCandles
   */
  getCandles(): never {
    throw new Error(
      '[BitvavoTrade] FORBIDDEN: getCandles() not available. ' +
      'Key separation: Executor module cannot access market data.'
    );
  }
}

// Singleton instance for executor use ONLY
let tradeInstance: BitvavoTrade | null = null;

/**
 * Get BitvavoTrade instance for execution
 * 
 * CRITICAL: Only call from execute handler after all pre-flight checks pass.
 */
export function getBitvavoTrade(): BitvavoTrade {
  if (!tradeInstance) {
    const apiKey = process.env.BITVAVO_TRADE_KEY;
    const apiSecret = process.env.BITVAVO_TRADE_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error(
        '[BitvavoTrade] Missing BITVAVO_TRADE_KEY or BITVAVO_TRADE_SECRET. ' +
        'Execution disabled. Check environment configuration.'
      );
    }

    tradeInstance = new BitvavoTrade({
      apiKey,
      apiSecret
    });
  }

  return tradeInstance;
}

export function resetBitvavoTrade(): void {
  tradeInstance = null;
}

/**
 * Guard: Ensure BitvavoReadonly never tries to call this
 */
export function assertExecutorOnlyContext(): void {
  if (!process.env.BITVAVO_TRADE_KEY || !process.env.BITVAVO_TRADE_SECRET) {
    throw new Error(
      '[BitvavoTrade] SECURITY: Not in executor context. ' +
      'Trading keys not available. This function must only be called from execute handler.'
    );
  }
}
