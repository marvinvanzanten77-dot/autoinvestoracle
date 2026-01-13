import type { ApiRequest, ApiResponse } from '../types';
import type { ExchangeId } from '../../../lib/exchanges/types';
import { getStorageAdapter } from '../../../lib/exchanges/storage';
import { syncExchange } from '../../../lib/exchanges/sync/engine';
import { getSessionUserId } from '../../session';

type Body = {
  userId?: string;
  exchange: ExchangeId;
};

export async function handleExchangeSync(req: ApiRequest, res: ApiResponse) {
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
    const connection = await storage.getConnection(userId, exchange);
    if (!connection) {
      res.status(404).json({ error: 'Geen verbinding gevonden.' });
      return;
    }
    const result = await syncExchange(connection);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon sync niet uitvoeren.' });
  }
}
