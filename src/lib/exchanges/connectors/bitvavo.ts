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
    // https://api.bitvavo.com/v2/account
    // Requires: HMAC-SHA256 signing met API secret
    console.warn('⚠️ Bitvavo fetchAccounts not implemented');
    return [];
  }

  async fetchBalances(): Promise<Balance[]> {
    // TODO: Bitvavo balance endpoint + signing.
    // https://api.bitvavo.com/v2/balance
    // Returns array van { symbol, available, held }
    console.warn('⚠️ Bitvavo fetchBalances not implemented');
    return [];
  }

  async fetchPositions(): Promise<Position[]> {
    // Bitvavo ondersteunt geen futures/margin
    console.warn('⚠️ Bitvavo fetchPositions not available (spot only)');
    return [];
  }

  async fetchTransactions(): Promise<Transaction[]> {
    // TODO: Bitvavo deposits/withdrawals/trades.
    // https://api.bitvavo.com/v2/deposits
    // https://api.bitvavo.com/v2/withdrawals
    // Requires filtering & aggregation
    console.warn('⚠️ Bitvavo fetchTransactions not implemented');
    return [];
  }

  async fetchOrders(): Promise<Order[]> {
    // TODO: Bitvavo orders endpoint + signing.
    // https://api.bitvavo.com/v2/orders
    // Filters open orders
    console.warn('⚠️ Bitvavo fetchOrders not implemented');
    return [];
  }

  async fetchMarketData(params: MarketDataParams): Promise<MarketCandle[]> {
    const symbol = params.symbols[0] || 'BTC-EUR';
    const interval = params.interval || '1h';
    try {
      const url = `${EXCHANGE_CONFIG.bitvavo.baseUrl}/${symbol}/candles?interval=${interval}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) {
        console.error(`Bitvavo market data error: ${resp.status}`);
        return [];
      }
      const data = (await resp.json()) as Array<[number, number, number, number, number, number]>;
      return data.map(([timestamp, open, high, low, close, volume]) => ({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      }));
    } catch (err) {
      console.error('Bitvavo fetchMarketData error:', err);
      return [];
    }
  }
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
