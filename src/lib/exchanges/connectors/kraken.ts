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
    // TODO: Kraken account endpoint + signing.
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    // TODO: Kraken balance endpoint + signing.
    return [];
  }

  async fetchPositions(): Promise<Position[]> {
    // TODO: Kraken positions endpoint + signing.
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    // TODO: Kraken ledger endpoint + signing.
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // TODO: Kraken orders endpoint + signing.
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
