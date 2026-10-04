import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { kv } from '@vercel/kv';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { runObservation, type RunStore } from './runner.js';

const require = createRequire(import.meta.url);
const base = 'https://api.bitvavo.com/v2';
const store: RunStore = {
  claim: async id => (await kv.set(`cron:claim:${id}`, true, { nx: true })) === 'OK',
  get: async id => kv.get(`cron:audit:${id}`),
  save: async audit => { await kv.set(`cron:audit:${audit.id}`, audit); }
};

export function authorized(header: unknown, secret = process.env.CRON_SECRET): boolean {
  if (!secret || typeof header !== 'string') return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function request(endpoint: string, credentials?: { apiKey: string; apiSecret: string }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const timestamp = Date.now().toString();
    const headers: Record<string, string> = {};
    if (credentials) {
      headers['Bitvavo-Access-Key'] = credentials.apiKey;
      headers['Bitvavo-Access-Timestamp'] = timestamp;
      headers['Bitvavo-Access-Signature'] = createHmac('sha256', credentials.apiSecret)
        .update(`${timestamp}GET/v2${endpoint}`).digest('hex');
    }
    const response = await fetch(base + endpoint, { headers, signal: AbortSignal.timeout(10000) });
    if (response.ok) return response.json();
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    // Do not log upstream response bodies or credentials.
    throw new Error(`Bitvavo ${endpoint} HTTP ${response.status}`);
  }
  throw new Error('Bitvavo retry exhausted');
}

export async function fetchLiveMarket() {
  const raw = await request('/ticker/24h');
  if (!Array.isArray(raw)) throw new Error('Invalid market response');
  const ticks: Record<string, { price: number; change: number }> = {};
  for (const row of raw) {
    const open = Number(row.open), last = Number(row.last);
    if (!Number.isFinite(Number(row.timestamp)) || Math.abs(Date.now() - Number(row.timestamp)) > 600000) continue;
    if (typeof row.market === 'string' && row.market.endsWith('-EUR') &&
      Number.isFinite(open) && open > 0 && Number.isFinite(last) && last > 0) {
      ticks[row.market.slice(0, -4)] = { price: last, change: (last / open - 1) * 100 };
    }
  }
  if (!ticks.BTC || !ticks.ETH) throw new Error('Required BTC/ETH market data missing');
  return { source: 'bitvavo', fetchedAt: new Date().toISOString(), ticks };
}

function pushClient() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server configuration missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function cronAudit(req: any, res: any) {
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!authorized(req.headers?.authorization)) return res.status(401).json({ error: 'Unauthorized' });
  const id = req.query?.runId;
  if (typeof id !== 'string' || !id.startsWith('observation:')) return res.status(400).json({ error: 'runId required' });
  try {
    const audit = await store.get(id);
    res.status(audit ? 200 : 404).json({ audit });
  } catch { res.status(500).json({ error: 'Audit lookup failed' }); }
}

