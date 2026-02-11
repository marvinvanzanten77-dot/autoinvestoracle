import { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import type { Ticket } from '../lib/observation/types';

type TicketsWidgetProps = {
  userId?: string;
};

export function TicketsWidget({ userId }: TicketsWidgetProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Load tickets function
  const loadTickets = async (isPolling = false) => {
    if (!userId) {
      setTickets([]);
      setLoading(false);
      return;
    }

    try {
      if (!isPolling) setLoading(true);
      const resp = await fetch(`/api/tickets?userId=${userId}`);
      if (!resp.ok) throw new Error('Kon tickets niet laden');
      const data = (await resp.json()) as { tickets: Ticket[] };
      setTickets(data.tickets || []);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
      if (!isPolling) setError('Kon tickets niet laden');
    } finally {
      if (!isPolling) setLoading(false);
    }
  };

  // Initial load on mount
  useEffect(() => {
    loadTickets();
  }, [userId]);

  // Auto-refresh polling: refresh every 5 seconds
  useEffect(() => {
    if (!userId) return;

    // Set up polling interval
    const pollInterval = setInterval(() => {
      loadTickets(true); // true = isPolling, so we don't show loading state
    }, 5000); // 5 seconds

    return () => clearInterval(pollInterval);
  }, [userId]);

  const typeColors: Record<string, { bg: string; border: string; text: string }> = {
    observatie: {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-700'
    },
    advies: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700'
    },
    opportuniteit: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700'
    },
    execution: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-800'
    }
  };

  const priorityColors: Record<string, string> = {
    low: 'text-slate-500',
    medium: 'text-amber-600',
    high: 'text-rose-600'
  };

  const confidenceIcons: Record<string, string> = {
    laag: '◐',
    middel: '◑',
    hoog: '◕'
  };

  if (loading) {
    return (
      <Card title="Observatie Tickets" subtitle="Marktwaarnemingen en adviezen">
        <div className="text-center py-8 text-slate-500">Laden...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Observatie Tickets" subtitle="Marktwaarnemingen en adviezen">
        <div className="text-center py-8 text-rose-600">{error}</div>
      </Card>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card title="Observatie Tickets" subtitle="Marktwaarnemingen en adviezen">
        <div className="text-center py-8 text-slate-500">Geen actieve tickets op dit moment.</div>
      </Card>
    );
  }

  return (
    <Card title="Observatie Tickets" subtitle="Marktwaarnemingen en adviezen">
      <div className="space-y-3">
        {tickets.map((ticket) => {
          const colors = typeColors[ticket.type] || typeColors.observatie;
          const isExpired = new Date(ticket.validUntil) < new Date();

          return (
            <div
              key={ticket.id}
              className={`rounded-2xl border p-4 transition ${colors.bg} ${colors.border} ${
                isExpired ? 'opacity-50' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`text-sm font-semibold ${colors.text}`}>{ticket.title}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 border border-slate-200">
                      {ticket.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{ticket.description}</p>
                </div>

                {/* Priority & Confidence */}
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className={`text-xs font-semibold ${priorityColors[ticket.priority]}`}>
                    {ticket.priority === 'high' ? '⚠️ Hoog' : ticket.priority === 'medium' ? '→ Middel' : '○ Laag'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {confidenceIcons[ticket.confidence]} {ticket.confidence}
                  </span>
                </div>
              </div>

              {/* Pattern & Context */}
              <div className="space-y-2 mb-3 text-xs text-slate-600 bg-white/40 rounded-lg p-2">
                <div>
                  <span className="font-medium text-slate-700">Pattern: </span>
                  {ticket.pattern}
                </div>
                <div>
                  <span className="font-medium text-slate-700">Context: </span>
                  {ticket.context}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {isExpired
                    ? '✓ Verlopen'
                    : `Geldig tot ${new Date(ticket.validUntil).toLocaleTimeString('nl-NL', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}`}
                </span>
                {ticket.relatedObservationId && (
                  <a href={`#obs-${ticket.relatedObservationId}`} className="text-primary hover:underline">
                    Zie observatie
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-slate-200/60 text-xs text-slate-600">
        <div className="flex gap-4 flex-wrap justify-between items-start">
          <div className="flex gap-4 flex-wrap">
            <div>
              <span className="font-medium">Totaal:</span> {tickets.length} ticket
              {tickets.length !== 1 ? 's' : ''}
            </div>
            <div>
              <span className="font-medium">Hoog:</span>{' '}
              {tickets.filter((t) => t.priority === 'high').length}
            </div>
            <div>
              <span className="font-medium">Verlopen:</span>{' '}
              {tickets.filter((t) => new Date(t.validUntil) < new Date()).length}
            </div>
          </div>
          {lastRefresh && (
            <div className="text-slate-400 text-xs">
              ↻ Vernieuwd op {lastRefresh.toLocaleTimeString('nl-NL', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
