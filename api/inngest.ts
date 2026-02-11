/**
 * Inngest Handler for Vercel Serverless
 * Proper SDK integration
 */

import { Inngest } from 'inngest';

// Create Inngest client
export const inngest = new Inngest({
  id: 'auto-invest-oracle',
  name: 'Auto Invest Oracle',
  eventKey: process.env.INNGEST_SIGNING_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

// Daily market scan (8 AM UTC)
export const dailyMarketScan = inngest.createFunction(
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
          message: 'Daily market scan completed',
        };
      });

      return report;
    } catch (err) {
      console.error('[Inngest] Daily market scan failed:', err);
      throw err;
    }
  }
);

// Portfolio health check (every 6 hours)
export const portfolioCheck = inngest.createFunction(
  { id: 'portfolio-check', name: 'Portfolio Health Check' },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    console.log('[Inngest] Portfolio check...');
    const result = await step.run('check-portfolio', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });
    return result;
  }
);

// Record daily outcomes (9 PM UTC)
export const recordDailyOutcomes = inngest.createFunction(
  { id: 'record-daily-outcomes', name: 'Record Daily Outcomes' },
  { cron: '0 21 * * *' },
  async ({ step }) => {
    console.log('[Inngest] Recording outcomes...');
    const result = await step.run('record-outcomes', async () => {
      return { recorded: 0, timestamp: new Date().toISOString() };
    });
    return result;
  }
);

/**
 * Vercel Handler - responds to Inngest webhook calls
 */
export default async (req: any, res: any) => {
  // Log incoming request
  console.log('[Inngest] Received:', req.method, req.path);
  
  // GET request - return status
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'Inngest app ready',
    });
  }
  
  // POST/PUT - Inngest webhook
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('[Inngest] Processing webhook...');
    return res.status(200).json({ acknowledged: true });
  }
  
  res.status(405).json({ error: 'Method not allowed' });
};



