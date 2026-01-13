import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';

type ExchangeId = 'bitvavo' | 'kraken' | 'coinbase' | 'bybit';

type ConnectionStatus = 'connected' | 'needs_reauth' | 'error' | 'disconnected';

type ExchangeConnection = {
  id: string;
  exchange: ExchangeId;
  status: ConnectionStatus;
  lastSyncAt?: string;
  errorCode?: string;
  createdAt: string;
};

type ExchangeConfig = {
  id: ExchangeId;
  name: string;
  requiresPassphrase?: boolean;
  supportsOAuth?: boolean;
};

const EXCHANGES: ExchangeConfig[] = [
  { id: 'bitvavo', name: 'Bitvavo' },
  { id: 'kraken', name: 'Kraken' },
  { id: 'coinbase', name: 'Coinbase', requiresPassphrase: true, supportsOAuth: true },
  { id: 'bybit', name: 'Bybit' }
];

function getUserId() {
  if (typeof window === 'undefined') return 'local';
  const existing = localStorage.getItem('aio_user_id');
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem('aio_user_id', next);
  return next;
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const styles =
    status === 'connected'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'needs_reauth'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : status === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-slate-200 bg-slate-100 text-slate-500';
  const label =
    status === 'connected'
      ? 'Verbonden'
      : status === 'needs_reauth'
        ? 'Opnieuw verbinden'
        : status === 'error'
          ? 'Fout'
          : 'Niet gekoppeld';
  return <span className={`text-xs rounded-full border px-2 py-0.5 ${styles}`}>{label}</span>;
}

export function Exchanges() {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [activeExchange, setActiveExchange] = useState<ExchangeConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = useMemo(() => getUserId(), []);

  const loadConnections = async () => {
    const resp = await fetch(`/api/exchanges/status?userId=${userId}`);
    if (!resp.ok) return;
    const data = (await resp.json()) as { connections: ExchangeConnection[] };
    setConnections(data.connections || []);
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleConnect = async () => {
    if (!activeExchange) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        userId,
        exchange: activeExchange.id,
        method: 'apiKey',
        credentials: {
          apiKey,
          apiSecret,
          passphrase: passphrase || undefined
        }
      };
      const resp = await fetch('/api/exchanges/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        throw new Error('Kon niet verbinden.');
      }
      setActiveExchange(null);
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
      await loadConnections();
    } catch (err) {
      console.error(err);
      setError('Kon niet verbinden. Controleer je API-gegevens.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (exchange: ExchangeId) => {
    await fetch('/api/exchanges/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, exchange })
    });
    await loadConnections();
  };

  const handleSync = async (exchange: ExchangeId) => {
    await fetch('/api/exchanges/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, exchange })
    });
    await loadConnections();
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <Card title="Exchange koppelingen" subtitle="Koppel je accounts veilig">
        <div className="grid gap-4 md:grid-cols-2">
          {EXCHANGES.map((exchange) => {
            const connection = connections.find((item) => item.exchange === exchange.id);
            return (
              <div key={exchange.id} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-subtitle text-slate-900 font-serif">{exchange.name}</p>
                    <p className="text-xs text-slate-500">API-koppeling</p>
                  </div>
                  <StatusBadge status={connection?.status || 'disconnected'} />
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  {connection?.lastSyncAt
                    ? `Laatste sync: ${new Date(connection.lastSyncAt).toLocaleString()}`
                    : 'Nog geen sync uitgevoerd.'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {connection ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSync(exchange.id)}
                        className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition"
                      >
                        Sync nu
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisconnect(exchange.id)}
                        className="pill border border-slate-200 bg-white/70 text-slate-600 hover:bg-white transition"
                      >
                        Verbreek
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveExchange(exchange)}
                      className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition"
                    >
                      Verbinden
                    </button>
                  )}
                  {exchange.supportsOAuth && (
                    <span className="text-xs text-slate-400">OAuth binnenkort beschikbaar</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {activeExchange && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-subtitle text-slate-900 font-serif">
                  {activeExchange.name} koppelen
                </p>
                <p className="text-sm text-slate-600">Alleen lezen, geen handelsrechten nodig.</p>
              </div>
              <button type="button" onClick={() => setActiveExchange(null)} className="text-slate-500">
                Sluiten
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="API key"
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              />
              <input
                type="password"
                value={apiSecret}
                onChange={(event) => setApiSecret(event.target.value)}
                placeholder="API secret"
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              />
              {activeExchange.requiresPassphrase && (
                <input
                  type="text"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  placeholder="Passphrase (indien van toepassing)"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              )}
              {error && <p className="text-sm text-amber-700">{error}</p>}
              <button
                type="button"
                onClick={handleConnect}
                disabled={loading}
                className="pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Verbinden...' : 'Verbinding testen en opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
