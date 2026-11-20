import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white/70 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-light text-sky">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-bold text-navy">{title}</p>
        {description ? (
          <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
