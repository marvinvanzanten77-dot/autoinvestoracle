import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase/client';

type RiskProfile = 'Voorzichtig' | 'Gebalanceerd' | 'Actief';

export function Settings() {
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('Gebalanceerd');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [markets, setMarkets] = useState({
    bitcoin: true,
    ethereum: true,
    stable: true,
    altcoins: false
  });
  const [notifications, setNotifications] = useState({
    dailyEmail: true,
    volAlerts: true
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('aio_settings_v1');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { riskProfile?: RiskProfile };
      if (parsed.riskProfile) {
        setRiskProfile(parsed.riskProfile);
      }
    } catch {
      // ignore invalid storage
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccountEmail(data.session?.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({ riskProfile });
    localStorage.setItem('aio_settings_v1', payload);
    window.dispatchEvent(new Event('aio_settings_updated'));
  }, [riskProfile]);

  const riskCopy: Record<RiskProfile, string> = {
    Voorzichtig: 'Lage volatiliteit, focus op defensief gedrag en beperkte drawdowns.',
    Gebalanceerd: 'Evenwicht tussen groei en bescherming; normaal risico met brede spreiding.',
    Actief: 'Hoger risico met focus op momentum en kortere horizons.'
  };

  return (
    <div className="grid gap-4 md:gap-5">
      <Card title="Risicoprofiel" subtitle="Stel je risicohouding in">
        <div className="space-y-3">
          {(['Voorzichtig', 'Gebalanceerd', 'Actief'] as RiskProfile[]).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="risk"
                value={option}
                checked={riskProfile === option}
                onChange={() => setRiskProfile(option)}
                className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
              />
              <span>{option}</span>
            </label>
          ))}
          <p className="text-xs text-slate-500 pt-1">{riskCopy[riskProfile]}</p>
        </div>
      </Card>

      <Card title="Munten" subtitle="Kies welke munten je wilt volgen">
        <div className="space-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.bitcoin}
              onChange={(e) => setMarkets((m) => ({ ...m, bitcoin: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
            />
            Bitcoin
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.ethereum}
              onChange={(e) => setMarkets((m) => ({ ...m, ethereum: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
            />
            Ethereum
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.stable}
              onChange={(e) => setMarkets((m) => ({ ...m, stable: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
            />
            Stablecoins
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.altcoins}
              onChange={(e) => setMarkets((m) => ({ ...m, altcoins: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
            />
            Altcoins
          </label>
        </div>
      </Card>

      <Card title="Notificaties" subtitle="Blijf op de hoogte">
        <div className="space-y-3 text-sm text-slate-700">
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Dagrapport per e-mail</span>
            <input
              type="checkbox"
              checked={notifications.dailyEmail}
              onChange={(e) => setNotifications((n) => ({ ...n, dailyEmail: e.target.checked }))}
              className="h-5 w-10 accent-primary"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Waarschuwingen bij hoge volatiliteit</span>
            <input
              type="checkbox"
              checked={notifications.volAlerts}
              onChange={(e) => setNotifications((n) => ({ ...n, volAlerts: e.target.checked }))}
              className="h-5 w-10 accent-primary"
            />
          </label>
          <p className="text-xs text-slate-500 pt-1">Instellingen zijn lokaal; opslag naar backend volgt later.</p>
        </div>
      </Card>

      <Card title="Account" subtitle="Login via magic link">
        <div className="space-y-3 text-sm text-slate-700">
          <p>{accountEmail ? `Ingelogd als ${accountEmail}.` : 'Niet ingelogd.'}</p>
          {signOutError && <p className="text-sm text-amber-700">{signOutError}</p>}
          <button
            type="button"
            onClick={async () => {
              setSignOutError(null);
              const { error } = await supabase.auth.signOut();
              if (error) {
                setSignOutError('Uitloggen mislukt. Probeer het opnieuw.');
                return;
              }
              await fetch('/api/session/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="pill border border-slate-200 bg-white/70 text-slate-600 hover:bg-white transition"
          >
            Uitloggen
          </button>
        </div>
      </Card>
    </div>
  );
}
