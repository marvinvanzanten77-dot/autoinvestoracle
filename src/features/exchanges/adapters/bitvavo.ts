import crypto from 'crypto';
import { EXCHANGE_CONFIG } from '../config';
import { PriceResolver } from '../resolvers/priceResolver';
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
    // Path must include /v2 for signing (but baseUrl already has it)
    const signingPath = `/v2${endpoint}`;
    const message = timestamp + method + signingPath + bodyStr;
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

    // URL construction: baseUrl already contains /v2, so just append endpoint
    const fullUrl = `${EXCHANGE_CONFIG.bitvavo.baseUrl}${endpoint}`;
    console.log('[Bitvavo] Fetching URL:', fullUrl);
    
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
        body: errText,
        url: fullUrl
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
      // Fetch balances from API
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
          held: b.held
        }))
      });
      
      // Fetch ALL market pairs for price resolution
      let priceResolver: PriceResolver | null = null;
      try {
        const marketsData = await this.makeRequest('GET', '/markets');
        if (Array.isArray(marketsData)) {
          priceResolver = new PriceResolver(marketsData);
        }
      } catch (err) {
        console.error('[Bitvavo] CRITICAL: Could not fetch market data for price resolution:', err);
      }

      if (!priceResolver) {
        console.error('[Bitvavo] No price resolver available - cannot price assets');
        return [];
      }
      
      // Filter balances: include only those with available > 0 OR held > 0
      const balances = data
        .filter((bal: any) => {
          const available = Number(bal.available ?? 0);
          const held = Number(bal.held ?? 0);
          const hasBalance = available > 0 || held > 0;
          if (hasBalance) {
            console.log(`[Bitvavo] ✓ INCLUDE ${bal.symbol}: available=${available}, held=${held}`);
          }
          return hasBalance;
        })
        .map((bal: any) => {
          const available = Number(bal.available ?? 0);
          const held = Number(bal.held ?? 0);
          const total = available + held;
          
          // Use PriceResolver to get price in EUR (handles all conversions automatically)
          const priceEUR = priceResolver!.getPrice(bal.symbol);
          const estimatedValue = total * priceEUR;
          
          console.log(`[Bitvavo] MAP ${bal.symbol}:`, {
            total_qty: total,
            available: available,
            held: held,
            price_eur: priceEUR,
            value: `${total} × €${priceEUR.toFixed(4)} = €${estimatedValue.toFixed(2)}`
          });
          
          return {
            id: crypto.randomUUID(),
            userId: '', // Will be set by caller
            exchange: this.id,
            asset: bal.symbol,
            total: total,
            available: available,
            priceEUR: priceEUR,
            estimatedValue: estimatedValue,
            updatedAt: new Date().toISOString()
          };
        });
      
      console.log(`[Bitvavo] fetchBalances: Returning ${balances.length} assets with prices:`, {
        assets: balances.map(b => `${b.asset}=€${b.priceEUR.toFixed(4)}`)
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
        console.log('[Bitvavo] fetchAvailableAssets: /markets returned non-array:', typeof data);
        return [];
      }
      
      console.log('[Bitvavo] fetchAvailableAssets: Raw /markets response:', {
        count: data.length,
        sample: data.slice(0, 5).map(m => ({
          market: m.market,
          name: m.name,
          status: m.status,
          all_fields: Object.keys(m)
        }))
      });
      
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
      console.log(`[Bitvavo] fetchAvailableAssets: Extracted ${result.length} unique assets`, {
        all_assets: result.map(a => a.symbol)
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
    // Deposits/withdrawals endpoint: GET /v2/deposits or /v2/withdrawals
    // Requires: API key signing
    // IMPLEMENTATION NEEDED:
    // - Fetch deposits with makeRequest('GET', '/deposits')
    // - Fetch withdrawals with makeRequest('GET', '/withdrawals')
    // - Combine and map to Transaction[] format with type field
    console.log('[Bitvavo] fetchTransactions - implement deposits/withdrawals API calls');
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // Orders endpoint: GET /v2/orders
    // Requires: API key signing
    // IMPLEMENTATION NEEDED:
    // - Fetch orders with makeRequest('GET', '/orders')
    // - Map response to Order[] format with buy/sell sides and status
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
}
