import { Card } from '../components/ui/Card';
import { platforms } from '../data/platforms';

export function Charts() {
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <Card title="Platforms" subtitle="Vergelijk in rustig tempo">
        <div className="grid gap-4 md:grid-cols-2">
          {platforms.map((platform) => (
            <div key={platform.name} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
              <div className="space-y-1">
                <p className="text-subtitle text-slate-900 font-serif">{platform.name}</p>
                <p className="text-sm text-slate-600">{platform.tone}</p>
              </div>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
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
          ))}
        </div>
      </Card>
    </div>
  );
}
