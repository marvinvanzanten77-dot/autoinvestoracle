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

function intervalToBybit(interval: string) {
  if (interval === '1h') return '60';
  if (interval === '4h') return '240';
  if (interval === '1d') return 'D';
  return '60';
}

export class BybitConnector implements ExchangeConnector {
  id = 'bybit' as const;
  name = EXCHANGE_CONFIG.bybit.name;
  capabilities = EXCHANGE_CONFIG.bybit.capabilities;

  async connect(credentials: ExchangeCredentials): Promise<ConnectorConnectResult> {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    return { ok: true, scopes: ['read'] };
  }

  async fetchAccounts(): Promise<Account[]> {
    // Bybit account endpoint: GET /v5/account/wallet-balance
    // Requires: API key signing (HMAC-SHA256)
    // Returns: wallet balance with multiple accounts (SPOT, FUTURES, etc.)
    console.log('[Bybit] fetchAccounts - implement with API key signing');
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    // Bybit balance endpoint: GET /v5/account/wallet-balance
    // Requires: API key signing
    // Returns: coin balances with total/available/locked
    console.log('[Bybit] fetchBalances - implement with API key signing');
    return [];
  }

  async fetchAvailableAssets(): Promise<Array<{ symbol: string; name?: string }>> {
    // Bybit instruments endpoint: GET /v5/market/instruments-info?category=spot
    // Public endpoint, no signing needed
    // Returns: BTCUSDT, ETHUSDT, etc.
    try {
      const resp = await fetch(`${EXCHANGE_CONFIG.bybit.baseUrl}/market/instruments-info?category=spot`);
      if (!resp.ok) return [];
      const payload = (await resp.json()) as { result?: { list?: Array<any> } };
      const instruments = payload.result?.list || [];
      return instruments.map(inst => ({
        symbol: inst.symbol,
        name: inst.baseCoin + '/' + inst.quoteCoin
      }));
    } catch (err) {
      console.error('[Bybit] fetchAvailableAssets error:', err);
      return [];
    }
  }

  async fetchPositions(): Promise<Position[]> {
    // Bybit positions endpoint: GET /v5/position/list
    // Requires: API key signing
    // Note: Only for FUTURES/PERPS, not SPOT
    console.log('[Bybit] fetchPositions - implement with API key signing (FUTURES only)');
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    // Bybit transactions endpoint: GET /v5/account/transaction-log
    // Requires: API key signing
    // Returns: deposits/withdrawals/trades/fees
    console.log('[Bybit] fetchTransactions - implement with API key signing');
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // Bybit orders endpoint: GET /v5/order/history
    // Requires: API key signing
    // Returns: open and closed orders
    console.log('[Bybit] fetchOrders - implement with API key signing');
    return [];
  }

  async fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]> {
    const symbol = (params.symbols[0] || 'BTCUSDT').replace('-', '');
    const interval = intervalToBybit(params.interval || '1h');
    const url = `${EXCHANGE_CONFIG.bybit.baseUrl}/market/kline?category=spot&symbol=${symbol}&interval=${interval}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return [];
    }
    const payload = (await resp.json()) as { result?: { list?: string[][] } };
    const rows = payload.result?.list || [];
    return rows.map((row) => ({
      exchange: this.id,
      symbol,
      interval,
      time: new Date(Number(row[0])).toISOString(),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5])
    }));
  }
}
