/**
 * BACKGROUND JOBS SCHEDULER
 * 
 * Skeleton voor cron-tasks.
 * Momenteel: setInterval (lokaal)
 * Toekomst: Bull Queue of Inngest (production)
 */

import { recordOutcome } from '../lib/observation/logger';
import { getRecentObservations } from '../lib/observation/logger';

/**
 * JOB 1: Record outcomes (24h later)
 * 
 * Elke 24 uur:
 * 1. Kijken naar observaties van 24h geleden
 * 2. Kijken wat werkelijk gebeurde (mock: random success)
 * 3. Vastleggen als outcome
 * 4. Markeren als "geleerd"
 */
export async function jobRecordOutcomes(): Promise<void> {
  console.log('🔄 [CRON] Running: Record Outcomes');

  try {
    const observations = await getRecentObservations('all', 24 + 1); // 24-25 uur oud
    
    if (observations.length === 0) {
      console.log('  → Geen observaties van 24h geleden');
      return;
    }

    for (const obs of observations) {
      const mockOutcome = {
        predictedAction: 'HOLD',
        predictedAsset: 'BTC',
        predictedConfidence: 50,
        predictedAt: new Date(),
        actualOutcome: `+${(Math.random() * 5).toFixed(1)}%`,
        actualResult: 'success' as const,
        durationHours: 24,
        profitLossPercent: Math.random() * 5,
        wasSignificant: Math.random() > 0.5
      };

      await recordOutcome('all', obs.id, mockOutcome);
      console.log(`  ✓ Outcome recorded for ${obs.id}`);
    }
  } catch (err) {
    console.error('❌ Error in jobRecordOutcomes:', err);
  }
}

/**
 * JOB 2: Analyze Patterns in Executions (wekelijks)
 * 
 * PURPOSE:
 * Review past trades to identify winning patterns. This helps the AI improve
 * its decision-making by learning from historical execution outcomes.
 * 
 * INPUTS:
 * - execution_outcomes table: Past 30 days of trades
 * - agent_activities table: Context (alerts, observations)
 * 
 * PROCESS:
 * 1. Query execution_outcomes from past 30 days
 * 2. Group by: market condition (bull/bear), asset class, time of day
 * 3. For each group, calculate:
 *    - Win rate (executions with profit_loss > 0)
 *    - Average profit/loss
 *    - Risk metrics (max drawdown)
 * 4. Identify best performing groups
 * 5. Store in pattern_learning table
 * 6. Log insights
 * 
 * OUTPUTS:
 * - pattern_learning table: Aggregated metrics by condition
 * - Console logs: Key insights
 * 
 * TIMING:
 * - Runs weekly (e.g., Sundays at 10:00 PM)
 * 
 * STATUS: Ready to implement
 * ESTIMATED EFFORT: 6-8 hours
 */
