import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';

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
  const [exchange, setExchange] = useState<string>('all');
  const [exchanges, setExchanges] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

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
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, filter, exchange]);

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
                <option value="all">Alle exchanges</option>
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
    </div>
  );
}
