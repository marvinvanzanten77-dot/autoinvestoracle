import type { ApiRequest, ApiResponse } from './types';
import { generateObservation } from '../../lib/observation/generator';
import { generateTicketsFromObservation } from '../../lib/observation/ticketGenerator';
import { logObservation, logTicket } from '../../lib/observation/logger';
import type { MarketObservation } from '../../lib/observation/types';
import type { Ticket } from '../../lib/observation/types';

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

function resamplePercentSeries(
  series: Array<{ ts: number; value: number }>,
  points: number
) {
  if (series.length <= 1 || points <= 1) return series;
  const start = series[0].ts;
  const end = series[series.length - 1].ts;
  const step = (end - start) / (points - 1);
  const result: Array<{ ts: number; value: number }> = [];

  let cursor = 0;
  for (let i = 0; i < points; i++) {
    const target = start + step * i;
    while (cursor < series.length - 1 && series[cursor + 1].ts < target) {
      cursor += 1;
    }
    const left = series[cursor];
    const right = series[Math.min(cursor + 1, series.length - 1)];
    if (right.ts === left.ts) {
      result.push({ ts: target, value: left.value });
    } else {
      const ratio = (target - left.ts) / (right.ts - left.ts);
      const value = left.value + (right.value - left.value) * ratio;
      result.push({ ts: target, value });
    }
  }
  return result;
}

async function fetchMarketSparkline(ids: string[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const resp = await fetch(
    `${COINGECKO_BASE}/coins/markets?vs_currency=eur&ids=${ids.join(',')}&sparkline=true`,
    {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'AutoInvestOracle/1.0'
      }
    }
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

function buildDefaultPayload(range: MarketRange) {
  return {
    range,
    updatedAt: new Date().toISOString(),
    changes: {
      bitcoin: 0,
      ethereum: 0,
      stablecoins: 0,
      altcoins: 0
    },
    volatility: {
      level: 'rustig',
      label: 'Rustig tempo',
      detail: 'Geen actuele data beschikbaar; laat later nog eens laden.'
    },
    series: [] as Array<{
      time: string;
      bitcoin: number;
      ethereum: number;
      stablecoins: number;
      altcoins: number;
    }>
  };
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
  if (btc.length === 0 || eth.length === 0) {
    return buildDefaultPayload(range);
  }
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

  const targetPoints = range === '1h' ? 60 : null;
  const btcFinal = targetPoints ? resamplePercentSeries(btcP, targetPoints) : btcP;
  const ethFinal = targetPoints ? resamplePercentSeries(ethP, targetPoints) : ethP;
  const stableFinal = targetPoints ? resamplePercentSeries(stableP, targetPoints) : stableP;
  const altFinal = targetPoints ? resamplePercentSeries(altP, targetPoints) : altP;

  const minLength = Math.min(
    btcFinal.length,
    ethFinal.length,
    stableFinal.length,
    altFinal.length
  );
  const series = Array.from({ length: minLength }, (_, idx) => ({
    time: new Date(btcFinal[idx].ts).toISOString(),
    bitcoin: Number(btcFinal[idx].value.toFixed(2)),
    ethereum: Number(ethFinal[idx].value.toFixed(2)),
    stablecoins: Number(stableFinal[idx].value.toFixed(2)),
    altcoins: Number(altFinal[idx].value.toFixed(2))
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

export async function handleMarketScan(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const range = (req.query?.range as MarketRange) || '24h';
    const effectiveRange: MarketRange = range;
    const userId = (req.query?.userId as string) || 'anonymous';
    const cacheKey = `market:${range}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60_000) {
      res.setHeader?.('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.status(200).json(cached.payload);
      return;
    }

    const payload = await buildMarketScanFromSparkline(effectiveRange);
    
    // 📊 NIEUWE LAAG: Log deze scan als observatie
    try {
      const observation = generateObservation(userId, payload, 'BTC') as MarketObservation;
      observation.id = `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const observationId = await logObservation(observation);
      
      // Genereer tickets uit observatie
      const observationWithId = { ...observation, id: observationId };
      const ticketsPartial = generateTicketsFromObservation(userId, observationWithId);
      
      for (const ticketPartial of ticketsPartial) {
        const ticket: Ticket = {
          id: `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          type: ticketPartial.type || 'observatie',
          title: ticketPartial.title || 'Markt observatie',
          description: ticketPartial.description || '',
          confidence: ticketPartial.confidence || 'middel',
          priority: ticketPartial.priority || 'medium',
          createdAt: new Date().toISOString(),
          validUntil: ticketPartial.validUntil || new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          relatedObservationId: ticketPartial.relatedObservationId,
          pattern: ticketPartial.pattern || '',
          context: ticketPartial.context || ''
        };
        await logTicket(ticket);
      }
      
      console.log(`✅ Observatie-laag: Scan gelogd als observatie ${observationId} met ${ticketsPartial.length} tickets`);
    } catch (obsErr) {
      // Observatie-laag mag niet de scan blokkeren
      console.warn('Observatie-logging mislukt (niet kritiek):', obsErr);
    }
    
    cache.set(cacheKey, { timestamp: Date.now(), payload });
    res.setHeader?.('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    const range = (req.query?.range as MarketRange) || '24h';
    const cacheKey = `market:${range}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader?.('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.status(200).json(cached.payload);
      return;
    }
    try {
      const payload = await buildMarketScanFromSparkline(range);
      cache.set(cacheKey, { timestamp: Date.now(), payload });
      res.setHeader?.('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.status(200).json(payload);
      return;
    } catch (fallbackErr) {
      console.error(fallbackErr);
    }
    res.status(200).json(buildDefaultPayload(range));
  }
}
