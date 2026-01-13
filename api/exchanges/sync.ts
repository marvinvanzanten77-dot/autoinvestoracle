import { syncAll, syncExchange } from '../../src/lib/exchanges/sync/engine';
import type { ExchangeId } from '../../src/lib/exchanges/types';

type SyncBody = {
  userId: string;
  exchange?: ExchangeId;
};

export default async function handler(req: { method?: string; body?: SyncBody }, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { userId, exchange } = req.body || {};
    if (!userId) {
      res.status(400).json({ error: 'userId is verplicht.' });
      return;
    }
    const result = exchange ? await syncExchange(userId, exchange) : await syncAll(userId);
    res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon sync niet uitvoeren.' });
  }
}
