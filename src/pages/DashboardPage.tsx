import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  DollarSign,
  FileText,
  Plus,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Money } from '../components/Money';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { fetchAllPayments, fetchInvoices } from '../lib/api';
import { describeError } from '../lib/errors';
import {
  MONTHS_SHORT_ES,
  BUSINESS_CURRENCY,
  formatDate,
  formatInvoiceNumber,
  formatMoney,
  monthKeyOf,
  todayISO,
} from '../lib/format';
import type { InvoiceBalance, Payment } from '../types/database';

interface MonthPoint {
  key: string;
  label: string;
  billed: number;
  collected: number;
}

function buildMonthPoints(): { key: string; label: string }[] {
  const now = new Date();
  const points: { key: string; label: string }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    points.push({ key, label: MONTHS_SHORT_ES[date.getMonth()] });
  }
  return points;
}

export function DashboardPage() {
  const { isAdmin } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceBalance[]>([]);
  const copInvoices = useMemo(() => invoices.filter((invoice) =>
    invoice.currency_code === BUSINESS_CURRENCY.currency_code && invoice.status !== 'anulada',
  ), [invoices]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedInvoices, loadedPayments] = await Promise.all([
        fetchInvoices(),
        fetchAllPayments(),
      ]);
      setInvoices(loadedInvoices);
      const billedInCop = new Set(loadedInvoices.filter((invoice) =>
        invoice.currency_code === BUSINESS_CURRENCY.currency_code && invoice.status !== 'anulada',
      ).map((invoice) => invoice.id));
      setPayments(loadedPayments.filter((payment) => billedInCop.has(payment.invoice_id)));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    let billed = 0;
    let collected = 0;
    let outstanding = 0;
    for (const invoice of copInvoices) {
      billed += Number(invoice.total) || 0;
      collected += Number(invoice.paid_amount) || 0;
      outstanding += Math.max(0, Number(invoice.balance) || 0);
    }
    return {
      count: copInvoices.length,
      billed: Math.round(billed * 100) / 100,
      collected: Math.round(collected * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
    };
  }, [copInvoices]);

  const currentMonthKey = monthKeyOf(todayISO());

  const currentMonth = useMemo(() => {
    let billed = 0;
    let count = 0;
    for (const invoice of copInvoices) {
      if (monthKeyOf(invoice.issue_date) === currentMonthKey) {
        billed += Number(invoice.total) || 0;
        count += 1;
      }
    }
    let collected = 0;
    for (const payment of payments) {
      if (monthKeyOf(payment.paid_at) === currentMonthKey) {
        collected += Number(payment.amount) || 0;
      }
    }
    return {
      billed: Math.round(billed * 100) / 100,
      collected: Math.round(collected * 100) / 100,
      count,
    };
  }, [copInvoices, payments, currentMonthKey]);

  const months = useMemo<MonthPoint[]>(() => {
    return buildMonthPoints().map((point) => {
      let billed = 0;
      let collected = 0;
      for (const invoice of copInvoices) {
        if (monthKeyOf(invoice.issue_date) === point.key) {
          billed += Number(invoice.total) || 0;
        }
      }
      for (const payment of payments) {
        if (monthKeyOf(payment.paid_at) === point.key) {
          collected += Number(payment.amount) || 0;
        }
      }
      return {
        ...point,
        billed: Math.round(billed * 100) / 100,
        collected: Math.round(collected * 100) / 100,
      };
    });
  }, [copInvoices, payments]);

  const chartMax = useMemo(() => {
    const values = months.flatMap((month) => [month.billed, month.collected]);
    return Math.max(1, ...values);
  }, [months]);

  const recentInvoices = useMemo(
    () =>
      [...invoices]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
    [invoices],
  );

  const outstandingInvoices = useMemo(
    () =>
      [...invoices]
        .filter((invoice) => invoice.status !== 'anulada' && Number(invoice.balance) > 0.009)
        .sort((a, b) => a.issue_date.localeCompare(b.issue_date))
        .slice(0, 5),
    [invoices],
  );

  const barHeight = (value: number) => {
    if (value <= 0) return '3%';
    return `${Math.max(5, Math.round((value / chartMax) * 100))}%`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Spinner className="h-6 w-6 text-accent" />
        <p className="text-sm font-medium">Cargando resumen…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card mx-auto max-w-lg p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
        <p className="mt-3 text-sm font-semibold text-navy">{error}</p>
        <button type="button" onClick={() => void load()} className="btn btn-primary mt-4">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle="Resumen de facturación, cobros y saldos de facturas vigentes en COP."
        actions={isAdmin ? (
          <Link to="/facturas/nueva" className="btn btn-accent">
            <Plus className="h-4 w-4" />
            Nueva factura
          </Link>
        ) : null}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Facturas emitidas
            </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-light text-accent">
                <FileText className="h-4 w-4" />
              </span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-navy">{metrics.count}</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Total facturado
            </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-light text-accent">
                <DollarSign className="h-4 w-4" />
              </span>
          </div>
          <Money
            value={metrics.billed}
            className="mt-3 block text-lg font-extrabold text-navy sm:text-2xl"
          />
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Total cobrado
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <Money
            value={metrics.collected}
            className="mt-3 block text-lg font-extrabold text-emerald-600 sm:text-2xl"
          />
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Saldo pendiente
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <Money
            value={metrics.outstanding}
            className="mt-3 block text-lg font-extrabold text-red-600 sm:text-2xl"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-navy">Facturado vs. cobrado</h2>
              <p className="text-xs text-slate-500">Últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-navy" />
                Facturado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-sky" />
                Cobrado
              </span>
            </div>
          </div>

          <div className="mt-5 flex h-40 items-end gap-2 sm:gap-4">
            {months.map((month) => (
              <div
                key={month.key}
                className="flex h-full flex-1 flex-col items-center justify-end"
              >
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div
                    className="w-2.5 rounded-t bg-navy/90 sm:w-3.5"
                    style={{ height: barHeight(month.billed) }}
                    title={`Facturado: ${formatMoney(month.billed, '$', 'COP')}`}
                  />
                  <div
                    className="w-2.5 rounded-t bg-sky sm:w-3.5"
                    style={{ height: barHeight(month.collected) }}
                    title={`Cobrado: ${formatMoney(month.collected, '$', 'COP')}`}
                  />
                </div>
                <span className="mt-2 text-[10px] font-semibold uppercase text-slate-500">
                  {month.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold text-navy">Resumen del mes actual</h2>
          <p className="text-xs text-slate-500">Movimientos de este mes</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-2.5">
              <span className="text-xs font-semibold text-slate-500">
                Facturas emitidas
              </span>
              <span className="text-sm font-bold text-navy">{currentMonth.count}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-2.5">
              <span className="text-xs font-semibold text-slate-500">Facturado</span>
              <Money value={currentMonth.billed} className="text-sm font-bold text-navy" />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-2.5">
              <span className="text-xs font-semibold text-slate-500">Cobrado</span>
              <Money
                value={currentMonth.collected}
                className="text-sm font-bold text-emerald-600"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-navy">Facturas recientes</h2>
            <Link
              to="/facturas"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover"
            >
              Ver todas
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-3">
            {recentInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Todavía no hay facturas"
                description="Crea la primera factura para comenzar a controlar tus ventas."
                action={isAdmin ? (
                  <Link to="/facturas/nueva" className="btn btn-accent btn-sm">
                    <Plus className="h-4 w-4" />
                    Nueva factura
                  </Link>
                ) : null}
              />
            ) : (
              <ul className="divide-y divide-line">
                {recentInvoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link
                      to={`/facturas/${invoice.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">
                          N° {formatInvoiceNumber(invoice.number)} · {invoice.customer_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(invoice.issue_date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Money
                          value={invoice.total}
                          invoice={invoice}
                          className="text-sm font-bold text-navy"
                        />
                        <StatusBadge status={invoice.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-navy">Facturas por cobrar</h2>
            <Link
              to="/facturas?estado=pendiente"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover"
            >
              Ver pendientes
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-3">
            {outstandingInvoices.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No hay saldos pendientes"
                description="Todas las facturas registradas están cobradas."
              />
            ) : (
              <ul className="divide-y divide-line">
                {outstandingInvoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link
                      to={`/facturas/${invoice.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">
                          {invoice.customer_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          N° {formatInvoiceNumber(invoice.number)} ·{' '}
                          {formatDate(invoice.issue_date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Money
                          value={invoice.balance}
                          invoice={invoice}
                          className="text-sm font-bold text-red-600"
                        />
                        <StatusBadge status={invoice.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
