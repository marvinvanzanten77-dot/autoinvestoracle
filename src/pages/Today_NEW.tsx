/**
 * TODAY PAGE - CONSOLIDATED VERSION
 * 
 * DATA FETCHING STRATEGY:
 * - NO auto-refresh (prevents OpenAI costs)
 * - Fetches on initial mount (if user is present)
 * - Manual refresh button for user-triggered updates
 * - Caches for 5 minutes to avoid duplicate requests
 */

import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import {
  getMarketUpdates,
  getMarketContext,
  getLimitedEducation,
  getAutoLoadedDataCached,
  refreshAutoLoadedData,
  type AutoLoadedData,
} from '../lib/dataService';
import { fetchMarketScan, type MarketScanRange, type MarketScanResponse } from '../api/marketScan';
import { fetchMarketSummary, type MarketSummaryResponse } from '../api/marketSummary';
import { AutoLoadedDataWidget } from '../components/AutoLoadedDataWidget';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

export function Today() {
  const [lastScan, setLastScan] = useState('Nog geen check');
  const [range, setRange] = useState<MarketScanRange>('24h');
  const [scanData, setScanData] = useState<MarketScanResponse | null>(null);
  const [summary, setSummary] = useState<MarketSummaryResponse | null>(null);
  const [autoLoadData, setAutoLoadData] = useState<AutoLoadedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoLoadLoading, setAutoLoadLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoLoadError, setAutoLoadError] = useState<string | null>(null);

  // ========================================================
  // ONLY LOAD ONCE on mount (no auto-refresh)
  // ========================================================
  useEffect(() => {
    async function loadAutoData() {
      try {
        setAutoLoadLoading(true);
        const data = await getAutoLoadedDataCached();
        setAutoLoadData(data);
        setAutoLoadError(null);
      } catch (err) {
        console.error('[AutoLoad] Error:', err);
        setAutoLoadError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setAutoLoadLoading(false);
      }
    }

    loadAutoData();
    // NO setInterval - prevents auto-refresh
  }, []);

  // ========================================================
  // MANUAL REFRESH: User clicks button
  // ========================================================
  const handleAutoLoadRefresh = async () => {
    try {
      setAutoLoadLoading(true);
      setAutoLoadError(null);
      const data = await refreshAutoLoadedData();
      setAutoLoadData(data);
    } catch (err) {
      console.error('[AutoLoad Refresh] Error:', err);
      setAutoLoadError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setAutoLoadLoading(false);
    }
  };

  // ========================================================
  // MANUAL-REQUEST: User manually triggers market scan
  // ========================================================
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
            minute: '2-digit',
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
      Altcoins: point.altcoins,
    }));
  }, [scanData]);

  const tickFormatter = (value: string) => {
    const date = new Date(value);
    if (range === '7d') {
      return date.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' });
    }
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };

  const marketUpdates = getMarketUpdates();
  const marketContexts = getMarketContext();
  const educationTips = getLimitedEducation(6);

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
          {loading ? 'Bezig...' : 'Handmatige check'}
        </button>
      </div>

      {/* ONLY ON-DEMAND: Real-time market data (user-triggered refresh) */}
      <Card
        title="Live marktdata"
        subtitle="Klik refresh om bij te werken (op aanvraag, geen auto-fetch)"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <AutoLoadedDataWidget
              autoLoadData={autoLoadData}
              isLoading={autoLoadLoading}
              error={autoLoadError}
            />
          </div>
          <button
            type="button"
            onClick={handleAutoLoadRefresh}
            disabled={autoLoadLoading}
            className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition disabled:opacity-50"
          >
            {autoLoadLoading ? 'Laden...' : 'Refresh'}
          </button>
        </div>
      </Card>

      {/* MANUAL-REQUEST: User-triggered scan chart */}
      <Card
        title="Gedetailleerde grafiek"
        subtitle={
          range === '1h'
            ? 'Laatste uur'
            : range === '7d'
              ? 'Laatste 7 dagen'
              : 'Laatste 24 uur'
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3">
          {(
            [
              { id: '1h', label: '1 uur' },
              { id: '24h', label: '24 uur' },
              { id: '7d', label: '7 dagen' },
            ] as { id: MarketScanRange; label: string }[]
          ).map((item) => (
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
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
                >
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
                      color: '#0f172a',
                    }}
                    labelStyle={{ color: '#475569' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Bitcoin"
                    stroke="#6FA8A1"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Ethereum"
                    stroke="#8FA6C3"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Stablecoins"
                    stroke="#C7B28A"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Altcoins"
                    stroke="#BFA2C6"
                    strokeWidth={2}
                    dot={false}
                  />
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

      {/* CONSOLIDATED: Market updates (single source) */}
      <Card title="Markt observaties" subtitle="Wat zien we?">
        <div className="space-y-4">
          {marketUpdates.map((item) => (
            <div key={item.id} className="space-y-1">
              <p className="text-subtitle text-slate-900 font-serif">{item.title}</p>
              <p className="text-sm text-slate-700">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Market context */}
        <Card title="Context" subtitle="De achtergrond">
          <div className="space-y-3">
            {marketContexts.map((item) => (
              <div key={item.id} className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Learning tips (consolidated) */}
        <Card title="Tip van de dag" subtitle="Wat moet ik weten?">
          <div className="space-y-3">
            {educationTips.slice(0, 3).map((item) => (
              <div key={item.id} className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* All education snippets (grid) */}
      <Card title="Leren in kleine stappen" subtitle="Korte uitleg zonder jargon">
        <div className="grid gap-3 md:grid-cols-3">
          {educationTips.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="text-sm text-slate-700 mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
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
            minute: '2-digit',
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
      Altcoins: point.altcoins,
    }));
  }, [scanData]);

  const tickFormatter = (value: string) => {
    const date = new Date(value);
    if (range === '7d') {
      return date.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' });
    }
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };

  const marketUpdates = getMarketUpdates();
  const marketContexts = getMarketContext();
  const educationTips = getLimitedEducation(6);

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
          {loading ? 'Bezig...' : 'Handmatige check'}
        </button>
      </div>

      {/* AUTO-LOADED: Real-time market data */}
      <Card title="Live marktdata" subtitle="Automatisch bijgewerkt">
        <AutoLoadedDataWidget
          autoLoadData={autoLoadData}
          isLoading={autoLoadLoading}
          error={autoLoadError}
        />
      </Card>

      {/* MANUAL-REQUEST: User-triggered scan chart */}
      <Card
        title="Gedetailleerde grafiek"
        subtitle={
          range === '1h'
            ? 'Laatste uur'
            : range === '7d'
              ? 'Laatste 7 dagen'
              : 'Laatste 24 uur'
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3">
          {(
            [
              { id: '1h', label: '1 uur' },
              { id: '24h', label: '24 uur' },
              { id: '7d', label: '7 dagen' },
            ] as { id: MarketScanRange; label: string }[]
          ).map((item) => (
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
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
                >
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
                      color: '#0f172a',
                    }}
                    labelStyle={{ color: '#475569' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Bitcoin"
                    stroke="#6FA8A1"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Ethereum"
                    stroke="#8FA6C3"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Stablecoins"
                    stroke="#C7B28A"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Altcoins"
                    stroke="#BFA2C6"
                    strokeWidth={2}
                    dot={false}
                  />
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

      {/* CONSOLIDATED: Market updates (single source) */}
      <Card title="Markt observaties" subtitle="Wat zien we?">
        <div className="space-y-4">
          {marketUpdates.map((item) => (
            <div key={item.id} className="space-y-1">
              <p className="text-subtitle text-slate-900 font-serif">{item.title}</p>
              <p className="text-sm text-slate-700">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Market context */}
        <Card title="Context" subtitle="De achtergrond">
          <div className="space-y-3">
            {marketContexts.map((item) => (
              <div key={item.id} className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Learning tips (consolidated) */}
        <Card title="Tip van de dag" subtitle="Wat moet ik weten?">
          <div className="space-y-3">
            {educationTips.slice(0, 3).map((item) => (
              <div key={item.id} className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* All education snippets (grid) */}
      <Card title="Leren in kleine stappen" subtitle="Korte uitleg zonder jargon">
        <div className="grid gap-3 md:grid-cols-3">
          {educationTips.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="text-sm text-slate-700 mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
