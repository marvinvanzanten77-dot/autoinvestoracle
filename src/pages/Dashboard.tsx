import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { marketUpdates, volatilityStatus } from '../data/marketUpdates';
import { platforms } from '../data/platforms';
import { fetchMarketScan, type MarketScanResponse } from '../api/marketScan';
import { fetchPortfolioAllocation, type PortfolioAllocationResponse } from '../api/portfolioAllocate';
import { STRATEGIES } from '../data/strategies';
import { sendChatMessage, type ChatMessage } from '../api/chat';

type OnboardingData = {
  goals: string[];
  amount: number;
  strategies: string[];
  knowledge: 'Starter' | 'Gemiddeld' | 'Gevorderd' | '';
};

function DashboardHeader({
  onScan,
  lastScan,
  volatility
}: {
  onScan: () => void;
  lastScan: string;
  volatility: MarketScanResponse['volatility'];
}) {
  const isHigh = volatility.level === 'hoog';
  const isMid = volatility.level === 'matig';
  return (
    <div className="glass rounded-2xl p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-label tracking-[0.04em] text-slate-500">Jouw dag in crypto</p>
        <div className="mt-1 flex items-center gap-3 text-sm text-slate-700">
          <span>Rustig overzicht</span>
          <span className="text-slate-400">|</span>
          <span>Laatste check: {lastScan}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            isHigh
              ? 'border-amber-300 bg-amber-100 text-amber-700'
              : isMid
                ? 'border-orange-200 bg-orange-100 text-orange-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isHigh ? 'bg-amber-500' : isMid ? 'bg-orange-500' : 'bg-emerald-500'
            }`}
          />
          {volatility.label}
        </div>
        <button
          type="button"
          onClick={onScan}
          className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition"
        >
          Korte check
        </button>
      </div>
    </div>
  );
}

function ChatCard() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const res = await sendChatMessage(nextMessages);
      setMessages((current) => [...current, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      console.error(err);
      setError('Kon AI-chat niet ophalen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="AI-chat" subtitle="Stel gerust je vragen">
      <div className="space-y-3">
        <div className="max-h-56 space-y-3 overflow-auto rounded-xl border border-slate-200/70 bg-white/70 p-3 text-sm text-slate-700">
          {messages.length === 0 && (
            <p className="text-slate-500">Vraag bijvoorbeeld: “Wat betekent dit tempo?”</p>
          )}
          {messages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={`rounded-lg px-3 py-2 ${
                msg.role === 'user' ? 'bg-slate-100 text-slate-800' : 'bg-primary/10 text-slate-700'
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-amber-700">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Typ je vraag..."
            className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading}
            className="pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'Stuur'}
          </button>
        </div>
      </div>
    </Card>
  );
}

function WalletCard({ amount }: { amount: number }) {
  const formatted = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(amount || 0);

  return (
    <Card title="Portemonnee (voorbeeld)" subtitle="Beschikbaar saldo">
      <div className="space-y-2">
        <p className="text-title text-slate-900 font-serif">{formatted}</p>
        <p className="text-sm text-slate-700">
          Dit is het saldo dat je als start hebt opgegeven.
        </p>
      </div>
    </Card>
  );
}

