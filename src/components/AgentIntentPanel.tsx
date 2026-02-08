import { useEffect, useState } from 'react';
import { Card } from './ui/Card';

type AgentIntent = {
  exchange: string;
  timestamp: string;
  mode: string;
  enabled: boolean;
  nextAction: {
    type: string;
    description: string;
    reason: string;
  };
  safetyLimits: {
    maxRiskPerTrade: number;
    maxDailyLoss: number;
    confidenceThreshold: number;
    enableStopLoss: boolean;
  };
  nextCheck: {
    in: number;
    unit: string;
    estimatedTime: string;
  };
};

interface AgentIntentPanelProps {
  exchange: string;
}

export function AgentIntentPanel({ exchange }: AgentIntentPanelProps) {
  const [intent, setIntent] = useState<AgentIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const fetchIntent = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch(`/api/agent/intent?exchange=${exchange}`);
      if (!resp.ok) {
        setError('Kon intent niet ophalen');
        return;
      }
      const data = (await resp.json()) as AgentIntent;
      setIntent(data);

      // Fetch AI analysis in planner_explainer mode
      const analysisResp = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, mode: 'planner_explainer' })
      });
      if (analysisResp.ok) {
        const analysisData = (await analysisResp.json()) as { analysis: string };
        setAnalysis(analysisData.analysis);
      }
    } catch (err) {
      console.error('Error fetching intent:', err);
      setError('Fout bij ophalen intent');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntent();
    const interval = setInterval(fetchIntent, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [exchange]);

  if (loading && !intent) {
    return <div className="text-sm text-slate-500">Laden...</div>;
  }

  if (error || !intent) {
    return <div className="text-sm text-red-600">{error || 'Geen data'}</div>;
  }

  const getActionColor = (type: string) => {
    switch (type) {
      case 'idle':
        return 'bg-slate-50 border-slate-200 text-slate-700';
      case 'monitor':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'prepare_trade':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getActionEmoji = (type: string) => {
    switch (type) {
      case 'idle':
        return '😴';
      case 'monitor':
        return '👁️';
      case 'prepare_trade':
        return '🤖';
      default:
        return '❓';
    }
  };

  return (
    <Card title="🎯 Agent Plan" subtitle="Volgende acties en waarom">
      <div className="space-y-4">
        {/* Primary Action */}
        <div className={`rounded-lg border-2 p-4 ${getActionColor(intent.nextAction.type)}`}>
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold">
              {getActionEmoji(intent.nextAction.type)} {intent.nextAction.description}
            </p>
            <span className="text-xs text-slate-500">
              {new Date(intent.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-xs leading-relaxed">{intent.nextAction.reason}</p>
        </div>

        {/* AI Explanation */}
        {analysis && (
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
            <p className="text-xs text-purple-600 font-medium mb-2">📝 AGENT VERKLAART:</p>
            <p className="text-sm text-purple-900 leading-relaxed">{analysis}</p>
          </div>
        )}

        {/* Safety Limits */}
        {intent.enabled && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
            <p className="text-xs text-orange-600 font-medium mb-3">🛡️ VEILIGHEIDSLIMIETEN</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded">
                <p className="text-orange-600 font-medium">Max risico/trade</p>
                <p className="text-orange-900 text-lg font-bold">{intent.safetyLimits.maxRiskPerTrade}%</p>
              </div>
              <div className="bg-white p-2 rounded">
                <p className="text-orange-600 font-medium">Max dagelijks verlies</p>
                <p className="text-orange-900 text-lg font-bold">{intent.safetyLimits.maxDailyLoss}%</p>
              </div>
              <div className="bg-white p-2 rounded">
                <p className="text-orange-600 font-medium">Minimale vertrouwen</p>
                <p className="text-orange-900 text-lg font-bold">{intent.safetyLimits.confidenceThreshold}%</p>
              </div>
              <div className="bg-white p-2 rounded">
                <p className="text-orange-600 font-medium">Stop-loss actief</p>
                <p className="text-orange-900 text-lg font-bold">
                  {intent.safetyLimits.enableStopLoss ? 'JA' : 'NEE'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Next Check Schedule */}
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs text-slate-600 font-medium mb-2">⏰ VOLGENDE CHECK</p>
          <div className="space-y-1">
            <p className="text-sm text-slate-900 font-semibold">
              Over {intent.nextCheck.in} {intent.nextCheck.unit}
            </p>
            <p className="text-xs text-slate-600">
              {new Date(intent.nextCheck.estimatedTime).toLocaleString('nl-NL')}
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={fetchIntent}
          disabled={loading}
          className="w-full text-xs py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition"
        >
          {loading ? '⏳ Laden...' : '🔄 Ververs plan'}
        </button>
      </div>
    </Card>
  );
}
