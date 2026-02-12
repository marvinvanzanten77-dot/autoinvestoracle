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

function intervalToGranularity(interval: string) {
  if (interval === '1h') return 3600;
  if (interval === '4h') return 14400;
  if (interval === '1d') return 86400;
  return 3600;
}

export class CoinbaseConnector implements ExchangeConnector {
  id = 'coinbase' as const;
  name = EXCHANGE_CONFIG.coinbase.name;
  capabilities = EXCHANGE_CONFIG.coinbase.capabilities;

  async connect(credentials: ExchangeCredentials): Promise<ConnectorConnectResult> {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    return { ok: true, scopes: ['read'] };
  }

  async fetchAccounts(): Promise<Account[]> {
    // Coinbase account endpoint: GET /accounts or /api/v3/accounts (v3 API)
    // Requires: API key signing or OAuth token
    // Returns list of accounts (trading, cash, etc.)
    console.log('[Coinbase] fetchAccounts - implement with API key signing or OAuth');
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    // Coinbase balances endpoint: GET /accounts/{account-id}/fills or /api/v3/accounts
    // Requires: API key signing or OAuth token
    // Returns: asset balances in each account
    console.log('[Coinbase] fetchBalances - implement with API key signing or OAuth');
    return [];
  }

  async fetchAvailableAssets(): Promise<Array<{ symbol: string; name?: string }>> {
    // Coinbase products endpoint: GET /products (public)
    // Returns: BTC-EUR, ETH-EUR, etc.
    try {
      const resp = await fetch(`${EXCHANGE_CONFIG.coinbase.baseUrl}/products`);
      if (!resp.ok) return [];
      const data = (await resp.json()) as Array<any>;
      return data.map(product => ({
        symbol: product.id,
        name: product.display_name || product.id
      }));
    } catch (err) {
      console.error('[Coinbase] fetchAvailableAssets error:', err);
      return [];
    }
  }

  async fetchPositions(): Promise<Position[]> {
    // Coinbase doesn't support margin trading positions (spot only)
    console.log('[Coinbase] fetchPositions - Coinbase spot does not support positions');
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    // Coinbase transfers/trades endpoint: GET /accounts/{account-id}/transfers
    // Requires: API key signing or OAuth token
    console.log('[Coinbase] fetchTransactions - implement with API key signing or OAuth');
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // Coinbase orders endpoint: GET /orders (v3 API)
    // Requires: API key signing or OAuth token
    console.log('[Coinbase] fetchOrders - implement with API key signing or OAuth');
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
}
