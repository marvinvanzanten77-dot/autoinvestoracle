import { API_BASE } from './dashboard';
import type { MarketScanRange, MarketScanResponse } from './marketScan';

export type MarketSummaryResponse = {
  summary: string;
  createdAt: string;
};

export async function fetchMarketSummary(
  range: MarketScanRange,
  changes: MarketScanResponse['changes']
): Promise<MarketSummaryResponse> {
  const resp = await fetch(`${API_BASE}/api/market-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, changes })
  });
  if (!resp.ok) {
    throw new Error(`API error ${resp.status}`);
  }
  return resp.json();
}
