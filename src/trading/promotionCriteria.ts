/**
 * PROMOTION CRITERIA & AUTO-SCALING
 *
 * Operational confidence-based limit increases: €25 → €100 → €500 → ∞
 * 
 * Confidence is TIME-BASED (operational experience), NOT account-size-based.
 * Bitvavo balance serves as hard limit (can't trade what you don't have).
 *
 * Promotion happens when:
 * 1. Enough execution history (N >= 100 orders)
 * 2. High success rate (>= 98% without double-orders)
 * 3. Low unknown-outcome recovery rate (< 5%)
 *
 * Anti-gaming metric: recovery_rate < 5% ensures we're not over-relying on
 * reconciliation to fix bugs; we want the primary execution path to work.
 */

import { supabase } from '../lib/supabase/client';

export type ConfidenceLevel = 'TRAINING' | 'VALIDATED' | 'PRODUCTION' | 'MATURE';
export type OrderLimit = 25 | 100 | 500 | 10000; // in EUR; 10000 = no limit (check balance)

export interface PromotionCriteria {
  minExecutions: number;
  minSuccessRate: number; // percentage, e.g., 0.98 = 98%
  maxRecoveryRate: number; // percentage, e.g., 0.05 = 5%
}

const PROMOTION_RULES: Record<ConfidenceLevel, PromotionCriteria> = {
  TRAINING: {
    minExecutions: 10,
    minSuccessRate: 0.95, // 95% success
    maxRecoveryRate: 0.10 // 10% recovery acceptable
  },
  VALIDATED: {
    minExecutions: 100,
    minSuccessRate: 0.98, // 98% success
    maxRecoveryRate: 0.05 // 5% recovery max
  },
  PRODUCTION: {
    minExecutions: 500,
    minSuccessRate: 0.99, // 99% success
    maxRecoveryRate: 0.03 // 3% recovery max
  },
  MATURE: {
    minExecutions: 1000,
    minSuccessRate: 0.99, // 99%+ success
    maxRecoveryRate: 0.02 // 2% recovery max
  }
};

const LIMIT_FOR_CONFIDENCE: Record<ConfidenceLevel, OrderLimit> = {
  TRAINING: 25,
  VALIDATED: 100,
  PRODUCTION: 500,
  MATURE: 10000
};

/**
 * Check if user qualifies for promotion to next level
 *
 * Returns: { eligible: boolean, reason: string, metrics?: { ... } }
 */
export async function checkPromotionEligibility(
  userId: string,
  currentLevel: ConfidenceLevel
): Promise<{
  eligible: boolean;
  reason: string;
  nextLevel?: ConfidenceLevel;
  metrics?: {
    totalExecutions: number;
    successRate: number;
    recoveryRate: number;
  };
  newLimit?: OrderLimit;
}> {
  try {
    // Fetch metrics from execution_stats_24h
    const { data: stats, error } = await supabase
      .from('execution_stats_24h')
      .select(
        'total_executions, success_rate, reconcile_found, hard_failures, soft_failures'
      )
      .eq('user_id', userId)
      .single();

    if (error || !stats) {
      return {
        eligible: false,
        reason: 'No execution statistics available yet'
      };
    }

    // Calculate metrics
    const totalExecutions = stats.total_executions || 0;
    const successRate = (stats.success_rate || 0) / 100; // Convert percentage to decimal
    const softFailures = stats.soft_failures || 0;
    const recoveryRate = totalExecutions > 0 ? softFailures / totalExecutions : 0;

    // Determine next level (skip if at MATURE)
    let nextLevel: ConfidenceLevel | null = null;
    if (currentLevel === 'TRAINING') nextLevel = 'VALIDATED';
    if (currentLevel === 'VALIDATED') nextLevel = 'PRODUCTION';
    if (currentLevel === 'PRODUCTION') nextLevel = 'MATURE';

    if (!nextLevel) {
      return {
        eligible: false,
        reason: 'Already at maximum confidence level (MATURE)',
        metrics: { totalExecutions, successRate, recoveryRate }
      };
    }

    // Check criteria for next level
    const criteria = PROMOTION_RULES[nextLevel];
    const meetsExecutions = totalExecutions >= criteria.minExecutions;
    const meetsSuccessRate = successRate >= criteria.minSuccessRate;
    const meetsRecoveryRate = recoveryRate <= criteria.maxRecoveryRate;

    if (!meetsExecutions) {
      return {
        eligible: false,
        reason: `Need ${criteria.minExecutions} executions for ${nextLevel}; have ${totalExecutions}`,
        metrics: { totalExecutions, successRate, recoveryRate }
      };
    }

    if (!meetsSuccessRate) {
      const percent = (successRate * 100).toFixed(1);
      const needed = (criteria.minSuccessRate * 100).toFixed(1);
      return {
        eligible: false,
        reason: `Success rate ${percent}% below required ${needed}% for ${nextLevel}`,
        metrics: { totalExecutions, successRate, recoveryRate }
      };
    }

    if (!meetsRecoveryRate) {
      const percent = (recoveryRate * 100).toFixed(1);
      const max = (criteria.maxRecoveryRate * 100).toFixed(1);
      return {
        eligible: false,
        reason: `Recovery rate ${percent}% above max ${max}% for ${nextLevel} (too many timeouts)`,
        metrics: { totalExecutions, successRate, recoveryRate }
      };
    }

    // All criteria met: eligible for promotion
    const newLimit = LIMIT_FOR_CONFIDENCE[nextLevel];
    return {
      eligible: true,
      reason: `Qualifies for promotion to ${nextLevel} (executions=${totalExecutions}, success=${(successRate * 100).toFixed(1)}%, recovery=${(recoveryRate * 100).toFixed(1)}%)`,
      nextLevel,
      metrics: { totalExecutions, successRate, recoveryRate },
      newLimit
    };
  } catch (err: any) {
    return {
      eligible: false,
      reason: `Error checking eligibility: ${err?.message || String(err)}`
    };
  }
}