function UpdatesCard() {
  return (
    <Card title="Markt in mensentaal" subtitle="Korte observaties">
      <div className="space-y-3">
        {marketUpdates.map((item) => (
          <div key={item.title} className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="text-sm text-slate-700">{item.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlatformsCard() {
  return (
    <Card title="Handelsplatforms om te verkennen" subtitle="Plus- en minpunten op een rij">
      <div className="grid gap-4 md:grid-cols-2">
        {platforms.map((platform) => (
          <div key={platform.name} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
            <div className="space-y-1">
              <p className="text-subtitle text-slate-900 font-serif">{platform.name}</p>
              <p className="text-sm text-slate-700">{platform.tone}</p>
              <a
                href={platform.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Bekijk platform
              </a>
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
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
        ))}
      </div>
    </Card>
  );
}

function AllocationCard({
  amount,
  strategies,
  selectedStrategies,
  onAllocate
}: {
  amount: number;
  strategies: string[];
  selectedStrategies: string[];
  onAllocate: (strategy: string) => Promise<void>;
}) {
  const [activeStrategy, setActiveStrategy] = useState(
    selectedStrategies[0] || strategies[0] || 'Rustig spreiden over tijd'
  );
  const [data, setData] = useState<PortfolioAllocationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!amount) return;
    const cached = localStorage.getItem(`aio_allocation_${activeStrategy}`);
    if (cached) {
      try {
        setData(JSON.parse(cached) as PortfolioAllocationResponse);
      } catch {
        // ignore invalid cache
      }
    }
  }, [activeStrategy, amount]);

  const handleAllocate = async (strategy: string) => {
    setActiveStrategy(strategy);
    if (!amount) return;
    setLoading(true);
    setError(null);
    try {
      await onAllocate(strategy);
      const cached = localStorage.getItem(`aio_allocation_${strategy}`);
      if (cached) {
        setData(JSON.parse(cached) as PortfolioAllocationResponse);
      }
    } catch (err) {
      console.error(err);
      setError('Kon AI-verdeling niet ophalen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Verdeling in potjes" subtitle="Op basis van jouw strategie">
      <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-3">
        {strategies.map((strategy) => (
          <button
            key={strategy}
            type="button"
            onClick={() => handleAllocate(strategy)}
            className={`pill border transition ${
              activeStrategy === strategy
                ? 'border-primary/40 bg-primary/30 text-primary'
                : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-white'
            }`}
          >
            {strategy}
          </button>
        ))}
      </div>
      {selectedStrategies.length > 0 && (
        <p className="text-xs text-slate-500">
          Jouw keuzes: {selectedStrategies.join(', ')}
        </p>
      )}
      <div className="space-y-3">
        {loading && <p className="text-sm text-slate-500">Verdeling ophalen...</p>}
        {error && <p className="text-sm text-amber-700">{error}</p>}
        {data?.allocation ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.allocation.map((item) => {
              const value = amount * (item.pct / 100);
              const formatted = new Intl.NumberFormat('nl-NL', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0
              }).format(value);
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200/70 bg-white/70 p-4 space-y-1"
                >
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.pct}%</p>
                  <p className="text-sm text-slate-700">{formatted}</p>
                  <p className="text-xs text-slate-500">{item.rationale}</p>
                </div>
              );
            })}
          </div>
        ) : (
          !loading && <p className="text-sm text-slate-500">Nog geen verdeling beschikbaar.</p>
        )}
        {data?.note && (
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 text-sm text-slate-700">
            <p className="text-xs text-slate-500 mb-1">AI-toelichting</p>
            {data.note}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Dashboard() {
  const [profile, setProfile] = useState<OnboardingData | null>(null);
  const [lastScan, setLastScan] = useState('Nog geen check');
  const [volatility, setVolatility] = useState<MarketScanResponse['volatility']>(
    volatilityStatus
  );
  const [scanChanges, setScanChanges] = useState<MarketScanResponse['changes'] | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('aio_onboarding_v1');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as OnboardingData;
        setProfile(parsed);
      } catch {
        setProfile(null);
      }
    }
    const cachedScan = localStorage.getItem('aio_market_scan_v1');
    if (cachedScan) {
      try {
        const parsed = JSON.parse(cachedScan) as MarketScanResponse;
        if (parsed.volatility) {
          setVolatility(parsed.volatility);
          setLastScan(
            new Date(parsed.updatedAt).toLocaleTimeString('nl-NL', {
              hour: '2-digit',
              minute: '2-digit'
            })
          );
        }
        if (parsed.changes) {
          setScanChanges(parsed.changes);
        }
      } catch {
        // ignore invalid storage
      }
    }
  }, []);

  const handleScan = async () => {
    const time = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    setLastScan(time);
    try {
      const scan = await fetchMarketScan('24h');
      setVolatility(scan.volatility);
      setScanChanges(scan.changes);
      localStorage.setItem('aio_market_scan_v1', JSON.stringify(scan));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAllocate = async (strategy: string) => {
    if (!profile?.amount) return;
    const payload = await fetchPortfolioAllocation({
      amount: profile.amount,
      strategy,
      goals: profile.goals,
      knowledge: profile.knowledge,
      changes: scanChanges || undefined
    });
    localStorage.setItem(`aio_allocation_${strategy}`, JSON.stringify(payload));
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <DashboardHeader onScan={handleScan} lastScan={lastScan} volatility={volatility} />

      <div className="grid gap-4 md:gap-5 md:grid-cols-3">
        <ChatCard />
        <WalletCard amount={profile?.amount ?? 0} />
        <UpdatesCard />
      </div>

      <AllocationCard
        amount={profile?.amount ?? 0}
        strategies={[...STRATEGIES]}
        selectedStrategies={profile?.strategies ?? []}
        onAllocate={handleAllocate}
      />

      <PlatformsCard />
    </div>
  );
}
