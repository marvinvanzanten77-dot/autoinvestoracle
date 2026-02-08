import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { marketContext, marketUpdates, volatilityStatus } from '../data/marketUpdates';
import { educationSnippets } from '../data/educationSnippets';
import { fetchMarketScan, type MarketScanRange, type MarketScanResponse } from '../api/marketScan';
import { fetchMarketSummary, type MarketSummaryResponse } from '../api/marketSummary';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

export function Today() {
  const [lastScan, setLastScan] = useState('Nog geen check');
  const [range, setRange] = useState<MarketScanRange>('24h');
  const [scanData, setScanData] = useState<MarketScanResponse | null>(null);
  const [summary, setSummary] = useState<MarketSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (targetRange = range) => {
    const time = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    setLastScan(time);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarketScan(targetRange);
      setScanData(data);
      localStorage.setItem('aio_market_scan_v1', JSON.stringify(data));
      try {
        const aiSummary = await fetchMarketSummary(targetRange, data.changes);
        setSummary(aiSummary);
      } catch (summaryError) {
        console.error(summaryError);
      }
    } catch (err) {
      console.error(err);
      setError('Kon marktdata niet ophalen.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('aio_market_scan_v1');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as MarketScanResponse;
        setScanData(parsed);
        setLastScan(
          new Date(parsed.updatedAt).toLocaleTimeString('nl-NL', {
            hour: '2-digit',
            minute: '2-digit'
          })
        );
        const cachedSummary = localStorage.getItem('aio_market_summary_v1');
        if (cachedSummary) {
          setSummary(JSON.parse(cachedSummary) as MarketSummaryResponse);
        }
      } catch {
        // ignore invalid storage
      }
    }
  }, []);

  useEffect(() => {
    handleScan(range);
  }, [range]);

  useEffect(() => {
    if (!summary) return;
    localStorage.setItem('aio_market_summary_v1', JSON.stringify(summary));
  }, [summary]);

  const chartData = useMemo(() => {
    if (!scanData?.series?.length) return [];
    return scanData.series.map((point) => ({
      time: point.time,
      Bitcoin: point.bitcoin,
      Ethereum: point.ethereum,
      Stablecoins: point.stablecoins,
      Altcoins: point.altcoins
    }));
  }, [scanData]);

  const tickFormatter = (value: string) => {
    const date = new Date(value);
    if (range === '7d') {
      return date.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' });
    }
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-title text-slate-900 font-serif">Marktnieuws</p>
          <p className="text-sm text-slate-700">Korte vertaling van wat er speelt in de markt.</p>
        </div>
        <button
          type="button"
          onClick={() => handleScan(range)}
          className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition"
        >
          {loading ? 'Bezig...' : 'Korte check'}
        </button>
      </div>

      <Card
        title="Koersbewegingen"
        subtitle={
          range === '1h'
            ? 'Laatste uur'
            : range === '7d'
              ? 'Laatste 7 dagen'
              : 'Laatste 24 uur'
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3">
          {([
            { id: '1h', label: '1 uur' },
            { id: '24h', label: '24 uur' },
            { id: '7d', label: '7 dagen' }
          ] as { id: MarketScanRange; label: string }[]).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`pill border transition ${
                range === item.id
                  ? 'border-primary/40 bg-primary/30 text-primary'
                  : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-amber-700">{error}</p>}
        {!error && (
          <div className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid stroke="rgba(15,23,42,0.08)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={tickFormatter}
                    stroke="rgba(71,85,105,0.6)"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(71,85,105,0.75)', fontSize: 11 }}
                  />
                  <YAxis
                    stroke="rgba(71,85,105,0.6)"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(71,85,105,0.75)', fontSize: 11 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                    labelFormatter={(label) => `Tijd: ${tickFormatter(label)}`}
                    contentStyle={{
                      background: '#F9F7F2',
                      border: '1px solid rgba(148,163,184,0.35)',
                      borderRadius: '12px',
                      color: '#0f172a'
                    }}
                    labelStyle={{ color: '#475569' }}
                  />
                  <Line type="monotone" dataKey="Bitcoin" stroke="#6FA8A1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Ethereum" stroke="#8FA6C3" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Stablecoins" stroke="#C7B28A" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Altcoins" stroke="#BFA2C6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm text-slate-700">
              <p className="text-xs text-slate-500 mb-1">AI-toelichting</p>
              {summary ? (
                <p className="whitespace-pre-line">{summary.summary}</p>
              ) : (
                <p className="text-slate-500">Nog geen samenvatting beschikbaar.</p>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card title="Laatste observaties" subtitle={`Laatste check: ${lastScan}`}>
        <div className="space-y-4">
          {marketUpdates.map((item) => (
            <div key={item.title} className="space-y-1">
              <p className="text-subtitle text-slate-900 font-serif">{item.title}</p>
              <p className="text-sm text-slate-700">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>


    </div>
  );
}
