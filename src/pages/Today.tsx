import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { marketContext, marketUpdates, volatilityStatus } from '../data/marketUpdates';

export function Today() {
  const [lastScan, setLastScan] = useState('Nog geen check');

  const handleScan = () => {
    const time = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    setLastScan(time);
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-title text-slate-900 font-serif">Marktnieuws</p>
          <p className="text-sm text-slate-700">Korte vertaling van wat er speelt in de markt.</p>
        </div>
        <button
          type="button"
          onClick={handleScan}
          className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition"
        >
          Korte check
        </button>
      </div>

      <Card title="Laatste observaties" subtitle={`Laatste check: ${lastScan}`}>
        <div className="space-y-4">
          {marketUpdates.map((item) => (
            <div key={item.title} className="space-y-1">
              <p className="text-subtitle text-slate-900 font-serif">{item.title}</p>
              <p className="text-sm text-slate-700">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Tempo van de markt" subtitle={volatilityStatus.label}>
          <p className="text-sm text-slate-700">{volatilityStatus.detail}</p>
        </Card>
        <Card title="Extra context" subtitle="In gewone woorden">
          <div className="space-y-3">
            {marketContext.map((item) => (
              <div key={item.title} className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
