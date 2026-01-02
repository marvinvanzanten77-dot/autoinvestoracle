import { useState } from 'react';
import { Card } from '../components/ui/Card';

type RiskProfile = 'Voorzichtig' | 'Gebalanceerd' | 'Actief';

export function Settings() {
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('Gebalanceerd');
  const [markets, setMarkets] = useState({
    crypto: true,
    stocks: true,
    futures: true,
    fx: true
  });
  const [notifications, setNotifications] = useState({
    dailyEmail: true,
    volAlerts: true
  });

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
            <label key={option} className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
              <input
                type="radio"
                name="risk"
                value={option}
                checked={riskProfile === option}
                onChange={() => setRiskProfile(option)}
                className="h-4 w-4 text-primary border-slate-600 focus:ring-primary"
              />
              <span>{option}</span>
            </label>
          ))}
          <p className="text-xs text-slate-400 pt-1">{riskCopy[riskProfile]}</p>
        </div>
      </Card>

      <Card title="Markten" subtitle="Kies welke markten je wilt scannen">
        <div className="space-y-2 text-sm text-slate-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.crypto}
              onChange={(e) => setMarkets((m) => ({ ...m, crypto: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-600 focus:ring-primary"
            />
            Crypto
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.stocks}
              onChange={(e) => setMarkets((m) => ({ ...m, stocks: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-600 focus:ring-primary"
            />
            Aandelen
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.futures}
              onChange={(e) => setMarkets((m) => ({ ...m, futures: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-600 focus:ring-primary"
            />
            Index-futures
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markets.fx}
              onChange={(e) => setMarkets((m) => ({ ...m, fx: e.target.checked }))}
              className="h-4 w-4 text-primary border-slate-600 focus:ring-primary"
            />
            Valuta
          </label>
        </div>
      </Card>

      <Card title="Notificaties" subtitle="Blijf op de hoogte">
        <div className="space-y-3 text-sm text-slate-200">
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Dagrapport per e-mail</span>
            <input
              type="checkbox"
              checked={notifications.dailyEmail}
              onChange={(e) => setNotifications((n) => ({ ...n, dailyEmail: e.target.checked }))}
              className="h-4 w-8 accent-primary"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Waarschuwingen bij hoge volatiliteit</span>
            <input
              type="checkbox"
              checked={notifications.volAlerts}
              onChange={(e) => setNotifications((n) => ({ ...n, volAlerts: e.target.checked }))}
              className="h-4 w-8 accent-primary"
            />
          </label>
          <p className="text-xs text-slate-400 pt-1">Instellingen zijn lokaal; opslag naar backend volgt later.</p>
        </div>
      </Card>
    </div>
  );
}
