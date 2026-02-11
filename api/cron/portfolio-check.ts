/**
 * Vercel Cron Job - Portfolio Check
 * Runs every hour, checks for SELL/REBALANCE opportunities
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async (req: any, res: any) => {
  // Verify Vercel cron secret
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Portfolio health check triggered at', new Date().toISOString());

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

        // Generate portfolio observations (SELL, REBALANCE, STOP-LOSS)
        const { generatePortfolioObservation } = await import('../../src/lib/observation/generator');
        
        const observation = await generatePortfolioObservation(
          profile.user_id,
          portfolio,
          'BTC'
        );

        if (observation) {
          // Log the observation
          const { error: insertError } = await supabase
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

          if (!insertError) {
            observationsGenerated++;
            console.log(`[Cron] Generated observation for user ${profile.user_id}: ${observation.observedBehavior?.substring(0, 80)}...`);
          }
        }

        processedCount++;
      } catch (userError) {
        console.error(`[Cron] Error processing user portfolio:`, userError);
      }
    }

    return res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      message: 'Portfolio check completed',
      processed: processedCount,
      observationsGenerated,
    });
  } catch (err) {
    console.error('[Cron] Portfolio check failed:', err);
    return res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
};

