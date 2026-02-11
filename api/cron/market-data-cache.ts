/**
 * Vercel Cron Job - Market Data Caching
 * Runs every 30 minutes to fetch and cache CoinGecko data
 * Ensures constant data availability for agent and ChatGPT
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Assets to fetch
const ASSETS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT', 'LINK', 'DOGE', 'MATIC'];

// CoinGecko coin IDs
const COIN_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOT: 'polkadot',
  LINK: 'chainlink',
  DOGE: 'dogecoin',
  MATIC: 'matic-network',
};

interface CoinGeckoPrice {
  [key: string]: {
    eur: number;
    usd: number;
    eur_24h_change: number;
    usd_24h_change: number;
    eur_7d_change?: number;
    usd_7d_change?: number;
    eur_market_cap: number;
    usd_market_cap: number;
    eur_24h_vol: number;
    usd_24h_vol: number;
    circulating_supply: number;
    total_supply?: number;
    max_supply?: number;
  };
}

interface CoinGeckoMarketData {
  [key: string]: {
    market_cap_rank?: number;
  };
}

interface FearGreedResponse {
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
}

async function fetchCoinGeckoData(): Promise<Map<string, any>> {
  try {
    const coinIds = ASSETS.map(asset => COIN_IDS[asset]).join(',');
    
    // Fetch prices
    const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=eur,usd&include_24hr_change=true&include_market_cap=true&include_market_cap_change_24h=true&include_circulating_supply=true`;
    
    console.log('[CronJob] Fetching CoinGecko prices...');
    const priceResponse = await fetch(priceUrl);
    
    if (!priceResponse.ok) {
      throw new Error(`CoinGecko price fetch failed: ${priceResponse.status}`);
    }
    
    const prices = (await priceResponse.json()) as CoinGeckoPrice;
    
    // Fetch Fear & Greed Index
    console.log('[CronJob] Fetching Fear & Greed Index...');
    const fgUrl = 'https://api.alternative.me/fng/?limit=1&format=json';
    const fgResponse = await fetch(fgUrl);
    const fgData = (await fgResponse.json()) as FearGreedResponse;
    
    const fearGreedIndex = fgData.data?.[0]?.value || '50';
    const fearGreedClassification = fgData.data?.[0]?.value_classification || 'Neutral';
    
    // Map data
    const dataMap = new Map();
    
    for (const asset of ASSETS) {
      const coinId = COIN_IDS[asset];
      const priceData = prices[coinId];
      
      if (priceData) {
        dataMap.set(asset, {
          asset,
          coin_id: coinId,
          price_eur: priceData.eur,
          price_usd: priceData.usd,
          change_24h_eur: priceData.eur_24h_change,
          change_24h_usd: priceData.usd_24h_change,
          change_7d_eur: priceData.eur_7d_change || 0,
          change_7d_usd: priceData.usd_7d_change || 0,
          market_cap_eur: priceData.eur_market_cap,
          market_cap_usd: priceData.usd_market_cap,
          volume_24h_eur: priceData.eur_24h_vol,
          volume_24h_usd: priceData.usd_24h_vol,
          circulating_supply: priceData.circulating_supply,
          total_supply: priceData.total_supply,
          max_supply: priceData.max_supply,
          fear_greed_index: parseInt(fearGreedIndex),
          fear_greed_classification: fearGreedClassification,
        });
      }
    }
    
    return dataMap;
  } catch (error) {
    console.error('[CronJob] Error fetching CoinGecko data:', error);
    throw error;
  }
}

async function updateMarketCache(dataMap: Map<string, any>): Promise<number> {
  let updatedCount = 0;
  
  for (const [asset, data] of dataMap) {
    try {
      const { error } = await supabase
        .from('market_data_cache')
        .upsert({
          asset,
          ...data,
          last_updated: new Date().toISOString(),
        }, { onConflict: 'asset' });
      
      if (error) {
        console.error(`[CronJob] Error updating ${asset}:`, error);
      } else {
        updatedCount++;
        console.log(`[CronJob] Updated ${asset} cache`);
      }
    } catch (err) {
      console.error(`[CronJob] Exception updating ${asset}:`, err);
    }
  }
  
  return updatedCount;
}

async function recordHistory(dataMap: Map<string, any>): Promise<void> {
  const records = Array.from(dataMap.values()).map(data => ({
    asset: data.asset,
    price_eur: data.price_eur,
    price_usd: data.price_usd,
    change_24h_eur: data.change_24h_eur,
    market_cap_eur: data.market_cap_eur,
    volume_24h_eur: data.volume_24h_eur,
    recorded_at: new Date().toISOString(),
    source: 'coingecko',
  }));
  
  try {
    const { error } = await supabase
      .from('market_data_history')
      .insert(records);
    
    if (error) {
      console.error('[CronJob] Error recording history:', error);
    } else {
      console.log(`[CronJob] Recorded ${records.length} history entries`);
    }
  } catch (err) {
    console.error('[CronJob] Exception recording history:', err);
  }
}

export default async (req: any, res: any) => {
  // Verify Vercel cron secret
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[CronJob] Market data cache job started at', new Date().toISOString());

  try {
    // Fetch CoinGecko data
    const dataMap = await fetchCoinGeckoData();
    
    if (dataMap.size === 0) {
      return res.status(200).json({
        status: 'warning',
        message: 'No data fetched from CoinGecko',
        timestamp: new Date().toISOString(),
      });
    }
    
    // Update cache
    const updatedCount = await updateMarketCache(dataMap);
    
    // Record history
    await recordHistory(dataMap);
    
    // Log summary
    const summary = Array.from(dataMap.entries()).map(([asset, data]) => 
      `${asset}: €${data.price_eur.toFixed(2)} (${data.change_24h_eur > 0 ? '+' : ''}${data.change_24h_eur.toFixed(2)}%)`
    ).join(' | ');
    
    console.log(`[CronJob] Market Cache Summary: ${summary}`);
    console.log(`[CronJob] Fear & Greed: ${Array.from(dataMap.values())[0]?.fear_greed_classification} (${Array.from(dataMap.values())[0]?.fear_greed_index})`);

    return res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      message: 'Market data cache updated',
      updated: updatedCount,
      assets: ASSETS,
    });
  } catch (err) {
    console.error('[CronJob] Market cache job failed:', err);
    return res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
};
