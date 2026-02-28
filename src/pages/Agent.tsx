import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';

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
  // Observing agent settings
  monitoringInterval?: number; // minutes
  alertOnVolatility?: boolean;
  volatilityThreshold?: number; // percentage
  analysisDepth?: 'basic' | 'detailed' | 'expert';
  // Trading agent settings
  autoTrade?: boolean;
  riskPerTrade?: number; // percentage
  maxDailyLoss?: number; // percentage
  confidenceThreshold?: number; // percentage (0-100)
  orderLimit?: number; // EUR
  tradingStrategy?: 'conservative' | 'balanced' | 'aggressive';
  enableStopLoss?: boolean;
  stopLossPercent?: number;
};

export function Agent() {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeId | null>(null);
  const [agentSettings, setAgentSettings] = useState<AgentSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

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
    setLoading(true);
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
      setLoading(false);
    }
  };

  const getDefaultSettings = (exchange: ExchangeId, apiMode: AgentMode): AgentSettings => {
    return {
      exchange,
      apiMode,
      enabled: true,
      // Observing agent defaults
      monitoringInterval: 5,
      alertOnVolatility: false,
      volatilityThreshold: 5,
      analysisDepth: 'basic',
      // Trading agent defaults
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

  const loadAgentSettings = (exchange: ExchangeId) => {
    const connection = connections.find((c) => c.exchange === exchange);
    if (!connection) {
      setAgentSettings(null);
      return;
    }

    // Initialize from profile.tradingEnabled (single source of truth)
    const settings = getDefaultSettings(exchange, 'readonly' as const);
    
    // Override autoTrade with profile.tradingEnabled
    if (profile) {
      settings.autoTrade = profile.tradingEnabled || false;
      console.log('[AIO AgentMode] Initialized agentSettings from profile', {
        profile_tradingEnabled: profile.tradingEnabled,
        agentSettings_autoTrade: settings.autoTrade
      });
    }
    
    setAgentSettings(settings);
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
    if (selectedExchange && connections.length > 0 && profile) {
      loadAgentSettings(selectedExchange);
    }
  }, [selectedExchange, connections, profile]);

  const handleSaveSettings = async () => {
    if (!agentSettings || !profile) {
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
        throw new Error(data.error || 'Kon instellingen niet opslaan.');
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
      setTimeout(() => setSaveSuccess(false), 3000);
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

  const selectedConnection = connections.find((c) => c.exchange === selectedExchange);

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <Card title="Agent instellingen" subtitle="Configureer agentgedrag per exchange">
        {loading ? (
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
            {selectedConnection && agentSettings && (
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
                      <input
                        type="checkbox"
                        checked={agentSettings.autoTrade || false}
                        onChange={(e) =>
                          setAgentSettings((current) =>
                            current ? { ...current, autoTrade: e.target.checked } : null
                          )
                        }
                        className="h-4 w-4 text-amber-600 rounded"
                      />
                      <span className="text-sm text-slate-700">Automatisch handelen inschakelen</span>
                    </label>

                    {agentSettings.autoTrade && (
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
                    )}
                  </div>
                )}

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
    </div>
  );
}
