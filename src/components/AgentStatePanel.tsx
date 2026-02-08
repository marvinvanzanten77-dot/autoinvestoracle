import { useEffect, useState } from 'react';
import { Card } from './ui/Card';

type AgentState = {
  exchange: string;
  timestamp: string;
  portfolio: {
    totalAssets: number;
    totalValue: number;
    topAssets: Array<{
      asset: string;
      amount: number;
      available: number;
    }>;
  };
  settings: {
    apiMode: string;
    enabled: boolean;
    monitoringInterval: number;
    autoTrade: boolean;
    riskPerTrade: number;
  };
  healthChecks: {
    dataFresh: boolean;
    connectionActive: boolean;
    lastSync: string;
  };
};

interface AgentStatePanelProps {
  exchange: string;
}

export function AgentStatePanel({ exchange }: AgentStatePanelProps) {
  const [state, setState] = useState<AgentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchState = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch(`/api/agent/state?exchange=${exchange}`);
      if (!resp.ok) {
        setError('Kon state niet ophalen');
        return;
      }
      const data = (await resp.json()) as AgentState;
      setState(data);

      // Fetch AI analysis in observer mode
      const analysisResp = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, mode: 'observer' })
      });
      if (analysisResp.ok) {
        const analysisData = (await analysisResp.json()) as { analysis: string };
        setAnalysis(analysisData.analysis);
      }
    } catch (err) {
      console.error('Error fetching state:', err);
      setError('Fout bij ophalen state');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = async () => {
    if (!state) return;
    
    setUpdating(true);
    try {
      const newMode = state.settings.apiMode === 'trading' ? 'readonly' : 'trading';
      
      const resp = await fetch('/api/agent/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          apiMode: newMode,
          autoTrade: newMode === 'trading'
        })
      });
      
      if (resp.ok) {
        // Update local state immediately
        setState(prev => prev ? {
          ...prev,
          settings: {
            ...prev.settings,
            apiMode: newMode,
            autoTrade: newMode === 'trading'
          }
        } : null);
        
        // Refetch to get fresh data
        await fetchState();
      } else if (resp.status === 403) {
        // Permission denied - API keys don't have trading rights
        const errData = await resp.json();
        setError(errData.error || 'Je API keys hebben onvoldoende rechten voor trading mode');
      } else {
        setError('Kon modus niet wijzigen');
      }
    } catch (err) {
      console.error('Error toggling mode:', err);
      setError('Fout bij wijzigen modus');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [exchange]);

  if (loading && !state) {
    return <div className="text-sm text-slate-500">Laden...</div>;
  }

  if (error || !state) {
    return <div className="text-sm text-red-600">{error || 'Geen data'}</div>;
  }

  return (
    <Card title="📊 Huidige Stand van Zaken" subtitle={`${exchange} portfolio analyse`}>
      <div className="space-y-4">
        {/* Permission Warning Banner */}
        {state.settings.apiMode === 'readonly' && (
          <div className="rounded-lg bg-amber-50 border border-amber-300 p-3">
            <p className="text-xs text-amber-700 font-medium mb-1">⚠️ Read-only API sleutels actief</p>
            <p className="text-xs text-amber-600 leading-relaxed">
              Je huidige API sleutels hebben geen trading rechten. Om trading mode in te schakelen, genereer je nieuwe sleutels met de rechten "Account Read" EN "Account Manage" (of "Trading") en verbind ze opnieuw.
            </p>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-300 p-3">
            <p className="text-xs text-red-700 font-medium mb-1">❌ Fout</p>
            <p className="text-xs text-red-600 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-red-600 underline mt-1 hover:text-red-700"
            >
              Sluiten
            </button>
          </div>
        )}
        {/* Portfolio Summary */}
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-600 font-medium">PORTFOLIO OVERZICHT</span>
            <span className="text-xs text-slate-500">
              Geupdate: {new Date(state.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded bg-white p-3">
              <p className="text-xs text-slate-500">Aantal assets</p>
              <p className="text-lg font-semibold text-slate-900">{state.portfolio.totalAssets}</p>
            </div>
            <div className="rounded bg-white p-3">
              <p className="text-xs text-slate-500">Totaalwaarde</p>
              <p className="text-lg font-semibold text-slate-900">€{(state.portfolio.totalValue || 0).toFixed(2)}</p>
            </div>
          </div>

          {state.portfolio.topAssets.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-600 font-medium">Top assets:</p>
              {state.portfolio.topAssets.map((asset) => (
                <div key={asset.asset} className="flex justify-between text-xs bg-white p-2 rounded">
                  <span className="font-medium text-slate-900">{asset.asset}</span>
                  <span className="text-slate-600">
                    {(asset.amount || 0).toFixed(6)} ({(asset.available || 0).toFixed(6)} beschikbaar)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Status */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-blue-600 font-medium">AGENT STATUS</p>
              <p className="text-sm text-blue-900 mt-1">
                {state.settings.enabled ? '✅ Agent aktief' : '⏸️ Agent paused'}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              state.settings.enabled
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {state.settings.apiMode === 'trading' ? '🤖 Trading' : '👁️ Monitoring'}
            </span>
          </div>

          {state.settings.enabled && (
            <div className="mt-3 space-y-3">
              <div className="text-xs text-blue-700 space-y-1">
                <p>• Check-interval: {state.settings.monitoringInterval} minuten</p>
                {state.settings.autoTrade && <p>• Auto-trading: AAN ({state.settings.riskPerTrade}% risico)</p>}
              </div>

              {/* Mode Toggle Switch */}
              <div className="bg-white rounded p-3 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-700">Modus</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {state.settings.apiMode === 'trading' ? 'Trading mode' : 'Monitoring mode'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleMode}
                    disabled={updating}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      state.settings.apiMode === 'trading'
                        ? 'bg-emerald-500'
                        : 'bg-slate-300'
                    } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        state.settings.apiMode === 'trading' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Analysis */}
        {analysis && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs text-amber-600 font-medium mb-2">💡 AI ANALYSE</p>
            <p className="text-sm text-amber-900 leading-relaxed">{analysis}</p>
          </div>
        )}

        {/* Health Status */}
        <div className="flex gap-2 text-xs">
          <span className={`px-2 py-1 rounded-full ${
            state.healthChecks.dataFresh
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            ✓ Data vers
          </span>
          <span className={`px-2 py-1 rounded-full ${
            state.healthChecks.connectionActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}>
            ✓ Verbinding OK
          </span>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={fetchState}
          disabled={loading}
          className="w-full text-xs py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition"
        >
          {loading ? '⏳ Laden...' : '🔄 Handmatig verversen'}
        </button>
      </div>
    </Card>
  );
}
