import { handleChat } from '../src/server/handlers/chat.js';
import { handleMarketScan } from '../src/server/handlers/marketScan.js';
import { handleMarketSummary } from '../src/server/handlers/marketSummary.js';
import { handlePortfolioAllocate } from '../src/server/handlers/portfolioAllocate.js';
import { handleProfileGet } from '../src/server/handlers/profileGet.js';
import { handleProfileUpsert } from '../src/server/handlers/profileUpsert.js';
import { handleSessionAuth } from '../src/server/handlers/sessionAuth.js';
import { handleSessionInit } from '../src/server/handlers/sessionInit.js';
import { handleSessionLogout } from '../src/server/handlers/sessionLogout.js';
import { handleExchangeConnect } from '../src/server/handlers/exchanges/connect.js';
import { handleExchangeDisconnect } from '../src/server/handlers/exchanges/disconnect.js';
import { handleExchangeStatus } from '../src/server/handlers/exchanges/status.js';
import { handleExchangeSync } from '../src/server/handlers/exchanges/sync.js';
import { handleExchangeHealth } from '../src/server/handlers/exchanges/health.js';
import type { ApiRequest, ApiResponse } from '../src/server/handlers/types';

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void;

const routes: Record<string, Handler> = {
  chat: handleChat,
  'market-scan': handleMarketScan,
  'market-summary': handleMarketSummary,
  'portfolio-allocate': handlePortfolioAllocate,
  'profile/get': handleProfileGet,
  'profile/upsert': handleProfileUpsert,
  'session/init': handleSessionInit,
  'session/auth': handleSessionAuth,
  'session/logout': handleSessionLogout,
  'exchanges/connect': handleExchangeConnect,
  'exchanges/disconnect': handleExchangeDisconnect,
  'exchanges/status': handleExchangeStatus,
  'exchanges/sync': handleExchangeSync,
  'exchanges/_health': handleExchangeHealth
};

function getOriginalPath(req: { headers?: Record<string, string | string[] | undefined>; url?: string }) {
  const headers = req.headers || {};
  const original = headers['x-vercel-original-path'];
  if (typeof original === 'string') return original;
  return req.url || '/api';
}

function buildQuery(url: URL) {
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const rawUrl = getOriginalPath(req);
  const base = `http://${(req.headers?.host as string) || 'localhost'}`;
  const url = new URL(rawUrl, base);
  const pathname = url.pathname;
  const path = pathname.replace(/^\/api\/?/, '');
  const route = path || '';

  const handlerFn = routes[route];
  if (!handlerFn) {
    res.status(404).json({ error: 'Route niet gevonden.' });
    return;
  }

  const nextReq: ApiRequest = {
    ...req,
    url: req.url,
    query: buildQuery(url)
  };

  await handlerFn(nextReq, res);
}