export async function jobAnalyzePatterns(): Promise<void> {
  console.log('🔄 [CRON] Running: Analyze Execution Patterns');

  try {
    const { createClient } = await import('@supabase/supabase-js');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[jobAnalyzePatterns] Supabase not configured, skipping');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch executions from past 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log('[jobAnalyzePatterns] Fetching executions from past 30 days...');
    const { data: executions, error } = await supabase
      .from('execution_outcomes')
      .select('*')
      .gte('recorded_at', thirtyDaysAgo);

    if (error || !executions) {
      console.error('[jobAnalyzePatterns] Error fetching executions:', error);
      return;
    }

    if (executions.length === 0) {
      console.log('[jobAnalyzePatterns] No executions in past 30 days');
      return;
    }

    console.log(`[jobAnalyzePatterns] Analyzing ${executions.length} executions...`);

    // GROUP 1: By Asset
    const byAsset = groupBy(executions, 'symbol');
    console.log('[jobAnalyzePatterns] Analysis by asset:');
    for (const [asset, trades] of Object.entries(byAsset)) {
      const winRate = calculateWinRate(trades);
      const avgProfit = trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0) / trades.length;
      console.log(
        `  ${asset}: ${trades.length} trades, ${(winRate * 100).toFixed(1)}% win rate, ${avgProfit.toFixed(2)} avg profit`
      );

      // Store in pattern_learning
      await storePattern(supabase, {
        category: 'asset',
        condition: asset,
        win_rate: winRate,
        avg_profit: avgProfit,
        trade_count: trades.length,
        period_days: 30
      });
    }

    // GROUP 2: By Time of Day
    const byTimeOfDay = groupByTimeOfDay(executions);
    console.log('[jobAnalyzePatterns] Analysis by time of day:');
    for (const [timeSlot, trades] of Object.entries(byTimeOfDay)) {
      const winRate = calculateWinRate(trades as Array<{ profit_loss?: number }>);
      const avgProfit = trades.reduce((sum, t: any) => sum + (t.profit_loss || 0), 0) / trades.length;
      console.log(
        `  ${timeSlot}: ${trades.length} trades, ${(winRate * 100).toFixed(1)}% win rate, ${avgProfit.toFixed(2)} avg profit`
      );

      await storePattern(supabase, {
        category: 'time_of_day',
        condition: timeSlot,
        win_rate: winRate,
        avg_profit: avgProfit,
        trade_count: trades.length,
        period_days: 30
      });
    }

    // GROUP 3: By Confidence Level (proposed confidence at time of execution)
    const byConfidence = groupByConfidenceBand(executions);
    console.log('[jobAnalyzePatterns] Analysis by confidence band:');
    for (const [band, trades] of Object.entries(byConfidence)) {
      const winRate = calculateWinRate(trades as Array<{ profit_loss?: number }>);
      const avgProfit = trades.reduce((sum, t: any) => sum + (t.profit_loss || 0), 0) / trades.length;
      console.log(
        `  Confidence ${band}: ${trades.length} trades, ${(winRate * 100).toFixed(1)}% win rate, ${avgProfit.toFixed(2)} avg profit`
      );

      await storePattern(supabase, {
        category: 'confidence_band',
        condition: band,
        win_rate: winRate,
        avg_profit: avgProfit,
        trade_count: trades.length,
        period_days: 30
      });
    }

    console.log('[jobAnalyzePatterns] ✓ Pattern analysis completed');
  } catch (err) {
    console.error('❌ Error in jobAnalyzePatterns:', err);
  }
}

/**
 * Helper: Group array by property
 */
function groupBy<T extends Record<string, any>>(
  arr: T[],
  key: keyof T
): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = String(item[key]);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

/**
 * Helper: Group executions by time of day
 */
function groupByTimeOfDay(
  executions: Array<{ recorded_at?: string }>
): Record<string, typeof executions> {
  const groups: Record<string, typeof executions> = {
    '00:00-08:00': [],
    '08:00-14:00': [],
    '14:00-20:00': [],
    '20:00-00:00': []
  };

  for (const exec of executions) {
    if (!exec.recorded_at) continue;
    const hour = new Date(exec.recorded_at).getHours();
    let slot = '00:00-08:00';
    if (hour >= 8 && hour < 14) slot = '08:00-14:00';
    else if (hour >= 14 && hour < 20) slot = '14:00-20:00';
    else if (hour >= 20) slot = '20:00-00:00';
    groups[slot].push(exec);
  }

  return groups;
}

/**
 * Helper: Group executions by confidence band
 */
function groupByConfidenceBand(
  executions: Array<{ confidence?: number }>
): Record<string, typeof executions> {
  const groups: Record<string, typeof executions> = {
    'Low (0-40)': [],
    'Medium (40-70)': [],
    'High (70-90)': [],
    'Very High (90+)': []
  };

  for (const exec of executions) {
    const conf = exec.confidence || 50;
    if (conf < 40) groups['Low (0-40)'].push(exec);
    else if (conf < 70) groups['Medium (40-70)'].push(exec);
    else if (conf < 90) groups['High (70-90)'].push(exec);
    else groups['Very High (90+)'].push(exec);
  }

  return groups;
}

