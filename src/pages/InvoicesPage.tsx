import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Money } from '../components/Money';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { fetchInvoices } from '../lib/api';
import { describeError } from '../lib/errors';
import { downloadInvoicesExcel } from '../lib/excel/invoicesListExcel';
import {
  formatDate,
  formatInvoiceNumber,
  formatMonthKey,
  monthKeyOf,
} from '../lib/format';
import type { InvoiceBalance, InvoiceStatus } from '../types/database';

type StatusFilter = 'todas' | InvoiceStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pagada', label: 'Pagada' },
];

function isValidStatus(value: string | null): value is InvoiceStatus {
  return value === 'pendiente' || value === 'parcial' || value === 'pagada';
}

export function InvoicesPage() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('estado');
  const { settings } = useSettings();
  const { notify } = useToast();

  const [invoices, setInvoices] = useState<InvoiceBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>(
    isValidStatus(initialStatus) ? initialStatus : 'todas',
  );
  const [month, setMonth] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchInvoices();
      setInvoices(loaded);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const monthOptions = useMemo(() => {
    const keys = Array.from(
      new Set(invoices.map((invoice) => monthKeyOf(invoice.issue_date))),
    );
    return keys.sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const number = formatInvoiceNumber(invoice.number);
      const matchesQuery =
        query.length === 0 ||
        invoice.customer_name.toLowerCase().includes(query) ||
        String(invoice.number).includes(query) ||
        number.includes(query);
      const matchesStatus = status === 'todas' || invoice.status === status;
      const matchesMonth = !month || monthKeyOf(invoice.issue_date) === month;
      return matchesQuery && matchesStatus && matchesMonth;
    });
  }, [invoices, search, status, month]);

  const listSummary = useMemo(() => {
    let balance = 0;
    for (const invoice of filtered) {
      balance += Number(invoice.balance) || 0;
    }
    return { count: filtered.length, balance: Math.round(balance * 100) / 100 };
  }, [filtered]);

  const handleExport = async () => {
    if (!settings) {
      notify('La configuración del negocio aún no está disponible.', 'error');
      return;
    }
    if (filtered.length === 0) {
      notify('No hay facturas para exportar con los filtros actuales.', 'info');
      return;
    }
    setExporting(true);
    try {
      await downloadInvoicesExcel(filtered, settings);
      notify('Listado exportado a Excel.', 'success');
    } catch (cause) {
      notify(describeError(cause), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Facturas"
        subtitle="Consulta, filtra y exporta todas las facturas emitidas."
        actions={
          <>
            <button
              type="button"
              onClick={handleExport}
              className="btn btn-ghost"
              disabled={exporting}
            >
              {exporting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Exportar Excel
            </button>
            <Link to="/facturas/nueva" className="btn btn-accent">
              <Plus className="h-4 w-4" />
              Nueva factura
            </Link>
          </>
        }
      />

      <div className="card mb-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input pl-9"
              placeholder="Buscar por número o cliente…"
              aria-label="Buscar facturas"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="input sm:w-52"
              aria-label="Filtrar por mes"
            >
              <option value="">Todos los meses</option>
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {formatMonthKey(key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                status === option.value
                  ? 'bg-navy text-white'
                  : 'bg-surface text-slate-500 hover:bg-line/60 hover:text-navy'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
          <Spinner className="h-6 w-6 text-sky" />
          <p className="text-sm font-medium">Cargando facturas…</p>
        </div>
      ) : error ? (
        <div className="card p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-3 text-sm font-semibold text-navy">{error}</p>
          <button type="button" onClick={() => void load()} className="btn btn-primary mt-4">
            Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No se encontraron facturas"
          description={
            invoices.length === 0
              ? 'Crea la primera factura para comenzar a controlar tus ventas.'
              : 'Prueba con otro término de búsqueda o cambia los filtros.'
          }
          action={
            <Link to="/facturas/nueva" className="btn btn-accent btn-sm">
              <Plus className="h-4 w-4" />
              Nueva factura
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {listSummary.count}{' '}
              {listSummary.count === 1 ? 'factura' : 'facturas'}
            </span>
            <span>
              Saldo del listado:{' '}
              <Money value={listSummary.balance} className="font-bold text-navy" />
            </span>
          </div>

          <div className="space-y-2.5 lg:hidden">
            {filtered.map((invoice) => (
              <Link
                key={invoice.id}
                to={`/facturas/${invoice.id}`}
                className="card block p-4 transition-shadow hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-navy">
                      N° {formatInvoiceNumber(invoice.number)}
                    </p>
                    <p className="truncate text-sm text-slate-600">
                      {invoice.customer_name}
                    </p>
                  </div>
                  <StatusBadge status={invoice.status} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Fecha
                    </p>
                    <p className="text-xs text-slate-600">
                      {formatDate(invoice.issue_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Total
                    </p>
                    <Money value={invoice.total} className="text-sm font-bold text-navy" />
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Saldo
                    </p>
                    <Money
                      value={invoice.balance}
                      className={`text-sm font-bold ${
                        Number(invoice.balance) > 0.009
                          ? 'text-red-600'
                          : 'text-emerald-600'
                      }`}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="card hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface/70 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">N°</th>
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 text-right font-semibold">Pagado</th>
                    <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((invoice) => (
                    <tr key={invoice.id} className="transition-colors hover:bg-surface/60">
                      <td className="px-4 py-3 font-semibold text-navy">
                        <Link to={`/facturas/${invoice.id}`}>
                          {formatInvoiceNumber(invoice.number)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(invoice.issue_date)}
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-slate-700">
                        {invoice.customer_name}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-navy">
                        <Money value={invoice.total} />
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        <Money value={invoice.paid_amount} />
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          Number(invoice.balance) > 0.009
                            ? 'text-red-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        <Money value={invoice.balance} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-2 py-3">
                        <Link
                          to={`/facturas/${invoice.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-surface hover:text-navy"
                          aria-label={`Ver factura ${formatInvoiceNumber(invoice.number)}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
