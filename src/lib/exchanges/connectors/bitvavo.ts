import crypto from 'crypto';
import { EXCHANGE_CONFIG } from '../config';
import type {
  Account,
  Balance,
  ConnectorConnectResult,
  ExchangeConnector,
  ExchangeCredentials,
  MarketCandle,
  MarketDataParams,
  Order,
  Position,
  Transaction
} from '../types';
import { ValidationError } from '../types';

export class BitvavoConnector implements ExchangeConnector {
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
  }

  private async makeRequest(method: string, endpoint: string, body?: Record<string, unknown>) {
    const timestamp = Date.now();
    
    let bodyStr = '';
    if (body) {
      bodyStr = JSON.stringify(body);
    }

    // Bitvavo signing: HMAC-SHA256(apiSecret, timestamp + method + path + body)
    // Path includes /v2 prefix!
    const path = `/v2${endpoint}`;
    const message = timestamp + method + path + bodyStr;
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
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

    const resp = await fetch(`${EXCHANGE_CONFIG.bitvavo.baseUrl}${endpoint}`, {
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
      console.error('[Bitvavo] Error response:', { status: resp.status, body: errText });
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
      return { ok: false, message: `Bitvavo verbinding mislukt: ${msg}` };
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
      const data = await this.makeRequest('GET', '/balance');
      if (!Array.isArray(data)) {
        console.log('[Bitvavo] fetchBalances: /balance endpoint returned non-array:', typeof data);
        return [];
      }
      
      console.log('[Bitvavo] fetchBalances: Raw API response:', {
        count: data.length,
        sample: data.slice(0, 3).map(b => ({
          symbol: b.symbol,
          available: b.available,
          held: b.held,
          inOrder: b.inOrder
        }))
      });
      
      // Filter balances: include only those with available > 0 OR held > 0
      const balances = data
        .filter((bal: any) => {
          const available = Number(bal.available ?? 0);
          const held = Number(bal.held ?? 0);
          return available > 0 || held > 0;
        })
        .map((bal: any) => {
          const available = Number(bal.available ?? 0);
          const held = Number(bal.held ?? 0);
          return {
            id: crypto.randomUUID(),
            userId: '', // Will be set by caller
            exchange: this.id,
            asset: bal.symbol,
            total: available + held,
            available: available
          };
        });
      
      console.log(`[Bitvavo] fetchBalances: Filtered to ${balances.length} assets with balance`, {
        assets: balances.map(b => `${b.asset}:${b.available}/${b.total}`)
      });
      return balances;
    } catch (err) {
      console.error('Bitvavo fetchBalances error:', err);
      return [];
    }
  }

  async fetchAvailableAssets(): Promise<Array<{ symbol: string; name?: string }>> {
    try {
      // Bitvavo markets endpoint returns all available trading pairs
      const data = await this.makeRequest('GET', '/markets');
      if (!Array.isArray(data)) {
        return [];
      }
      // Extract unique base assets (e.g., from BTC-EUR, ETH-EUR get BTC, ETH)
      const assets = new Map<string, { symbol: string; name?: string }>();
      data.forEach((market: any) => {
        // Format is like "BTC-EUR", we want just "BTC"
        const [baseAsset] = market.market?.split('-') || [];
        if (baseAsset && !assets.has(baseAsset)) {
          assets.set(baseAsset, { symbol: baseAsset, name: market.name });
        }
      });
      const result = Array.from(assets.values());
      console.log(`[Bitvavo] fetchAvailableAssets: Found ${result.length} unique assets`, {
        assets: result.map(a => a.symbol).slice(0, 20) + (result.length > 20 ? '...' : '')
      });
      return result;
    } catch (err) {
      console.error('Bitvavo fetchAvailableAssets error:', err);
      return [];
    }
  }

  async fetchPositions(): Promise<Position[]> {
    // Bitvavo is spot only
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    // TODO: Implement deposits/withdrawals
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // TODO: Implement orders
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
}
