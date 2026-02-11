/**
 * Vercel Cron Job - Daily Market Scan
 * Runs hourly but respects user's interval setting from database
 */

export default async (req: any, res: any) => {
  // Verify Vercel cron secret
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  
  if (secret !== process.env.CRON_SECRET) {
    console.warn('[Cron] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Daily market scan check at', new Date().toISOString());

  try {
    // TODO: Fetch user's interval setting from Supabase
    // const intervalMinutes = await getIntervalFromDatabase();
    // const lastRun = await getLastRunTimeFromDatabase();
    // 
    // if (Date.now() - lastRun < intervalMinutes * 60 * 1000) {
    //   return res.status(200).json({ status: 'skipped', reason: 'interval not reached' });
    // }

    // For now: always run
    const resp = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana,ethereum&vs_currencies=eur'
    );
    const prices = await resp.json();
    
    console.log('[Cron] Market data fetched:', {
      btc: prices.bitcoin?.eur,
      sol: prices.solana?.eur,
      eth: prices.ethereum?.eur,
      timestamp: new Date().toISOString(),
    });

    // TODO: Store in database, generate reports, update observations
    
    return res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      pricesFetched: Object.keys(prices).length,
    });
  } catch (err) {
    console.error('[Cron] Daily market scan failed:', err);
    return res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
};

