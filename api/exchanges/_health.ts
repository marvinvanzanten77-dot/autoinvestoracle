import { createConnector } from '../../src/lib/exchanges/registry';
import { decryptSecrets, encryptSecrets, getStorageAdapter } from '../../src/lib/exchanges/storage';

export default async function handler(_req: { method?: string }, res: any) {
  if (_req.method && _req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const connector = createConnector('bitvavo');
    const testPayload = { apiKey: 'test', apiSecret: 'test' };
    const encrypted = encryptSecrets(testPayload);
    const decrypted = decryptSecrets(encrypted);
    if (decrypted.apiKey !== 'test') {
      res.status(500).json({ error: 'Crypto self-check failed.' });
      return;
    }

    const storage = getStorageAdapter();
    const userId = 'healthcheck';
    await storage.saveConnection(userId, {
      id: 'health-1',
      userId,
      exchange: connector.id,
      method: 'apiKey',
      encryptedSecrets: encrypted,
      scopes: ['read'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'connected'
    });
    const list = await storage.listConnections(userId);
    await storage.deleteConnection(userId, connector.id);

    res.status(200).json({
      ok: true,
      registry: connector.id,
      crypto: true,
      storage: list.length >= 1
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Health check faalde.' });
  }
}
