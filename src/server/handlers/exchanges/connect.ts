import crypto from 'crypto';
import type { ApiRequest, ApiResponse } from '../types';
import { createConnector } from '../../../lib/exchanges/registry';
import { encryptSecrets, getStorageAdapter } from '../../../lib/exchanges/storage';
import type { AuthMethod, ExchangeConnection, ExchangeCredentials, ExchangeId } from '../../../lib/exchanges/types';
import { getSessionUserId } from '../../session';

type ConnectBody = {
  userId: string;
  exchange: ExchangeId;
  method: AuthMethod;
  credentials: ExchangeCredentials;
  scopes?: string[];
};

export async function handleExchangeConnect(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { userId: bodyUserId, exchange, method, credentials, scopes = [] } = (req.body || {}) as ConnectBody;
    const userId = bodyUserId || getSessionUserId(req);
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