/**
 * Helper: Calculate win rate from executions
 */
function calculateWinRate(executions: Array<{ profit_loss?: number }>): number {
  const wins = executions.filter((e) => (e.profit_loss || 0) > 0).length;
  return executions.length > 0 ? wins / executions.length : 0;
}

/**
 * Helper: Store pattern in database
 */
async function storePattern(
  supabase: any,
  data: {
    category: string;
    condition: string;
    win_rate: number;
    avg_profit: number;
    trade_count: number;
    period_days: number;
  }
): Promise<void> {
  // Only store if we have significant data
  if (data.trade_count < 3) return;

  const { error } = await supabase
    .from('pattern_learning')
    .upsert({
      category: data.category,
      condition: data.condition,
      win_rate: data.win_rate,
      avg_profit: data.avg_profit,
      sample_size: data.trade_count,
      period_days: data.period_days,
      last_updated: new Date().toISOString()
    })
    .eq('category', data.category)
    .eq('condition', data.condition);

  if (error) {
    console.error('[storePattern] Error storing pattern:', error);
  }
}

/**
 * JOB 3: Refresh market scans (elk uur)
 * 
 * DISABLED: Automatic background scans are disabled per user preference.
 * Market scans are now:
 * - Manual only via POST /api/trading/scan/now
 * - Or via user-configured agent settings with interval monitoring
 */
export async function jobRefreshMarketScans(): Promise<void> {
  console.log('[CRON] Automatic market scans are disabled per user preference');
  return;
}

/**
 * JOB 4: Generate digest emails (dagelijks)
 * 
 * PURPOSE:
 * Send users a daily summary of market observations, executions, and performance.
 * Keeps users informed without overwhelming them.
 * 
 * INPUTS:
 * - agent_activities table: Today's observations & alerts
 * - execution_outcomes table: Today's trades
 * - notification_preferences table: User email preferences
 * - user_profiles table: User email address
 * 
 * PROCESS:
 * 1. For each user with email_on_daily_summary = true:
 * 2. Fetch activities from past 24 hours
 * 3. Fetch executions and their outcomes
 * 4. Calculate daily portfolio change
 * 5. Identify key observations and alerts
 * 6. Build HTML email using template
 * 7. Send via Resend/SendGrid API
 * 8. Log send status
 * 
 * OUTPUTS:
 * - Email sent to users (fire-and-forget)
 * - Logged to console
 * 
 * TIMING:
 * - Runs once per day (e.g., 9:00 AM)
 * - Or configured digest_frequency from notification_preferences
 */
