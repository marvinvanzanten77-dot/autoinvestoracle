/**
 * BUDGET ENFORCEMENT (Fact-Based)
 * 
 * Replace scan_jobs counters with gpt_usage_log fact-based tracking.
 * Ensures correct hourly/daily caps even under concurrent scheduler ticks.
 * 
 * For each GPT call decision:
 * 1. Query gpt_usage_log for recent entries (hourly/daily)
 * 2. Check against policy budget limits
 * 3. If approved, make GPT call
 * 4. Insert fact into gpt_usage_log
 * 5. Never rely on counter fields in scan_jobs
 */

import { supabase } from '../../src/lib/supabase/client';

export type BudgetCheckResult = {
  withinDailyBudget: boolean;
  withinHourlyBudget: boolean;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  hourlyUsed: number;
  hourlyLimit: number;
  hourlyRemaining: number;
  canCall: boolean;
  reason: string;
};

// ============================================================================
// CHECK GPT BUDGET
// ============================================================================

/**
 * Check if user can make a GPT call based on fact-based budget logging
 */
export async function checkGptBudget(
  userId: string,
  dailyLimit: number = 5,
  hourlyLimit: number = 2
): Promise<BudgetCheckResult> {
  try {
    const now = new Date();

    // ========================================================================
    // DAILY BUDGET (UTC midnight boundary)
    // ========================================================================
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data: dailyData, error: dailyError } = await supabase
      .from('gpt_usage_log')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
      .eq('success', true);

    if (dailyError) {
      console.error('[BudgetEnforcement] Daily check error:', dailyError);
      return {
        withinDailyBudget: false,
        withinHourlyBudget: false,
        dailyUsed: 0,
        dailyLimit,
        dailyRemaining: 0,
        hourlyUsed: 0,
        hourlyLimit,
        hourlyRemaining: 0,
        canCall: false,
        reason: 'ERROR_BUDGET_CHECK_FAILED'
      };
    }

    const dailyUsed = dailyData?.length || 0;
    const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);
    const withinDailyBudget = dailyUsed < dailyLimit;

    // ========================================================================
    // HOURLY BUDGET (Rolling 60-minute window)
    // ========================================================================
    const oneHourAgo = new Date(now);
    oneHourAgo.setMinutes(oneHourAgo.getMinutes() - 60);

    const { data: hourlyData, error: hourlyError } = await supabase
      .from('gpt_usage_log')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo.toISOString())
      .eq('success', true);

    if (hourlyError) {
      console.error('[BudgetEnforcement] Hourly check error:', hourlyError);
      return {
        withinDailyBudget,
        withinHourlyBudget: false,
        dailyUsed,
        dailyLimit,
        dailyRemaining,
        hourlyUsed: 0,
        hourlyLimit,
        hourlyRemaining: 0,
        canCall: false,
        reason: 'ERROR_BUDGET_CHECK_FAILED'
      };
    }

    const hourlyUsed = hourlyData?.length || 0;
    const hourlyRemaining = Math.max(0, hourlyLimit - hourlyUsed);
    const withinHourlyBudget = hourlyUsed < hourlyLimit;

    // ========================================================================
    // DETERMINE IF CALL CAN PROCEED
    // ========================================================================
    const canCall = withinDailyBudget && withinHourlyBudget;
    let reason = '';

    if (!withinDailyBudget) {
      reason = `DAILY_BUDGET_EXHAUSTED: ${dailyUsed}/${dailyLimit}`;
    } else if (!withinHourlyBudget) {
      reason = `HOURLY_BUDGET_EXHAUSTED: ${hourlyUsed}/${hourlyLimit}`;
    } else {
      reason = `OK: daily ${dailyUsed}/${dailyLimit}, hourly ${hourlyUsed}/${hourlyLimit}`;
    }

    console.log(
      `[BudgetEnforcement] User ${userId}: ${reason}`
    );

    return {
      withinDailyBudget,
      withinHourlyBudget,
      dailyUsed,
      dailyLimit,
      dailyRemaining,
      hourlyUsed,
      hourlyLimit,
      hourlyRemaining,
      canCall,
      reason
    };
  } catch (err) {
    console.error('[BudgetEnforcement] Check error:', err);
    return {
      withinDailyBudget: false,
      withinHourlyBudget: false,
      dailyUsed: 0,
      dailyLimit,
      dailyRemaining: 0,
      hourlyUsed: 0,
      hourlyLimit,
      hourlyRemaining: 0,
      canCall: false,
      reason: 'EXCEPTION_BUDGET_CHECK'
    };
  }
}

// ============================================================================
// LOG GPT USAGE
// ============================================================================

/**
 * Log a GPT API call to gpt_usage_log
 * Must be called AFTER successful GPT response (or failed attempt)
 */
export async function logGptUsage(
  userId: string,
  snapshotId: string | null,
  tokensEstimate: number = 0,
  reason: string = 'analysis',
  success: boolean = true,
  error: string | null = null
): Promise<boolean> {
  try {
    const { error: insertError } = await supabase
      .from('gpt_usage_log')
      .insert({
        user_id: userId,
        snapshot_id: snapshotId,
        tokens_estimate: tokensEstimate,
        reason,
        success,
        error
      });

    if (insertError) {
      console.error('[BudgetEnforcement] Log insert error:', insertError);
      return false;
    }

    console.log(
      `[BudgetEnforcement] Logged GPT usage for ${userId}: ${reason} (${success ? 'success' : 'failed'})`
    );
    return true;
  } catch (err) {
    console.error('[BudgetEnforcement] Log error:', err);
    return false;
  }
}

// ============================================================================
// RESET DAILY BUDGET (Utility for testing/debugging)
// ============================================================================

/**
 * Clear today's GPT usage (admin function, testing only)
 */
export async function clearTodaysBudget(userId: string): Promise<number> {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('gpt_usage_log')
      .delete()
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
      .select('id');

    if (error) {
      console.error('[BudgetEnforcement] Clear error:', error);
      return 0;
    }

    const count = data?.length || 0;
    console.warn(
      `[BudgetEnforcement] Cleared ${count} GPT usage entries for ${userId} (testing only)`
    );
    return count;
  } catch (err) {
    console.error('[BudgetEnforcement] Clear error:', err);
    return 0;
  }
}

// ============================================================================
// BUDGET ANALYTICS
// ============================================================================

/**
 * Get detailed budget usage for a user (analytics)
 */
export async function getBudgetAnalytics(userId: string): Promise<any> {
  try {
    const now = new Date();

    // Last 24 hours
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data, error } = await supabase
      .from('gpt_usage_log')
      .select('created_at, tokens_estimate, success, reason')
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BudgetEnforcement] Analytics error:', error);
      return null;
    }

    const totalCalls = data?.length || 0;
    const successfulCalls = data?.filter((d) => d.success).length || 0;
    const failedCalls = totalCalls - successfulCalls;
    const totalTokens = data?.reduce((sum, d) => sum + (d.tokens_estimate || 0), 0) || 0;
    const reasonCounts: Record<string, number> = {};

    data?.forEach((d) => {
      reasonCounts[d.reason] = (reasonCounts[d.reason] || 0) + 1;
    });

    return {
      period: 'last_24h',
      totalCalls,
      successfulCalls,
      failedCalls,
      totalTokens,
      averageTokensPerCall:
        totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0,
      reasonBreakdown: reasonCounts,
      entries: data
    };
  } catch (err) {
    console.error('[BudgetEnforcement] Analytics error:', err);
    return null;
  }
}
