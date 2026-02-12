/**
 * API Route: Market Data Cache
 * GET /api/market-data - Get cached market prices for all assets
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const asset = url.searchParams.get('asset');
    const freshOnly = url.searchParams.get('freshOnly') === 'true';

    // If fresh only, check cache age
    const maxAgeSeconds = freshOnly ? 600 : 3600; // 10 min fresh, 1 hour acceptable

    let query = supabase
      .from('market_data_cache')
      .select('*');

    if (asset) {
      query = query.eq('asset', asset.toUpperCase());
    } else {
      query = query.in('asset', ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT', 'LINK', 'DOGE', 'MATIC']);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API] Market data query error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'warning',
          message: 'No market data cached yet. Waiting for first cron run.',
          data: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter by cache age if needed
    let filtered = data;
    if (freshOnly) {
      const now = new Date().getTime();
      filtered = data.filter(item => {
        const age = (now - new Date(item.last_updated).getTime()) / 1000;
        return age <= maxAgeSeconds;
      });
    }

    // Format response
    const prices = filtered.reduce((acc: Record<string, any>, item: any) => {
      acc[item.asset] = {
        priceEUR: item.price_eur,
        priceUSD: item.price_usd,
        change24hEUR: item.change_24h_eur,
        change24hUSD: item.change_24h_usd,
        change7dEUR: item.change_7d_eur,
        change7dUSD: item.change_7d_usd,
        marketCapEUR: item.market_cap_eur,
        marketCapUSD: item.market_cap_usd,
        volume24hEUR: item.volume_24h_eur,
        volume24hUSD: item.volume_24h_usd,
        circulatingSupply: item.circulating_supply,
        totalSupply: item.total_supply,
        maxSupply: item.max_supply,
        fearGreedIndex: item.fear_greed_index,
        fearGreedClassification: item.fear_greed_classification,
        lastUpdated: item.last_updated,
        cacheAgeSecs: item.cache_age_seconds,
      };
      return acc;
    }, {});

    return new Response(
      JSON.stringify({
        status: 'success',
        data: prices,
        timestamp: new Date().toISOString(),
        cacheInfo: {
          assets: filtered.length,
          oldestData: Math.max(...filtered.map((d: any) => d.cache_age_seconds || 0)),
          newestData: Math.min(...filtered.map((d: any) => d.cache_age_seconds || 0)),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[API] Market data error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
