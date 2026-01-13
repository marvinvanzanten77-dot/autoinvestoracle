import type { ApiRequest, ApiResponse } from '../src/server/handlers/types';

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void;

const routes: Record<string, Handler> = {
  chat: async (req, res) => {
    const { handleChat } = await import('../src/server/handlers/chat');
    return handleChat(req, res);
  },
  'market-scan': async (req, res) => {
    const { handleMarketScan } = await import('../src/server/handlers/marketScan');
    return handleMarketScan(req, res);
  },
  'market-summary': async (req, res) => {
    const { handleMarketSummary } = await import('../src/server/handlers/marketSummary');
    return handleMarketSummary(req, res);
  },
  'portfolio-allocate': async (req, res) => {
    const { handlePortfolioAllocate } = await import('../src/server/handlers/portfolioAllocate');
    return handlePortfolioAllocate(req, res);
  },
  'profile/get': async (req, res) => {
    const { handleProfileGet } = await import('../src/server/handlers/profileGet');
    return handleProfileGet(req, res);
  },
  'profile/upsert': async (req, res) => {
    const { handleProfileUpsert } = await import('../src/server/handlers/profileUpsert');
    return handleProfileUpsert(req, res);
  },
  'session/init': async (req, res) => {
    const { handleSessionInit } = await import('../src/server/handlers/sessionInit');
    return handleSessionInit(req, res);
  },
  'session/auth': async (req, res) => {
    const { handleSessionAuth } = await import('../src/server/handlers/sessionAuth');
    return handleSessionAuth(req, res);
  },
  'session/logout': async (req, res) => {
    const { handleSessionLogout } = await import('../src/server/handlers/sessionLogout');
    return handleSessionLogout(req, res);
  },
  'exchanges/connect': async (req, res) => {
    const { handleExchangeConnect } = await import('../src/server/handlers/exchanges/connect');
    return handleExchangeConnect(req, res);
  },
  'exchanges/disconnect': async (req, res) => {
    const { handleExchangeDisconnect } = await import('../src/server/handlers/exchanges/disconnect');
    return handleExchangeDisconnect(req, res);
  },
  'exchanges/status': async (req, res) => {
    const { handleExchangeStatus } = await import('../src/server/handlers/exchanges/status');
    return handleExchangeStatus(req, res);
  },
  'exchanges/sync': async (req, res) => {
    const { handleExchangeSync } = await import('../src/server/handlers/exchanges/sync');
    return handleExchangeSync(req, res);
  },
  'exchanges/_health': async (req, res) => {
    const { handleExchangeHealth } = await import('../src/server/handlers/exchanges/health');
    return handleExchangeHealth(req, res);
  }
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
