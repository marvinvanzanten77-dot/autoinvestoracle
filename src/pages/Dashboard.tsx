import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { AgentStatusWidget } from '../components/AgentStatusWidget';
import { dashboardUpdates, volatilityStatus } from '../data/marketUpdates';
import { educationSnippets } from '../data/educationSnippets';
import { fetchMarketScan, type MarketScanResponse } from '../api/marketScan';
import { fetchPortfolioAllocation, type PortfolioAllocationResponse } from '../api/portfolioAllocate';
import { fetchInsights, type InsightInput } from '../api/chat';
import { fetchBalances, fetchPerformance, fetchAvailableAssets, type Balance } from '../api/exchanges';
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
  const [userId, setUserId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user session and restore chat history from localStorage
  useEffect(() => {
    const initSession = async () => {
      try {
        const resp = await fetch('/api/session/init');
        if (resp.ok) {
          const data = (await resp.json()) as { userId: string };
          setUserId(data.userId);
          
          // Restore chat history from localStorage
          const storedMessages = localStorage.getItem(`chat_history_${data.userId}`);
          if (storedMessages) {
            try {
              setMessages(JSON.parse(storedMessages));
            } catch (e) {
              console.warn('Could not restore chat history:', e);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing session:', err);
      }
    };
    initSession();
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (userId && messages.length > 0) {
      localStorage.setItem(`chat_history_${userId}`, JSON.stringify(messages));
    }
  }, [messages, userId]);

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

function WalletCard({ amount, userId, onRefresh }: { amount: number; userId: string; onRefresh?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestFetch = async () => {
    if (!userId) {
      setTestResult('❌ Geen userId beschikbaar');
      return;
    }
    setLoading(true);
    setTestResult(null);
    try {
      console.log('[WalletCard] Testing balance fetch with userId:', userId);
      const response = await fetch(`/api/exchanges/balances?userId=${userId}`);
      const data = (await response.json()) as any;
      console.log('[WalletCard] Test response:', data);
      
      if (!response.ok) {
        setTestResult(`❌ API Error: ${response.status} - ${JSON.stringify(data)}`);
        return;
      }

      if (!data.balances || data.balances.length === 0) {
        setTestResult('⚠️ Geen balances geretourneerd van API. Klik "Debug" voor meer info.');
        return;
      }

      const eur = data.balances.find((b: any) => b.asset === 'EUR');
      if (!eur) {
        setTestResult(`⚠️ EUR niet gevonden. Assets: ${data.balances.map((b: any) => b.asset).join(', ')}`);
        return;
      }

      setTestResult(`✓ EUR opgehaald: €${eur.available} beschikbaar`);
      onRefresh?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult(`❌ Error: ${msg}`);
      console.error('[WalletCard] Test error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDebug = async () => {
    if (!userId) {
      setTestResult('❌ Geen userId beschikbaar');
      return;
    }
    setLoading(true);
    try {
      console.log('[WalletCard] Requesting debug info for userId:', userId);
      const response = await fetch(`/api/exchanges/debug?userId=${userId}`);
      const data = (await response.json()) as any;
      console.log('[WalletCard] Debug response:', data);
      
      if (!response.ok) {
        setTestResult(`❌ Debug error: ${JSON.stringify(data)}`);
        return;
      }

      const info = `
Connections: ${data.connectionsCount}
${data.connections.map((c: any) => `  - ${c.exchange}: ${c.status} (encrypted secrets: ${c.encryptedSecretsLength} bytes)`).join('\n')}`;
      
      setTestResult(data.connectionsCount === 0 
        ? `⚠️ GEEN CONNECTIES OPGESLAGEN!\n\n${info}\n\nGa naar "Exchange koppelingen" en verbind Bitvavo.`
        : `Debug info:\n${info}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult(`❌ Debug error: ${msg}`);
      console.error('[WalletCard] Debug error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatted = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(amount || 0);

  return (
    <Card title="Portemonnee" subtitle="Beschikbaar saldo van Bitvavo">
      <div className="space-y-3">
        <p className="text-title text-slate-900 font-serif">{formatted}</p>
        <p className="text-xs text-slate-500">
          Dit saldo wordt direct van je verbonden platform (Bitvavo) opgehaald. Verbind je account voor real-time updates.
        </p>
        
        <div className="flex gap-2">
          <button
            onClick={handleTestFetch}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition disabled:opacity-60"
          >
          {loading ? 'Testen...' : '🔄 Saldo testen'}
        </button>
          <button
            onClick={handleDebug}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition disabled:opacity-60"
          >
            {loading ? 'Debug...' : '🔍 Debug'}
          </button>
        </div>

        {testResult && (
          <div className={`text-xs p-2 rounded-lg font-mono ${
            testResult.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            testResult.startsWith('⚠️') ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {testResult}
          </div>
        )}
      </div>
    </Card>
  );
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

function PortfolioCard({ balances }: { balances: Balance[] }) {
  const [expanded, setExpanded] = useState(false);
  const [performance, setPerformance] = useState<Record<string, number>>({});

  useEffect(() => {
    if (balances.length === 0) return;
    fetchPerformance()
      .then((perf) => {
        const perfMap: Record<string, number> = {};
        perf.performance.forEach((p) => {
          perfMap[`${p.exchange}:${p.asset}`] = p.quantityChangePercent;
        });
        setPerformance(perfMap);
      })
      .catch(() => setPerformance({}));
  }, [balances]);

  // Filter out stablecoins/EUR from display (they're shown as cash saldo)
  const cryptoBalances = balances.filter(b => !['EUR', 'USDT', 'USDC', 'EURC'].includes(b.asset));
  const cashBalances = balances.filter(b => ['EUR', 'USDT', 'USDC', 'EURC'].includes(b.asset));
  
  if (!cryptoBalances || cryptoBalances.length === 0) {
    return null;
  }

  const groupedByExchange = cryptoBalances.reduce(
    (acc, bal) => {
      if (!acc[bal.exchange]) {
        acc[bal.exchange] = [];
      }
      acc[bal.exchange].push(bal);
      return acc;
    },
    {} as Record<string, Balance[]>
  );

  const totalValue = cryptoBalances.reduce((sum, bal) => sum + (bal.total ?? 0), 0);

  return (
    <Card title="Jouw Portfolio" subtitle={`${cryptoBalances.length} crypto assets | Total: €${(totalValue ?? 0).toFixed(2)}`}>
      <div className="space-y-4">
        {Object.entries(groupedByExchange).map(([exchange, assets]) => (
          <div key={exchange} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 capitalize">{exchange}</p>
              <p className="text-xs text-slate-500">{assets.length} assets</p>
            </div>
            <div className="space-y-1.5">
              {assets.map((bal) => {
                const perfKey = `${bal.exchange}:${bal.asset}`;
                const changePercent = performance[perfKey];
                const hasChange = changePercent !== undefined && changePercent !== 0;
                const isPositive = changePercent && changePercent > 0;
                
                return (
                  <div key={bal.id} className="rounded-lg border border-slate-200 bg-white/50 p-2.5 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{bal.asset.toUpperCase()}</p>
                      <p className="text-xs text-slate-500">
                        {(bal.total ?? 0).toFixed(8)} {bal.asset.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">€{(bal.total ?? 0).toFixed(2)}</p>
                      {hasChange ? (
                        <p className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPositive ? '📈' : '📉'} {Math.abs(changePercent ?? 0).toFixed(2)}%
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-600">✓ Beschikbaar</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {expanded && (
          <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1 text-slate-600 border border-slate-200">
            <p><strong>Total Balance:</strong> €{(totalValue ?? 0).toFixed(2)}</p>
            <p><strong>Exchanges:</strong> {Object.keys(groupedByExchange).join(', ')}</p>
            <p><strong>Last Updated:</strong> {new Date().toLocaleTimeString('nl-NL')}</p>
          </div>
        )}
        
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-xs text-slate-500 hover:text-slate-700 py-1 rounded border border-slate-300 hover:border-slate-400 transition"
        >
          {expanded ? '▼ Details' : '▶ Toon details'}
        </button>
      </div>
    </Card>
  );
}

function DataOverviewPanel({
  profile,
  market,
  exchanges,
  allocation
}: {
  profile?: UserProfile | null;
  market?: { volatility: MarketScanResponse['volatility']; changes: MarketScanResponse['changes'] | null };
  exchanges: string[];
  allocation?: Array<{ label: string; pct: number }>;
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
            <p className="font-semibold text-slate-700">Allocatie</p>
            <div className="text-slate-600 space-y-0.5">
              {allocation && allocation.length > 0 ? (
                <div className="space-y-0.5">
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
  const [userId, setUserId] = useState<string>('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lastScan, setLastScan] = useState('Nog geen check');
  const [volatility, setVolatility] = useState<MarketScanResponse['volatility']>(
    volatilityStatus
  );
  const [scanChanges, setScanChanges] = useState<MarketScanResponse['changes'] | null>(null);
  const [connectedExchanges, setConnectedExchanges] = useState<string[]>([]);
  const [activePlatform, setActivePlatform] = useState<string>(() => {
    return localStorage.getItem('aio_active_platform') || '';
  });
  const [currentAllocation, setCurrentAllocation] = useState<Array<{ label: string; pct: number }>>();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [exchangeAssets, setExchangeAssets] = useState<{ [platform: string]: string[] }>({});

  useEffect(() => {
    // Initialize session and get userId
    fetch('/api/session/init')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { userId: string };
        console.log('[Dashboard] Session userId:', data.userId);
        setUserId(data.userId);
      })
      .catch(() => {
        // ignore error
      });

    // Fetch profile
    fetch('/api/profile/get')
      .then(async (res) => {
        if (!res.ok) {
          setProfile(null);
          return;
        }
        const data = (await res.json()) as { profile?: UserProfile };
        console.log('[Dashboard] Profile loaded:', data.profile);
        setProfile(data.profile ?? null);
      })
      .catch(() => setProfile(null));

    // Fetch connected exchanges
    fetch('/api/exchanges/status')
      .then(async (res) => {
        if (!res.ok) {
          console.log('[Dashboard] No exchanges connected');
          setConnectedExchanges([]);
          return;
        }
        const data = (await res.json()) as { connections?: Array<{ exchange: string; status: string }> };
        console.log('[Dashboard] Exchanges response:', data);
        const connected = data.connections
          ?.filter((c) => c.status === 'connected')
          .map((c) => c.exchange) || [];
        console.log('[Dashboard] Connected exchanges:', connected);
        setConnectedExchanges(connected);
        
        // Auto-set active platform if not set or if stored platform is no longer connected
        setActivePlatform((current) => {
          if (!current || !connected.includes(current)) {
            const next = connected[0] || '';
            if (next) localStorage.setItem('aio_active_platform', next);
            console.log('[Dashboard] Setting active platform to:', next);
            return next;
          }
          return current;
        });
      })
      .catch((err) => {
        console.error('[Dashboard] Error fetching exchanges:', err);
        setConnectedExchanges([]);
      });

    // Fetch balances from connected exchanges - ONLY if userId is set
    if (userId) {
      console.log('[Dashboard] Fetching balances for userId:', userId);
      fetchBalances(userId)
        .then((bals) => {
          console.log('[Dashboard] Balances loaded:', bals);
          setBalances(bals);
        })
        .catch((err) => {
          console.error('[Dashboard] Error fetching balances:', err);
          setBalances([]);
        });

      // Also fetch available assets from all exchanges
      fetchAvailableAssets(userId)
        .then((response) => {
          console.log('[Dashboard] Available assets loaded:', response.assetsByExchange);
          // Convert to { platform: [assets] } format
          const assets: { [platform: string]: string[] } = {};
          Object.entries(response.assetsByExchange).forEach(([platform, assetList]) => {
            assets[platform] = assetList.map((a) => 
              typeof a === 'string' ? a : a.symbol
            );
          });
          setExchangeAssets(assets);
        })
        .catch((err) => {
          console.error('[Dashboard] Error fetching available assets:', err);
          setExchangeAssets({});
        });
    } else {
      console.log('[Dashboard] Skipping fetch - no userId yet');
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
  }, [userId]);

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
    // Use live Bitvavo EUR balance for allocation
    const activeBalances = balances.filter(b => !activePlatform || b.exchange === activePlatform);
    const eurBalance = activeBalances.find(b => b.asset === 'EUR' || b.asset === 'USDT' || b.asset === 'USDC');
    const allocAmount = eurBalance?.available ?? 0;
    if (!allocAmount) return;
    const goals = profile
      ? [mapGoalLabel(profile.primaryGoal), mapHorizonLabel(profile.timeHorizon)]
      : undefined;
    const knowledge = profile ? mapKnowledgeLabel(profile.knowledgeLevel) : undefined;
    const payload = await fetchPortfolioAllocation({
      amount: allocAmount,
      strategy,
      goals,
      knowledge,
      changes: scanChanges || undefined
    });
    localStorage.setItem(`aio_allocation_${strategy}`, JSON.stringify(payload));
    setCurrentAllocation(payload.allocation);
  };

  // Get EUR/cash saldo from active platform (always use Bitvavo data, never manual input)
  const activeBalances = activePlatform 
    ? balances.filter(b => b.exchange === activePlatform)
    : balances;
  
  const eurBalance = activeBalances.find(b => b.asset === 'EUR' || b.asset === 'USDT' || b.asset === 'USDC');
  const amount = eurBalance?.available ?? 0;
  const cashSaldo = amount; // Alias for consistency
  
  // Debug logging
  useEffect(() => {
    console.log('[Dashboard] State summary:', {
      activePlatform,
      connectedExchanges,
      totalBalances: balances.length,
      activeBalances: activeBalances.length,
      activeAssets: activeBalances.map(b => `${b.asset}:${b.available}`),
      eurBalance: eurBalance ? `${eurBalance.asset}:${eurBalance.available}` : 'NOT FOUND',
      cashSaldo
    });
  }, [activePlatform, balances, activeBalances, eurBalance, cashSaldo]);
  
  const chatContext: ChatContext | undefined = profile
    ? {
        profile: {
          displayName: profile.displayName,
          strategy: profile.strategies?.[0],
          primaryGoal: mapGoalLabel(profile.primaryGoal),
          timeHorizon: mapHorizonLabel(profile.timeHorizon),
          knowledgeLevel: mapKnowledgeLabel(profile.knowledgeLevel)
        },
        market: {
          volatilityLabel: volatility.label,
          volatilityLevel: volatility.level,
          lastScan,
          changes: scanChanges || undefined
        },
        exchanges: {
          connected: connectedExchanges,
          activePlatform: activePlatform,
          availableAssets: activePlatform ? exchangeAssets[activePlatform] || [] : [],
          cashSaldo: cashSaldo
        }
      }
    : undefined;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <DashboardHeader onScan={handleScan} lastScan={lastScan} volatility={volatility} />

      {/* Agent Status */}
      <AgentStatusWidget />

      {/* Platform Selector */}
      {connectedExchanges.length > 1 && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 md:gap-4">
          <p className="text-sm font-medium text-slate-700 whitespace-nowrap">Actief platform:</p>
          <div className="flex gap-2 flex-wrap">
            {connectedExchanges.map((exchange) => (
              <button
                key={exchange}
                onClick={() => {
                  setActivePlatform(exchange);
                  localStorage.setItem('aio_active_platform', exchange);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activePlatform === exchange
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-white/50 text-slate-700 border border-slate-200 hover:bg-white/80'
                }`}
              >
                {exchange.charAt(0).toUpperCase() + exchange.slice(1)}
              </button>
            ))}
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-slate-500">Beschikbaar</p>
            <p className="text-lg font-semibold text-emerald-600">€{cashSaldo.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:gap-5 md:grid-cols-3">
        <ChatCard context={chatContext} />
        <WalletCard 
          amount={amount} 
          userId={userId}
          onRefresh={() => {
            if (userId) fetchBalances(userId).then(setBalances).catch(() => setBalances([]));
          }}
        />
        <UpdatesCard />
      </div>

      <PortfolioCard balances={activeBalances} />

      <DataOverviewPanel
        profile={profile}
        market={{ volatility, changes: scanChanges }}
        exchanges={connectedExchanges}
        allocation={currentAllocation}
      />
    </div>
  );
}
