import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { STRATEGIES } from '../data/strategies';
import type { UserProfile } from '../lib/profile/types';
import { supabase } from '../lib/supabase/client';

type OnboardingProps = {
  onComplete: () => void;
};

const GOALS: Array<{ value: UserProfile['primaryGoal']; label: string }> = [
  { value: 'growth', label: 'Rustig groeien' },
  { value: 'income', label: 'Extra inkomen' },
  { value: 'preserve', label: 'Waarde bewaren' },
  { value: 'learn', label: 'Leren in de praktijk' }
];

const HORIZONS: Array<{ value: UserProfile['timeHorizon']; label: string }> = [
  { value: 'lt1y', label: 'Kort (tot 1 jaar)' },
  { value: '1-3y', label: 'Midden (1-3 jaar)' },
  { value: '3-7y', label: 'Lang (3+ jaar)' },
  { value: '7y+', label: 'Heel lang (7+ jaar)' }
];

const START_AMOUNTS: Array<{ value: UserProfile['startAmountRange']; label: string }> = [
  { value: '0-500', label: '0 - 500' },
  { value: '500-2k', label: '500 - 2k' },
  { value: '2k-10k', label: '2k - 10k' },
  { value: '10k-50k', label: '10k - 50k' },
  { value: '50k+', label: '50k+' }
];

const KNOWLEDGE_LEVELS: Array<{ value: UserProfile['knowledgeLevel']; label: string }> = [
  { value: 'beginner', label: 'Nieuw' },
  { value: 'intermediate', label: 'Bekend' },
  { value: 'advanced', label: 'Ervaren' }
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [data, setData] = useState<UserProfile>({
    displayName: '',
    email: '',
    strategies: [STRATEGIES[0]],
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: sessionData }) => {
      const email = sessionData.session?.user?.email;
      if (email) {
        setData((current) => ({ ...current, email: email.toLowerCase() }));
      }
    });
  }, []);

  const progressLabel = useMemo(() => `Stap ${step + 1} van 3`, [step]);

  const canContinue = useMemo(() => {
    if (step === 0) return data.displayName.trim().length > 1 && data.email.trim().length > 3;
    if (step === 1) return data.strategies.length > 0 && Boolean(data.primaryGoal && data.timeHorizon);
    if (step === 2) return Boolean(data.startAmountRange && data.knowledgeLevel && acceptedRules);
    return false;
  }, [acceptedRules, data, step]);

  const errorText = useMemo(() => {
    if (!showErrors || canContinue) return '';
    if (step === 0) return 'Vul je naam en e-mailadres in.';
    if (step === 1) return 'Kies een strategie, doel en tijdshorizon.';
    if (step === 2) return 'Kies je startpunt en ga akkoord met de huisregels.';
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
    setStep((current) => Math.min(2, current + 1));
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
          <p className="text-sm text-slate-700">We bouwen een rustige start die bij je past.</p>
        </div>

        {step === 0 && (
          <Card title="Jij" subtitle="Even kort kennismaken">
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
              <p className="text-xs text-slate-500">
                Heb je al een account?{' '}
                <a href="/login" className="text-primary hover:underline">
                  Log in met magic link
                </a>
                .
              </p>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card title="Jouw richting" subtitle="Rustig en helder">
            <div className="space-y-5 text-sm text-slate-700">
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Strategie</p>
                <div className="flex flex-wrap gap-2">
                  {STRATEGIES.map((strategy) => {
                    const active = data.strategies[0] === strategy;
                    return (
                      <button
                        key={strategy}
                        type="button"
                        onClick={() => setData((current) => ({ ...current, strategies: [strategy] }))}
                        className={`pill border transition ${
                          active
                            ? 'border-primary/40 bg-primary/30 text-primary'
                            : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                        }`}
                      >
                        {strategy}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Waarom doe je dit?</p>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map((goal) => (
                    <button
                      key={goal.value}
                      type="button"
                      onClick={() => setData((current) => ({ ...current, primaryGoal: goal.value }))}
                      className={`pill border transition ${
                        data.primaryGoal === goal.value
                          ? 'border-primary/40 bg-primary/30 text-primary'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {goal.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Tijdshorizon</p>
                <div className="flex flex-wrap gap-2">
                  {HORIZONS.map((horizon) => (
                    <button
                      key={horizon.value}
                      type="button"
                      onClick={() => setData((current) => ({ ...current, timeHorizon: horizon.value }))}
                      className={`pill border transition ${
                        data.timeHorizon === horizon.value
                          ? 'border-primary/40 bg-primary/30 text-primary'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {horizon.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card title="Startpunt" subtitle="Klein maar belangrijk">
            <div className="space-y-5 text-sm text-slate-700">
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Startbedrag</p>
                <div className="flex flex-wrap gap-2">
                  {START_AMOUNTS.map((amount) => (
                    <button
                      key={amount.value}
                      type="button"
                      onClick={() => setData((current) => ({ ...current, startAmountRange: amount.value }))}
                      className={`pill border transition ${
                        data.startAmountRange === amount.value
                          ? 'border-primary/40 bg-primary/30 text-primary'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {amount.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Kennisniveau</p>
                <div className="flex flex-wrap gap-2">
                  {KNOWLEDGE_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setData((current) => ({ ...current, knowledgeLevel: level.value }))}
                      className={`pill border transition ${
                        data.knowledgeLevel === level.value
                          ? 'border-primary/40 bg-primary/30 text-primary'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 space-y-2">
                <p className="text-xs text-slate-500">Huisregels</p>
                <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
                  <li>We geven geen beslissingen, alleen context.</li>
                  <li>Je blijft altijd zelf verantwoordelijk.</li>
                  <li>AI kan fouten maken; controleer zelf.</li>
                  <li>Investeer alleen geld dat je kunt missen.</li>
                </ul>
                <label className="flex items-center gap-2 text-sm text-slate-700 pt-2">
                  <input
                    type="checkbox"
                    checked={acceptedRules}
                    onChange={(event) => setAcceptedRules(event.target.checked)}
                    className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
                  />
                  Ik ga akkoord met de huisregels.
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
          {step < 2 ? (
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
              Start overzicht
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
