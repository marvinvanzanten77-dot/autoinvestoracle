import type { ApiRequest, ApiResponse } from '../types';
import { getStorageAdapter } from '../../../lib/exchanges/storage';
import type { ExchangeId } from '../../../lib/exchanges/types';
import { getSessionUserId } from '../../session';

type Body = {
  userId?: string;
  exchange: ExchangeId;
};

export async function handleExchangeDisconnect(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { userId: bodyUserId, exchange } = (req.body || {}) as Body;
    const userId = bodyUserId || getSessionUserId(req);
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
