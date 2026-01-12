import { API_BASE } from './dashboard';

export type MarketScanRange = '1h' | '24h' | '7d';

export type MarketScanResponse = {
  range: MarketScanRange;
  updatedAt: string;
  changes: {
    bitcoin: number;
    ethereum: number;
    stablecoins: number;
    altcoins: number;
  };
  volatility: {
    level: 'rustig' | 'matig' | 'hoog';
    label: string;
    detail: string;
  };
  series: Array<{
    time: string;
    bitcoin: number;
    ethereum: number;
    stablecoins: number;
    altcoins: number;
  }>;
};

export async function fetchMarketScan(range: MarketScanRange): Promise<MarketScanResponse> {
  const resp = await fetch(`${API_BASE}/api/market-scan?range=${range}`);
  if (!resp.ok) {
    throw new Error(`API error ${resp.status}`);
  }
  return resp.json();
}
