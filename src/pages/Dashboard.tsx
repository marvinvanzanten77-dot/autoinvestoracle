import { Card } from '../components/ui/Card';
import { mockSignals } from '../data/mockSignals';
import { useEffect, useState } from 'react';
import { fetchDashboard, type DashboardResponse } from '../api/dashboard';

function DashboardHeader({ date }: { date: string }) {
  return (
    <div className="glass rounded-2xl p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-label tracking-[0.04em] text-slate-500">Marktoverzicht van vandaag</p>
        <div className="mt-1 flex items-center gap-3 text-sm text-slate-600">
          <span>{date}</span>
          <span className="text-slate-400">|</span>
          <span>Laatst bijgewerkt om 09:42</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className="relative h-2.5 w-2.5">
          <span className="absolute inset-0 rounded-full bg-primary/70 shadow-[0_0_0_4px_rgba(111,168,161,0.12)]"></span>
        </span>
        De scan draait live
      </div>
    </div>
  );
}

function CircleMeter({ value }: { value: number }) {
  return (
    <div className="relative h-20 w-20">
      <div className="absolute inset-0 rounded-full bg-white/80 border border-slate-200/80 shadow-inner shadow-black/5" />
      <div
        className="absolute inset-1 rounded-full border border-primary/30"
        style={{
          background: `conic-gradient(#6FA8A1 ${value}%, rgba(226,232,240,0.9) ${value}%)`
        }}
      />
      <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center text-slate-600 font-medium">
        <span className="text-sm">{value}</span>
      </div>
    </div>
  );
}

function TopChanceCard({ topChance }: { topChance: DashboardResponse['topChance'] }) {
  return (
    <Card title="Beste kans van vandaag" subtitle="Waar kijkt de AI het meest positief naar?">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-subtitle text-slate-900 font-serif leading-tight">{topChance.assetName}</p>
          <p className="text-muted text-sm">Verwachting: {topChance.confidence} op 100 (hoog vertrouwen)</p>
        </div>
        <span className="pill border border-primary/40 text-primary bg-primary/15">
          {topChance.direction === 'up'
            ? 'Omhoog (long)'
            : topChance.direction === 'down'
              ? 'Omlaag (short)'
              : 'Nog even afwachten'}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <CircleMeter value={topChance.confidence} />
        <div className="space-y-1">
          <p className="text-xs tracking-[0.08em] text-slate-500">Verwachting</p>
          <p className="text-value text-slate-900">{topChance.confidence} op 100</p>
          <p className="text-xs text-slate-500">(hoog vertrouwen)</p>
          <p className="pt-1 text-sm text-slate-600">
            Richting:{' '}
            {topChance.direction === 'up'
              ? 'Omhoog (long)'
              : topChance.direction === 'down'
                ? 'Omlaag (short)'
                : 'Nog even afwachten'}
          </p>
        </div>
      </div>
    </Card>
  );
}

function MarketSentimentCard({ marketSentiment }: { marketSentiment: DashboardResponse['marketSentiment'] }) {
  return (
    <Card title="Stemming op de markt" subtitle="Optimistisch (68%)">
      <div className="space-y-3">
        <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden border border-slate-200/80">
          <div
            className="h-full bg-gradient-to-r from-slate-300 via-primary/70 to-slate-400"
            style={{ width: `${marketSentiment.percentage}%` }}
          />
        </div>
        <p className="text-sm text-slate-600">
          Op dit moment zijn mensen vooral: {marketSentiment.label} ({marketSentiment.percentage}%)
        </p>
        <p className="text-xs text-slate-500">{marketSentiment.explanation}</p>
      </div>
    </Card>
  );
}

function RiskLevelCard({ riskLevel }: { riskLevel: DashboardResponse['riskLevel'] }) {
  return (
    <Card title="Algemeen risiconiveau" subtitle="De markt beweegt normaal">
      <p className="text-subtitle text-slate-900 font-serif">{riskLevel.label} risico</p>
      <p className="text-muted text-sm">{riskLevel.description}</p>
    </Card>
  );
}

