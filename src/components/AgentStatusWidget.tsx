import { useEffect, useState } from 'react';

type AgentStatus = {
  exchange: string;
  mode: 'readonly' | 'trading';
  enabled: boolean;
  status: 'idle' | 'monitoring' | 'analyzing' | 'trading' | 'error';
  lastActivity?: string;
  nextAction?: string;
  errorMessage?: string;
};

export function AgentStatusWidget() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const resp = await fetch('/api/agent/status');
      if (!resp.ok) return;
      const data = (await resp.json()) as { agents: AgentStatus[] };
      setAgents(data.agents || []);
    } catch (err) {
      console.error('Error fetching agent status:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadHistory = async (exchange: string, format: 'json' | 'text') => {
    try {
      setDownloading(`${exchange}-${format}`);
      const url = `/api/agent/history?exchange=${exchange}&hours=24&format=download`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      
      const blob = await resp.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `agent-history-${exchange}-${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'txt'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Kon geschiedenis niet downloaden');
    } finally {
      setDownloading(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Update every 30 seconds (reduced from 3)
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'bg-slate-50 border-slate-200 text-slate-700';
      case 'monitoring':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'analyzing':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'trading':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle':
        return '😴';
      case 'monitoring':
        return '👁️';
      case 'analyzing':
        return '🤔';
      case 'trading':
        return '🤖';
      case 'error':
        return '⚠️';
      default:
        return '•';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'idle':
        return 'Passief';
      case 'monitoring':
        return 'Monitoring';
      case 'analyzing':
        return 'Analyseren';
      case 'trading':
        return 'Handelen';
      case 'error':
        return 'Fout';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 md:p-5">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-3 bg-slate-100 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 md:p-5">
        <p className="text-xs text-slate-500">Geen agents gekoppeld</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-subtitle text-slate-900 font-serif">Agent Status</h3>
        <span className="text-xs text-slate-500">Live</span>
      </div>

      <div className="space-y-2">
        {agents.map((agent) => {
          const colors = getStatusColor(agent.status);
          const isEnabled = agent.enabled && agent.status !== 'error';

          return (
            <div
              key={agent.exchange}
              className={`rounded-lg border p-3 transition ${colors} ${!isEnabled ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg flex-shrink-0">{getStatusIcon(agent.status)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{agent.exchange}</p>
                    <p className="text-xs opacity-75">{getStatusLabel(agent.status)}</p>
                    {agent.nextAction && (
                      <p className="text-xs opacity-75 mt-1">Volgende: {agent.nextAction}</p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium">{agent.mode === 'trading' ? '🤖' : '👁️'}</p>
                  {agent.lastActivity && (
                    <p className="text-xs opacity-75 mt-1">
                      {new Date(agent.lastActivity).toLocaleTimeString('nl-NL', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              </div>

              {agent.errorMessage && (
                <div className="mt-2 p-2 bg-black/5 rounded text-xs">
                  <p className="font-medium">Error:</p>
                  <p className="opacity-75">{agent.errorMessage}</p>
                </div>
              )}

              {/* Download buttons */}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => downloadHistory(agent.exchange, 'json')}
                  disabled={downloading === `${agent.exchange}-json`}
                  className="flex-1 text-xs py-1 px-2 rounded border border-current/30 hover:bg-black/5 transition disabled:opacity-50"
                >
                  {downloading === `${agent.exchange}-json` ? '⬇️ JSON...' : '📥 JSON'}
                </button>
                <button
                  onClick={() => downloadHistory(agent.exchange, 'text')}
                  disabled={downloading === `${agent.exchange}-text`}
                  className="flex-1 text-xs py-1 px-2 rounded border border-current/30 hover:bg-black/5 transition disabled:opacity-50"
                >
                  {downloading === `${agent.exchange}-text` ? '⬇️ TXT...' : '📄 TXT'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
