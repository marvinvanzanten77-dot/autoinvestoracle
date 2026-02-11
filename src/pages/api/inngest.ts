/**
 * Inngest Handler for Vercel
 * 
 * This endpoint receives webhook calls from Inngest
 * Inngest calls this to trigger background jobs
 */

import { inngest, dailyMarketScan, portfolioCheck, recordDailyOutcomes } from '@/server/inngest';
import { serve } from 'inngest/next';

/**
 * Export serve function for Vercel
 * POST /api/inngest - Receives webhook calls from Inngest
 * GET /api/inngest - Returns function definitions
 */
export const { GET, POST } = serve({
  client: inngest,
  functions: [
    dailyMarketScan,
    portfolioCheck,
    recordDailyOutcomes,
  ],
});