function TopSetupsTable({ setups }: { setups: DashboardResponse['topSetups'] }) {
  return (
    <Card title="Top 3 setups vandaag" subtitle="Geordend op vertrouwen">
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/60">
        <div className="grid grid-cols-5 text-xs tracking-[0.04em] text-slate-500 border-b border-slate-200/70 px-4 py-2">
          <span>Wat</span>
          <span>Richting</span>
          <span>Vertrouwen</span>
          <span>Hoe lang</span>
          <span>Gevaar</span>
        </div>
        <div className="divide-y divide-slate-200/70">
          {setups.map((row) => {
            const barWidth = `${row.confidence}%`;
            const trustLabel = row.confidence >= 80 ? 'Hoog' : row.confidence >= 65 ? 'Gemiddeld' : 'Laag';
            return (
              <div key={row.name} className="grid grid-cols-5 items-center px-4 py-3 text-sm text-slate-700 hover:bg-white/60 transition">
                <span className="font-semibold text-slate-900">{row.name}</span>
                <span className="pill border border-primary/30 text-primary bg-primary/10">{row.direction}</span>
                <span className="flex items-center gap-2">
                  {trustLabel} ({row.confidence}%)
                  <span className="h-2 w-24 rounded-full bg-slate-200 overflow-hidden">
                    <span className="block h-full bg-primary/60" style={{ width: barWidth }} />
                  </span>
                </span>
                <span className="text-muted">{row.horizonText}</span>
                <span
                  className={`pill border ${
                    row.riskLabel === 'Hoog'
                      ? 'border-amber-300/60 text-amber-700 bg-amber-100'
                      : row.riskLabel === 'Normaal'
                      ? 'border-slate-300/70 text-slate-700 bg-slate-100'
                      : 'border-teal-300/60 text-teal-700 bg-teal-100'
                  }`}
                >
                  {row.riskLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function SummaryCard({ summary }: { summary: DashboardResponse['dailySummary'] }) {
  return (
    <Card title="Wat valt vandaag op?" subtitle="Snel overzicht van de AI">
      <div className="space-y-2 text-sm text-slate-700">
        {summary.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </Card>
  );
}

function WarningsCard({ warnings }: { warnings: DashboardResponse['warnings'] }) {
  return (
    <Card title="Let vandaag extra op:" subtitle="Waarschuwingen">
      <ul className="space-y-3 text-sm text-slate-700">
        {warnings.map((warn) => (
          <li key={warn} className="flex items-start gap-3">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-300/80 shadow-[0_0_0_1px_rgba(148,163,184,0.25)]" />
            <span>{warn}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RiskProfileCard({ profile }: { profile: DashboardResponse['userRiskProfile'] }) {
  return (
    <Card title="Jouw manier van investeren" subtitle="Gebalanceerd profiel">
      <p className="text-subtitle text-slate-900 font-serif">{profile.label}</p>
      <p className="text-sm text-slate-600 mt-1">{profile.description}</p>
      <p className="text-xs text-slate-500 mt-2">Je spreidt automatisch en vermijdt grote gokposities.</p>
    </Card>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = () =>
      fetchDashboard()
        .then((res) => {
          if (mounted) {
            setData(res);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error(err);
          if (mounted) {
            setError('Kon dashboarddata niet ophalen.');
            setData(mockSignals); // fallback naar mock
            setLoading(false);
          }
        });

    load();
    const interval = setInterval(load, 20_000); // elke 20s vernieuwen
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const isLoading = loading && !data;
  const payload = data ?? mockSignals;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <DashboardHeader date={payload.currentDate} />

      {isLoading ? (
        <div className="text-sm text-slate-500">Data laden...</div>
      ) : (
        <>
          {error && <div className="text-sm text-amber-700">{error}</div>}

          <div className="grid gap-4 md:gap-5 md:grid-cols-3">
            <TopChanceCard topChance={payload.topChance} />
            <MarketSentimentCard marketSentiment={payload.marketSentiment} />
            <RiskLevelCard riskLevel={payload.riskLevel} />
          </div>

          <div className="grid gap-4 md:gap-5 lg:grid-cols-[1.6fr_1fr]">
            <TopSetupsTable setups={payload.topSetups} />
            <div className="flex flex-col gap-4 md:gap-5">
              <SummaryCard summary={payload.dailySummary} />
              <WarningsCard warnings={payload.warnings} />
              <RiskProfileCard profile={payload.userRiskProfile} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
