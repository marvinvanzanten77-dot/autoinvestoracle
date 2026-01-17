import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { platforms } from '../data/platforms';
import type { UserProfile } from '../lib/profile/types';

type FitLabel = {
  label: string;
  detail: string;
};

function getPlatformFit(profile: UserProfile | null, platformName: string): FitLabel | null {
  if (!profile) return null;
  const strategy = profile.strategies?.[0] || '';
  const isCalm = /Rustig|Kleine|Wachten/i.test(strategy);
  const isMove = /Meebewegen/i.test(strategy);
  const knowledge = profile.knowledgeLevel;

  const knowledgeFit = (() => {
    if (knowledge === 'beginner') return ['Bitvavo', 'Coinbase'];
    if (knowledge === 'intermediate') return ['Kraken', 'Coinbase'];
    if (knowledge === 'advanced') return ['Bybit', 'Kraken'];
    return [];
  })();

  const strategyFit = (() => {
    if (isCalm) return ['Bitvavo', 'Kraken'];
    if (isMove) return ['Coinbase', 'Kraken'];
    return [];
  })();

  if (![...knowledgeFit, ...strategyFit].includes(platformName)) {
    return null;
  }

  const details: Record<string, string> = {
    Bitvavo: 'Rustige start en duidelijke stappen.',
    Kraken: 'Degelijk tempo met veel uitleg.',
    Coinbase: 'Laagdrempelig en overzichtelijk.',
    Bybit: 'Voor wie sneller en actiever wil.'
  };

  return {
    label: 'Past bij jouw tempo',
    detail: details[platformName] || 'Past bij jouw voorkeuren.'
  };
}

export function Charts() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch('/api/profile/get')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { profile?: UserProfile };
        setProfile(data.profile ?? null);
      })
      .catch(() => {
        // ignore profile fetch error
      });
  }, []);

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <Card title="Handelsplatforms" subtitle="Vergelijk in rustig tempo">
        <div className="grid gap-4 md:grid-cols-2">
          {platforms.map((platform) => {
            const fit = getPlatformFit(profile, platform.name);
            return (
            <div key={platform.name} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
              <div className="space-y-1">
                <p className="text-subtitle text-slate-900 font-serif">{platform.name}</p>
                <p className="text-sm text-slate-700">{platform.tone}</p>
                {fit && (
                  <div className="space-y-1">
                    <span className="inline-flex rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                      {fit.label}
                    </span>
                    <p className="text-xs text-slate-500">{fit.detail}</p>
                  </div>
                )}
                <a
                  href={platform.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Bekijk platform
                </a>
              </div>
              <div className="mt-3 space-y-3 text-sm text-slate-700">
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
          )})}
        </div>
      </Card>

      <Card title="Vergelijking in één oogopslag" subtitle="Zonder jargon">
        <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white/70">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-6 gap-2 px-4 py-3 text-xs text-slate-500">
              <span>Platform</span>
              <span>Kosten</span>
              <span>Starten</span>
              <span>Tempo</span>
              <span>Uitleg</span>
              <span>Past bij</span>
            </div>
            <div className="divide-y divide-slate-200/70">
              {platforms.map((platform) => (
                <div key={platform.name} className="grid grid-cols-6 gap-2 px-4 py-3 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{platform.name}</span>
                  <span>{platform.costs}</span>
                  <span>{platform.ease}</span>
                  <span>{platform.pace}</span>
                  <span>{platform.learning}</span>
                  <span>{platform.bestFor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
