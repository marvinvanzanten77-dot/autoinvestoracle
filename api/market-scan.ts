type MarketRange = '1h' | '24h' | '7d';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINS = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  stablecoins: ['tether', 'usd-coin', 'dai'],
  altcoins: ['solana', 'ripple', 'cardano', 'dogecoin']
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
  const resp = await fetch(
    `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=eur&days=${days}`
  );
  if (!resp.ok) {
    throw new Error(`CoinGecko error ${resp.status}`);
  }
  const data = (await resp.json()) as { prices: [number, number][] };
  return data.prices;
}

async function buildMarketScan(range: MarketRange) {
  const now = Date.now();
  const rangeConfig: Record<MarketRange, { days: number; windowMs?: number }> = {
    '1h': { days: 1, windowMs: 60 * 60 * 1000 },
    '24h': { days: 1 },
    '7d': { days: 7 }
  };

  const config = rangeConfig[range];
  const [btc, eth, usdt, usdc, dai, sol, xrp, ada, doge] = await Promise.all([
    fetchMarketChart(COINS.bitcoin, config.days),
    fetchMarketChart(COINS.ethereum, config.days),
    fetchMarketChart(COINS.stablecoins[0], config.days),
    fetchMarketChart(COINS.stablecoins[1], config.days),
    fetchMarketChart(COINS.stablecoins[2], config.days),
    fetchMarketChart(COINS.altcoins[0], config.days),
    fetchMarketChart(COINS.altcoins[1], config.days),
    fetchMarketChart(COINS.altcoins[2], config.days),
    fetchMarketChart(COINS.altcoins[3], config.days)
  ]);

  const stable = averageSeries([usdt, usdc, dai]);
  const alt = averageSeries([sol, xrp, ada, doge]);

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
    const cacheKey = `market:${range}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60_000) {
      res.status(200).json(cached.payload);
      return;
    }

    const payload = await buildMarketScan(range);
    cache.set(cacheKey, { timestamp: Date.now(), payload });
    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon marktdata niet ophalen.' });
  }
}
