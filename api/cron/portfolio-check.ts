/**
 * Vercel Cron Job - Portfolio Check & Agent Report
 * Runs every hour, generates SELL/REBALANCE suggestions and sends agent report
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
    // Fetch all user profiles with active portfolios
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, portfolio_data')
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
      });
    }

    let processedCount = 0;
    let observationsGenerated = 0;
    let reportsGenerated = 0;

    // Process each user's portfolio
    for (const profile of profiles) {
      try {
        const portfolio = profile.portfolio_data as Array<{
          asset: string;
          balance: number;
          priceEUR: number;
          change24h: number;
          entryPrice?: number;
        }>;

        if (!portfolio || portfolio.length === 0) continue;

        const { generatePortfolioObservation, generateAgentReport } = await import('../../src/lib/observation/generator');
        
        // Step 1: Generate portfolio observations (SELL, REBALANCE, STOP-LOSS)
        const observation = await generatePortfolioObservation(
          profile.user_id,
          portfolio,
          'BTC'
        );

        if (observation) {
          const { error: insertObsError } = await supabase
            .from('market_observations')
            .insert({
              user_id: profile.user_id,
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
            observationsGenerated++;
            console.log(`[Cron] Generated observation for ${profile.user_id}: "${observation.observedBehavior?.substring(0, 60)}..."`);
          }
        }

        // Step 2: Generate agent report with action suggestions
        const observationStrings = observation?.observedBehavior 
          ? observation.observedBehavior.split(' | ')
          : ['Portfolio under monitoring'];
        
        const report = await generateAgentReport(
          profile.user_id,
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
            reportsGenerated++;
            
            // Log the report
            const logMessage = `[AGENT REPORT ${report.reportedAt}]
📊 Observations: ${report.summary.observationsCount}
💡 Suggestions: ${report.summary.suggestionsCount}
📈 Mood: ${report.agentMood.toUpperCase()}
🎯 Confidence: ${report.overallConfidence}%
💬 Action: ${report.recommendedAction}`;
            
            console.log(logMessage);
            
            // Also create a notification if needed
            if (report.shouldNotify) {
              const { error: notifError } = await supabase
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
              
              if (!notifError) {
                console.log(`[Cron] Created notification for user ${profile.user_id}`);
              }
            }
          }
        }

        processedCount++;
      } catch (userError) {
        console.error(`[Cron] Error processing user portfolio:`, userError);
      }
    }

    const summaryMessage = `[CRON SUMMARY] Processed: ${processedCount}, Observations: ${observationsGenerated}, Reports: ${reportsGenerated}`;
    console.log(summaryMessage);

    return res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      message: 'Portfolio check completed',
      processed: processedCount,
      observationsGenerated,
      reportsGenerated,
    });
  } catch (err) {
    console.error('[Cron] Portfolio check failed:', err);
    return res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
};

