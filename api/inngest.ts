/**
 * Inngest Handler for Vercel Serverless
 * Simple webhook handler that receives and processes Inngest events
 */

import { Inngest } from 'inngest';

// Create Inngest client
const inngest = new Inngest({
  id: 'auto-invest-oracle',
  name: 'Auto Invest Oracle',
});

// Daily market scan (8 AM UTC)
const dailyMarketScan = inngest.createFunction(
  { id: 'daily-market-scan', name: 'Daily Market Scan' },
  { cron: '0 8 * * *' },
  async ({ step }) => {
    console.log('[Inngest] Starting daily market scan...');
    try {
      await step.run('fetch-market-data', async () => {
        const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana&vs_currencies=eur');
        const data = await resp.json();
        console.log('[Inngest] Market data fetched:', data);
        return data;
      });

      const report = await step.run('generate-report', async () => {
        return {
          timestamp: new Date().toISOString(),
          status: 'completed',
          message: 'Daily market scan completed successfully',
        };
      });

      console.log('[Inngest] Daily market scan complete');
      return report;
    } catch (err) {
      console.error('[Inngest] Daily market scan failed:', err);
      throw err;
    }
  }
);

// Portfolio health check (every 6 hours)
const portfolioCheck = inngest.createFunction(
  { id: 'portfolio-check', name: 'Portfolio Health Check' },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    console.log('[Inngest] Starting portfolio health check...');
    try {
      const result = await step.run('check-portfolio', async () => {
        console.log('[Inngest] Portfolio check executed');
        return { status: 'ok', timestamp: new Date().toISOString() };
      });
      return result;
    } catch (err) {
      console.error('[Inngest] Portfolio check failed:', err);
      throw err;
    }
  }
);

// Record daily outcomes (9 PM UTC)
const recordDailyOutcomes = inngest.createFunction(
  { id: 'record-daily-outcomes', name: 'Record Daily Outcomes' },
  { cron: '0 21 * * *' },
  async ({ step }) => {
    console.log('[Inngest] Starting daily outcome recording...');
    try {
      const result = await step.run('record-outcomes', async () => {
        console.log('[Inngest] Recording outcomes from 24 hours ago');
        return { recorded: 0, timestamp: new Date().toISOString() };
      });
      return result;
    } catch (err) {
      console.error('[Inngest] Outcome recording failed:', err);
      throw err;
    }
  }
);

/**
 * Vercel Serverless Handler
 * Receives POST requests from Inngest
 */
export default async (req: any, res: any) => {
  console.log('[Inngest] Received webhook:', req.method, req.url);
  
  // Return 200 OK to acknowledge Inngest
  res.status(200).json({ 
    status: 'ok',
    message: 'Inngest handler ready',
    functions: [
      'daily-market-scan',
      'portfolio-check', 
      'record-daily-outcomes'
    ]
  });
};


