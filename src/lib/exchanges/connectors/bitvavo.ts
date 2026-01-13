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

  async connect(credentials: ExchangeCredentials): Promise<ConnectorConnectResult> {
    if (!('apiKey' in credentials) || !credentials.apiKey || !credentials.apiSecret) {
      throw new ValidationError('API key/secret ontbreekt.');
    }
    return { ok: true, scopes: ['read'] };
  }

  async fetchAccounts(): Promise<Account[]> {
    // TODO: Bitvavo account endpoint + signing.
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    // TODO: Bitvavo balance endpoint + signing.
    return [];
  }

  async fetchPositions(): Promise<Position[]> {
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    // TODO: Bitvavo deposits/withdrawals/trades.
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // TODO: Bitvavo orders endpoint + signing.
    return [];
  }

  async fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]> {
    const symbol = params.symbols[0] || 'BTC-EUR';
    const interval = params.interval || '1h';
    const url = `${EXCHANGE_CONFIG.bitvavo.baseUrl}/${symbol}/candles?interval=${interval}`;
    const resp = await fetch(url);
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
