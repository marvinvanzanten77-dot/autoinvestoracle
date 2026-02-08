import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AppLayout } from './layouts/AppLayout';
import { ThemeProvider } from './lib/theme/ThemeContext';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Today } from './pages/Today';
import { MonthOverview } from './pages/MonthOverview';
import { YearView } from './pages/YearView';
import { Charts } from './pages/Charts';
import { Settings } from './pages/Settings';
import { Academy } from './pages/Academy';
import { Onboarding } from './pages/Onboarding';
import { Exchanges } from './pages/Exchanges';
import { AgentActivity } from './pages/AgentActivity';
import { Trading } from './pages/Trading';
import { Login } from './pages/Login';
import { supabase } from './lib/supabase/client';

function MainLayoutRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/today" element={<Today />} />
        <Route path="/month" element={<MonthOverview />} />
        <Route path="/year" element={<YearView />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/academy" element={<Academy />} />
        <Route path="/agent/activity" element={<AgentActivity />} />
        <Route path="/trading" element={<Trading />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/exchanges" element={<Exchanges />} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  useEffect(() => {
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
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        await fetch('/api/session/logout', { method: 'POST' });
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
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding onComplete={() => window.location.href = '/'} />} />
        <Route path="/*" element={<MainLayoutRoutes />} />
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
