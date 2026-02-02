import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { dashboardUpdates, volatilityStatus } from '../data/marketUpdates';
import { educationSnippets } from '../data/educationSnippets';
import { fetchMarketScan, type MarketScanResponse } from '../api/marketScan';
import { fetchPortfolioAllocation, type PortfolioAllocationResponse } from '../api/portfolioAllocate';
import { fetchInsights, type InsightInput } from '../api/chat';
import { STRATEGIES } from '../data/strategies';
import { sendChatMessage, type ChatContext, type ChatMessage } from '../api/chat';
import type { UserProfile } from '../lib/profile/types';

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
          <span>{volatility.label}</span>
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

function ChatCard({ context }: { context?: ChatContext }) {
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
      const res = await sendChatMessage(nextMessages, context);
      setMessages((current) => [...current, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      console.error(err);
      setError('Kon AI-chat niet ophalen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card 
      title="AI-chat" 
      subtitle={context ? "✓ Met volledige context" : "Stel gerust je vragen"}
    >
      <div className="space-y-3">
        <div className="max-h-56 space-y-3 overflow-auto rounded-xl border border-slate-200/70 bg-white/70 p-3 text-sm text-slate-700">
          {messages.length === 0 && (
            <p className="text-slate-500">
              Vraag bijvoorbeeld: "Wat betekent dit tempo voor mijn strategie?"
            </p>
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

function WalletCard({ amount, onEdit }: { amount: number; onEdit?: () => void }) {
  const formatted = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(amount || 0);

  return (
    <Card title="Portemonnee" subtitle="Beschikbaar saldo">
      <div className="space-y-3">
        <p className="text-title text-slate-900 font-serif">{formatted}</p>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition text-sm"
          >
            Saldo aanpassen
          </button>
        )}
        <p className="text-xs text-slate-500">
          Dit is je startbedrag. Je kunt dit later aanpassen in de instellingen.
        </p>
      </div>
    </Card>
  );
}

function mapRangeToAmount(range?: UserProfile['startAmountRange']) {
  switch (range) {
    case '0-500':
      return 250;
    case '500-2k':
      return 1250;
    case '2k-10k':
      return 6000;
    case '10k-50k':
      return 30000;
    case '50k+':
      return 75000;
    default:
      return 0;
  }
}

function mapGoalLabel(goal?: UserProfile['primaryGoal']) {
  switch (goal) {
    case 'growth':
      return 'Groeien';
    case 'income':
      return 'Inkomen';
    case 'preserve':
      return 'Behouden';
    case 'learn':
      return 'Leren';
    default:
      return 'Onbekend';
  }
}

function mapHorizonLabel(horizon?: UserProfile['timeHorizon']) {
  switch (horizon) {
    case 'lt1y':
      return 'Korter dan 1 jaar';
    case '1-3y':
      return '1 - 3 jaar';
    case '3-7y':
      return '3 - 7 jaar';
    case '7y+':
      return '7+ jaar';
    default:
      return 'Onbekend';
  }
}

function mapKnowledgeLabel(level?: UserProfile['knowledgeLevel']) {
  switch (level) {
    case 'beginner':
      return 'Beginner';
    case 'intermediate':
      return 'Gemiddeld';
    case 'advanced':
      return 'Ervaren';
    default:
      return 'Onbekend';
  }
}

function UpdatesCard() {
  return (
    <Card title="Markt in mensentaal" subtitle="Korte observaties">
      <div className="space-y-3">
        {dashboardUpdates.map((item) => (
          <div key={item.title} className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="text-sm text-slate-700">{item.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InsightsCard({
  profile,
  market,
  allocation
}: {
  profile?: any;
  market?: any;
  allocation?: Array<{ label: string; pct: number }>;
}) {
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !market) return;
    setLoading(true);
    setError(null);
    const input: InsightInput = {
      profile: {
        displayName: profile.displayName,
        strategy: profile.strategies?.[0],
        primaryGoal: profile.primaryGoal,
        timeHorizon: profile.timeHorizon,
        knowledgeLevel: profile.knowledgeLevel
      },
      market: {
        volatilityLevel: market.volatility?.level,
        volatilityLabel: market.volatility?.label,
        changes: market.changes
      },
      currentAllocation: allocation
    };
    fetchInsights(input)
      .then((res) => setInsights(res.insights))
      .catch((err) => {
        console.error(err);
        setError('Kon inzichten niet ophalen.');
      })
      .finally(() => setLoading(false));
  }, [profile, market, allocation]);

  return (
    <Card title="Inzichten" subtitle="Gegeven jouw profiel">
      {loading && <p className="text-sm text-slate-500">Inzichten laden...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {insights && !loading && (
        <div className="space-y-2 text-sm text-slate-700 whitespace-pre-wrap">
          {insights}
        </div>
      )}
      {!insights && !loading && !error && (
        <p className="text-sm text-slate-500">Nog geen inzichten beschikbaar.</p>
      )}
    </Card>
  );
}

function DataOverviewPanel({
  profile,
  market,
  exchanges,
  allocation,
  customBalance
}: {
  profile?: UserProfile | null;
  market?: { volatility: MarketScanResponse['volatility']; changes: MarketScanResponse['changes'] | null };
  exchanges: string[];
  allocation?: Array<{ label: string; pct: number }>;
  customBalance?: number | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full text-xs text-slate-500 hover:text-slate-700 py-2 px-3 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 transition"
      >
        📊 Toon alle beschikbare data
      </button>
    );
  }

  return (
    <Card title="Alle beschikbare data" subtitle="Voor AI-context en debugging">
      <div className="space-y-4 text-xs max-h-96 overflow-auto">
        <div className="grid grid-cols-2 gap-3">
          {/* Profiel */}
          <div className="rounded-lg bg-slate-50 p-3 space-y-1">
            <p className="font-semibold text-slate-700">Profiel</p>
            <div className="text-slate-600 space-y-0.5">
              <div><span className="font-medium">Naam:</span> {profile?.displayName || '-'}</div>
              <div><span className="font-medium">Strategie:</span> {profile?.strategies?.[0] || '-'}</div>
              <div><span className="font-medium">Doel:</span> {profile?.primaryGoal || '-'}</div>
              <div><span className="font-medium">Horizon:</span> {profile?.timeHorizon || '-'}</div>
              <div><span className="font-medium">Kennis:</span> {profile?.knowledgeLevel || '-'}</div>
              <div><span className="font-medium">Startbedrag:</span> {profile?.startAmountRange || '-'}</div>
            </div>
          </div>

          {/* Markt */}
          <div className="rounded-lg bg-slate-50 p-3 space-y-1">
            <p className="font-semibold text-slate-700">Markt</p>
            <div className="text-slate-600 space-y-0.5">
              <div><span className="font-medium">Tempo:</span> {market?.volatility.label || '-'}</div>
              <div><span className="font-medium">Niveau:</span> {market?.volatility.level || '-'}</div>
              <div><span className="font-medium">BTC:</span> {market?.changes?.bitcoin}%</div>
              <div><span className="font-medium">ETH:</span> {market?.changes?.ethereum}%</div>
              <div><span className="font-medium">Stablecoins:</span> {market?.changes?.stablecoins}%</div>
              <div><span className="font-medium">Altcoins:</span> {market?.changes?.altcoins}%</div>
            </div>
          </div>

          {/* Exchanges */}
          <div className="rounded-lg bg-slate-50 p-3 space-y-1">
            <p className="font-semibold text-slate-700">Exchanges</p>
            <div className="text-slate-600">
              {exchanges.length > 0 ? (
                <div className="space-y-1">
                  {exchanges.map((ex) => (
                    <div key={ex} className="capitalize">✓ {ex}</div>
                  ))}
                </div>
              ) : (
                <div>Geen exchanges verbonden</div>
              )}
            </div>
          </div>

          {/* Balans & Allocatie */}
          <div className="rounded-lg bg-slate-50 p-3 space-y-1">
            <p className="font-semibold text-slate-700">Balans & Allocatie</p>
            <div className="text-slate-600 space-y-0.5">
              <div><span className="font-medium">Saldo:</span> €{customBalance?.toFixed(2) || '0.00'}</div>
              {allocation && allocation.length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  {allocation.map((a) => (
                    <div key={a.label}><span className="font-medium">{a.label}:</span> {a.pct}%</div>
                  ))}
                </div>
              ) : (
                <div>Geen allocatie</div>
              )}
            </div>
          </div>
        </div>

        {/* JSON View */}
        <div className="rounded-lg bg-slate-900 text-slate-200 p-3 font-mono text-xs overflow-auto max-h-48">
          <p className="text-slate-400 mb-2">Raw Context (voor AI):</p>
          <pre>{JSON.stringify(
            {
              profile: {
                displayName: profile?.displayName,
                strategy: profile?.strategies?.[0],
                primaryGoal: profile?.primaryGoal,
                timeHorizon: profile?.timeHorizon,
                knowledgeLevel: profile?.knowledgeLevel
              },
              market: {
                volatilityLevel: market?.volatility.level,
                volatilityLabel: market?.volatility.label,
                changes: market?.changes
              },
              exchanges: exchanges,
              allocation: allocation
            },
            null,
            2
          )}</pre>
        </div>

        <button
          onClick={() => setIsExpanded(false)}
          className="w-full text-xs text-slate-500 hover:text-slate-700 py-1 rounded border border-slate-300 hover:border-slate-400 transition"
        >
          Verbergen
        </button>
      </div>
    </Card>
  );
}


function BalanceEditDialog({ 
  isOpen, 
  currentBalance, 
  onSave, 
  onCancel 
}: { 
  isOpen: boolean; 
  currentBalance: number; 
  onSave: (balance: number) => void; 
  onCancel: () => void;
}) {
  const [value, setValue] = useState(currentBalance.toString());
  
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newBalance = parseFloat(value);
    if (!isNaN(newBalance) && newBalance >= 0) {
      onSave(newBalance);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full mx-4 space-y-4">
        <div>
          <p className="text-subtitle text-slate-900 font-serif">Saldo aanpassen</p>
          <p className="text-sm text-slate-600 mt-1">Wijzig je beschikbare investeringsbedrag</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bedrag (€)
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary/20 border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/30 transition"
            >
              Opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
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

  useEffect(() => {
    if (!amount || loading || data) return;
    const cached = localStorage.getItem(`aio_allocation_${activeStrategy}`);
    if (cached) return;
    setLoading(true);
    setError(null);
    onAllocate(activeStrategy)
      .then(() => {
        const fresh = localStorage.getItem(`aio_allocation_${activeStrategy}`);
        if (fresh) {
          setData(JSON.parse(fresh) as PortfolioAllocationResponse);
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Kon AI-verdeling niet ophalen.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeStrategy, amount, data, loading, onAllocate]);

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lastScan, setLastScan] = useState('Nog geen check');
  const [volatility, setVolatility] = useState<MarketScanResponse['volatility']>(
    volatilityStatus
  );
  const [scanChanges, setScanChanges] = useState<MarketScanResponse['changes'] | null>(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [customBalance, setCustomBalance] = useState<number | null>(null);
  const [connectedExchanges, setConnectedExchanges] = useState<string[]>([]);
  const [currentAllocation, setCurrentAllocation] = useState<Array<{ label: string; pct: number }>>();

  useEffect(() => {
    // Fetch profile
    fetch('/api/profile/get')
      .then(async (res) => {
        if (!res.ok) {
          setProfile(null);
          return;
        }
        const data = (await res.json()) as { profile?: UserProfile };
        setProfile(data.profile ?? null);
        // Load custom balance from localStorage
        const stored = localStorage.getItem('aio_custom_balance');
        if (stored) {
          const balance = parseFloat(stored);
          if (!isNaN(balance)) {
            setCustomBalance(balance);
          }
        }
      })
      .catch(() => setProfile(null));

    // Fetch connected exchanges
    fetch('/api/exchanges/status')
      .then(async (res) => {
        if (!res.ok) {
          setConnectedExchanges([]);
          return;
        }
        const data = (await res.json()) as { connections?: Array<{ exchange: string; status: string }> };
        const connected = data.connections
          ?.filter((c) => c.status === 'connected')
          .map((c) => c.exchange) || [];
        setConnectedExchanges(connected);
      })
      .catch(() => setConnectedExchanges([]));

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
    const amount = customBalance ?? mapRangeToAmount(profile?.startAmountRange);
    if (!amount) return;
    const goals = profile
      ? [mapGoalLabel(profile.primaryGoal), mapHorizonLabel(profile.timeHorizon)]
      : undefined;
    const knowledge = profile ? mapKnowledgeLabel(profile.knowledgeLevel) : undefined;
    const payload = await fetchPortfolioAllocation({
      amount,
      strategy,
      goals,
      knowledge,
      changes: scanChanges || undefined
    });
    localStorage.setItem(`aio_allocation_${strategy}`, JSON.stringify(payload));
    setCurrentAllocation(payload.allocation);
  };

  const handleBalanceEdit = (newBalance: number) => {
    setCustomBalance(newBalance);
    localStorage.setItem('aio_custom_balance', String(newBalance));
    setEditingBalance(false);
  };

  const amount = customBalance ?? mapRangeToAmount(profile?.startAmountRange);
  const chatContext: ChatContext | undefined = profile
    ? {
        profile: {
          displayName: profile.displayName,
          strategy: profile.strategies?.[0],
          primaryGoal: mapGoalLabel(profile.primaryGoal),
          timeHorizon: mapHorizonLabel(profile.timeHorizon),
          knowledgeLevel: mapKnowledgeLabel(profile.knowledgeLevel),
          startAmountRange: profile.startAmountRange
        },
        market: {
          volatilityLabel: volatility.label,
          volatilityLevel: volatility.level,
          lastScan,
          changes: scanChanges || undefined
        },
        exchanges: {
          connected: connectedExchanges
        }
      }
    : undefined;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <BalanceEditDialog
        isOpen={editingBalance}
        currentBalance={amount || 0}
        onSave={handleBalanceEdit}
        onCancel={() => setEditingBalance(false)}
      />

      <DashboardHeader onScan={handleScan} lastScan={lastScan} volatility={volatility} />

      <div className="grid gap-4 md:gap-5 md:grid-cols-3">
        <ChatCard context={chatContext} />
        <WalletCard amount={amount} onEdit={() => setEditingBalance(true)} />
        <UpdatesCard />
      </div>

      <InsightsCard
        profile={profile}
        market={{ volatility, changes: scanChanges }}
        allocation={currentAllocation}
      />

      <DataOverviewPanel
        profile={profile}
        market={{ volatility, changes: scanChanges }}
        exchanges={connectedExchanges}
        allocation={currentAllocation}
        customBalance={customBalance}
      />

      <AllocationCard
        amount={amount}
        strategies={[...STRATEGIES]}
        selectedStrategies={profile?.strategies ?? []}
        onAllocate={handleAllocate}
      />
    </div>
  );
}
