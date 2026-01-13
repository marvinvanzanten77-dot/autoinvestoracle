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
    // TODO: Coinbase account endpoint + signing or OAuth.
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    // TODO: Coinbase balances endpoint + signing or OAuth.
    return [];
  }

  async fetchPositions(): Promise<Position[]> {
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    // TODO: Coinbase transfers/trades endpoint + signing or OAuth.
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // TODO: Coinbase orders endpoint + signing or OAuth.
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
