import type { ExchangeConnector, ExchangeId } from './types';
import { BitvavoConnector } from './connectors/bitvavo';
import { KrakenConnector } from './connectors/kraken';
import { CoinbaseConnector } from './connectors/coinbase';
import { BybitConnector } from './connectors/bybit';

export function createConnector(exchange: ExchangeId): ExchangeConnector {
  switch (exchange) {
    case 'bitvavo':
      return new BitvavoConnector();
    case 'kraken':
      return new KrakenConnector();
    case 'coinbase':
      return new CoinbaseConnector();
    case 'bybit':
      return new BybitConnector();
    default:
      throw new Error(`Unsupported exchange: ${exchange}`);
  }
}

export const ALL_EXCHANGES: ExchangeId[] = ['bitvavo', 'kraken', 'coinbase', 'bybit'];
