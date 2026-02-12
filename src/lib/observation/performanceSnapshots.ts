/**
 * Performance Snapshot Service
 * Captures portfolio state at regular intervals for charting and analysis
 */

import { supabase } from '../supabase/client';

export interface PortfolioSnapshot {
  id: string;
  userId: string;
  timestamp: Date;
  totalValue: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  balances: Record<string, number>;
  positions: Record<string, {
    amount: number;
    entryPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
  }>;
}

/**
 * Create a portfolio snapshot
 */
export async function createSnapshot(
  userId: string,
  portfolio: any
): Promise<PortfolioSnapshot | null> {
  try {
    const snapshot: PortfolioSnapshot = {
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      timestamp: new Date(),
      totalValue: portfolio.totalValueInEur || 0,
      totalCost: portfolio.totalCostInEur || 0,
      unrealizedPnL: portfolio.unrealizedPnL || 0,
      unrealizedPnLPercent: portfolio.unrealizedPnLPercent || 0,
      balances: {},
      positions: {}
    };

    // Extract balances and positions
    if (portfolio.balances) {
      for (const balance of portfolio.balances) {
        snapshot.balances[balance.asset] = balance.total;
      }
    }

    if (portfolio.positions) {
      for (const position of portfolio.positions) {
        snapshot.positions[position.asset] = {
          amount: position.amount,
          entryPrice: position.entryPrice,
          currentPrice: position.currentPrice,
          pnl: position.unrealizedPnL,
          pnlPercent: position.unrealizedPnLPercent
        };
      }
    }

    // Save to database
    const { data, error } = await supabase
      .from('market_observations')
      .insert({
        user_id: userId,
        timestamp: snapshot.timestamp.toISOString(),
        range: '1h', // Hourly snapshot
        asset_category: 'portfolio_snapshot',
        market_context: `Portfolio snapshot: €${snapshot.totalValue}`,
        observed_behavior: JSON.stringify({
          totalValue: snapshot.totalValue,
          pnl: snapshot.unrealizedPnL,
          pnlPercent: snapshot.unrealizedPnLPercent
        }),
        source: 'system'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating snapshot:', error);
      return null;
    }

    console.log('✅ Portfolio snapshot created:', {
      id: snapshot.id,
      value: snapshot.totalValue,
      pnl: snapshot.unrealizedPnL
    });

    return snapshot;
  } catch (error) {
    console.error('Error in createSnapshot:', error);
    return null;
  }
}

/**
 * Get portfolio snapshots for time period
 */
export async function getSnapshots(
  userId: string,
  hoursBack: number = 24
): Promise<PortfolioSnapshot[]> {
  try {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('market_observations')
      .select('*')
      .eq('user_id', userId)
      .eq('asset_category', 'portfolio_snapshot')
      .gt('timestamp', cutoff)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching snapshots:', error);
      return [];
    }

    return (data || []).map(snapshot => {
      try {
        const observed = JSON.parse(snapshot.observed_behavior || '{}');
        return {
          id: snapshot.id,
          userId: snapshot.user_id,
          timestamp: new Date(snapshot.timestamp),
          totalValue: observed.totalValue || 0,
          totalCost: 0, // Not stored in this format
          unrealizedPnL: observed.pnl || 0,
          unrealizedPnLPercent: observed.pnlPercent || 0,
          balances: {},
          positions: {}
        };
      } catch {
        return null;
      };
    }).filter(Boolean) as PortfolioSnapshot[];
  } catch (error) {
    console.error('Error in getSnapshots:', error);
    return [];
  }
}

/**
 * Calculate performance metrics from snapshots
 */
export function calculatePerformanceMetrics(snapshots: PortfolioSnapshot[]): {
  startValue: number;
  endValue: number;
  returnPercent: number;
  highestValue: number;
  lowestValue: number;
  volatility: number;
  dayCount: number;
} {
  if (snapshots.length === 0) {
    return {
      startValue: 0,
      endValue: 0,
      returnPercent: 0,
      highestValue: 0,
      lowestValue: 0,
      volatility: 0,
      dayCount: 0
    };
  }

  const values = snapshots.map(s => s.totalValue);
  const startValue = values[0] || 0;
  const endValue = values[values.length - 1] || 0;
  const returnPercent = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
  const highestValue = Math.max(...values);
  const lowestValue = Math.min(...values);

  // Calculate volatility (standard deviation of daily returns)
  const dailyReturns = [];
  for (let i = 1; i < values.length; i++) {
    const dayReturn = (values[i] - values[i - 1]) / values[i - 1];
    dailyReturns.push(dayReturn);
  }

  const avgReturn = dailyReturns.length > 0 
    ? dailyReturns.reduce((a, b) => a + b) / dailyReturns.length 
    : 0;
  
  const variance = dailyReturns.length > 0
    ? dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length
    : 0;
  
  const volatility = Math.sqrt(variance) * 100; // As percentage

  const dayCount = snapshots.length;

  return {
    startValue,
    endValue,
    returnPercent,
    highestValue,
    lowestValue,
    volatility,
    dayCount
  };
}

/**
 * Get performance chart data
 */
export async function getPerformanceChartData(
  userId: string,
  hoursBack: number = 24
): Promise<{
  timestamps: string[];
  values: number[];
  pnls: number[];
}> {
  const snapshots = await getSnapshots(userId, hoursBack);

  return {
    timestamps: snapshots.map(s => s.timestamp.toISOString()),
    values: snapshots.map(s => s.totalValue),
    pnls: snapshots.map(s => s.unrealizedPnL)
  };
}
