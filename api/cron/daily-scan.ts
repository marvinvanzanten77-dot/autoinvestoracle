/**
 * Vercel Cron Job - Daily Pattern Analysis & Learning
 * Runs daily at 00:00 UTC to analyze outcomes and learn patterns
 */

import { createClient } from '@supabase/supabase-js';
import { analyzePatterns } from '../../src/lib/observation/patternLearning';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async (req: any, res: any) => {
  // Verify Vercel cron secret
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  
  if (secret !== process.env.CRON_SECRET) {
    console.warn('[Cron] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Daily pattern analysis starting at', new Date().toISOString());

  try {
    // Get all active users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('agent_status', 'running');

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      console.log('[Cron] No active users to analyze');
      return res.status(200).json({
        status: 'success',
        usersAnalyzed: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Analyze patterns for each user
    const results = [];
    for (const user of users) {
      try {
        console.log(`[Cron] Analyzing patterns for user ${user.user_id}`);
        
        // Note: We can't directly import the function here, so we'll make a direct call
        // In production, this should be moved to the backend
        const patterns = await analyzePatterns(user.user_id);
        
        results.push({
          userId: user.user_id,
          patternsFound: patterns.length,
          status: 'success'
        });
      } catch (error) {
        console.error(`[Cron] Error analyzing patterns for user ${user.user_id}:`, error);
        results.push({
          userId: user.user_id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[Cron] Daily pattern analysis complete:', results);

    return res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      usersAnalyzed: users.length,
      results
    });
  } catch (err) {
    console.error('[Cron] Daily pattern analysis failed:', err);
    return res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
};

