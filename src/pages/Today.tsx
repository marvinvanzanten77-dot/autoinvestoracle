import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { fetchDailyReport } from '../api/dailyReport';
import { fetchDashboard } from '../api/dashboard';
import { mockSignals } from '../data/mockSignals';

export function Today() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ text: string; createdAt: string } | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchDashboard().catch(() => mockSignals);
      const res = await fetchDailyReport({
        portfolioInfo: 'Demo portfolio',
        dashboardSnapshot: snapshot
      });
      setReport({ text: res.reportText, createdAt: res.createdAt });
    } catch (e) {
      console.error(e);
      setError('Kon dagrapport niet genereren.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-title text-slate-900 font-serif">Dagrapport</p>
          <p className="text-sm text-slate-600">Laat de AI een kort dagrapport samenstellen (stub).</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="pill border border-primary/40 bg-primary/15 text-primary hover:bg-primary/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Bezig...' : 'Dagrapport genereren'}
        </button>
      </div>

      {error && <div className="text-sm text-amber-700">{error}</div>}

      <Card title="Dagrapport" subtitle="Stub output">
        {loading && !report && <p className="text-sm text-slate-500">Rapport genereren...</p>}
        {report ? (
          <div className="space-y-3">
            <p className="text-subtitle text-slate-900 font-serif">Dagrapport van vandaag</p>
            <div className="h-px bg-slate-200" />
            {report.text.split('\n').map((line, idx) => (
              <p key={idx} className="text-sm text-slate-700 leading-relaxed">
                {line}
              </p>
            ))}
            <p className="text-xs text-slate-500">Gegenereerd op: {new Date(report.createdAt).toLocaleString()}</p>
          </div>
        ) : (
          !loading && <p className="text-sm text-slate-600">Klik op “Dagrapport genereren” om een stub-rapport op te halen.</p>
        )}
      </Card>
    </div>
  );
}
