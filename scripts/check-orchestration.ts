import assert from 'node:assert/strict';
import { runObservation, type Audit, type RunStore, type Services } from '../src/server/orchestration/runner.js';
import { authorized } from '../src/server/orchestration/cron.js';

function harness(failure?: string, allowed = true) {
  const claims = new Set<string>(), audits = new Map<string, Audit>();
  const calls: string[] = [];
  const store: RunStore = {
    claim: async id => { if (claims.has(id)) return false; claims.add(id); return true; },
    get: async id => audits.get(id) || null,
    save: async audit => { audits.set(audit.id, structuredClone(audit)); }
  };
  const call = async (name: string) => { calls.push(name); if (failure === name) throw new Error(`Injected ${name} failure`); };
  const services: Services = {
    market: async () => { await call('market'); return { source: 'fixture' }; },
    portfolio: async () => { await call('portfolio'); return []; },
    analyze: async () => { await call('analysis'); return {}; },
    policy: async () => { await call('policy'); return { executionAllowed: false }; },
    persist: async () => { await call('persistence'); },
    notification: async () => { await call('decision'); return { allowed, reason: allowed ? 'allowed' : 'disabled' }; },
    push: async () => { await call('push'); return 'accepted'; }
  };
  return { store, services, calls, audits };
}

assert.equal(authorized(undefined, 'test'), false);
assert.equal(authorized('Bearer test', undefined), false);
assert.equal(authorized('Bearer wrong', 'test'), false);
assert.equal(authorized('Bearer test', 'test'), true);
const happy = harness();
const completed = await runObservation('user', 'slot', happy.store, happy.services);
assert.equal(completed.audit?.status, 'success');
assert.deepEqual(happy.calls, ['market', 'portfolio', 'analysis', 'policy', 'persistence', 'decision', 'push']);
assert.equal((await runObservation('user', 'slot', happy.store, happy.services)).duplicate, true);
assert.equal(happy.calls.filter(x => x === 'push').length, 1);
const concurrent = harness();
await Promise.all(Array.from({ length: 10 }, () => runObservation('user', 'slot', concurrent.store, concurrent.services)));
assert.equal(concurrent.calls.filter(x => x === 'persistence').length, 1);
assert.equal(concurrent.calls.filter(x => x === 'push').length, 1);
const disabled = harness(undefined, false);
const skipped = await runObservation('user', 'slot', disabled.store, disabled.services);
assert.equal(skipped.audit?.steps.at(-1)?.status, 'skipped');
assert.equal(disabled.calls.includes('push'), false);
for (const name of ['market', 'portfolio', 'analysis', 'policy', 'persistence', 'decision', 'push']) {
  const h = harness(name);
  const failed = await runObservation('user', 'slot', h.store, h.services);
  assert.equal(failed.audit?.status, 'failed');
  assert.equal(failed.audit?.steps.at(-1)?.status, 'failed');
  assert.equal(h.calls.at(-1), name);
  await runObservation('user', 'slot', h.store, h.services);
  assert.equal(h.calls.filter(x => x === name).length, 1);
}
console.log('PASS: authentication, full chain, concurrency, idempotency, opt-out, seven failure checkpoints. Fixture services; not production evidence.');
