import { NavLink } from 'react-router-dom';

type NavItem = {
  label: string;
  to: string;
  locked?: boolean;
};

const navItems: NavItem[] = [
  { label: 'Overzicht', to: '/' },
  { label: 'Vandaag', to: '/today' },
  { label: 'Maandoverzicht', to: '/month', locked: true },
  { label: 'Jaarbeeld', to: '/year', locked: true },
  { label: 'Koersen', to: '/charts' },
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
        <div className="h-11 w-11 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-primary font-semibold">
          AI
        </div>
        <div>
          <p className="text-subtitle leading-tight">Auto Invest Oracle</p>
          <p className="text-xs text-slate-400">Signalen & inzichten</p>
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
                  ? 'opacity-50 pointer-events-none border-transparent bg-slate-900/20 text-slate-400'
                  : isActive
                    ? 'border-slate-500/60 bg-slate-800/60 text-slate-100 shadow-[0_12px_28px_rgba(0,0,0,0.25)]'
                    : 'border-transparent bg-slate-900/40 text-slate-300 hover:border-slate-600/40 hover:bg-slate-800/50'
              }`
            }
            end={item.to === '/'}
          >
            <span className={`h-2 w-2 rounded-full ${item.locked ? 'bg-slate-700/70' : 'bg-primary/60'}`} />
            <span className="flex-1">{item.label}</span>
            {item.locked && (
              <span className="text-xs text-slate-500">
                🔒
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="glass rounded-xl p-3 border border-slate-700/70 mt-auto">
        <p className="text-sm font-semibold text-white">{userName}</p>
        <p className="text-xs text-slate-400">{badge}</p>
      </div>
    </aside>
  );
}
