import type { ApiRequest, ApiResponse } from '../types';
import { createConnector } from '../../../lib/exchanges/registry';
import { encryptSecrets, decryptSecrets } from '../../../lib/exchanges/storage';
import type { ExchangeId } from '../../../lib/exchanges/types';

export async function handleExchangeHealth(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sample = {
    apiKey: 'sample-key',
    apiSecret: 'sample-secret'
  };

  try {
    const connector = createConnector('bitvavo' as ExchangeId);
    const market = await connector.fetchMarketData({ symbols: ['BTC-EUR'], interval: '1h' });
    const encrypted = encryptSecrets(sample);
    const decrypted = decryptSecrets(encrypted);
    res.status(200).json({
      ok: true,
      marketOk: Boolean(market?.length),
      cryptoOk: decrypted.apiKey === sample.apiKey
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Health check mislukt.' });
  }
}
