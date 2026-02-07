import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { mockSignals } from '../src/data/mockSignals';
import { generateDailyReportAgent, type DashboardSnapshot } from './ai/dailyReportAgent';
import { generateMarketSummary } from './ai/openaiClient';
import {
  handleAutoLoadMarketData,
  handleGetObservations,
  handleGetLearnedPatterns,
  handleGetDetailedAnalysis,
  handleGetComparison,
  handleGetSourcesHealth,
} from '../src/server/handlers/marketData';
import {
  handleTradingAnalyze,
  handleTradingExecute,
  handleTradingAudit,
  handleTradingSignals,
  handleGetPolicy,
  handleCreatePolicy,
  handleActivatePolicy,
  handleListPolicies,
  handleCreatePolicyFromPreset,
  handleListProposals,
  handleAcceptProposal,
  handleModifyProposal,
  handleDeclineProposal,
  handleTradingEnabled,
  handlePauseScan,
  handleResumeScan,
  handleForceScan,
  handleSchedulerTick,
  handleTradingExecuteUpdated
} from '../src/server/handlers/trading';

const app = express();
const port = process.env.PORT || 4000;
const marketCache = new Map<string, { timestamp: number; payload: unknown }>();

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost:5502',
  'http://127.0.0.1:5502',
  'https://autoinvestoracle.nl',
  'https://www.autoinvestoracle.nl'
];

app.use(
  cors({
    origin: allowedOrigins
  })
);
app.use(express.json());

type DashboardState = typeof mockSignals;

let currentDashboard: DashboardState = { ...mockSignals };

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function randomizeSignals(current: DashboardState): DashboardState {
  const deltaTop = Math.round((Math.random() * 10 - 5));
  const deltaSentiment = Math.round((Math.random() * 6 - 3));

  const nextTopChanceConfidence = clamp(current.topChance.confidence + deltaTop, 0, 100);
  const nextSentiment = clamp(current.marketSentiment.percentage + deltaSentiment, 0, 100);

  const nextSetups = current.topSetups.map((s) => {
    const delta = Math.round(Math.random() * 4 - 2); // -2..+2
    const conf = clamp(s.confidence + delta, 0, 100);
    return { ...s, confidence: conf };
  });

  return {
    ...current,
    topChance: {
      ...current.topChance,
      confidence: nextTopChanceConfidence
    },
    marketSentiment: {
      ...current.marketSentiment,
      percentage: nextSentiment
    },
    topSetups: nextSetups
  };
}

setInterval(() => {
  currentDashboard = randomizeSignals(currentDashboard);
  currentDashboard.scanStatus = 'live';
}, 60_000); // demo: elke 60s

function generateDailyReportText(snapshot: DashboardState): string {
  const topAsset = snapshot.topChance.assetName;
  const risk = snapshot.riskLevel.label;
  return [
    `Dagrapport voor ${snapshot.currentDate}`,
    ``,
    `De AI-scan zag vandaag de meeste kans in ${topAsset}. Het vertrouwen is ${snapshot.topChance.confidence}/100 met een ${snapshot.topChance.direction === 'up' ? 'opwaartse' : snapshot.topChance.direction === 'down' ? 'neerwaartse' : 'afwachtende'} bias.`,
    `Het algemene risiconiveau is ${risk.toLowerCase()}; de markt beweegt volgens onze volatiliteits- en liquiditeitsmeters normaal.`,
    ``,
    `Belangrijkste punten:`,
    `- Sentiment: ${snapshot.marketSentiment.label} (${snapshot.marketSentiment.percentage}%)`,
    `- Top setups: ${snapshot.topSetups.map((s) => `${s.name} (${s.confidence}%)`).join(', ')}`,
    `- Waarschuwingen: ${snapshot.warnings.slice(0, 2).join(' | ')}`,
    ``,
    `Deze tekst is een stub. Vervang generateDailyReportText met echte AI-output wanneer de API klaar staat.`
  ].join('\n');
}

app.get('/api/dashboard', (_req, res) => {
  res.json(currentDashboard);
});

