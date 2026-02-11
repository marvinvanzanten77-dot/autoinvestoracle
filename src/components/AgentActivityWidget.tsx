import { useState, useEffect } from 'react';

interface AgentActivityProps {
  userId?: string;
}

type AgentStatus = 'running' | 'paused' | 'offline';

interface ActivityLog {
  id: string;
  previous_status: AgentStatus;
  new_status: AgentStatus;
  reason: string;
  changed_at: string;
}

export function AgentActivityWidget({ userId }: AgentActivityProps) {
  const [status, setStatus] = useState<AgentStatus>('running');
  const [loading, setLoading] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial status
  useEffect(() => {
    if (!userId) return;
    fetchStatus();
  }, [userId]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/agent-status?userId=${userId}`);
      const data = await res.json();
      if (data.data?.agentStatus) {
        setStatus(data.data.agentStatus);
      }
    } catch (err) {
      console.error('Failed to fetch agent status:', err);
    }
  };

  const fetchActivityLog = async () => {
    try {
      const res = await fetch(`/api/agent-status?userId=${userId}&action=activity-log&limit=10`);
      const data = await res.json();
      if (data.data) {
        setActivityLog(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch activity log:', err);
    }
  };

  const handleStatusChange = async (newStatus: AgentStatus, reason?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-status?userId=${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus, reason }),
      });

      const data = await res.json();
      if (data.data?.agentStatus) {
        setStatus(data.data.agentStatus);
        await fetchActivityLog();
      } else {
        setError('Failed to update agent status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-status?userId=${userId}&action=toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.data?.agentStatus) {
        setStatus(data.data.agentStatus);
        await fetchActivityLog();
      } else {
        setError('Failed to toggle agent status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (s: AgentStatus) => {
    switch (s) {
      case 'running':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (s: AgentStatus) => {
    switch (s) {
      case 'running':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const getStatusEmoji = (s: AgentStatus) => {
    switch (s) {
      case 'running':
        return '▶️';
      case 'paused':
        return '⏸️';
      case 'offline':
        return '⛔';
      default:
        return '❓';
    }
  };

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Agent Activity</h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm font-medium ${getStatusColor(status)}`}>
          <span>{getStatusEmoji(status)}</span>
          <span>{getStatusLabel(status)}</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <span className="text-red-600 mt-0.5 flex-shrink-0">⚠️</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Status Controls */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => handleStatusChange('running', 'Activated by user')}
          disabled={loading || status === 'running'}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>▶️</span>
          <span className="text-sm font-medium">Run</span>
        </button>

        <button
          onClick={() => handleStatusChange('paused', 'Paused by user')}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>⏸️</span>
          <span className="text-sm font-medium">Pause</span>
        </button>

        <button
          onClick={() => handleStatusChange('offline', 'Went offline by user')}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>⛔</span>
          <span className="text-sm font-medium">Offline</span>
        </button>
      </div>

      {/* Quick Toggle */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <button
          onClick={toggleStatus}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {status === 'running' ? '⏸️ Quick Pause' : '▶️ Quick Start'}
        </button>
      </div>

      {/* Activity Log */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm text-gray-700">Recent Activity</h4>
          <button
            onClick={fetchActivityLog}
            className="text-xs text-blue-600 hover:text-blue-700 underline"
          >
            Refresh
          </button>
        </div>

        {activityLog.length > 0 ? (
          <div className="space-y-2">
            {activityLog.map((log) => (
              <div key={log.id} className="text-xs bg-gray-50 p-2 rounded border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-white text-xs font-medium ${getStatusColor(log.new_status)}`}>
                    {getStatusEmoji(log.new_status)} {getStatusLabel(log.new_status)}
                  </span>
                  <span className="text-gray-500">
                    {new Date(log.changed_at).toLocaleTimeString()}
                  </span>
                </div>
                {log.reason && <p className="text-gray-600">{log.reason}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No activity recorded</p>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>Agent Modes:</strong>
          <ul className="mt-1 space-y-1 ml-2">
            <li>• <strong>Running:</strong> Full observation & suggestion generation</li>
            <li>• <strong>Paused:</strong> Observation mode only, no suggestions</li>
            <li>• <strong>Offline:</strong> Agent completely inactive</li>
          </ul>
        </p>
      </div>
    </div>
  );
}
