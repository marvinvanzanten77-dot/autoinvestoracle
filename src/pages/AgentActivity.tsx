import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { AgentStatePanel } from '../components/AgentStatePanel';
import { AgentIntentPanel } from '../components/AgentIntentPanel';
import { AgentChat } from '../components/AgentChat';

type ActivityType =
  | 'monitoring'
  | 'alert'
  | 'analysis'
  | 'trade_placed'
  | 'trade_filled'
  | 'trade_cancelled'
  | 'stop_loss_triggered'
  | 'daily_limit_reached'
  | 'error';

type AgentActivity = {
  id: string;
  exchange: string;
  type: ActivityType;
  status: 'success' | 'pending' | 'failed';
  title: string;
  description: string;
  details?: Record<string, any>;
  timestamp: string;
  executedAt?: string;
  duration?: number; // milliseconds
};

type ExchangeId = 'bitvavo' | 'kraken' | 'coinbase' | 'bybit';
type AgentMode = 'readonly' | 'trading';

type ExchangeConnection = {
  id: string;
  exchange: ExchangeId;
  status: 'connected' | 'needs_reauth' | 'error' | 'disconnected';
  apiMode?: AgentMode;
};

type AgentSettings = {
  exchange: ExchangeId;
  apiMode: AgentMode;
  enabled: boolean;
  monitoringInterval?: number;
  alertOnVolatility?: boolean;
  volatilityThreshold?: number;
  analysisDepth?: 'basic' | 'detailed' | 'expert';
  autoTrade?: boolean;
  riskPerTrade?: number;
  maxDailyLoss?: number;
  confidenceThreshold?: number;
  orderLimit?: number;
  tradingStrategy?: 'conservative' | 'balanced' | 'aggressive';
  enableStopLoss?: boolean;
  stopLossPercent?: number;
  assetPreferences?: {
    bitcoin: number; // 0-100
    ethereum: number; // 0-100
    stablecoins: number; // 0-100
    altcoins: number; // 0-100
    memecoins: number; // 0-100
    hypeCoins: number; // 0-100
    newCoins: number; // 0-100
  };
};

const ACTIVITY_COLORS: Record<ActivityType, { bg: string; text: string; icon: string }> = {
  monitoring: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '👁️' },
  alert: { bg: 'bg-amber-50', text: 'text-amber-700', icon: '⚠️' },
  analysis: { bg: 'bg-purple-50', text: 'text-purple-700', icon: '📊' },
  trade_placed: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '🛒' },
  trade_filled: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '✓' },
  trade_cancelled: { bg: 'bg-slate-50', text: 'text-slate-700', icon: '✕' },
  stop_loss_triggered: { bg: 'bg-red-50', text: 'text-red-700', icon: '🛑' },
  daily_limit_reached: { bg: 'bg-orange-50', text: 'text-orange-700', icon: '📈' },
  error: { bg: 'bg-red-50', text: 'text-red-700', icon: '❌' }
};

