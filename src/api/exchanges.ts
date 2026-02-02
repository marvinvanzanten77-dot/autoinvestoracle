import { API_BASE } from './dashboard';

export type Balance = {
  id: string;
  userId: string;
  exchange: string;
  asset: string;
  total: number;
  available: number;
  updatedAt: string;
};

export type BalancesResponse = {
  balances: Balance[];
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