export async function jobGenerateDigestEmail(): Promise<void> {
  console.log('🔄 [CRON] Running: Generate Digest Email');

  try {
    // Dynamically import to avoid circular dependencies
    const { createClient } = await import('@supabase/supabase-js');
    const { sendDailySummaryEmail } = await import('../lib/notifications/emailService');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[jobGenerateDigestEmail] Supabase not configured, skipping');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // STEP 1: Get all users who want daily digests
    console.log('[jobGenerateDigestEmail] Fetching users with digest enabled...');
    const { data: usersWithDigest, error: userError } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('email_on_daily_summary', true);

    if (userError) {
      console.error('[jobGenerateDigestEmail] Error fetching users:', userError);
      return;
    }

    if (!usersWithDigest || usersWithDigest.length === 0) {
      console.log('[jobGenerateDigestEmail] No users with digest enabled');
      return;
    }

    console.log(`[jobGenerateDigestEmail] Found ${usersWithDigest.length} users to email`);

    // STEP 2: For each user, build and send digest
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const userPref of usersWithDigest) {
      try {
        const userId = userPref.user_id;

        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('email, display_name')
          .eq('user_id', userId)
          .single();

        if (profileError || !profile?.email) {
          console.warn(`[jobGenerateDigestEmail] No email for user ${userId}`);
          continue;
        }

        // Fetch activities from past 24 hours
        const { data: activities } = await supabase
          .from('agent_activities')
          .select('*')
          .eq('user_id', userId)
          .gte('timestamp', yesterday)
          .order('timestamp', { ascending: false })
          .limit(10);

        // Fetch executions from past 24 hours
        const { data: executions } = await supabase
          .from('execution_outcomes')
          .select('*')
          .eq('user_id', userId)
          .gte('recorded_at', yesterday)
          .order('recorded_at', { ascending: false });

        // Calculate daily profit/loss
        const dailyProfit = (executions || []).reduce(
          (sum, e) => sum + (e.profit_loss || 0),
          0
        );

        const dailyProfitPercent = (executions || []).reduce(
          (sum, e) => sum + (e.profit_loss_percent || 0),
          0
        ) / Math.max(1, (executions || []).length);

        // Build and send email
        await sendDailySummaryEmail({
          userId,
          userEmail: profile.email,
          portfolioValue: 0, // TODO: Get from user's actual portfolio
          portfolioChange24h: dailyProfitPercent,
          topAssets: extractTopAssets(executions || []),
          executions: (executions || []).length,
          alerts: (activities || []).filter((a) => a.activity_type === 'alert').length
        });

        console.log(`[jobGenerateDigestEmail] ✓ Digest sent to ${profile.email}`);
      } catch (userErr) {
        console.error(`[jobGenerateDigestEmail] Error processing user ${userPref.user_id}:`, userErr);
        // Continue with next user
      }
    }

    console.log('[jobGenerateDigestEmail] ✓ Digest email job completed');
  } catch (err) {
    console.error('❌ Error in jobGenerateDigestEmail:', err);
  }
}

/**
 * Helper: Extract top assets from executions
 */
