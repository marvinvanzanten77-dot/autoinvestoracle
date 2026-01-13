import { useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import type { UserProfile } from '../lib/profile/types';

type OnboardingProps = {
  onComplete: () => void;
};

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [data, setData] = useState<UserProfile>({
    displayName: '',
    email: '',
    primaryGoal: 'growth',
    timeHorizon: '1-3y',
    riskTolerance: 5,
    maxDrawdownComfort: '10',
    rebalancing: 'quarterly',
    panicSellLikelihood: 'medium',
    startAmountRange: '500-2k',
    monthlyContributionRange: '0',
    knowledgeLevel: 'beginner',
    assetPreference: ['crypto'],
    excludedAssets: [],
    ethicalConstraints: '',
    advisorMode: 'balanced',
    explanationDepth: 'normal'
  });

  const progressLabel = useMemo(() => `Stap ${step + 1} van 5`, [step]);

  const canContinue = useMemo(() => {
    if (step === 0) return data.displayName.trim().length > 1 && data.email.trim().length > 3;
    if (step === 1) return Boolean(data.primaryGoal && data.timeHorizon);
    if (step === 2) return Boolean(data.riskTolerance && data.maxDrawdownComfort && data.rebalancing);
    if (step === 3) return Boolean(data.startAmountRange && data.monthlyContributionRange);
    if (step === 4) return Boolean(data.knowledgeLevel && data.assetPreference.length);
    return false;
  }, [data, step]);

  const errorText = useMemo(() => {
    if (!showErrors || canContinue) return '';
    if (step === 0) return 'Vul je naam en e-mailadres in.';
    if (step === 1) return 'Kies je doel en tijdshorizon.';
    if (step === 2) return 'Vul je risicoprofiel en gedrag in.';
    if (step === 3) return 'Kies je startbedrag en maandelijkse inleg.';
    if (step === 4) return 'Kies je kennisniveau en voorkeuren.';
    return '';
  }, [canContinue, showErrors, step]);

  const handleFinish = () => {
    if (!canContinue) {
      setShowErrors(true);
      return;
    }
    fetch('/api/profile/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: data })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Kon profiel niet opslaan.');
        onComplete();
      })
      .catch(() => {
        setShowErrors(true);
      });
  };

  const handleNext = () => {
    if (!canContinue) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((current) => Math.min(4, current + 1));
  };

  const handlePrev = () => {
    setShowErrors(false);
    setStep((current) => Math.max(0, current - 1));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <p className="text-label tracking-[0.04em] text-slate-500">{progressLabel}</p>
          <p className="text-title text-slate-900 font-serif">Welkom bij Auto Invest Oracle</p>
          <p className="text-sm text-slate-700">We stellen je profiel samen om de omgeving te personaliseren.</p>
        </div>

        {step === 0 && (
          <Card title="Identiteit" subtitle="Wie ben je?">
            <div className="space-y-3">
              <input
                type="text"
                value={data.displayName}
                onChange={(event) => setData((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Naam"
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="email"
                value={data.email}
                onChange={(event) =>
                  setData((current) => ({ ...current, email: event.target.value.toLowerCase() }))
                }
                placeholder="E-mailadres"
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card title="Doel & horizon" subtitle="Wat is je richting?">
            <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-700">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Primair doel</span>
                <select
                  value={data.primaryGoal}
                  onChange={(event) =>
                    setData((current) => ({ ...current, primaryGoal: event.target.value as UserProfile['primaryGoal'] }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                >
                  <option value="growth">Groeien</option>
                  <option value="income">Inkomen</option>
                  <option value="preserve">Behouden</option>
                  <option value="learn">Leren</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Tijdshorizon</span>
                <select
                  value={data.timeHorizon}
                  onChange={(event) =>
                    setData((current) => ({ ...current, timeHorizon: event.target.value as UserProfile['timeHorizon'] }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                >
                  <option value="lt1y">Korter dan 1 jaar</option>
                  <option value="1-3y">1 - 3 jaar</option>
                  <option value="3-7y">3 - 7 jaar</option>
                  <option value="7y+">7+ jaar</option>
                </select>
              </label>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card title="Risico & gedrag" subtitle="Hoe voel je je bij schommelingen?">
            <div className="space-y-4 text-sm text-slate-700">
              <label className="space-y-1 block">
                <span className="text-xs text-slate-500">Risicotolerantie: {data.riskTolerance}</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={data.riskTolerance}
                  onChange={(event) =>
                    setData((current) => ({ ...current, riskTolerance: Number(event.target.value) }))
                  }
                  className="w-full"
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">Maximale drawdown</span>
                  <select
                    value={data.maxDrawdownComfort}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        maxDrawdownComfort: event.target.value as UserProfile['maxDrawdownComfort']
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                  >
                    <option value="5">5%</option>
                    <option value="10">10%</option>
                    <option value="20">20%</option>
                    <option value="30">30%</option>
                    <option value="50">50%</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">Herbalanceren</span>
                  <select
                    value={data.rebalancing}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        rebalancing: event.target.value as UserProfile['rebalancing']
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                  >
                    <option value="none">Niet</option>
                    <option value="quarterly">Per kwartaal</option>
                    <option value="monthly">Maandelijks</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">Panieksell kans</span>
                  <select
                    value={data.panicSellLikelihood}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        panicSellLikelihood: event.target.value as UserProfile['panicSellLikelihood']
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                  >
                    <option value="low">Laag</option>
                    <option value="medium">Gemiddeld</option>
                    <option value="high">Hoog</option>
                  </select>
                </label>
              </div>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card title="Kapitaal & cashflow" subtitle="Waar start je mee?">
            <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-700">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Startbedrag</span>
                <select
                  value={data.startAmountRange}
                  onChange={(event) =>
                    setData((current) => ({
                      ...current,
                      startAmountRange: event.target.value as UserProfile['startAmountRange']
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                >
                  <option value="0-500">0 - 500</option>
                  <option value="500-2k">500 - 2k</option>
                  <option value="2k-10k">2k - 10k</option>
                  <option value="10k-50k">10k - 50k</option>
                  <option value="50k+">50k+</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Maandelijkse inleg</span>
                <select
                  value={data.monthlyContributionRange}
                  onChange={(event) =>
                    setData((current) => ({
                      ...current,
                      monthlyContributionRange: event.target.value as UserProfile['monthlyContributionRange']
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                >
                  <option value="0">0</option>
                  <option value="1-100">1 - 100</option>
                  <option value="100-500">100 - 500</option>
                  <option value="500-2k">500 - 2k</option>
                  <option value="2k+">2k+</option>
                </select>
              </label>
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card title="Ervaring & voorkeuren" subtitle="Laatste details">
            <div className="space-y-4 text-sm text-slate-700">
              <label className="space-y-1 block">
                <span className="text-xs text-slate-500">Kennisniveau</span>
                <select
                  value={data.knowledgeLevel}
                  onChange={(event) =>
                    setData((current) => ({
                      ...current,
                      knowledgeLevel: event.target.value as UserProfile['knowledgeLevel']
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Gemiddeld</option>
                  <option value="advanced">Ervaren</option>
                </select>
              </label>
              <div className="space-y-2">
                <span className="text-xs text-slate-500">Voorkeur assets</span>
                {(['crypto', 'etf', 'stocks', 'mixed'] as UserProfile['assetPreference']).map((option) => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={data.assetPreference.includes(option)}
                      onChange={() =>
                        setData((current) => {
                          const exists = current.assetPreference.includes(option);
                          const next = exists
                            ? current.assetPreference.filter((item) => item !== option)
                            : [...current.assetPreference, option];
                          return { ...current, assetPreference: next };
                        })
                      }
                      className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">Advisor modus</span>
                  <select
                    value={data.advisorMode}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        advisorMode: event.target.value as UserProfile['advisorMode']
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                  >
                    <option value="conservative">Voorzichtig</option>
                    <option value="balanced">Gebalanceerd</option>
                    <option value="aggressive">Actief</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">Uitlegniveau</span>
                  <select
                    value={data.explanationDepth}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        explanationDepth: event.target.value as UserProfile['explanationDepth']
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                  >
                    <option value="short">Kort</option>
                    <option value="normal">Normaal</option>
                    <option value="deep">Diep</option>
                  </select>
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs text-slate-500">Uitsluiten (komma's)</span>
                  <input
                    type="text"
                    value={(data.excludedAssets || []).join(', ')}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        excludedAssets: event.target.value
                          .split(',')
                          .map((val) => val.trim())
                          .filter(Boolean)
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs text-slate-500">Ethische voorkeuren</span>
                  <input
                    type="text"
                    value={data.ethicalConstraints || ''}
                    onChange={(event) =>
                      setData((current) => ({ ...current, ethicalConstraints: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                  />
                </label>
              </div>
            </div>
          </Card>
        )}

        {errorText && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-2">
            {errorText}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            className="pill border border-slate-300 text-slate-700 bg-white/80 hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={step === 0}
          >
            Terug
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className={`pill border transition disabled:cursor-not-allowed ${
                canContinue
                  ? 'border-primary/40 bg-primary/30 text-primary hover:bg-primary/40'
                  : 'border-slate-200 bg-slate-100 text-slate-400'
              }`}
              disabled={!canContinue}
            >
              Volgende
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className={`pill border transition disabled:cursor-not-allowed ${
                canContinue
                  ? 'border-primary/40 bg-primary/40 text-primary hover:bg-primary/50'
                  : 'border-slate-200 bg-slate-100 text-slate-400'
              }`}
              disabled={!canContinue}
            >
              Profiel opslaan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
