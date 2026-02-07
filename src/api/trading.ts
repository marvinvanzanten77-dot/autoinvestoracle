/**
 * TRADING AGENT CLIENT
 * 
 * Frontend API for AI trading agent interaction
 */

import { API_BASE } from './dashboard';
import type { TradeSignal } from '../../server/ai/tradingAgent';

export type TradingAnalyzeRequest = {
  context: {
    userId: string;
    profile: {
      riskProfile: 'voorzichtig' | 'gebalanceerd' | 'actief';
      maxDrawdown: number;
      maxPositionSize: number;
      allowedAssets: string[];
    };
    market: {
      volatility: number;
      sentiment: number;
      recentObservations: string[];
    };
    portfolio: {
      totalValue: number;
      balances: Array<{ asset: string; total: number }>;
      openOrders: any[];
      openPositions: Array<{
        asset: string;
        quantity: number;
        entryPrice: number;
        currentPrice: number;
      }>;
    };
  };
};

export type TradingAnalyzeResponse = {
  success: boolean;
  signals: TradeSignal[];
  count: number;
  timestamp: string;
  message: string;
};

export type TradingExecuteRequest = {
  signal: TradeSignal;
  context: TradingAnalyzeRequest['context'];
};

export type TradingExecuteResponse = {
  success: boolean;
  action: string;
  asset: string;
  orderId?: string;
  quantity?: number;
  price?: number;
  fee?: number;
  totalValue?: number;
  timestamp: string;
  message: string;
  auditId: string;
};

export type TradeExecution = {
  id: string;
  action: string;
  asset: string;
  quantity?: number;
  price?: number;
  total?: number;
  fee?: number;
  success: boolean;
  status: 'executed' | 'rejected';
  orderId?: string;
  timestamp: string;
  message: string;
};

export type TradingAuditResponse = {
  success: boolean;
  executions: TradeExecution[];
  count: number;
  limit: number;
  offset: number;
  timestamp: string;
};

/**
 * Analyze market and get AI trade signals
 */
export async function fetchTradingSignals(
  request: TradingAnalyzeRequest
): Promise<TradingAnalyzeResponse> {
  const resp = await fetch(`${API_BASE}/api/trading/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });

  if (!resp.ok) {
    throw new Error(`Trading analysis failed: ${resp.status}`);
  }

  return resp.json();
}

/**
 * Execute a specific trade signal
 */
export async function executeTradingSignal(
  request: TradingExecuteRequest
): Promise<TradingExecuteResponse> {
  const resp = await fetch(`${API_BASE}/api/trading/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });

  if (!resp.ok) {
    throw new Error(`Trade execution failed: ${resp.status}`);
  }

  return resp.json();
}

/**
 * Fetch audit trail of executed trades
 */
export async function fetchTradingAudit(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<TradingAuditResponse> {
  const params = new URLSearchParams({
    userId,
    limit: String(options?.limit || 50),
    offset: String(options?.offset || 0)
  });

  const resp = await fetch(`${API_BASE}/api/trading/audit?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch audit trail: ${resp.status}`);
  }

  return resp.json();
}

/**
 * Fetch recent trade signals (for UI review)
 */
export async function fetchRecentSignals(
  userId: string,
  hoursBack?: number
): Promise<{ success: boolean; signals: TradeSignal[]; count: number }> {
  const params = new URLSearchParams({
    userId,
    ...(hoursBack && { hoursBack: String(hoursBack) })
  });

  const resp = await fetch(`${API_BASE}/api/trading/signals?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch signals: ${resp.status}`);
  }

  return resp.json();
}
