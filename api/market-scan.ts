type MarketRange = '1h' | '24h' | '7d';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINS = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  stablecoins: ['tether', 'usd-coin'],
  altcoins: ['solana', 'cardano']
};

const cache = new Map<string, { timestamp: number; payload: unknown }>();

function averageSeries(seriesList: [number, number][][]) {
  const minLength = Math.min(...seriesList.map((series) => series.length));
  return Array.from({ length: minLength }, (_, idx) => {
    const ts = seriesList[0][idx][0];
    const avg =
      seriesList.reduce((sum, series) => sum + series[idx][1], 0) / seriesList.length;
    return [ts, avg] as [number, number];
  });
}

function toPercentSeries(series: [number, number][]) {
  if (series.length === 0) return [];
  const base = series[0][1];
  return series.map(([ts, price]) => ({
    ts,
    value: ((price - base) / base) * 100
  }));
}

async function fetchMarketChart(coinId: string, days: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const resp = await fetch(
    `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=eur&days=${days}`,
    { signal: controller.signal }
  );
  clearTimeout(timeout);
  if (!resp.ok) {
    throw new Error(`CoinGecko error ${resp.status}`);
  }
  const data = (await resp.json()) as { prices: [number, number][] };
  return data.prices;
}

async function fetchMarketSparkline(ids: string[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const resp = await fetch(
    `${COINGECKO_BASE}/coins/markets?vs_currency=eur&ids=${ids.join(',')}&sparkline=true`,
    { signal: controller.signal }
  );
  clearTimeout(timeout);
  if (!resp.ok) {
    throw new Error(`CoinGecko error ${resp.status}`);
  }
  const data = (await resp.json()) as Array<{
    id: string;
    sparkline_in_7d?: { price?: number[] };
  }>;
  return data;
}

function seriesFromSparkline(prices: number[]) {
  const totalMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const count = prices.length;
  if (count === 0) return [];
  const step = totalMs / Math.max(count - 1, 1);
  const start = now - totalMs;
  return prices.map((price, idx) => [start + idx * step, price] as [number, number]);
}

async function buildMarketScanFromSparkline(range: MarketRange) {
  const ids = [
    COINS.bitcoin,
    COINS.ethereum,
    ...COINS.stablecoins,
    ...COINS.altcoins
  ];
  const rows = await fetchMarketSparkline(ids);
  const map = new Map<string, [number, number][]>();
  rows.forEach((row) => {
    const prices = row.sparkline_in_7d?.price || [];
    map.set(row.id, seriesFromSparkline(prices));
  });

  const btc = map.get(COINS.bitcoin) || [];
  const eth = map.get(COINS.ethereum) || [];
  const stableSeries = COINS.stablecoins.map((id) => map.get(id)).filter(Boolean) as [number, number][][];
  const altSeries = COINS.altcoins.map((id) => map.get(id)).filter(Boolean) as [number, number][][];

  const stable = stableSeries.length ? averageSeries(stableSeries) : btc;
  const alt = altSeries.length ? averageSeries(altSeries) : eth;

  const windowMs =
    range === '1h' ? 60 * 60 * 1000 : range === '24h' ? 24 * 60 * 60 * 1000 : null;
  const cutoff = windowMs ? Date.now() - windowMs : null;
  const filter = (series: [number, number][]) =>
    cutoff ? series.filter(([ts]) => ts >= cutoff) : series;

  const btcP = toPercentSeries(filter(btc));
  const ethP = toPercentSeries(filter(eth));
  const stableP = toPercentSeries(filter(stable));
  const altP = toPercentSeries(filter(alt));

  const minLength = Math.min(btcP.length, ethP.length, stableP.length, altP.length);
  const series = Array.from({ length: minLength }, (_, idx) => ({
    time: new Date(btcP[idx].ts).toISOString(),
    bitcoin: Number(btcP[idx].value.toFixed(2)),
    ethereum: Number(ethP[idx].value.toFixed(2)),
    stablecoins: Number(stableP[idx].value.toFixed(2)),
    altcoins: Number(altP[idx].value.toFixed(2))
  }));

  const last = series[series.length - 1] || {
    bitcoin: 0,
    ethereum: 0,
    stablecoins: 0,
    altcoins: 0
  };

  const avgAbs =
    (Math.abs(last.bitcoin) +
      Math.abs(last.ethereum) +
      Math.abs(last.stablecoins) +
      Math.abs(last.altcoins)) /
    4;

  const volatility =
    avgAbs >= 4
      ? {
          level: 'hoog',
          label: 'Onrustig tempo',
          detail: 'De bewegingen zijn vandaag duidelijk groter dan normaal.'
        }
      : avgAbs >= 2
        ? {
            level: 'matig',
            label: 'Licht onrustig',
            detail: 'Er is wat meer beweging, maar geen extreme uitschieters.'
          }
        : {
            level: 'rustig',
            label: 'Rustig tempo',
            detail: 'Geen sterke uitschieters zichtbaar in de afgelopen uren.'
          };

  return {
    range,
    updatedAt: new Date().toISOString(),
    changes: {
      bitcoin: last.bitcoin,
      ethereum: last.ethereum,
      stablecoins: last.stablecoins,
      altcoins: last.altcoins
    },
    volatility,
    series
  };
}

async function buildMarketScan(range: MarketRange) {
  const now = Date.now();
  const rangeConfig: Record<MarketRange, { days: number; windowMs?: number }> = {
    '1h': { days: 1, windowMs: 60 * 60 * 1000 },
    '24h': { days: 1 },
    '7d': { days: 7 }
  };

  const config = rangeConfig[range];
  const useCompact = range !== '24h';
  const stableList = useCompact ? [COINS.stablecoins[0]] : COINS.stablecoins;
  const altList = useCompact ? [COINS.altcoins[0]] : COINS.altcoins;

  const requestList: Array<{ key: string; fetcher: Promise<[number, number][]> }> = [
    { key: 'btc', fetcher: fetchMarketChart(COINS.bitcoin, config.days) },
    { key: 'eth', fetcher: fetchMarketChart(COINS.ethereum, config.days) },
    ...stableList.map((coin, idx) => ({
      key: `stable_${idx}`,
      fetcher: fetchMarketChart(coin, config.days)
    })),
    ...altList.map((coin, idx) => ({
      key: `alt_${idx}`,
      fetcher: fetchMarketChart(coin, config.days)
    }))
  ];

  const settled = await Promise.allSettled(requestList.map((item) => item.fetcher));
  const seriesMap = new Map<string, [number, number][]>();
  settled.forEach((result, idx) => {
    const key = requestList[idx].key;
    if (result.status === 'fulfilled') {
      seriesMap.set(key, result.value);
    } else {
      console.error(`Market fetch failed: ${key}`, result.reason);
    }
  });

  const btc = seriesMap.get('btc');
  const eth = seriesMap.get('eth');
  if (!btc || !eth) {
    throw new Error('Kernmarktdata ontbreekt.');
  }

  const stableSeries = stableList.map((_, idx) => seriesMap.get(`stable_${idx}`)).filter(Boolean) as [
    number,
    number
  ][][];
  const altSeries = altList.map((_, idx) => seriesMap.get(`alt_${idx}`)).filter(Boolean) as [
    number,
    number
  ][][];

  const stable = stableSeries.length ? averageSeries(stableSeries) : btc;
  const alt = altSeries.length ? averageSeries(altSeries) : eth;

  const cutoff = config.windowMs ? now - config.windowMs : null;
  const filter = (series: [number, number][]) =>
    cutoff ? series.filter(([ts]) => ts >= cutoff) : series;

  const btcP = toPercentSeries(filter(btc));
  const ethP = toPercentSeries(filter(eth));
  const stableP = toPercentSeries(filter(stable));
  const altP = toPercentSeries(filter(alt));

  const minLength = Math.min(btcP.length, ethP.length, stableP.length, altP.length);
  const series = Array.from({ length: minLength }, (_, idx) => ({
    time: new Date(btcP[idx].ts).toISOString(),
    bitcoin: Number(btcP[idx].value.toFixed(2)),
    ethereum: Number(ethP[idx].value.toFixed(2)),
    stablecoins: Number(stableP[idx].value.toFixed(2)),
    altcoins: Number(altP[idx].value.toFixed(2))
  }));

  const last = series[series.length - 1] || {
    bitcoin: 0,
    ethereum: 0,
    stablecoins: 0,
    altcoins: 0
  };

  const avgAbs =
    (Math.abs(last.bitcoin) +
      Math.abs(last.ethereum) +
      Math.abs(last.stablecoins) +
      Math.abs(last.altcoins)) /
    4;

  const volatility =
    avgAbs >= 4
      ? {
          level: 'hoog',
          label: 'Onrustig tempo',
          detail: 'De bewegingen zijn vandaag duidelijk groter dan normaal.'
        }
      : avgAbs >= 2
        ? {
            level: 'matig',
            label: 'Licht onrustig',
            detail: 'Er is wat meer beweging, maar geen extreme uitschieters.'
          }
        : {
            level: 'rustig',
            label: 'Rustig tempo',
            detail: 'Geen sterke uitschieters zichtbaar in de afgelopen uren.'
          };

  return {
    range,
    updatedAt: new Date().toISOString(),
    changes: {
      bitcoin: last.bitcoin,
      ethereum: last.ethereum,
      stablecoins: last.stablecoins,
      altcoins: last.altcoins
    },
    volatility,
    series
  };
}

export default async function handler(req: { method?: string; query?: Record<string, string> }, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const range = (req.query?.range as MarketRange) || '24h';
    const effectiveRange: MarketRange = range === '24h' ? '24h' : '24h';
    const cacheKey = `market:${range}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60_000) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.status(200).json(cached.payload);
      return;
    }

    let payload;
    try {
      payload = await buildMarketScan(effectiveRange);
    } catch (err) {
      console.error('Primary market scan failed, using sparkline fallback.', err);
      payload = await buildMarketScanFromSparkline(effectiveRange);
    }
    payload = { ...payload, range };
    cache.set(cacheKey, { timestamp: Date.now(), payload });
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    const range = (req.query?.range as MarketRange) || '24h';
    const cacheKey = `market:${range}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.status(200).json(cached.payload);
      return;
    }
    try {
      const payload = await buildMarketScanFromSparkline('24h');
      const ranged = { ...payload, range };
      cache.set(cacheKey, { timestamp: Date.now(), payload: ranged });
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.status(200).json(ranged);
      return;
    } catch (fallbackErr) {
      console.error(fallbackErr);
    }
    try {
      const payload = await buildMarketScanFromSparkline(range);
      cache.set(cacheKey, { timestamp: Date.now(), payload });
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.status(200).json(payload);
      return;
    } catch (fallbackErr) {
      console.error(fallbackErr);
    }
    res.status(500).json({ error: 'Kon marktdata niet ophalen.' });
  }
}
