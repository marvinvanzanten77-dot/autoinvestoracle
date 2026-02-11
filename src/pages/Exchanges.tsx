import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { platforms } from '../data/platforms';
import type { UserProfile } from '../lib/profile/types';

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

type FitLabel = {
  label: string;
  detail: string;
};

const EXCHANGES: ExchangeConfig[] = [
  { id: 'bitvavo', name: 'Bitvavo' },
  { id: 'kraken', name: 'Kraken' },
  { id: 'coinbase', name: 'Coinbase', requiresPassphrase: true, supportsOAuth: true },
  { id: 'bybit', name: 'Bybit' }
];

function getPlatformFit(profile: UserProfile | null, platformName: string): FitLabel | null {
  if (!profile) return null;
  const strategy = profile.strategies?.[0] || '';
  const isCalm = /Rustig|Kleine|Wachten/i.test(strategy);
  const isMove = /Meebewegen/i.test(strategy);
  const knowledge = profile.knowledgeLevel;

  const knowledgeFit = (() => {
    if (knowledge === 'beginner') return ['Bitvavo', 'Coinbase'];
    if (knowledge === 'intermediate') return ['Kraken', 'Coinbase'];
    if (knowledge === 'advanced') return ['Bybit', 'Kraken'];
    return [];
  })();

  const strategyFit = (() => {
    if (isCalm) return ['Bitvavo', 'Kraken'];
    if (isMove) return ['Coinbase', 'Kraken'];
    return [];
  })();

  if (![...knowledgeFit, ...strategyFit].includes(platformName)) {
    return null;
  }

  const details: Record<string, string> = {
    Bitvavo: 'Rustige start en duidelijke stappen.',
    Kraken: 'Degelijk tempo met veel uitleg.',
    Coinbase: 'Laagdrempelig en overzichtelijk.',
    Bybit: 'Voor wie sneller en actiever wil.'
  };

  return {
    label: 'Past bij jouw tempo',
    detail: details[platformName] || 'Past bij jouw voorkeuren.'
  };
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
  const [apiMode, setApiMode] = useState<'readonly' | 'trading' | null>(null);

  const [userId, setUserId] = useState<string>('');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const initSession = async () => {
    const resp = await fetch('/api/session/init');
    if (!resp.ok) return;
    const data = (await resp.json()) as { userId: string };
    setUserId(data.userId);
  };

  useEffect(() => {
    fetch('/api/profile/get')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { profile?: UserProfile };
        setProfile(data.profile ?? null);
      })
      .catch(() => {
        // ignore profile fetch error
      });
  }, []);

  const loadConnections = async (id: string) => {
    const resp = await fetch(`/api/exchanges/status?userId=${id}`);
    if (!resp.ok) return;
    const data = (await resp.json()) as { connections: ExchangeConnection[] };
    setConnections(data.connections || []);
  };

  useEffect(() => {
    initSession().then(() => {
      if (userId) {
        loadConnections(userId);
      }
    });
  }, []);

  useEffect(() => {
    if (userId) {
      loadConnections(userId);
    }
  }, [userId]);

  const handleConnect = async () => {
    if (!activeExchange || !apiMode) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        exchange: activeExchange.id,
        method: 'apiKey',
        apiMode: apiMode,
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
      setApiMode(null);
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
      await loadConnections(userId);
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
      body: JSON.stringify({ exchange })
    });
    await loadConnections(userId);
  };

  const handleSync = async (exchange: ExchangeId) => {
    await fetch('/api/exchanges/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange })
    });
    await loadConnections(userId);
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <Card title="Handelsplatforms" subtitle="Vergelijk in rustig tempo">
        <div className="grid gap-4 md:grid-cols-2">
          {platforms.map((platform) => {
            const fit = getPlatformFit(profile, platform.name);
            return (
            <div key={platform.name} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
              <div className="space-y-1">
                <p className="text-subtitle text-slate-900 font-serif">{platform.name}</p>
                <p className="text-sm text-slate-700">{platform.tone}</p>
                {fit && (
                  <div className="space-y-1">
                    <span className="inline-flex rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                      {fit.label}
                    </span>
                    <p className="text-xs text-slate-500">{fit.detail}</p>
                  </div>
                )}
                <a
                  href={platform.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Bekijk platform
                </a>
              </div>
              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <div>
                  <p className="text-xs text-slate-500">Plus</p>
                  <ul className="list-disc pl-4">
                    {platform.pros.map((pro) => (
                      <li key={pro}>{pro}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Min</p>
                  <ul className="list-disc pl-4">
                    {platform.cons.map((con) => (
                      <li key={con}>{con}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )})}
        </div>
      </Card>

      <Card title="Vergelijking in één oogopslag" subtitle="Zonder jargon">
        <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white/70">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-6 gap-2 px-4 py-3 text-xs text-slate-500">
              <span>Platform</span>
              <span>Kosten</span>
              <span>Starten</span>
              <span>Tempo</span>
              <span>Uitleg</span>
              <span>Past bij</span>
            </div>
            <div className="divide-y divide-slate-200/70">
              {platforms.map((platform) => (
                <div key={platform.name} className="grid grid-cols-6 gap-2 px-4 py-3 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{platform.name}</span>
                  <span>{platform.costs}</span>
                  <span>{platform.ease}</span>
                  <span>{platform.pace}</span>
                  <span>{platform.learning}</span>
                  <span>{platform.bestFor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Exchange koppelingen" subtitle="Koppel je accounts veilig">
        <p className="text-xs text-slate-500 mb-4">
          Kies of je alleen wilt observeren (lezen) of Oracle volledige handelsrechten wilt geven. Je sleutels worden versleuteld opgeslagen.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {EXCHANGES.map((exchange) => {
            const connection = connections.find((item) => item.exchange === exchange.id);
            const isComingSoon = exchange.id !== 'bitvavo'; // Only Bitvavo is ready
            
            return (
              <div key={exchange.id} className={`rounded-xl border border-slate-200/70 bg-white/70 p-4 ${isComingSoon ? 'opacity-70' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-subtitle text-slate-900 font-serif">{exchange.name}</p>
                      {isComingSoon && (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Binnenkort
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">API-koppeling</p>
                  </div>
                  <StatusBadge status={connection?.status || 'disconnected'} />
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  {isComingSoon ? (
                    '🔄 Deze exchange wordt nog geïmplementeerd. Volg de updates!'
                  ) : connection?.lastSyncAt ? (
                    `Laatste sync: ${new Date(connection.lastSyncAt).toLocaleString()}`
                  ) : (
                    'Nog geen sync uitgevoerd.'
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!isComingSoon && connection ? (
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
                  ) : !isComingSoon ? (
                    <button
                      type="button"
                      onClick={() => setActiveExchange(exchange)}
                      className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition"
                    >
                      Verbinden
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="pill border border-slate-300 bg-slate-50 text-slate-400 cursor-not-allowed"
                    >
                      Binnenkort beschikbaar
                    </button>
                  )}
                  {!isComingSoon && exchange.supportsOAuth && (
                    <span className="text-xs text-slate-400">OAuth in voorbereiding</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {activeExchange && !apiMode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-subtitle text-slate-900 font-serif">
                  {activeExchange.name} koppelen
                </p>
                <p className="text-sm text-slate-600">Kies je verbindingsmodus</p>
              </div>
              <button type="button" onClick={() => setActiveExchange(null)} className="text-slate-500">
                Sluiten
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setApiMode('readonly')}
                className="w-full rounded-xl border-2 border-slate-200 bg-white/70 p-4 text-left hover:bg-slate-50 hover:border-primary/40 transition"
              >
                <p className="text-subtitle text-slate-900 font-serif">👁️ Alleen observatie</p>
                <p className="text-xs text-slate-600 mt-1">Alleen data inzien, geen handelsbevoegdheden</p>
                <p className="text-xs text-slate-500 mt-2">Geschikt voor uitsluitend monitoring</p>
              </button>
              <button
                type="button"
                onClick={() => setApiMode('trading')}
                className="w-full rounded-xl border-2 border-slate-200 bg-white/70 p-4 text-left hover:bg-slate-50 hover:border-primary/40 transition"
              >
                <p className="text-subtitle text-slate-900 font-serif">🤖 Volledige rechten</p>
                <p className="text-xs text-slate-600 mt-1">Oracle kan automatisch handelen</p>
                <p className="text-xs text-slate-500 mt-2">Vereist volledige API-toegang en persmissies</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeExchange && apiMode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-subtitle text-slate-900 font-serif">
                  {activeExchange.name} koppelen
                </p>
                <p className="text-sm text-slate-600">
                  {apiMode === 'readonly' ? 'Modus: Alleen observatie' : 'Modus: Volledige rechten'}
                </p>
              </div>
              <button type="button" onClick={() => { setActiveExchange(null); setApiMode(null); }} className="text-slate-500">
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
                  placeholder="Passphrase (alleen als je die gebruikt)"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              )}
              {apiMode === 'readonly' && (
                <p className="text-xs text-slate-500">
                  💡 Tip: Bij {activeExchange.name} kun je een API-sleutel met alleen leesrechten aanmaken. Dit is veiliger.
                </p>
              )}
              {apiMode === 'trading' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-800">
                    ⚠️ Je geeft Oracle toestemming om automatisch te handelen. Zorg dat je limiten hebt ingesteld op je exchange account.
                  </p>
                </div>
              )}
              {error && <p className="text-sm text-amber-700">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setApiMode(null)}
                  className="flex-1 pill border border-slate-200 bg-white/70 text-slate-600 hover:bg-white transition"
                >
                  Terug
                </button>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={loading}
                  className="flex-1 pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Verbinden...' : 'Verbinding testen en opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
