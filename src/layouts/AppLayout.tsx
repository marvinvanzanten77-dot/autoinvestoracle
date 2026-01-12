import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [riskLabel, setRiskLabel] = useState<'Voorzichtig' | 'Gebalanceerd' | 'Actief'>('Gebalanceerd');

  useEffect(() => {
    const load = () => {
      if (typeof window === 'undefined') return;
      const stored = localStorage.getItem('aio_settings_v1');
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as { riskProfile?: 'Voorzichtig' | 'Gebalanceerd' | 'Actief' };
        if (parsed.riskProfile) {
          setRiskLabel(parsed.riskProfile);
        }
      } catch {
        // ignore invalid storage
      }
    };

    load();
    const handleStorage = () => load();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('aio_settings_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('aio_settings_updated', handleStorage);
    };
  }, []);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-12 py-8 md:py-10">
        <div className="glass rounded-3xl p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 md:gap-6">
            <Sidebar userName="Jij" badge={riskLabel} />

            <main className="flex flex-col gap-4 md:gap-6">
              <header className="glass rounded-2xl p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-label tracking-[0.04em] text-slate-500">Crypto overzicht</p>
                  <p className="text-title text-slate-900 font-serif">Auto Invest Oracle</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="flex items-center gap-2">
                    <span className="relative h-2.5 w-2.5">
                      <span className="absolute inset-0 rounded-full bg-primary/70 shadow-[0_0_0_4px_rgba(111,168,161,0.12)]"></span>
                    </span>
                    Korte check
                  </span>
                  <span className="text-slate-400">|</span>
                  <span>Laatst bijgewerkt: 09:42 CET</span>
                </div>
              </header>
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
