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
      <div className="flex items-center gap-2 text-xs text-slate-600 mb-3">
        <span className="pill border border-primary/30 text-primary bg-primary/15">1D</span>
        <span className="pill border border-slate-300 text-slate-600">1W</span>
        <span className="pill border border-slate-300 text-slate-600">1M</span>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={priceSeriesTopAsset} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
            <CartesianGrid stroke="rgba(15,23,42,0.08)" vertical={false} />
            <XAxis
              dataKey="time"
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
              domain={['dataMin - 20', 'dataMax + 20']}
            />
            <Tooltip
              contentStyle={{
                background: '#F9F7F2',
                border: '1px solid rgba(148,163,184,0.35)',
                borderRadius: '12px',
                color: '#0f172a'
              }}
              labelStyle={{ color: '#475569' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6FA8A1"
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
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span className="text-sm text-slate-900">{asset.last}</span>
              <span
                className={`pill ${
                  asset.changePct.startsWith('-')
                    ? 'border border-amber-300/60 text-amber-700 bg-amber-100'
                    : 'border border-teal-300/60 text-teal-700 bg-teal-100'
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
