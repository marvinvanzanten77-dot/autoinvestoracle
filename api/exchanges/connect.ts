import crypto from 'crypto';
import { createConnector } from '../../src/lib/exchanges/registry';
import { encryptSecrets, getStorageAdapter } from '../../src/lib/exchanges/storage';
import type { AuthMethod, ExchangeConnection, ExchangeCredentials, ExchangeId } from '../../src/lib/exchanges/types';

type ConnectBody = {
  userId: string;
  exchange: ExchangeId;
  method: AuthMethod;
  credentials: ExchangeCredentials;
  scopes?: string[];
};

export default async function handler(req: { method?: string; body?: ConnectBody }, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { userId, exchange, method, credentials, scopes = [] } = req.body || {};
    if (!userId || !exchange || !method || !credentials) {
      res.status(400).json({ error: 'userId, exchange, method en credentials zijn verplicht.' });
      return;
    }

    const connector = createConnector(exchange);
    const result = await connector.connect(credentials);
    if (!result.ok) {
      res.status(400).json({ error: result.message || 'Kon niet verbinden.' });
      return;
    }

    const now = new Date().toISOString();
    const connection: ExchangeConnection = {
      id: crypto.randomUUID(),
      userId,
      exchange,
      method,
      encryptedSecrets: encryptSecrets(credentials as Record<string, string>),
      scopes: result.scopes?.length ? result.scopes : scopes,
      createdAt: now,
      updatedAt: now,
      status: 'connected'
    };

    const storage = getStorageAdapter();
    await storage.saveConnection(userId, connection);

    res.status(200).json({ ok: true, connection });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon verbinding niet opslaan.' });
  }
}
