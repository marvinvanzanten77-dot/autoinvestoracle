export type Step = { name: string; status: 'running' | 'success' | 'failed' | 'skipped'; durationMs: number; detail?: string };
export type Audit = { id: string; userId: string; slot: string; status: 'running' | 'success' | 'failed'; steps: Step[] };
export interface RunStore {
  claim(id: string): Promise<boolean>;
  get(id: string): Promise<Audit | null>;
  save(audit: Audit): Promise<void>;
}
export interface Services {
  market(): Promise<unknown>;
  portfolio(): Promise<unknown>;
  analyze(market: unknown, portfolio: unknown): Promise<unknown>;
  policy(analysis: unknown): Promise<unknown>;
  persist(id: string, observation: unknown): Promise<void>;
  notification(observation: unknown): Promise<{ allowed: boolean; reason: string }>;
  push(id: string, observation: unknown): Promise<string>;
}

// Claims are deliberately permanent. A crash/ambiguous push is never silently retried.
// Operators inspect the persisted checkpoint before starting a new scheduled slot.
export async function runObservation(userId: string, slot: string, store: RunStore, services: Services) {
  const id = `observation:${userId}:${slot}`;
  if (!await store.claim(id)) return { duplicate: true, audit: await store.get(id) };
  const audit: Audit = { id, userId, slot, status: 'running', steps: [] };
  await store.save(audit);
  async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const checkpoint: Step = { name, status: 'running', durationMs: 0 };
    audit.steps.push(checkpoint);
    await store.save(audit);
    try {
      const value = await fn();
      checkpoint.status = 'success';
      checkpoint.durationMs = Date.now() - start;
      await store.save(audit);
      console.log(JSON.stringify({ runId: id, userId, ...audit.steps[audit.steps.length - 1] }));
      return value;
    } catch (error) {
      checkpoint.status = 'failed';
      checkpoint.durationMs = Date.now() - start;
      checkpoint.detail = error instanceof Error ? error.message : 'Unknown error';
      audit.status = 'failed';
      await store.save(audit);
      console.error(JSON.stringify({ runId: id, userId, ...audit.steps[audit.steps.length - 1] }));
      throw error;
    }
  }
  try {
    await step('cron_trigger', async () => slot);
    const market = await step('market_data', services.market);
    const portfolio = await step('portfolio', services.portfolio);
    const analysis = await step('analysis', () => services.analyze(market, portfolio));
    const observation = await step('risk_policy', () => services.policy(analysis));
    await step('observation_persistence', () => services.persist(id, observation));
    const decision = await step('notification_decision', () => services.notification(observation));
    audit.steps[audit.steps.length - 1]!.detail = decision.reason;
    await store.save(audit);
    if (decision.allowed) {
      const result = await step('push', () => services.push(id, observation));
      audit.steps[audit.steps.length - 1]!.detail = result;
    } else audit.steps.push({ name: 'push', status: 'skipped', durationMs: 0, detail: decision.reason });
    audit.status = 'success';
    await store.save(audit);
  } catch { /* failed step has already been persisted; stop the chain */ }
  return { duplicate: false, audit };
}
