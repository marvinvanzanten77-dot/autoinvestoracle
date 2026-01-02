import { ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar';

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-12 py-8 md:py-10">
        <div className="glass rounded-3xl p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 md:gap-6">
            <Sidebar userName="Lena Visser" badge="Gebalanceerd" />

            <main className="flex flex-col gap-4 md:gap-6">
              <header className="glass rounded-2xl p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-label uppercase tracking-[0.12em] text-slate-400">Marktoverzicht</p>
                  <p className="text-title text-white">Auto Invest Oracle</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="flex items-center gap-2">
                    <span className="relative h-2.5 w-2.5">
                      <span className="absolute inset-0 animate-ping rounded-full bg-primary/60"></span>
                      <span className="absolute inset-0 rounded-full bg-primary shadow-[0_0_12px_rgba(70,240,255,0.6)]"></span>
                    </span>
                    Scan live
                  </span>
                  <span className="text-slate-600">|</span>
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
