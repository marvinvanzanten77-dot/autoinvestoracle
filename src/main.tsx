import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AppLayout } from './layouts/AppLayout';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Today } from './pages/Today';
import { MonthOverview } from './pages/MonthOverview';
import { YearView } from './pages/YearView';
import { Charts } from './pages/Charts';
import { Settings } from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/today" element={<Today />} />
          <Route path="/month" element={<MonthOverview />} />
          <Route path="/year" element={<YearView />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
