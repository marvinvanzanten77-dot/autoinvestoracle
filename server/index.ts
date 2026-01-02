import express from 'express';
import cors from 'cors';
import { mockSignals } from '../src/data/mockSignals';
import { generateDailyReportAgent, type DashboardSnapshot } from './ai/dailyReportAgent';

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost:5502',
  'http://127.0.0.1:5502'
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

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
