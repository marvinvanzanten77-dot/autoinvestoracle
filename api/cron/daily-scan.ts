/**
 * Vercel Cron Job - Daily Market Scan
 * Runs daily at 8 AM UTC
 */

export default async (req: any, res: any) => {
  // Verify Vercel cron secret
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  
  if (secret !== process.env.CRON_SECRET) {
    console.warn('[Cron] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Daily market scan triggered at', new Date().toISOString());

  try {
    // Fetch market data from CoinGecko
    const resp = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana,ethereum&vs_currencies=eur'
    );
    const prices = await resp.json();
    
    console.log('[Cron] Market data fetched:', {
      btc: prices.bitcoin?.eur,
      sol: prices.solana?.eur,
      eth: prices.ethereum?.eur,
    });

    // TODO: Store in database, generate reports, etc
    
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
