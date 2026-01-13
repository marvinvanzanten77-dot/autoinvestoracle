import type { ConnectorCapabilities, ExchangeId } from './types';

export const EXCHANGE_CONFIG: Record<
  ExchangeId,
  {
    baseUrl: string;
    name: string;
    capabilities: ConnectorCapabilities;
    timeoutMs: number;
  }
> = {
  bitvavo: {
    baseUrl: 'https://api.bitvavo.com/v2',
    name: 'Bitvavo',
    timeoutMs: 12_000,
    capabilities: {
      supportsPositions: false,
      supportsOAuth: false,
      supportsApiKeys: true
    }
  },
  kraken: {
    baseUrl: 'https://api.kraken.com/0',
    name: 'Kraken',
    timeoutMs: 12_000,
    capabilities: {
      supportsPositions: true,
      supportsOAuth: false,
      supportsApiKeys: true
    }
  },
  coinbase: {
    baseUrl: 'https://api.exchange.coinbase.com',
    name: 'Coinbase',
    timeoutMs: 12_000,
    capabilities: {
      supportsPositions: false,
      supportsOAuth: true,
      supportsApiKeys: true
    }
  },
  bybit: {
    baseUrl: 'https://api.bybit.com/v5',
    name: 'Bybit',
    timeoutMs: 12_000,
    capabilities: {
      supportsPositions: true,
      supportsOAuth: false,
      supportsApiKeys: true
    }
  }
};
