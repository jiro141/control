import type { InvoiceStatus } from '../types/database';

const styles: Record<InvoiceStatus, string> = {
  pendiente: 'bg-red-50 text-red-700 ring-red-200',
  parcial: 'bg-amber-50 text-amber-700 ring-amber-200',
  pagada: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  anulada: 'bg-slate-100 text-slate-700 ring-slate-300',
};

const labels: Record<InvoiceStatus, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagada: 'Pagada',
  anulada: 'Anulada',
};

export function StatusBadge({
  status,
  className = '',
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles[status]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
