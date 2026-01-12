import { useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';

type KnowledgeLevel = 'Starter' | 'Gemiddeld' | 'Gevorderd';

type OnboardingData = {
  goals: string[];
  amount: number;
  strategies: string[];
  knowledge: KnowledgeLevel | '';
  acceptedRules: boolean;
};

const GOALS = [
  'Rustig vermogen opbouwen',
  'Leren door te doen',
  'Beschermen tegen inflatie',
  'Meer grip op crypto'
];

const STRATEGIES = [
  'Rustig spreiden over tijd',
  'Meebewegen als het tempo stijgt',
  'Wachten tot het beeld rustiger is',
  'Kiezen voor kleine stappen'
];

const HOUSE_RULES = [
  'Deze tool geeft geen beslissingen, alleen advies.',
  'Je blijft zelf verantwoordelijk voor iedere keuze.',
  'AI kan fouten maken; gebruik altijd je eigen oordeel.',
  'Investeer alleen geld dat je kunt missen.'
];

type OnboardingProps = {
  onComplete: () => void;
};

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    goals: [],
    amount: 0,
    strategies: [],
    knowledge: '',
    acceptedRules: false
  });

  const progressLabel = useMemo(() => `Stap ${step + 1} van 5`, [step]);

  const canContinue = useMemo(() => {
    if (step === 0) return data.goals.length > 0;
    if (step === 1) return data.amount > 0;
    if (step === 2) return data.strategies.length > 0;
    if (step === 3) return data.knowledge !== '';
    if (step === 4) return data.acceptedRules;
    return false;
  }, [data, step]);

  const updateArray = (field: 'goals' | 'strategies', value: string) => {
    setData((current) => {
      const exists = current[field].includes(value);
      const next = exists
        ? current[field].filter((item) => item !== value)
        : [...current[field], value];
      return { ...current, [field]: next };
    });
  };

  const handleFinish = () => {
    const payload = {
      ...data,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('aio_onboarding_v1', JSON.stringify(payload));
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <p className="text-label tracking-[0.04em] text-slate-500">{progressLabel}</p>
          <p className="text-title text-slate-900 font-serif">Welkom bij Auto Invest Oracle</p>
          <p className="text-sm text-slate-600">
            We vragen je kort naar je doelen en voorkeuren zodat de omgeving rustig kan aansluiten.
          </p>
        </div>

        {step === 0 && (
          <Card title="Doelen" subtitle="Waar wil je naartoe groeien?">
            <div className="grid gap-3 md:grid-cols-2">
              {GOALS.map((goal) => (
                <label key={goal} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.goals.includes(goal)}
                    onChange={() => updateArray('goals', goal)}
                    className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
                  />
                  <span>{goal}</span>
                </label>
              ))}
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card title="Startbedrag" subtitle="Hoeveel wil je nu éénmalig inzetten?">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">EUR</span>
                <input
                  type="number"
                  min={0}
                  value={data.amount || ''}
                  onChange={(event) =>
                    setData((current) => ({
                      ...current,
                      amount: Number(event.target.value)
                    }))
                  }
                  placeholder="Bijv. 1000"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <p className="text-xs text-slate-500">
                Dit is een startpunt. Later kun je dit uitbreiden naar periodieke inleg.
              </p>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card title="Strategie" subtitle="Wat vind je interessant om te proberen?">
            <div className="grid gap-3 md:grid-cols-2">
              {STRATEGIES.map((strategy) => (
                <label key={strategy} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.strategies.includes(strategy)}
                    onChange={() => updateArray('strategies', strategy)}
                    className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
                  />
                  <span>{strategy}</span>
                </label>
              ))}
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card title="Kennisniveau" subtitle="Hoe vertrouwd ben je met trading?">
            <div className="space-y-3">
              {(['Starter', 'Gemiddeld', 'Gevorderd'] as KnowledgeLevel[]).map((level) => (
                <label key={level} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="knowledge"
                    value={level}
                    checked={data.knowledge === level}
                    onChange={() => setData((current) => ({ ...current, knowledge: level }))}
                    className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
                  />
                  <span>{level}</span>
                </label>
              ))}
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card title="House rules" subtitle="Korte afspraken om rustig te blijven">
            <div className="space-y-3 text-sm text-slate-700">
              <ul className="space-y-2">
                {HOUSE_RULES.map((rule) => (
                  <li key={rule} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary/60" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.acceptedRules}
                  onChange={(event) =>
                    setData((current) => ({
                      ...current,
                      acceptedRules: event.target.checked
                    }))
                  }
                  className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
                />
                <span>Ik begrijp dit en ga hiermee akkoord.</span>
              </label>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            className="pill border border-slate-300 text-slate-700 bg-white/80 hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={step === 0}
          >
            Terug
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((current) => Math.min(4, current + 1))}
              className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canContinue}
            >
              Volgende
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="pill border border-primary/40 bg-primary/30 text-primary hover:bg-primary/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canContinue}
            >
              Start met overzicht
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