export function createCronHandler(decrypt: (value: string) => Record<string, string>) {
  return async (req: any, res: any) => {
    res.setHeader?.('Cache-Control', 'no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!authorized(req.headers?.authorization)) return res.status(401).json({ error: 'Unauthorized' });
    const slot = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
    try {
      // KV is the canonical profile/connection store. Do not depend on a second profile table.
      const results = [];
      for await (const key of kv.scanIterator({ match: 'exchange:*:store', count: 100 })) {
        const userId = String(key).slice(9, -6);
        const data = await kv.get<any>(String(key));
        const connection = data?.connections?.find((c: any) => c.exchange === 'bitvavo' && c.status === 'connected');
        if (!connection) continue;
        const profile = await kv.get<any>(`user:${userId}:profile`);
        // Respect an explicit pause; connected users with no pause setting are observation-only.
        if (!profile || profile.agentEnabled === false) continue;
        const { data: agent, error: agentError } = await pushClient().from('profiles')
          .select('agent_status').eq('user_id', userId).maybeSingle();
        if (agentError) throw new Error('Agent status lookup failed');
        if (agent?.agent_status !== 'running') {
          console.log(JSON.stringify({ step: 'eligibility', userId, status: 'skipped', reason: 'agent_not_running' }));
          continue;
        }
        let market: Awaited<ReturnType<typeof fetchLiveMarket>>;
        let balances: Array<{ asset: string; available: number; locked: number; total: number }>;
        let subscriptions: any[] = [];
        const result = await runObservation(userId, slot, store, {
          market: async () => { market = await fetchLiveMarket(); return market; },
          portfolio: async () => {
            const credentials = decrypt(connection.encryptedSecrets);
            if (!credentials.apiKey || !credentials.apiSecret) throw new Error('Bitvavo credentials missing');
            const raw = await request('/balance', credentials as { apiKey: string; apiSecret: string });
            if (!Array.isArray(raw)) throw new Error('Invalid portfolio response');
            balances = raw.map(row => {
              const available = Number(row.available), locked = Number(row.inOrder);
              if (typeof row.symbol !== 'string' || !Number.isFinite(available) || available < 0 || !Number.isFinite(locked) || locked < 0)
                throw new Error('Invalid balance values');
              return { asset: row.symbol, available, locked, total: available + locked };
            });
            return balances;
          },
          analyze: async () => {
            const missingPrices = balances.filter(b => b.total > 0 && b.asset !== 'EUR' && !market.ticks[b.asset]);
            const value = balances.reduce((sum, b) => sum + b.total * (b.asset === 'EUR' ? 1 : market.ticks[b.asset]?.price || 0), 0);
            return { market, balances, value: missingPrices.length ? null : value,
              missingPrices: missingPrices.map(b => b.asset),
              text: `Bitcoin ${market.ticks.BTC.change.toFixed(2)}% en Ethereum ${market.ticks.ETH.change.toFixed(2)}% in 24 uur. ` +
                (missingPrices.length ? 'Niet alle portefeuilleprijzen zijn beschikbaar.' : `Portefeuillewaarde: €${value.toFixed(2)}.`) };
          },
          policy: async analysis => {
            const risk = profile.riskTolerance;
            if (risk !== undefined && (!Number.isFinite(risk) || risk < 1 || risk > 10))
              throw new Error('Invalid risk tolerance');
            const excluded = profile.excludedAssets || [];
            if (!Array.isArray(excluded) || excluded.some((a: unknown) => typeof a !== 'string'))
              throw new Error('Invalid excluded-assets policy');
            const exposure = balances.filter(b => b.total > 0 && excluded.includes(b.asset));
            return { ...(analysis as object), runId: `observation:${userId}:${slot}`,
            policy: { mode: 'observation_only', executionAllowed: false,
              decision: 'no_trade_proposal', reason: 'Deze unattended keten genereert alleen observaties; geen gevalideerde handelspolicy actief.',
              checks: { balancesNonNegative: true, excludedAssetExposure: exposure.map(b => b.asset),
                pricesComplete: (analysis as any).missingPrices.length === 0,
                riskToleranceValid: true, noExecution: true },
              excludedAssets: excluded, riskTolerance: risk ?? null },
            createdAt: new Date().toISOString() };
          },
          persist: async (id, observation) => {
            await kv.set(`user:${userId}:observation:${id}`, observation);
            await kv.set(`user:${userId}:observation:latest`, observation);
          },
          notification: async () => {
            if (profile.marketUpdates !== true && profile.accountUpdates !== true)
              return { allowed: false, reason: 'push_preferences_disabled' };
            const { data, error } = await pushClient().from('push_subscriptions')
              .select('endpoint,auth_key,p256dh_key').eq('user_id', userId);
            if (error) throw new Error('Push subscription lookup failed');
            subscriptions = data || [];
            return { allowed: subscriptions.length > 0, reason: subscriptions.length ? 'preferences_allow_push' : 'no_subscription' };
          },
          push: async (id, observation) => {
            const publicKey = process.env.VAPID_PUBLIC_KEY, privateKey = process.env.VAPID_PRIVATE_KEY;
            if (!publicKey || !privateKey || !process.env.VAPID_EMAIL) throw new Error('VAPID server configuration missing');
            const webpush = require('web-push');
            const subject = process.env.VAPID_EMAIL.startsWith('mailto:') ? process.env.VAPID_EMAIL : `mailto:${process.env.VAPID_EMAIL}`;
            webpush.setVapidDetails(subject, publicKey, privateKey);
            let sent = 0;
            for (const subscription of subscriptions) {
              const deliveryId = createHash('sha256').update(id + subscription.endpoint).digest('hex');
              const deliveryKey = `cron:delivery:${deliveryId}`;
              if (!await kv.set(deliveryKey, { status: 'attempting' }, { nx: true })) continue;
              try {
                await webpush.sendNotification({ endpoint: subscription.endpoint,
                  keys: { auth: subscription.auth_key, p256dh: subscription.p256dh_key } },
                  JSON.stringify({ title: 'Je crypto-observatie', body: (observation as any).text,
                    tag: id, data: { runId: id, url: '/' } }), { timeout: 10000 });
                await kv.set(deliveryKey, { status: 'accepted', at: new Date().toISOString() });
                sent++;
              } catch (error: any) {
                await kv.set(deliveryKey, { status: 'failed_or_unknown', code: error.statusCode || 'NETWORK_ERROR' });
                // A timeout may have delivered the push. Do not retry automatically.
                throw new Error(`Push failed or delivery uncertain: ${error.statusCode || 'NETWORK_ERROR'}`);
              }
            }
            return `push_service_accepted:${sent}`;
          }
        });
        results.push(result);
      }
      const ok = results.every(r => r.audit?.status === 'success');
      res.status(ok ? 200 : 500).json({ ok, slot, usersProcessed: results.length,
        evidence: results.length ? 'audit_records' : 'no_eligible_users', results });
    } catch (error) {
      console.error(JSON.stringify({ step: 'user_discovery', status: 'failed' }));
      res.status(500).json({ ok: false, error: 'Cron orchestration failed' });
    }
  };
}
