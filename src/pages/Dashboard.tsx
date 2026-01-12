import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { marketUpdates, volatilityStatus } from '../data/marketUpdates';
import { platforms } from '../data/platforms';

type OnboardingData = {
  goals: string[];
  amount: number;
  strategies: string[];
  knowledge: 'Starter' | 'Gemiddeld' | 'Gevorderd' | '';
};

function DashboardHeader({
  onScan,
  lastScan,
  volatility
}: {
  onScan: () => void;
  lastScan: string;
  volatility: typeof volatilityStatus;
}) {
  const isHigh = volatility.level === 'hoog';
  return (
    <div className="glass rounded-2xl p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-label tracking-[0.04em] text-slate-500">Jouw dag in crypto</p>
        <div className="mt-1 flex items-center gap-3 text-sm text-slate-700">
          <span>Rustig overzicht</span>
          <span className="text-slate-400">|</span>
          <span>Laatste check: {lastScan}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            isHigh
              ? 'border-amber-300 bg-amber-100 text-amber-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isHigh ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {volatility.label}
        </div>
        <button
          type="button"
          onClick={onScan}
          className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition"
        >
          Korte check
        </button>
      </div>
    </div>
  );
}

function ProfileCard({ profile }: { profile: OnboardingData | null }) {
  const goals = profile?.goals.length ? profile.goals.join(', ') : 'Nog niet ingevuld';
  const strategies = profile?.strategies.length ? profile.strategies.join(', ') : 'Nog niet ingevuld';
  const knowledge = profile?.knowledge || 'Nog niet ingevuld';
  return (
    <Card title="Jouw startpunt" subtitle="Gekozen voorkeuren">
      <div className="space-y-3 text-sm text-slate-700">
        <div>
          <p className="text-xs text-slate-500">Doel</p>
          <p>{goals}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Strategie</p>
          <p>{strategies}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Kennisniveau</p>
          <p>{knowledge}</p>
        </div>
      </div>
    </Card>
  );
}

function WalletCard({ amount }: { amount: number }) {
  const formatted = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(amount || 0);

  return (
    <Card title="Portemonnee (voorbeeld)" subtitle="Beschikbaar saldo">
      <div className="space-y-2">
        <p className="text-title text-slate-900 font-serif">{formatted}</p>
        <p className="text-sm text-slate-700">
          Dit is het saldo dat je als start hebt opgegeven.
        </p>
      </div>
    </Card>
  );
}

function UpdatesCard() {
  return (
    <Card title="Markt in mensentaal" subtitle="Korte observaties">
      <div className="space-y-3">
        {marketUpdates.map((item) => (
          <div key={item.title} className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="text-sm text-slate-700">{item.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlatformsCard() {
  return (
    <Card title="Handelsplatforms om te verkennen" subtitle="Plus- en minpunten op een rij">
      <div className="grid gap-4 md:grid-cols-2">
        {platforms.map((platform) => (
          <div key={platform.name} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
            <div className="space-y-1">
              <p className="text-subtitle text-slate-900 font-serif">{platform.name}</p>
              <p className="text-sm text-slate-700">{platform.tone}</p>
              <a
                href={platform.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Bekijk platform
              </a>
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <p className="text-xs text-slate-500">Plus</p>
                <ul className="list-disc pl-4">
                  {platform.pros.map((pro) => (
                    <li key={pro}>{pro}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-slate-500">Min</p>
                <ul className="list-disc pl-4">
                  {platform.cons.map((con) => (
                    <li key={con}>{con}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Dashboard() {
  const [profile, setProfile] = useState<OnboardingData | null>(null);
  const [lastScan, setLastScan] = useState('Nog geen check');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('aio_onboarding_v1');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as OnboardingData;
        setProfile(parsed);
      } catch {
        setProfile(null);
      }
    }
  }, []);

  const handleScan = () => {
    const time = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    setLastScan(time);
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <DashboardHeader onScan={handleScan} lastScan={lastScan} volatility={volatilityStatus} />

      <div className="grid gap-4 md:gap-5 md:grid-cols-3">
        <ProfileCard profile={profile} />
        <WalletCard amount={profile?.amount ?? 0} />
        <UpdatesCard />
      </div>

      <PlatformsCard />
    </div>
  );
}
