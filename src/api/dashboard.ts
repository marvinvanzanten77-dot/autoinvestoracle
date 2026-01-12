import { mockSignals } from '../data/mockSignals';

export type DashboardResponse = typeof mockSignals;

export const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchDashboard(): Promise<DashboardResponse> {
  const resp = await fetch(`${API_BASE}/api/dashboard`);
  if (!resp.ok) {
    throw new Error(`API error ${resp.status}`);
  }
  return resp.json();
}