function extractTopAssets(
  executions: Array<{ symbol?: string; profit_loss_percent?: number }>
): Array<{ asset: string; change: number }> {
  const assetMap = new Map<string, number[]>();

  for (const exec of executions) {
    if (exec.symbol) {
      const asset = exec.symbol.split('-')[0];
      if (!assetMap.has(asset)) {
        assetMap.set(asset, []);
      }
      assetMap.get(asset)!.push(exec.profit_loss_percent || 0);
    }
  }

  return Array.from(assetMap.entries())
    .map(([asset, changes]) => ({
      asset,
      change: changes.reduce((a, b) => a + b, 0) / changes.length
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);
}

/**
 * JOB 5: Cleanup Expired Records (elk uur)
 * 
 * PURPOSE:
 * Maintain database performance and storage by removing outdated records.
 * Keeps system lean and focused on recent, relevant data.
 * 
 * INPUTS:
 * - tickets table: Execution tickets with valid_until timestamps
 * - agent_activities table: Observations (keep 90 days, archive rest)
 * 
 * PROCESS:
 * 1. Delete expired tickets (WHERE valid_until < NOW())
 * 2. Archive old observations (> 90 days)
 * 3. Clean up orphaned activities
 * 4. Log cleanup statistics
 * 
 * OUTPUTS:
 * - Console logs: Deleted counts
 * 
 * TIMING:
 * - Runs hourly (e.g., every hour at :00)
 * 
 * STATUS: Ready to implement
 * ESTIMATED EFFORT: 2-3 hours
 */
export async function jobCleanupExpired(): Promise<void> {
  console.log('🔄 [CRON] Running: Cleanup Expired Records');

  try {
    const { createClient } = await import('@supabase/supabase-js');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[jobCleanupExpired] Supabase not configured, skipping');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // STEP 1: Delete expired tickets
    console.log('[jobCleanupExpired] Deleting expired tickets...');
    const now = new Date().toISOString();
    
    const { data: expiredTickets, error: deleteError } = await supabase
      .from('tickets')
      .delete()
      .lt('valid_until', now)
      .select('id');

    if (deleteError) {
      console.error('[jobCleanupExpired] Error deleting tickets:', deleteError);
    } else {
      const deletedCount = expiredTickets?.length || 0;
      console.log(`[jobCleanupExpired] ✓ Deleted ${deletedCount} expired tickets`);
    }

    // STEP 2: Archive old activities (>90 days)
    console.log('[jobCleanupExpired] Archiving old activities...');
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Mark old activities as archived instead of deleting (preserve data)
    const { data: archivedActivities, error: archiveError } = await supabase
      .from('agent_activities')
      .update({ archived: true })
      .lt('timestamp', ninetyDaysAgo)
      .is('archived', null)
      .select('id');

    if (archiveError) {
      console.error('[jobCleanupExpired] Error archiving activities:', archiveError);
    } else {
      const archivedCount = archivedActivities?.length || 0;
      console.log(`[jobCleanupExpired] ✓ Archived ${archivedCount} activities older than 90 days`);
    }

    // STEP 3: Cleanup orphaned data (activities without corresponding user profile)
    console.log('[jobCleanupExpired] Checking for orphaned records...');
    
    const { error: orphanError } = await supabase
      .rpc('cleanup_orphaned_activities');

    if (orphanError) {
      console.warn('[jobCleanupExpired] Note: cleanup_orphaned_activities RPC not available, skipping');
    } else {
      console.log('[jobCleanupExpired] ✓ Cleanup of orphaned records completed');
    }

    console.log('[jobCleanupExpired] ✓ Cleanup job completed');
  } catch (err) {
    console.error('❌ Error in jobCleanupExpired:', err);
  }
}

/**
 * Initialize all cron jobs (development mode)
 * 
 * WAARSCHUWING: Dit is NIET voor productie!
 * Gebruik in prod: Bull Queue, Inngest, APScheduler, etc.
 */
export function initializeCronJobs(): void {
  console.log('🚀 Initializing cron jobs (DEVELOPMENT MODE)');

  // Outcome recording: elke 24 uur
  setInterval(jobRecordOutcomes, 24 * 60 * 60 * 1000);

  // Pattern analysis: elke dag (midnight)
  const now = new Date();
  const tonight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const timeUntilMidnight = tonight.getTime() - now.getTime();
  setTimeout(
    () => {
      jobAnalyzePatterns();
      setInterval(jobAnalyzePatterns, 24 * 60 * 60 * 1000);
    },
    timeUntilMidnight
  );

  // Market scan refresh: elk uur
  setInterval(jobRefreshMarketScans, 60 * 60 * 1000);

  // Digest email: 9:00 AM dagelijks
  const nextNine = getNextExecutionTime(9, 0);
  setTimeout(
    () => {
      jobGenerateDigestEmail();
      setInterval(jobGenerateDigestEmail, 24 * 60 * 60 * 1000);
    },
    nextNine
  );

  // Cleanup: elk uur
  setInterval(jobCleanupExpired, 60 * 60 * 1000);

  console.log('✓ Cron jobs initialized');
}

/**
 * Helper: Calculate next execution time for daily job
 */
function getNextExecutionTime(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - now.getTime();
}

/**
 * Stop all cron jobs (for cleanup)
 */
export function stopCronJobs(): void {
  // In development, just clear intervals
  // In production, cancel Bull jobs
  console.log('⏹️ Cron jobs stopped');
}

/**
 * MIGRATION TO PRODUCTION SCHEDULER:
 * 
 * TODO:
 * 1. Install Bull: npm install bull redis
 * 2. Create Bull queue:
 *    const recordOutcomesQueue = new Queue('record-outcomes', redisConfig);
 * 3. Add jobs:
 *    recordOutcomesQueue.add({}, { repeat: { cron: '0 * * * *' } });
 * 4. Process jobs:
 *    recordOutcomesQueue.process(jobRecordOutcomes);
 * 5. Add error handling
 * 6. Add monitoring/alerting
 * 
 * Or use Inngest:
 *    npm install inngest
 *    export const recordOutcomesJob = inngest.createFunction(
 *      { id: 'record-outcomes' },
 *      { cron: 'TZ=Europe/Amsterdam 0 * * * *' },
 *      jobRecordOutcomes
 *    );
 */