/**
 * Promote user to higher confidence level
 *
 * Updates user_policies.confidence_level and order_limit
 * Logs promotion event
 */
export async function promoteToNextLevel(
  userId: string,
  currentLevel: ConfidenceLevel
): Promise<{
  success: boolean;
  newLevel?: ConfidenceLevel;
  newLimit?: OrderLimit;
  message: string;
}> {
  try {
    // Check eligibility first
    const eligibility = await checkPromotionEligibility(userId, currentLevel);
    if (!eligibility.eligible || !eligibility.nextLevel) {
      return {
        success: false,
        message: eligibility.reason
      };
    }

    const nextLevel = eligibility.nextLevel;
    const newLimit = eligibility.newLimit!;

    // Update user policies
    const { error } = await supabase
      .from('user_policies')
      .update({
        confidence_level: nextLevel,
        order_limit_eur: newLimit,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      return {
        success: false,
        message: `Failed to update policy: ${error.message}`
      };
    }

    // Log promotion event
    const metrics = eligibility.metrics;
    const logMessage = `Promoted from ${currentLevel} to ${nextLevel}. Metrics: ${metrics?.totalExecutions} executions, ${(metrics?.successRate ? metrics.successRate * 100 : 0).toFixed(1)}% success, ${(metrics?.recoveryRate ? metrics.recoveryRate * 100 : 0).toFixed(1)}% recovery. New limit: €${newLimit}`;

    await supabase
      .from('audit_log')
      .insert({
        user_id: userId,
        event_type: 'CONFIDENCE_PROMOTION',
        details: {
          from_level: currentLevel,
          to_level: nextLevel,
          new_limit_eur: newLimit,
          metrics
        },
        created_at: new Date().toISOString()
      })
      .catch((err) => console.warn('[promoteToNextLevel] Failed to log audit:', err));

    console.log(`[promoteToNextLevel] ${logMessage}`);

    return {
      success: true,
      newLevel,
      newLimit,
      message: logMessage
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Promotion failed: ${err?.message || String(err)}`
    };
  }
}

/**
 * Get current order limit for user based on confidence level
 */
export function getLimitForConfidence(level: ConfidenceLevel): OrderLimit {
  return LIMIT_FOR_CONFIDENCE[level];
}

/**
 * Get confidence level from user policy
 */
export async function getUserConfidenceLevel(userId: string): Promise<ConfidenceLevel> {
  const { data, error } = await supabase
    .from('user_policies')
    .select('confidence_level')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.warn(`[getUserConfidenceLevel] Could not fetch level for user ${userId}:`, error);
    return 'TRAINING'; // Default to safest level
  }

  return (data.confidence_level || 'TRAINING') as ConfidenceLevel;
}

/**
 * Run promotion checks for a user (called by hourly cron job)
 */
export async function checkAndPromoteIfEligible(userId: string): Promise<{
  promoted: boolean;
  oldLevel?: ConfidenceLevel;
  newLevel?: ConfidenceLevel;
  message: string;
}> {
  try {
    const currentLevel = await getUserConfidenceLevel(userId);
    const eligibility = await checkPromotionEligibility(userId, currentLevel);

    if (!eligibility.eligible) {
      return {
        promoted: false,
        message: `User ${userId} (${currentLevel}): ${eligibility.reason}`
      };
    }

    const promotion = await promoteToNextLevel(userId, currentLevel);
    if (promotion.success) {
      return {
        promoted: true,
        oldLevel: currentLevel,
        newLevel: promotion.newLevel,
        message: promotion.message
      };
    } else {
      return {
        promoted: false,
        message: `Promotion check passed but promotion failed: ${promotion.message}`
      };
    }
  } catch (err: any) {
    return {
      promoted: false,
      message: `Error checking promotion for user ${userId}: ${err?.message || String(err)}`
    };
  }
}
