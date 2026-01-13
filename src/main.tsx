import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AppLayout } from './layouts/AppLayout';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Today } from './pages/Today';
import { MonthOverview } from './pages/MonthOverview';
import { YearView } from './pages/YearView';
import { Charts } from './pages/Charts';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import { Exchanges } from './pages/Exchanges';

function OnboardingGate({ onboarded }: { onboarded: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!onboarded && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true });
    }
    if (onboarded && location.pathname === '/onboarding') {
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
    fetch('/api/session/init')
      .then(() => fetch('/api/profile/get'))
      .then(async (res) => {
        if (!res.ok) {
          setOnboarded(false);
          return;
        }
        const data = (await res.json()) as { meta?: { onboardingComplete?: boolean } };
        setOnboarded(Boolean(data?.meta?.onboardingComplete));
      })
      .catch(() => setOnboarded(false));
  }, []);

  if (onboarded === null) {
    return <div className="min-h-screen flex items-center justify-center text-slate-700">Laden...</div>;
  }

  return (
    <BrowserRouter>
      <OnboardingGate onboarded={onboarded} />
      <Routes>
        <Route path="/onboarding" element={<Onboarding onComplete={() => setOnboarded(true)} />} />
        <Route path="/*" element={<MainLayoutRoutes onboarded={onboarded} />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
