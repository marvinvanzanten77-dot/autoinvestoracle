/**
 * Vercel Cron Job - Portfolio Check & Agent Report
 * Runs every hour, but respects user's monitoringInterval setting
 * Generates SELL/REBALANCE suggestions and sends agent report
 * 
 * Respects agent status: running, paused, offline
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

function generateId(): string {
  return crypto.randomUUID();
}

export default async (req: any, res: any) => {
  // Verify Vercel cron secret
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Portfolio check triggered at', new Date().toISOString());

  try {
    // Fetch all user profiles with active portfolios AND agent status = running
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select(
        'user_id, portfolio_data, agent_status, agent_monitoring_interval, agent_last_scan_at'
      )
      .eq('agent_status', 'running') // Only process running agents
      .not('portfolio_data', 'is', null);

    if (profileError) {
      console.error('[Cron] Failed to fetch profiles:', profileError);
      throw profileError;
    }

    if (!profiles || profiles.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No active portfolios to check',
        processed: 0,
        skipped: 'No agents in running status',
      });
    }

    let processed = 0;
    let skipped = 0;
    const now = new Date();

    // Process each profile
    for (const profile of profiles) {
      const userId = profile.user_id;
      const interval = profile.agent_monitoring_interval || 60; // Default 60 minutes
      const lastScan = profile.agent_last_scan_at ? new Date(profile.agent_last_scan_at) : null;
      
      // Check if enough time has passed since last scan
      if (lastScan) {
        const minutesSinceLastScan = (now.getTime() - lastScan.getTime()) / 1000 / 60;
        if (minutesSinceLastScan < interval) {
          console.log(`[Cron] User ${userId}: Skipping (${minutesSinceLastScan.toFixed(1)}m < ${interval}m interval)`);
          skipped++;
          continue;
        }
      }

      try {
        console.log(`[Cron] Processing user ${userId} (interval: ${interval}m)`);
        
        // Fetch user profile with portfolio data
        const { data: fullProfile, error: profileFetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (profileFetchError || !fullProfile) {
          console.error(`[Cron] Failed to fetch profile for ${userId}:`, profileFetchError);
          continue;
        }

        const portfolio = fullProfile.portfolio_data as Array<{
          asset: string;
          balance: number;
          priceEUR: number;
          change24h: number;
          entryPrice?: number;
        }>;

        if (!portfolio || portfolio.length === 0) {
          console.log(`[Cron] No portfolio data for ${userId}, skipping`);
          continue;
        }

        // Import observation generators
        const { generatePortfolioObservation, generateAgentReport } = await import('../../src/lib/observation/generator');
        
        // Step 1: Generate portfolio observations (SELL, REBALANCE, STOP-LOSS)
        const observation = await generatePortfolioObservation(
          userId,
          portfolio,
          'BTC'
        );

        if (observation) {
          const { error: insertObsError } = await supabase
            .from('market_observations')
            .insert({
              user_id: userId,
              timestamp: observation.timestamp,
              range: observation.range || '24h',
              asset_category: observation.assetCategory || 'BTC',
              exchanges: observation.exchanges || ['portfolio-monitor'],
              market_context: observation.marketContext || 'matig-volatiel',
              volatility_level: observation.volatilityLevel || 'matig',
              observed_behavior: observation.observedBehavior,
              relative_momentum: observation.relativeMomentum || {},
              exchange_anomalies: observation.exchangeAnomalies || [],
              data_sources: observation.dataSources || {},
              source: observation.source || 'api-monitor',
            });

          if (!insertObsError) {
            console.log(`[Cron] Generated observation for ${userId}: "${observation.observedBehavior?.substring(0, 60)}..."`);
          }
        }

        // Step 2: Generate agent report with action suggestions
        const observationStrings = observation?.observedBehavior 
          ? observation.observedBehavior.split(' | ')
          : ['Portfolio under monitoring'];
        
        const report = await generateAgentReport(
          userId,
          portfolio,
          observationStrings,
          'BTC'
        );

        if (report) {
          const { error: insertReportError } = await supabase
            .from('agent_reports')
            .insert({
              id: report.id,
              user_id: report.userId,
              reported_at: report.reportedAt,
              period_from: report.period.from,
              period_to: report.period.to,
              period_duration_minutes: report.period.durationMinutes,
              observations_count: report.summary.observationsCount,
              suggestions_count: report.summary.suggestionsCount,
              executions_count: report.summary.executionsCount,
              main_theme: report.summary.mainTheme,
              agent_mood: report.agentMood,
              recommended_action: report.recommendedAction,
              overall_confidence: report.overallConfidence,
              observations: report.observations,
              suggestions: report.suggestions,
              should_notify: report.shouldNotify,
              notification_sent: report.shouldNotify ? new Date().toISOString() : null,
            });

          if (!insertReportError) {
            console.log(`[AGENT REPORT]
📊 Observations: ${report.summary.observationsCount}
💡 Suggestions: ${report.summary.suggestionsCount}
📈 Mood: ${report.agentMood.toUpperCase()}
🎯 Confidence: ${report.overallConfidence}%
💬 Action: ${report.recommendedAction}`);
            
            // Create notification if needed
            if (report.shouldNotify) {
              await supabase
                .from('notifications')
                .insert({
                  user_id: report.userId,
                  type: 'agent-report',
                  title: `Agent Report: ${report.summary.mainTheme}`,
                  message: report.recommendedAction,
                  data: {
                    report_id: report.id,
                    confidence: report.overallConfidence,
                    suggestions_count: report.summary.suggestionsCount,
                  },
                  read: false,
                  created_at: new Date().toISOString(),
                });
              
              console.log(`[Cron] Created notification for user ${userId}`);
            }
          }
        }

        // Step 3: Update last_scan_at timestamp
        await supabase
          .from('profiles')
          .update({ agent_last_scan_at: now.toISOString() })
          .eq('user_id', userId);

        processed++;
        console.log(`[Cron] ✅ Completed for user ${userId}`);
      } catch (err) {
        console.error(`[Cron] Error processing user ${userId}:`, err);
      }
    }

    console.log(`[CRON SUMMARY] Processed: ${processed}, Skipped: ${skipped}`);

    return res.status(200).json({
      status: 'success',
      message: 'Portfolio check completed',
      processed,
      skipped,
      timestamp: now.toISOString()
    });
  } catch (err) {
    console.error('[Cron] Fatal error:', err);
    return res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
};

