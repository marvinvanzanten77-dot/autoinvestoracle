import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { marketUpdates } from '../data/marketUpdates';

export function Today() {
  const [lastScan, setLastScan] = useState('Nog geen scan');

  const handleScan = () => {
    const time = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    setLastScan(time);
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-title text-slate-900 font-serif">Updates</p>
          <p className="text-sm text-slate-600">Korte vertaling van wat er speelt in de markt.</p>
        </div>
        <button
          type="button"
          onClick={handleScan}
          className="pill border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 transition"
        >
          Korte scan
        </button>
      </div>

      <Card title="Laatste observaties" subtitle={`Laatste scan: ${lastScan}`}>
        <div className="space-y-4">
          {marketUpdates.map((item) => (
            <div key={item.title} className="space-y-1">
              <p className="text-subtitle text-slate-900 font-serif">{item.title}</p>
              <p className="text-sm text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
