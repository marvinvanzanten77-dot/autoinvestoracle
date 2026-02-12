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

function intervalToMinutes(interval: string) {
  if (interval === '1h') return 60;
  if (interval === '4h') return 240;
  if (interval === '1d') return 1440;
  return 60;
}

export class KrakenConnector implements ExchangeConnector {
  id = 'kraken' as const;
  name = EXCHANGE_CONFIG.kraken.name;
  capabilities = EXCHANGE_CONFIG.kraken.capabilities;

  async connect(credentials: ExchangeCredentials): Promise<ConnectorConnectResult> {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    return { ok: true, scopes: ['read'] };
  }

  async fetchAccounts(): Promise<Account[]> {
    // Kraken account endpoint: GET /0/private/QueryOrders
    // Note: Kraken doesn't have traditional "accounts", using stub with default account
    console.log('[Kraken] fetchAccounts - Kraken does not support multiple accounts');
    return [{
      id: 'kraken-main',
      userId: '',
      exchange: this.id,
      accountId: 'main',
      name: 'Main Account',
      type: 'spot',
      currency: 'EUR'
    }];
  }

  async fetchBalances(): Promise<Balance[]> {
    // Kraken balance endpoint: GET /0/private/Balance
    // Requires: API key, API secret, nonce
    // Example response: { "XXRP": "1000.0", "ZCAD": "500.0", ... }
    console.log('[Kraken] fetchBalances - implement with API key signing');
    return [];
  }

  async fetchAvailableAssets(): Promise<Array<{ symbol: string; name?: string }>> {
    // Kraken public markets endpoint: GET /0/public/AssetPairs
    // Public endpoint, no signing needed
    try {
      const resp = await fetch(`${EXCHANGE_CONFIG.kraken.baseUrl}/public/AssetPairs`);
      if (!resp.ok) return [];
      const data = (await resp.json()) as { result?: Record<string, any> };
      const pairs = data.result || {};
      return Object.keys(pairs).map(symbol => ({
        symbol,
        name: pairs[symbol]?.altname || symbol
      }));
    } catch (err) {
      console.error('[Kraken] fetchAvailableAssets error:', err);
      return [];
    }
  }

  async fetchPositions(): Promise<Position[]> {
    // Kraken positions endpoint: GET /0/private/OpenOrders (or /0/private/ClosedOrders)
    // Note: Kraken spot doesn't support margin positions, only for futures
    console.log('[Kraken] fetchPositions - Kraken spot does not support positions');
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    // Kraken ledger endpoint: GET /0/private/Ledger
    // Requires: API key, API secret, nonce
    // Returns: deposit/withdrawal/trade/fee transactions
    console.log('[Kraken] fetchTransactions - implement with API key signing');
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // Kraken orders endpoint: GET /0/private/OpenOrders or /0/private/ClosedOrders
    // Requires: API key, API secret, nonce
    console.log('[Kraken] fetchOrders - implement with API key signing');
    return [];
  }

  async fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]> {
    const symbol = params.symbols[0] || 'XBT/EUR';
    const interval = intervalToMinutes(params.interval || '1h');
    const url = `${EXCHANGE_CONFIG.kraken.baseUrl}/public/OHLC?pair=${encodeURIComponent(
      symbol
    )}&interval=${interval}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return [];
    }
    const payload = (await resp.json()) as { result?: Record<string, any> };
    const key = Object.keys(payload.result || {}).find((k) => k !== 'last');
    const rows = key ? (payload.result?.[key] as Array<any>) : [];
    return rows.map((row) => ({
      exchange: this.id,
      symbol,
      interval: `${interval}m`,
      time: new Date(Number(row[0]) * 1000).toISOString(),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[6])
    }));
  }
}
