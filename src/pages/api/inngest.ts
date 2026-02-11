/**
 * Inngest Handler for Vercel Serverless
 * 
 * This endpoint receives webhook calls from Inngest
 * Inngest calls this to trigger background jobs
 */

import { inngest, dailyMarketScan, portfolioCheck, recordDailyOutcomes } from '@/server/inngest';
import { serve } from 'inngest/vercel';

/**
 * Export serve function for Vercel
 * POST /api/inngest - Receives webhook calls from Inngest
 * GET /api/inngest - Returns function definitions
 */
export default serve({
  client: inngest,
  functions: [
    dailyMarketScan,
    portfolioCheck,
    recordDailyOutcomes,
  ],
});
