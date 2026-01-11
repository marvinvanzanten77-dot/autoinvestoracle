import { Card } from '../components/ui/Card';

export function YearView() {
  return (
    <div className="grid gap-4">
      <Card title="Jaarbeeld" subtitle="Locked">
        <p className="text-sm text-slate-600">
          Deze sectie is nog vergrendeld. Hier komt straks het jaarbeeld met long-term performance, risico en rotaties.
        </p>
      </Card>
    </div>
  );
}
