import { API_BASE } from './dashboard';
import type { DashboardResponse } from './dashboard';

export async function fetchDailyReport(payload: {
  portfolioInfo: string;
  dashboardSnapshot?: DashboardResponse;
}) {
  const resp = await fetch(`${API_BASE}/api/daily-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    throw new Error(`API error ${resp.status}`);
  }

  return resp.json() as Promise<{ reportText: string; createdAt: string; portfolioInfo: string }>;
}
