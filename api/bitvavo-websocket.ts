/**
 * BITVAVO WEBSOCKET CLIENT
 * Real-time price, order book, and account updates
 */

import { createHmac } from 'crypto';

export interface WebSocketMessage {
  event?: string;
  action?: string;
  market?: string;
  last?: string;
  bid?: string;
  ask?: string;
  high?: string;
  low?: string;
  volume?: string;
  timestamp?: number;
  orderId?: string;
  status?: string;
  amount?: string;
  price?: string;
  [key: string]: any;
}

export interface TickerUpdate {
  market: string;
  price: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export interface OrderBookUpdate {
  market: string;
  bids: [string, string][]; // [price, amount]
  asks: [string, string][]; // [price, amount]
  timestamp: number;
}

export interface AccountUpdate {
  event: string;
  orderId?: string;
  market?: string;
  side?: string;
  amount?: number;
  price?: number;
  status?: string;
  [key: string]: any;
}

export type WebSocketCallback<T> = (data: T) => void;
export type ErrorCallback = (error: Error) => void;

export class BitvavaWebSocket {
  private ws: WebSocket | null = null;
  private url = 'wss://ws.bitvavo.com/v2';
  private messageId = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 5000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Callbacks
  private tickerCallbacks: Map<string, WebSocketCallback<TickerUpdate>> = new Map();
  private orderBookCallbacks: Map<string, WebSocketCallback<OrderBookUpdate>> = new Map();
  private accountCallbacks: WebSocketCallback<AccountUpdate>[] = [];
  private errorCallbacks: ErrorCallback[] = [];

  // Auth
  private apiKey = '';
  private apiSecret = '';
  private authenticated = false;

  constructor(apiKey?: string, apiSecret?: string) {
    this.apiKey = apiKey || '';
    this.apiSecret = apiSecret || '';
  }

  /**
   * Connect to Bitvavo WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[Bitvavo WS] Attempting to connect to', this.url);
        
        // For server-side, use ws package if available
        let WSConstructor: any = null;
        
        // Try browser WebSocket first
        if (typeof WebSocket !== 'undefined') {
          console.log('[Bitvavo WS] Using browser WebSocket');
          WSConstructor = WebSocket;
        } else {
          // Try to load ws package for server-side
          try {
            const WebSocketModule = require('ws');
            console.log('[Bitvavo WS] Using ws package');
            WSConstructor = WebSocketModule;
          } catch (err) {
            console.warn('[Bitvavo WS] ws package not available, WebSocket will not work on server');
            // Don't reject here - we'll use price fallback instead
            resolve();
            return;
          }
        }

        this.ws = new WSConstructor(this.url);

        this.ws.onopen = () => {
          console.log('[Bitvavo WS] Connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          
          // Authenticate if credentials provided
          if (this.apiKey && this.apiSecret) {
            this.authenticate().catch(err => {
              console.error('[Bitvavo WS] Auth failed:', err);
              this.notifyError(err);
            });
          }
          
          resolve();
        };

        this.ws.onmessage = (event: any) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error: any) => {
          console.error('[Bitvavo WS] Error:', error);
          this.notifyError(new Error(`WebSocket error: ${error.message}`));
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[Bitvavo WS] Disconnected');
          this.stopHeartbeat();
          this.attemptReconnect();
        };
      } catch (err) {
        console.error('[Bitvavo WS] Connection error:', err);
        reject(err);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
  }

  /**
   * Authenticate private channels
   */
  private async authenticate(): Promise<void> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API key and secret required for authentication');
    }

    const timestamp = Date.now().toString();
    const message = timestamp + 'GET' + '/v2/websocket';
    const signature = createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');

