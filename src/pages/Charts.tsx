import { Card } from '../components/ui/Card';
import { priceSeriesTopAsset, miniAssets } from '../data/mockPrices';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

function PriceChartCard() {
  return (
    <Card title="NLX Tech Index" subtitle="Intraday prijsontwikkeling">
      <div className="flex items-center gap-2 text-xs text-slate-300 mb-3">
        <span className="pill border border-primary/30 text-primary bg-primary/10">1D</span>
        <span className="pill border border-slate-700/70 text-slate-300">1W</span>
        <span className="pill border border-slate-700/70 text-slate-300">1M</span>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={priceSeriesTopAsset} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="rgba(148,163,184,0.45)"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'rgba(148,163,184,0.6)', fontSize: 11 }}
            />
            <YAxis
              stroke="rgba(148,163,184,0.45)"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'rgba(148,163,184,0.6)', fontSize: 11 }}
              domain={['dataMin - 20', 'dataMax + 20']}
            />
            <Tooltip
              contentStyle={{
                background: '#0b1224',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '12px',
                color: '#e2e8f0'
              }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#8FB9B6"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function Charts() {
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <PriceChartCard />

      <div className="grid gap-3 md:grid-cols-3">
        {miniAssets.map((asset) => (
          <Card key={asset.name} title={asset.name} subtitle="Laatste koers" className="p-4">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span className="text-sm text-white">{asset.last}</span>
              <span
                className={`pill ${
                  asset.changePct.startsWith('-')
                    ? 'border border-amber-300/40 text-amber-200 bg-amber-500/10'
                    : 'border border-teal-300/40 text-teal-200 bg-teal-500/10'
                }`}
              >
                {asset.changePct}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
