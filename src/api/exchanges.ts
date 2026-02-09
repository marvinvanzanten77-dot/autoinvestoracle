import { API_BASE } from './dashboard';

export type Balance = {
  id: string;
  userId: string;
  exchange: string;
  asset: string;
  total: number;
  available: number;
  priceEUR?: number;
  estimatedValue?: number;
  updatedAt: string;
};

export type PerformanceMetric = {
  asset: string;
  exchange: string;
  currentQuantity: number;
  previousQuantity: number;
  quantityChange: number;
  quantityChangePercent: number;
  periodStart: string;
  periodEnd: string;
};

export type BalancesResponse = {
  balances: Balance[];
};

export type PerformanceResponse = {
  snapshots: Array<{
    asset: string;
    exchange: string;
    quantity: number;
    estimatedValue: number;
    timestamp: string;
    change24h?: number;
  }>;
  performance: PerformanceMetric[];
};

export type AssetSummary = {
  count: number;
  platforms: string[];
};

export type AssetsResponse = {
  assetsByExchange: Record<string, Array<{ symbol: string; name?: string }>>;
  assetSummary: Record<string, AssetSummary>;
};

export async function fetchBalances(userId?: string): Promise<Balance[]> {
  const params = userId ? `?userId=${userId}` : '';
  const resp = await fetch(`${API_BASE}/api/exchanges/balances${params}`);
  if (!resp.ok) {
    console.error('Failed to fetch balances:', resp.status);
    return [];
  }
  const data = (await resp.json()) as BalancesResponse;
  console.log('[fetchBalances] Got balances:', data.balances);
  return data.balances || [];
}

export async function fetchPerformance(userId?: string): Promise<PerformanceResponse> {
  const params = userId ? `?userId=${userId}` : '';
  const resp = await fetch(`${API_BASE}/api/exchanges/performance${params}`);
  if (!resp.ok) {
    console.error('Failed to fetch performance:', resp.status);
    return { snapshots: [], performance: [] };
  }
  const data = (await resp.json()) as PerformanceResponse;
  console.log('[fetchPerformance] Got performance:', data);
  return data;
}

export async function fetchAvailableAssets(userId?: string): Promise<AssetsResponse> {
  const params = userId ? `?userId=${userId}` : '';
  const resp = await fetch(`${API_BASE}/api/exchanges/assets${params}`);
  if (!resp.ok) {
    console.error('Failed to fetch available assets:', resp.status);
    return { assetsByExchange: {}, assetSummary: {} };
  }
  const data = (await resp.json()) as AssetsResponse;
  console.log('[fetchAvailableAssets] Got assets:', {
    platforms: Object.keys(data.assetsByExchange),
    totalUniqueAssets: Object.keys(data.assetSummary).length
  });
  return data;
}
