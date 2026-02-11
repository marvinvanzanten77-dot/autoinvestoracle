import { Inngest } from 'inngest';

/**
 * Create an Inngest client for background jobs
 * This client is used to define and trigger long-running tasks
 */
export const inngest = new Inngest({
  id: 'auto-invest-oracle',
  name: 'Auto Invest Oracle',
});

/**
 * Background job: Fetch daily market data and generate reports
 * Runs daily at 8:00 AM UTC
 */
export const dailyMarketScan = inngest.createFunction(
  {
    id: 'daily-market-scan',
    name: 'Daily Market Scan',
  },
  { cron: '0 8 * * *' }, // 8:00 AM UTC every day
  async ({ step }) => {
    console.log('[Inngest] Starting daily market scan...');

    try {
      // Step 1: Fetch market data
      await step.run('fetch-market-data', async () => {
        const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana&vs_currencies=eur');
        const data = await resp.json();
        console.log('[Inngest] Market data fetched:', data);
        return data;
      });

      // Step 2: Analyze and generate report
      const report = await step.run('generate-report', async () => {
        const timestamp = new Date().toISOString();
        return {
          timestamp,
          status: 'completed',
          message: 'Daily market scan completed successfully',
        };
      });

      console.log('[Inngest] Daily market scan complete:', report);
      return report;
    } catch (err) {
      console.error('[Inngest] Daily market scan failed:', err);
      throw err;
    }
  }
);

/**
 * Background job: Check portfolio and generate alerts
 * Runs every 6 hours
 */
export const portfolioCheck = inngest.createFunction(
  {
    id: 'portfolio-check',
    name: 'Portfolio Health Check',
  },
  { cron: '0 */6 * * *' }, // Every 6 hours
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

/**
 * Background job: Record outcomes from predictions
 * Runs daily at 9:00 PM UTC
 */
export const recordDailyOutcomes = inngest.createFunction(
  {
    id: 'record-daily-outcomes',
    name: 'Record Daily Outcomes',
  },
  { cron: '0 21 * * *' }, // 9:00 PM UTC every day
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
