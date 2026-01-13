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
    // TODO: Bybit account endpoint + signing.
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    // TODO: Bybit balance endpoint + signing.
    return [];
  }

  async fetchPositions(): Promise<Position[]> {
    // TODO: Bybit positions endpoint + signing.
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    // TODO: Bybit transactions endpoint + signing.
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // TODO: Bybit orders endpoint + signing.
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
