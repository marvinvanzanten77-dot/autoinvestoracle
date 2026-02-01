import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AppLayout } from './layouts/AppLayout';
import { ThemeProvider } from './lib/theme/ThemeContext';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Today } from './pages/Today';
import { MonthOverview } from './pages/MonthOverview';
import { YearView } from './pages/YearView';
import { Charts } from './pages/Charts';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import { Exchanges } from './pages/Exchanges';
import { Login } from './pages/Login';
import { supabase } from './lib/supabase/client';

function OnboardingGate({ onboarded }: { onboarded: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!onboarded && location.pathname !== '/onboarding' && location.pathname !== '/login') {
      navigate('/onboarding', { replace: true });
    }
    if (onboarded && (location.pathname === '/onboarding' || location.pathname === '/login')) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate, onboarded]);

  return null;
}

function MainLayoutRoutes({ onboarded }: { onboarded: boolean }) {
  return (
    <AppLayout onboarded={onboarded}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/today" element={<Today />} />
        <Route path="/month" element={<MonthOverview />} />
        <Route path="/year" element={<YearView />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/exchanges" element={<Exchanges />} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const syncProfile = async () => {
      const res = await fetch('/api/profile/get');
      if (!res.ok) {
        if (active) setOnboarded(false);
        return;
      }
      const data = (await res.json()) as { meta?: { onboardingComplete?: boolean } };
      if (active) setOnboarded(Boolean(data?.meta?.onboardingComplete));
    };

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const authResp = await fetch('/api/session/auth', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!authResp.ok) {
            await fetch('/api/session/init');
          }
        } else {
          await fetch('/api/session/init');
        }
      } catch {
        await fetch('/api/session/init');
      }
      await syncProfile();
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        await fetch('/api/session/logout', { method: 'POST' });
        if (active) setOnboarded(false);
        return;
      }
      if (session?.access_token) {
        const authResp = await fetch('/api/session/auth', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (!authResp.ok) {
          await fetch('/api/session/init');
        }
        await syncProfile();
      }
    });

    return () => {
      active = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (onboarded === null) {
    return <div className="min-h-screen flex items-center justify-center text-slate-700">Laden...</div>;
  }

  return (
    <BrowserRouter>
      <OnboardingGate onboarded={onboarded} />
      <Routes>
        <Route path="/onboarding" element={<Onboarding onComplete={() => setOnboarded(true)} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<MainLayoutRoutes onboarded={onboarded} />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
