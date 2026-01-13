import { API_BASE } from './dashboard';
import type { MarketScanResponse } from './marketScan';

export type PortfolioAllocationRequest = {
  amount: number;
  strategy: string;
  goals?: string[];
  knowledge?: string;
  changes?: MarketScanResponse['changes'];
};

export type AllocationItem = {
  label: string;
  pct: number;
  rationale: string;
};

export type PortfolioAllocationResponse = {
  allocation: AllocationItem[];
  note: string;
};

export async function fetchPortfolioAllocation(
  payload: PortfolioAllocationRequest
): Promise<PortfolioAllocationResponse> {
  const resp = await fetch(`${API_BASE}/api/portfolio-allocate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    throw new Error(`API error ${resp.status}`);
  }
  return resp.json();
}
