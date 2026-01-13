import { getStorageAdapter } from '../../src/lib/exchanges/storage';
import type { ExchangeId } from '../../src/lib/exchanges/types';

type DisconnectBody = {
  userId: string;
  exchange: ExchangeId;
};

export default async function handler(req: { method?: string; body?: DisconnectBody }, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { userId, exchange } = req.body || {};
    if (!userId || !exchange) {
      res.status(400).json({ error: 'userId en exchange zijn verplicht.' });
      return;
    }
    const storage = getStorageAdapter();
    await storage.deleteConnection(userId, exchange);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon verbinding niet verwijderen.' });
  }
}
