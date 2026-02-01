import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import type { UserProfile } from '../lib/profile/types';

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [riskLabel, setRiskLabel] = useState<'Voorzichtig' | 'Gebalanceerd' | 'Actief'>('Gebalanceerd');
  const [profile, setProfile] = useState<UserProfile | null>(null);

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
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-12 py-8 md:py-10">
        <div className="glass rounded-3xl p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 md:gap-6">
            <Sidebar
              userName={profile?.displayName || 'Jij'}
              avatarUrl={profile?.avatarUrl}
              badge={riskLabel}
            />

            <main className="relative flex flex-col gap-4 md:gap-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