export function AgentActivity() {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [exchange, setExchange] = useState<string>('bitvavo');
  const [exchanges, setExchanges] = useState<string[]>(['bitvavo']);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'settings'>('overview');

  // Agent settings state
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeId | null>(null);
  const [agentSettings, setAgentSettings] = useState<AgentSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const fetchActivities = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('type', filter);
      if (exchange !== 'all') params.append('exchange', exchange);

      const resp = await fetch(`/api/agent/activity?${params.toString()}`);
      if (!resp.ok) return;

      const data = (await resp.json()) as { activities: AgentActivity[] };
      setActivities(data.activities || []);

      // Extract unique exchanges
      const uniqueExchanges = Array.from(
        new Set(data.activities?.map((a) => a.exchange) || [])
      );
      setExchanges(uniqueExchanges);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [filter, exchange]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchActivities();
    }, 30000); // Refresh every 30 seconds (reduced from 5)

    return () => clearInterval(interval);
  }, [autoRefresh, filter, exchange]);

  // Agent settings functions
  const initSession = async () => {
    const resp = await fetch('/api/session/init');
    if (!resp.ok) return;
    const data = (await resp.json()) as { userId: string };
    setUserId(data.userId);
  };

  // Load profile to get tradingEnabled setting
  const loadProfile = async () => {
    try {
      const resp = await fetch('/api/profile/get');
      if (resp.ok) {
        const data = (await resp.json()) as { profile?: any };
        if (data.profile) {
          setProfile(data.profile);
          console.log('[AIO AgentMode] Profile loaded, tradingEnabled:', data.profile.tradingEnabled);
        }
      }
    } catch (err) {
      console.error('[AIO AgentMode] Failed to load profile:', err);
    }
  };

  const loadConnections = async (id: string) => {
    setSettingsLoading(true);
    try {
      const resp = await fetch(`/api/exchanges/status?userId=${id}`);
      if (!resp.ok) {
        setConnections([]);
        return;
      }
      const data = (await resp.json()) as { connections: ExchangeConnection[] };
      const connected = data.connections?.filter((c) => c.status === 'connected') || [];
      setConnections(connected);
    } catch (err) {
      console.error('Error loading connections:', err);
      setConnections([]);
    } finally {
      setSettingsLoading(false);
    }
  };

  const getDefaultSettings = (exchange: ExchangeId, apiMode: AgentMode): AgentSettings => {
    return {
      exchange,
      apiMode,
      enabled: true,
      monitoringInterval: 5,
      alertOnVolatility: false,
      volatilityThreshold: 5,
      analysisDepth: 'basic',
      autoTrade: false,
      riskPerTrade: 2,
      maxDailyLoss: 5,
      confidenceThreshold: 70,
      orderLimit: 100,
      tradingStrategy: 'balanced',
      enableStopLoss: false,
      stopLossPercent: 5
    };
  };

  const loadAgentSettings = (exch: ExchangeId) => {
    const connection = connections.find((c) => c.exchange === exch);
    if (!connection) {
      setAgentSettings(null);
      return;
    }

    // Initialize from profile.tradingEnabled (single source of truth)
    const settings = getDefaultSettings(exch, connection.apiMode || 'readonly');
    
    // Override autoTrade with profile.tradingEnabled
    if (profile) {
      settings.autoTrade = profile.tradingEnabled || false;
      console.log('[AIO AgentMode] Initialized agentSettings from profile', {
        exchange: exch,
        profile_tradingEnabled: profile.tradingEnabled,
        agentSettings_autoTrade: settings.autoTrade
      });
    }
    
    setAgentSettings(settings);
  };

  const handleSaveSettings = async () => {
    if (!agentSettings || !selectedExchange || !profile) {
      setError('Profiel is nog niet geladen.');
      return;
    }
    
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    
    try {
      console.log('[AIO AgentSettings] Saving agent settings to profile', {
        exchange: selectedExchange,
        tradingEnabled: agentSettings.autoTrade,
        riskPercentPerTrade: agentSettings.riskPerTrade,
        stopLossPercent: agentSettings.stopLossPercent,
        maxDrawdownPercent: agentSettings.maxDailyLoss
      });

      // Update profile with trading settings
      const updatedProfile = {
        ...profile,
        tradingEnabled: agentSettings.autoTrade,
        riskPercentPerTrade: agentSettings.riskPerTrade,
        stopLossPercent: agentSettings.stopLossPercent,
        maxDrawdownPercent: agentSettings.maxDailyLoss
      };

      const resp = await fetch('/api/profile/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: updatedProfile })
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Kon instellingen niet opslaan');
      }

      const data = (await resp.json()) as { profile?: any };
      if (data.profile) {
        setProfile(data.profile);
        // Sync agentSettings with saved profile
        setAgentSettings((curr) => curr ? { ...curr, autoTrade: data.profile.tradingEnabled } : null);
        console.log('[AIO AgentMode] saved tradingEnabled to profile', {
          tradingEnabled: data.profile.tradingEnabled
        });
        console.log('[AIO AgentSettings] ✅ Settings saved successfully');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Fout bij opslaan';
      console.error('[AIO AgentSettings] ❌ Error saving settings:', {
        message: errorMsg,
        error: err
      });
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    initSession();
    loadProfile();
  }, []);

  useEffect(() => {
    if (userId) {
      loadConnections(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (selectedExchange && profile) {
      loadAgentSettings(selectedExchange);
    }
  }, [selectedExchange, connections, profile]);

  const getStatusBadge = (status: 'success' | 'pending' | 'failed') => {
    const styles =
      status === 'success'
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : status === 'pending'
          ? 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse'
          : 'bg-red-100 text-red-700 border-red-200';

    return (
      <span className={`text-xs px-2 py-1 rounded-full border ${styles}`}>
        {status === 'success' ? '✓ Succes' : status === 'pending' ? '⏳ Bezig' : '✕ Fout'}
      </span>
    );
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          📊 Stand van Zaken
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          📋 Activiteiten Log
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'settings'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          ⚙️ Agent Instellingen
        </button>
        <button
          type="button"
          onClick={() => setChatOpen(!chatOpen)}
          className="ml-auto px-4 py-2 text-sm font-medium border-b-2 border-transparent text-slate-600 hover:text-primary transition"
        >
          💬 Agent Copilot
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <AgentStatePanel exchange={exchange} />
            <AgentIntentPanel exchange={exchange} />
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <>
          <Card title="Agent activiteit" subtitle="Real-time overzicht van alles wat agents doen">
            {/* Controls */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="h-4 w-4 text-primary"
                    />
                    Auto-refresh (5s)
                  </label>
                </div>
                <button
                  type="button"
                  onClick={fetchActivities}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 transition"
                >
                  Nu vernieuwen
                </button>
              </div>

              {/* Filter rows */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Type filter */}
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-2">Activiteit type</label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as ActivityType | 'all')}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="all">Alle types</option>
                    <option value="monitoring">👁️ Monitoring</option>
                    <option value="alert">⚠️ Alertes</option>
                    <option value="analysis">📊 Analyse</option>
                    <option value="trade_placed">🛒 Order geplaatst</option>
                    <option value="trade_filled">✓ Order voltooid</option>
                    <option value="trade_cancelled">✕ Order geannuleerd</option>
                    <option value="stop_loss_triggered">🛑 Stop-loss</option>
                    <option value="daily_limit_reached">📈 Dagelijkse limiet</option>
                    <option value="error">❌ Fouten</option>
                  </select>
                </div>

                {/* Exchange filter */}
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-2">Exchange</label>
                  <select
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="bitvavo">Bitvavo</option>
                    {exchanges.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Activity list */}
            {loading ? (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">Activiteiten laden...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">Geen activiteiten gevonden</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {activities.map((activity) => {
                  const colors = ACTIVITY_COLORS[activity.type];
                  return (
                    <div
                      key={activity.id}
                      className={`${colors.bg} border border-slate-200/50 rounded-lg p-4 space-y-2`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-xl mt-0.5">{colors.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${colors.text}`}>{activity.title}</p>
                            <p className="text-xs text-slate-600 mt-1">{activity.description}</p>
                            {activity.details && (
                              <div className="mt-2 space-y-1 text-xs text-slate-600">
                                {Object.entries(activity.details).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="font-medium">{key}:</span>
                                    <span className="text-right">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-2">
                          {getStatusBadge(activity.status)}
                          <div className="text-right">
                            <p className="text-xs font-medium text-slate-700 capitalize">{activity.exchange}</p>
                            <p className="text-xs text-slate-500">
                              {formatDate(activity.timestamp)} {formatTime(activity.timestamp)}
                            </p>
                            {activity.duration && (
                              <p className="text-xs text-slate-500">{activity.duration}ms</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Summary stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card title={activities.filter((a) => a.type === 'monitoring').length.toString()} subtitle="Monitoring sessies">
              <p className="text-xs text-slate-500">Aantal keer agents monitoring hebben gedaan</p>
            </Card>
            <Card
              title={activities.filter((a) => a.type.startsWith('trade')).length.toString()}
              subtitle="Trades uitgevoerd"
            >
              <p className="text-xs text-slate-500">Orders geplaatst en voltooid</p>
            </Card>
            <Card title={activities.filter((a) => a.status === 'pending').length.toString()} subtitle="Bezig">
              <p className="text-xs text-slate-500">Activiteiten in uitvoering</p>
            </Card>
            <Card title={activities.filter((a) => a.status === 'failed').length.toString()} subtitle="Fouten">
              <p className="text-xs text-slate-500">Mislukte activiteiten</p>
            </Card>
          </div>
        </>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <Card title="Agent instellingen" subtitle="Configureer agentgedrag per exchange">
          {settingsLoading ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Exchanges laden...</p>
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">
                Geen gekoppelde exchanges gevonden. Verbind eerst een exchange op het tabblad "Exchanges".
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Exchange selection */}
              <div className="space-y-3">
                <p className="text-xs text-slate-500 font-medium">EXCHANGE SELECTEREN</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {connections.map((conn) => (
                    <button
                      key={conn.exchange}
                      type="button"
                      onClick={() => setSelectedExchange(conn.exchange as ExchangeId)}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        selectedExchange === conn.exchange
                          ? 'border-primary/40 bg-primary/20'
                          : 'border-slate-200 bg-white/70 hover:bg-white'
                      }`}
                    >
                      <p className="text-subtitle text-slate-900 font-serif capitalize">{conn.exchange}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {profile?.tradingEnabled ? '🤖 Trading Agent' : '👁️ Observation Only'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent settings for selected exchange */}
              {selectedExchange && agentSettings && (
                <div className="space-y-6 border-t border-slate-200/70 pt-6">
                  {/* Common settings */}
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 font-medium">AGENT STATUS</p>
                    <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/50 hover:bg-slate-100/50 transition cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agentSettings.enabled}
                        onChange={(e) =>
                          setAgentSettings((current) =>
                            current ? { ...current, enabled: e.target.checked } : null
                          )
                        }
                        className="h-4 w-4 text-primary rounded"
                      />
                      <span className="text-sm text-slate-700">
                        {agentSettings.enabled ? '✓ Agent actief' : '○ Agent inactief'}
                      </span>
                    </label>
                  </div>

                  {/* Observation agent settings */}
                  {agentSettings.apiMode === 'readonly' && (
                    <div className="space-y-4 rounded-lg bg-blue-50/50 border border-blue-200/50 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">👁️</span>
                        <p className="text-sm font-medium text-slate-700">Observation Mode</p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-600 font-medium">
                            Monitoring Interval (minuten)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="1440"
                            value={agentSettings.monitoringInterval || 5}
                            onChange={(e) =>
                              setAgentSettings((current) =>
                                current
                                  ? { ...current, monitoringInterval: parseInt(e.target.value) }
                                  : null
                              )
                            }
                            className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                          <p className="text-xs text-slate-500 mt-1">Hoe vaak checks uit te voeren (1-1440)</p>
                        </div>

                        <label className="flex items-center gap-3 p-3 rounded-lg bg-white/50 hover:bg-white/70 transition cursor-pointer">
                          <input
                            type="checkbox"
                            checked={agentSettings.alertOnVolatility || false}
                            onChange={(e) =>
                              setAgentSettings((current) =>
                                current ? { ...current, alertOnVolatility: e.target.checked } : null
                              )
                            }
                            className="h-4 w-4 text-primary rounded"
                          />
                          <span className="text-sm text-slate-700">Waarschuwen bij volatiliteit</span>
                        </label>

                        {agentSettings.alertOnVolatility && (
                          <div>
                            <label className="text-xs text-slate-600 font-medium">
                              Volatiliteit drempel (%)
                            </label>
                            <input
                              type="number"
                              min="0.1"
                              max="100"
                              step="0.1"
                              value={agentSettings.volatilityThreshold || 5}
                              onChange={(e) =>
                                setAgentSettings((current) =>
                                  current
                                    ? { ...current, volatilityThreshold: parseFloat(e.target.value) }
                                    : null
                                )
                              }
                              className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          </div>
                        )}

                        <div>
                          <label className="text-xs text-slate-600 font-medium">Analysetaal</label>
                          <select
                            value={agentSettings.analysisDepth || 'basic'}
                            onChange={(e) =>
                              setAgentSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      analysisDepth: e.target.value as 'basic' | 'detailed' | 'expert'
                                    }
                                  : null
                              )
                            }
                            className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          >
                            <option value="basic">Basis (snel)</option>
                            <option value="detailed">Gedetailleerd (normaal)</option>
                            <option value="expert">Expert (diep)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Trading agent settings */}
                  {agentSettings.apiMode === 'trading' && (
                    <div className="space-y-4 rounded-lg bg-amber-50/50 border border-amber-200/50 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">🤖</span>
                        <p className="text-sm font-medium text-slate-700">Uitvoerend Agent</p>
                      </div>

                      <label className="flex items-center gap-3 p-3 rounded-lg bg-white/50 hover:bg-white/70 transition cursor-pointer">
                        <span className="text-sm text-slate-700">
                          💡 Trading is ingeschakeld in <strong>Settings → Trading Bot</strong>
                        </span>
                      </label>

                      <div className="space-y-3 pt-3 border-t border-white/50">
                          <div>
                            <label className="text-xs text-slate-600 font-medium">
                              Handelsintensiteit
                            </label>
                            <select
                              value={agentSettings.tradingStrategy || 'balanced'}
                              onChange={(e) =>
                                setAgentSettings((current) =>
                                  current
                                    ? {
                                        ...current,
                                        tradingStrategy: e.target.value as
                                          | 'conservative'
                                          | 'balanced'
                                          | 'aggressive'
                                      }
                                    : null
                                )
                              }
                              className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            >
                              <option value="conservative">Voorzichtig (minder trades)</option>
                              <option value="balanced">Gebalanceerd (normaal)</option>
                              <option value="aggressive">Actief (meer trades)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-slate-600 font-medium">
                              Ordergrootte limiet (EUR)
                            </label>
                            <input
                              type="number"
                              min="25"
                              step="25"
                              value={agentSettings.orderLimit || 100}
                              onChange={(e) =>
                                setAgentSettings((current) =>
                                  current ? { ...current, orderLimit: parseInt(e.target.value) } : null
                                )
                              }
                              className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">Maximale waarde per order</p>
                          </div>

                          <div>
                            <label className="text-xs text-slate-600 font-medium">
                              Risico per trade (%)
                            </label>
                            <input
                              type="number"
                              min="0.1"
                              max="10"
                              step="0.1"
                              value={agentSettings.riskPerTrade || 2}
                              onChange={(e) =>
                                setAgentSettings((current) =>
                                  current
                                    ? { ...current, riskPerTrade: parseFloat(e.target.value) }
                                    : null
                                )
                              }
                              className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">% van account per trade</p>
                          </div>

                          <div>
                            <label className="text-xs text-slate-600 font-medium">
                              Max dagelijks verlies (%)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              step="1"
                              value={agentSettings.maxDailyLoss || 5}
                              onChange={(e) =>
                                setAgentSettings((current) =>
                                  current
                                    ? { ...current, maxDailyLoss: parseInt(e.target.value) }
                                    : null
                                )
                              }
                              className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">Stop trading als verlies bereikt</p>
                          </div>

                          <div>
                            <label className="text-xs text-slate-600 font-medium">
                              Betrouwbaarheidsdrempel (%)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="5"
                              value={agentSettings.confidenceThreshold || 70}
                              onChange={(e) =>
                                setAgentSettings((current) =>
                                  current
                                    ? { ...current, confidenceThreshold: parseInt(e.target.value) }
                                    : null
                                )
                              }
                              className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Alleen handelen als zekerheid boven drempel
                            </p>
                          </div>

                          <label className="flex items-center gap-3 p-3 rounded-lg bg-white/50 hover:bg-white/70 transition cursor-pointer">
                            <input
                              type="checkbox"
                              checked={agentSettings.enableStopLoss || false}
                              onChange={(e) =>
                                setAgentSettings((current) =>
                                  current ? { ...current, enableStopLoss: e.target.checked } : null
                                )
                              }
                              className="h-4 w-4 text-amber-600 rounded"
                            />
                            <span className="text-sm text-slate-700">Stop-loss activeren</span>
                          </label>

                          {agentSettings.enableStopLoss && (
                            <div>
                              <label className="text-xs text-slate-600 font-medium">
                                Stop-loss percentage (%)
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="50"
                                step="1"
                                value={agentSettings.stopLossPercent || 5}
                                onChange={(e) =>
                                  setAgentSettings((current) =>
                                    current
                                      ? { ...current, stopLossPercent: parseInt(e.target.value) }
                                      : null
                                  )
                                }
                                className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                            </div>
                          )}
                        </div>
                    </div>
                  )}

                  {/* Asset Preferences */}
                  <div className="space-y-4 rounded-lg bg-purple-50/50 border border-purple-200/50 p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">🎯</span>
                      <p className="text-sm font-medium text-slate-700">Interessegebieden</p>
                    </div>

                    <p className="text-xs text-slate-600">
                      Geef aan hoeveel interesse je hebt in verschillende crypto-categorieën:
                    </p>

                    <div className="space-y-4">
                      {[
                        { key: 'bitcoin', label: '₿ Bitcoin', icon: '🔵' },
                        { key: 'ethereum', label: '◆ Ethereum', icon: '🔷' },
                        { key: 'stablecoins', label: '💵 Stablecoins', icon: '💵' },
                        { key: 'altcoins', label: '🪙 Altcoins', icon: '🪙' },
                        { key: 'memecoins', label: '🐕 Memecoins', icon: '🐕' },
                        { key: 'hypeCoins', label: '🚀 Hype Coins', icon: '🚀' },
                        { key: 'newCoins', label: '🆕 Nieuwe Coins', icon: '🆕' }
                      ].map(({ key, label, icon }) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm text-slate-700 font-medium">
                              {icon} {label}
                            </label>
                            <span className="text-sm font-bold text-purple-600">
                              {(agentSettings.assetPreferences?.[key as keyof typeof agentSettings.assetPreferences] ?? 0)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={
                              agentSettings.assetPreferences?.[key as keyof typeof agentSettings.assetPreferences] ?? 0
                            }
                            onChange={(e) =>
                              setAgentSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      assetPreferences: {
                                        ...current.assetPreferences,
                                        [key]: parseInt(e.target.value)
                                      }
                                    }
                                  : null
                              )
                            }
                            className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  )}

                  {saveSuccess && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                      <p className="text-xs text-emerald-700">✓ Instellingen opgeslagen</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Opslaan...' : 'Instellingen opslaan'}
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
      <AgentChat exchange={exchange} isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
