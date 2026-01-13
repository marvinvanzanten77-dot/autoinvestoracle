import type { ApiRequest, ApiResponse } from '../types';
import { getStorageAdapter } from '../../../lib/exchanges/storage';
import { getSessionUserId } from '../../session';

export async function handleExchangeStatus(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const userId = (req.query?.userId as string) || getSessionUserId(req);
    if (!userId) {
      res.status(400).json({ error: 'userId is verplicht.' });
      return;
    }
    const storage = getStorageAdapter();
    const connections = await storage.listConnections(userId);
    res.status(200).json({ connections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon status niet ophalen.' });
  }
}