app.post('/api/daily-report', (req, res) => {
  const { portfolioInfo, dashboardSnapshot, profile } = req.body || {};
  const snapshot: DashboardState =
    dashboardSnapshot && typeof dashboardSnapshot === 'object'
      ? { ...currentDashboard, ...dashboardSnapshot }
      : currentDashboard;

  generateDailyReportAgent(snapshot as DashboardSnapshot, profile || 'gebalanceerd')
    .then((reportText) => {
      res.json({
        reportText,
        createdAt: new Date().toISOString(),
        portfolioInfo: portfolioInfo || 'Demo portfolio'
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Kon dagrapport niet genereren.' });
    });
});

app.post('/api/market-summary', async (req, res) => {
  try {
    const { range, changes } = req.body || {};
    if (!range || !changes) {
      res.status(400).json({ error: 'range en changes zijn verplicht.' });
      return;
    }
    const summary = await generateMarketSummary({ range, changes });
    res.json({ summary, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon AI-samenvatting niet ophalen.' });
  }
});

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINS = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  stablecoins: ['tether', 'usd-coin', 'dai'],
  altcoins: ['solana', 'ripple', 'cardano', 'dogecoin']
};

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

async function buildMarketScan(range: string) {
  const now = Date.now();
  const rangeConfig: Record<string, { days: number; windowMs?: number }> = {
    '1h': { days: 1, windowMs: 60 * 60 * 1000 },
    '24h': { days: 1 },
    '7d': { days: 7 }
  };

  const config = rangeConfig[range] || rangeConfig['24h'];
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

// ============================================================================
// NEW: MARKET DATA ENDPOINTS (Auto-loaded + Manual-request)
// ============================================================================

// Auto-loaded: Real-time aggregated market data (BTC + ETH)
app.get('/api/market/auto-load', handleAutoLoadMarketData);

// Manual-request: Detailed observations (requires user trigger)
app.get('/api/market/observations', handleGetObservations);

// Manual-request: Learned patterns (requires user trigger)
app.get('/api/market/patterns', handleGetLearnedPatterns);

// Manual-request: Deep analysis with OpenAI (requires user trigger)
app.get('/api/market/analysis', handleGetDetailedAnalysis);

// Manual-request: BTC vs ETH comparison (requires user trigger)
app.get('/api/market/comparison', handleGetComparison);

// Manual-request: Data source health (diagnostics)
app.get('/api/market/sources-health', handleGetSourcesHealth);

// ============================================================================
// TRADING AGENT ENDPOINTS
// ============================================================================

// POLICY ENDPOINTS
// GET /api/trading/policy — Get active policy
app.get('/api/trading/policy', handleGetPolicy);

// POST /api/trading/policy — Create new policy
app.post('/api/trading/policy', handleCreatePolicy);

// POST /api/trading/policy/activate — Activate a policy
app.post('/api/trading/policy/activate', handleActivatePolicy);

// GET /api/trading/policies — List all user policies
app.get('/api/trading/policies', handleListPolicies);

// POST /api/trading/policies/presets/:preset — Create policy from preset (OBSERVER, HUNTER, SEMI_AUTO)
app.post('/api/trading/policies/presets/:preset', handleCreatePolicyFromPreset);

// PROPOSAL ENDPOINTS
// GET /api/trading/proposals?status=PROPOSED — List proposals with optional status filter
app.get('/api/trading/proposals', handleListProposals);

// POST /api/trading/proposals/:id/accept — Accept a proposal
app.post('/api/trading/proposals/:id/accept', handleAcceptProposal);

// POST /api/trading/proposals/:id/modify — Modify and approve a proposal
app.post('/api/trading/proposals/:id/modify', handleModifyProposal);

// POST /api/trading/proposals/:id/decline — Decline a proposal
app.post('/api/trading/proposals/:id/decline', handleDeclineProposal);

// SCANNING ENDPOINTS
// POST /api/trading/scans/pause — Pause automated scans
app.post('/api/trading/scans/pause', handlePauseScan);

// POST /api/trading/scans/resume — Resume automated scans
app.post('/api/trading/scans/resume', handleResumeScan);

// POST /api/trading/scan/now — Force immediate scan
app.post('/api/trading/scan/now', handleForceScan);

// EXECUTION CONTROL ENDPOINTS
// GET/POST /api/trading/trading-enabled — Get or set trading enabled flag
app.get('/api/trading/trading-enabled', handleTradingEnabled);
app.post('/api/trading/trading-enabled', handleTradingEnabled);

// SCHEDULER ENDPOINT (INTERNAL)
// POST /api/trading/scheduler/tick — Internal: Run scheduled scans (requires SERVER_SECRET header)
app.post('/api/trading/scheduler/tick', handleSchedulerTick);

// ORIGINAL ENDPOINTS (BACKWARD COMPATIBLE)
// POST /api/trading/analyze
// Request: { context: AgentContext }
// Response: { success, signals[], count, timestamp }
app.post('/api/trading/analyze', handleTradingAnalyze);

// POST /api/trading/execute (UPDATED: now checks for APPROVED status)
// Request: { proposalId: string }
// Response: { success, orderId, message }
app.post('/api/trading/execute', handleTradingExecuteUpdated);

// GET /api/trading/audit?userId=...&limit=50&offset=0
// Response: { success, executions[], count, limit, offset }
app.get('/api/trading/audit', handleTradingAudit);

// GET /api/trading/signals?userId=...&hoursBack=24
// Response: { success, signals[], count, hoursBack }
app.get('/api/trading/signals', handleTradingSignals);

// ============================================================================
// LEGACY ENDPOINTS (Keep for backward compatibility)
// ============================================================================

app.get('/api/market-scan', async (req, res) => {
  try {
    const range = typeof req.query.range === 'string' ? req.query.range : '24h';
    const cacheKey = `market:${range}`;
    const cached = marketCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60_000) {
      res.json(cached.payload);
      return;
    }

    const payload = await buildMarketScan(range);
    marketCache.set(cacheKey, { timestamp: Date.now(), payload });
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon marktdata niet ophalen.' });
  }
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