    this.send({
      action: 'authenticate',
      key: this.apiKey,
      signature: signature,
      timestamp: timestamp,
    });
  }

  /**
   * Subscribe to ticker updates (public channel)
   */
  subscribeTicker(market: string, callback: WebSocketCallback<TickerUpdate>): void {
    this.tickerCallbacks.set(market, callback);

    if (this.isConnected()) {
      this.send({
        action: 'subscribe',
        channels: [
          {
            name: 'ticker',
            markets: [market],
          },
        ],
      });
    }
  }

  /**
   * Subscribe to order book updates (public channel)
   */
  subscribeOrderBook(market: string, callback: WebSocketCallback<OrderBookUpdate>, depth = 20): void {
    this.orderBookCallbacks.set(market, callback);

    if (this.isConnected()) {
      this.send({
        action: 'subscribe',
        channels: [
          {
            name: 'book',
            markets: [market],
          },
        ],
      });
    }
  }

  /**
   * Subscribe to account updates (private channel - requires auth)
   */
  subscribeAccount(callback: WebSocketCallback<AccountUpdate>): void {
    this.accountCallbacks.push(callback);

    if (this.isConnected() && this.authenticated) {
      this.send({
        action: 'subscribe',
        channels: [
          {
            name: 'account',
          },
        ],
      });
    }
  }

  /**
   * Unsubscribe from ticker
   */
  unsubscribeTicker(market: string): void {
    this.tickerCallbacks.delete(market);

    if (this.isConnected()) {
      this.send({
        action: 'unsubscribe',
        channels: [
          {
            name: 'ticker',
            markets: [market],
          },
        ],
      });
    }
  }

  /**
   * Unsubscribe from order book
   */
  unsubscribeOrderBook(market: string): void {
    this.orderBookCallbacks.delete(market);

    if (this.isConnected()) {
      this.send({
        action: 'unsubscribe',
        channels: [
          {
            name: 'book',
            markets: [market],
          },
        ],
      });
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const msg: WebSocketMessage = JSON.parse(data);

      // Handle ticker updates
      if (msg.event === 'ticker' && msg.market && msg.last) {
        const callback = this.tickerCallbacks.get(msg.market);
        if (callback) {
          callback({
            market: msg.market,
            price: Number(msg.last),
            bid: Number(msg.bid || 0),
            ask: Number(msg.ask || 0),
            high24h: Number(msg.high || 0),
            low24h: Number(msg.low || 0),
            volume24h: Number(msg.volume || 0),
            timestamp: msg.timestamp || Date.now(),
          });
        }
      }

      // Handle order book updates
      if (msg.event === 'book' && msg.market) {
        const callback = this.orderBookCallbacks.get(msg.market);
        if (callback) {
          callback({
            market: msg.market,
            bids: msg.bids || [],
            asks: msg.asks || [],
            timestamp: msg.timestamp || Date.now(),
          });
        }
      }

      // Handle account updates (orders, fills, balance changes)
      if ((msg.event === 'order' || msg.event === 'fill' || msg.event === 'balanceUpdate') && this.authenticated) {
        for (const callback of this.accountCallbacks) {
          callback(msg as unknown as AccountUpdate);
        }
      }

      // Handle authentication response
      if (msg.action === 'authenticate' && msg.authenticated) {
        this.authenticated = true;
        console.log('[Bitvavo WS] Authenticated');

        // Subscribe to account channel after auth
        this.send({
          action: 'subscribe',
          channels: [
            {
              name: 'account',
            },
          ],
        });
      }
    } catch (err) {
      console.error('[Bitvavo WS] Message parse error:', err);
    }
  }

  /**
   * Send message to WebSocket
   */
  private send(message: any): void {
    if (!this.isConnected()) {
      console.warn('[Bitvavo WS] Not connected, message not sent');
      return;
    }

    try {
      const msg = {
        id: ++this.messageId,
        ...message,
      };
      this.ws!.send(JSON.stringify(msg));
    } catch (err) {
      console.error('[Bitvavo WS] Send error:', err);
      this.notifyError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ action: 'ping' });
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Bitvavo WS] Max reconnect attempts reached');
      this.notifyError(new Error('Failed to reconnect to WebSocket'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[Bitvavo WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(err => {
        console.error('[Bitvavo WS] Reconnect failed:', err);
        this.attemptReconnect();
      });
    }, delay);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1; // OPEN
  }

  /**
   * Register error callback
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Notify all error callbacks
   */
  private notifyError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (err) {
        console.error('[Bitvavo WS] Error callback error:', err);
      }
    }
  }
}

/**
 * Singleton instance (for use across the app)
 */
let wsInstance: BitvavaWebSocket | null = null;

export function getBitvavaWebSocket(apiKey?: string, apiSecret?: string): BitvavaWebSocket {
  if (!wsInstance) {
    wsInstance = new BitvavaWebSocket(apiKey, apiSecret);
  }
  return wsInstance;
}
