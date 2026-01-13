import { createConnector } from '../registry';
import {
  ExchangeDownError,
  RateLimitError,
  type ExchangeConnection,
  type ExchangeId
} from '../types';
import { decryptSecrets, getStorageAdapter } from '../storage';

type SyncResult = {
  ok: boolean;
  message?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 800): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries) throw err;
      await sleep(delayMs * attempt);
    }
  }
}

function logEvent(payload: Record<string, unknown>) {
  console.log(JSON.stringify(payload));
}

export async function syncExchange(userId: string, exchange: ExchangeId): Promise<SyncResult> {
  const storage = getStorageAdapter();
  const connection = await storage.getConnection(userId, exchange);
  if (!connection) {
    return { ok: false, message: 'Geen verbinding gevonden.' };
  }

  const connector = createConnector(exchange);
  const credentials = decryptSecrets(connection.encryptedSecrets);

  try {
    const accounts = await withRetry(() => connector.fetchAccounts(userId, credentials as any));
    const balances = await withRetry(() => connector.fetchBalances(userId, credentials as any));
    const positions = await withRetry(() => connector.fetchPositions(userId, credentials as any));
    const transactions = await withRetry(() =>
      connector.fetchTransactions(userId, credentials as any, {})
    );
    const orders = await withRetry(() => connector.fetchOrders(userId, credentials as any, {}));

    await storage.saveAccounts(userId, accounts);
    await storage.saveBalances(userId, balances);
    await storage.savePositions(userId, positions);
    await storage.saveTransactions(userId, transactions);
    await storage.saveOrders(userId, orders);

    await storage.saveConnection(userId, {
      ...connection,
      lastSyncAt: new Date().toISOString(),
      status: 'connected',
      errorCode: undefined,
      updatedAt: new Date().toISOString()
    });

    logEvent({
      exchange,
      userId,
      endpoint: 'sync',
      status: 'ok',
      duration: 'n/a'
    });

    return { ok: true };
  } catch (err) {
    const code =
      err instanceof RateLimitError
        ? 'RATE_LIMIT'
        : err instanceof ExchangeDownError
          ? 'EXCHANGE_DOWN'
          : 'UNKNOWN';
    await storage.saveConnection(userId, {
      ...connection,
      status: code === 'RATE_LIMIT' ? 'needs_reauth' : 'error',
      errorCode: code,
      updatedAt: new Date().toISOString()
    });
    logEvent({
      exchange,
      userId,
      endpoint: 'sync',
      status: 'error',
      errorCode: code
    });
    return { ok: false, message: 'Sync mislukt.' };
  }
}

export async function syncAll(userId: string): Promise<Record<string, SyncResult>> {
  const storage = getStorageAdapter();
  const connections = await storage.listConnections(userId);
  const results: Record<string, SyncResult> = {};
  for (const conn of connections) {
    results[conn.exchange] = await syncExchange(userId, conn.exchange);
  }
  return results;
}

export async function saveConnectionStatus(
  connection: ExchangeConnection,
  status: ExchangeConnection['status'],
  errorCode?: string
) {
  const storage = getStorageAdapter();
  await storage.saveConnection(connection.userId, {
    ...connection,
    status,
    errorCode,
    updatedAt: new Date().toISOString()
  });
}
