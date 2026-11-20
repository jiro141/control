import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  backTo,
  backLabel = 'Volver',
}: PageHeaderProps) {
  return (
    <div className="print-hidden mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {backTo ? (
          <Link
            to={backTo}
            className="mb-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-accent transition-colors hover:text-accent-hover sm:mb-2 sm:min-h-0"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        ) : null}
        <h1 className="break-words text-xl font-extrabold tracking-tight text-navy sm:text-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 break-words text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
