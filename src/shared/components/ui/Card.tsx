import { ReactNode } from 'react';

type CardProps = {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Card({ title, subtitle, icon, children, className = '' }: CardProps) {
  return (
    <div className={`glass rounded-2xl p-5 md:p-6 ${className}`}>
      {(title || subtitle || icon) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            {title && <p className="text-xs tracking-[0.12em] text-slate-500">{title}</p>}
            {subtitle && <p className="text-sm text-slate-700/90">{subtitle}</p>}
          </div>
          {icon && (
            <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-primary">
              {icon}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
