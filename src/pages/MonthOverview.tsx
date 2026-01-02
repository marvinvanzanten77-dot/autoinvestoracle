import { Card } from '../components/ui/Card';

export function MonthOverview() {
  return (
    <div className="grid gap-4">
      <Card title="Maandoverzicht" subtitle="Locked">
        <p className="text-sm text-slate-300">
          Deze sectie is nog vergrendeld. Hier komt straks het maandoverzicht met trends, volatiliteit en performance.
        </p>
      </Card>
    </div>
  );
}
