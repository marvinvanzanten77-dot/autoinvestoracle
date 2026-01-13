import { NavLink } from 'react-router-dom';

type NavItem = {
  label: string;
  to: string;
  locked?: boolean;
};

const navItems: NavItem[] = [
  { label: 'Overzicht', to: '/' },
  { label: 'Marktnieuws', to: '/today' },
  { label: 'Handelsplatforms', to: '/charts' },
  { label: 'Exchange koppelingen', to: '/settings/exchanges' },
  { label: 'Instellingen', to: '/settings' }
];

type SidebarProps = {
  userName: string;
  badge: 'Gebalanceerd' | 'Pro';
};

export function Sidebar({ userName, badge }: SidebarProps) {
  return (
    <aside className="glass rounded-2xl p-4 md:p-5 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-primary font-semibold">
          AI
        </div>
        <div>
          <p className="text-subtitle leading-tight text-slate-900 font-serif">Auto Invest Oracle</p>
          <p className="text-xs text-slate-500">Crypto observaties</p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm border transition ${
                item.locked
                  ? 'opacity-50 pointer-events-none border-transparent bg-transparent text-slate-400'
                  : isActive
                    ? 'border-transparent bg-white/70 text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.08)]'
                    : 'border-transparent bg-transparent text-slate-600 hover:bg-white/60'
              }`
            }
            end={item.to === '/'}
          >
            <span className={`h-2 w-2 rounded-full ${item.locked ? 'bg-slate-300' : 'bg-primary/70'}`} />
            <span className="flex-1">{item.label}</span>
            {item.locked && (
              <span className="text-xs text-slate-400">
                🔒
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="glass rounded-xl p-3 border border-slate-200/70 mt-auto">
        <p className="text-sm font-semibold text-slate-900">{userName}</p>
        <p className="text-xs text-slate-500">{badge}</p>
      </div>
    </aside>
  );
}
