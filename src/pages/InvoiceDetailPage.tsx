import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  FileDown,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  Share2,
  Trash2,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Money } from '../components/Money';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { PaymentModal } from '../components/PaymentModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InvoiceSheet } from '../components/InvoiceSheet';
import { EmptyState } from '../components/EmptyState';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import {
  voidInvoice,
  voidPayment,
  fetchInvoice,
  fetchInvoiceItems,
  fetchPayments,
} from '../lib/api';
import { describeError } from '../lib/errors';
import { downloadBlob } from '../lib/download';
import {
  capitalize,
  formatDate,
  formatInvoiceNumber,
  formatMoney,
  invoiceCurrency,
  sanitizeFileName,
} from '../lib/format';
import type { InvoiceBalance, InvoiceItem, Payment } from '../types/database';

type BusyAction = 'pdf' | 'excel' | 'share' | null;

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const { notify } = useToast();

  const [invoice, setInvoice] = useState<InvoiceBalance | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [paymentDeleteLoading, setPaymentDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setError('No se indicó la factura.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [loadedInvoice, loadedItems, loadedPayments] = await Promise.all([
        fetchInvoice(id),
        fetchInvoiceItems(id),
        fetchPayments(id),
      ]);
      setInvoice(loadedInvoice);
      setItems(loadedItems);
      setPayments(loadedPayments);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePdf = async () => {
    if (!invoice) return;
    if (!settings) {
      notify('La configuración del negocio aún no está disponible.', 'error');
      return;
    }
    setBusy('pdf');
    try {
      const { downloadInvoicePdf } = await import('../lib/pdf/InvoicePdf');
      await downloadInvoicePdf(invoice, items, settings);
      notify('PDF generado correctamente.', 'success');
    } catch (cause) {
      notify(describeError(cause), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleExcel = async () => {
    if (!invoice) return;
    if (!settings) {
      notify('La configuración del negocio aún no está disponible.', 'error');
      return;
    }
    setBusy('excel');
    try {
      const { downloadInvoiceExcel } = await import('../lib/excel/invoiceExcel');
      await downloadInvoiceExcel(invoice, items, payments, settings);
      notify('Excel generado correctamente.', 'success');
    } catch (cause) {
      notify(describeError(cause), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    if (!invoice) return;
    if (!settings) {
      notify('La configuración del negocio aún no está disponible.', 'error');
      return;
    }
    setBusy('share');
    try {
      const { buildInvoicePdfBlob } = await import('../lib/pdf/InvoicePdf');
      const blob = await buildInvoicePdfBlob(invoice, items, settings);
      const filename = `Factura-${formatInvoiceNumber(invoice.number)}-${sanitizeFileName(
        invoice.customer_name,
      )}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });
      const shareData: ShareData = {
        files: [file],
        title: `Factura N° ${formatInvoiceNumber(invoice.number)}`,
        text: `Factura comercial de ${invoice.customer_name}`,
      };

      if (typeof navigator.canShare === 'function' && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        notify('Factura compartida.', 'success');
      } else {
        downloadBlob(blob, filename);
        notify(
          'Este dispositivo no permite compartir archivos. Se descargó el PDF.',
          'info',
        );
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        return;
      }
      notify(describeError(cause), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoice || !isAdmin || invoice.voided_at) return;
    setDeleteLoading(true);
    try {
      await voidInvoice(invoice.id);
      notify('Factura anulada.', 'success');
      setDeleteOpen(false);
      await load();
    } catch (cause) {
      notify(describeError(cause), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete || !isAdmin || invoice?.voided_at || paymentToDelete.voided_at) return;
    setPaymentDeleteLoading(true);
    try {
      await voidPayment(paymentToDelete.id);
      notify('Pago anulado.', 'success');
      setPaymentToDelete(null);
      await load();
    } catch (cause) {
      notify(describeError(cause), 'error');
    } finally {
      setPaymentDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Spinner className="h-6 w-6 text-accent" />
        <p className="text-sm font-medium">Cargando factura…</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div>
        <PageHeader title="Factura" backTo="/facturas" />
        <div className="card p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-3 text-sm font-semibold text-navy">
            {error ?? 'No se encontró la factura.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn btn-primary"
            >
              Reintentar
            </button>
            <Link to="/facturas" className="btn btn-ghost">
              Volver al listado
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const number = formatInvoiceNumber(invoice.number);
  const canEdit = isAdmin && invoice.status !== 'anulada';
  const canPay = canEdit && Number(invoice.balance) > 0;
  const activePayments = payments.filter((payment) => !payment.voided_at).length;
  const { currency_code, currency_symbol } = invoiceCurrency(invoice);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Factura N° ${number}`}
        subtitle={`${invoice.customer_name} · ${formatDate(invoice.issue_date)}`}
        backTo="/facturas"
        actions={canEdit ? (
          <>
            <Link to={`/facturas/${invoice.id}/editar`} className="btn btn-ghost">
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
            {canPay ? <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              className="btn btn-accent"
            >
              <Plus className="h-4 w-4" />
              Registrar pago
            </button> : null}
          </>
        ) : null}
      />

      <div className="print-hidden card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={invoice.status} />
          <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:max-w-md sm:flex-1">
            <div className="rounded-xl bg-surface px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Total
              </p>
              <Money value={invoice.total} invoice={invoice} className="text-sm font-bold text-navy" />
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                Pagado
              </p>
              <Money
                value={invoice.paid_amount}
                invoice={invoice}
                className="text-sm font-bold text-emerald-700"
              />
            </div>
            <div className="rounded-xl bg-red-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">
                Saldo
              </p>
              <Money value={invoice.balance} invoice={invoice} className="text-sm font-bold text-red-700" />
            </div>
          </div>
        </div>
      </div>

      <div className="print-hidden card p-3">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={handlePdf}
            className="btn btn-ghost btn-sm"
            disabled={busy !== null}
          >
            {busy === 'pdf' ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Descargar PDF
          </button>
          <button
            type="button"
            onClick={handleExcel}
            className="btn btn-ghost btn-sm"
            disabled={busy !== null}
          >
            {busy === 'excel' ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="btn btn-ghost btn-sm"
            disabled={busy !== null}
          >
            {busy === 'share' ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Compartir
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-ghost btn-sm"
            disabled={busy !== null}
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          {canEdit ? <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="btn btn-sm border border-red-200 bg-white text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Anular factura
          </button> : null}
        </div>
      </div>

      <InvoiceSheet invoice={invoice} items={items} settings={settings} />

      <section className="print-hidden card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-navy">Pagos registrados</h2>
            <p className="text-xs text-slate-500">
              {activePayments} {activePayments === 1 ? 'pago vigente' : 'pagos vigentes'} ·{' '}
              <Money value={invoice.paid_amount} invoice={invoice} className="font-semibold" /> abonado
            </p>
          </div>
          {canPay ? <button
            type="button"
            onClick={() => setPaymentOpen(true)}
            className="btn btn-ghost btn-sm"
          >
            <Plus className="h-4 w-4" />
            Registrar pago
          </button> : null}
        </div>

        <div className="mt-3">
          {payments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Sin pagos registrados"
              action={canPay ? (
                <button
                  type="button"
                  onClick={() => setPaymentOpen(true)}
                  className="btn btn-accent btn-sm"
                >
                  <Plus className="h-4 w-4" />
                  Registrar pago
                </button>
              ) : null}
            />
          ) : (
            <ul className="divide-y divide-line">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy">
                      {capitalize(payment.method)} · {formatDate(payment.paid_at)}
                      {payment.voided_at ? ' · Anulado' : ''}
                    </p>
                    {payment.note ? (
                      <p className="mt-0.5 break-words text-xs text-slate-500">{payment.note}</p>
                    ) : null}
                  </div>
                  <div className="ml-auto flex min-w-0 items-center justify-end gap-2 text-right">
                    <Money
                      value={payment.amount}
                      invoice={invoice}
                      className={payment.voided_at ? 'text-sm text-slate-500 line-through' : 'text-sm font-bold text-emerald-600'}
                    />
                    {canEdit && !payment.voided_at ? <button
                      type="button"
                      onClick={() => setPaymentToDelete(payment)}
                      className="icon-button inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label="Anular pago"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <PaymentModal
        open={paymentOpen && canPay}
        invoice={invoice}
        onClose={() => setPaymentOpen(false)}
        onSaved={load}
      />

      <ConfirmDialog
        open={deleteOpen && canEdit}
        title="Anular factura"
        message={`¿Confirmás la anulación de la factura N° ${number} de ${invoice.customer_name}? La factura y sus pagos quedarán en el historial.`}
        confirmLabel="Anular factura"
        destructive
        loading={deleteLoading}
        onConfirm={() => void handleDeleteInvoice()}
        onClose={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(paymentToDelete) && canEdit}
        title="Anular pago"
        message={`¿Confirmás la anulación del pago por ${formatMoney(paymentToDelete?.amount, currency_symbol, currency_code)}? Se actualizará el saldo de la factura.`}
        confirmLabel="Anular pago"
        destructive
        loading={paymentDeleteLoading}
        onConfirm={() => void handleDeletePayment()}
        onClose={() => setPaymentToDelete(null)}
      />
    </div>
  );
}
