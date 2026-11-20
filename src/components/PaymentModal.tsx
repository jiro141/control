import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { addPayment } from '../lib/api';
import { describeError } from '../lib/errors';
import { todayISO } from '../lib/format';
import type { InvoiceBalance, PaymentMethod } from '../types/database';
import { Modal } from './Modal';
import { Spinner } from './Spinner';
import { Money } from './Money';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'pago móvil', label: 'Pago móvil' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'otro', label: 'Otro' },
];

interface PaymentModalProps {
  open: boolean;
  invoice: InvoiceBalance;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function PaymentModal({ open, invoice, onClose, onSaved }: PaymentModalProps) {
  const { notify } = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [paidAt, setPaidAt] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const balance = Number(invoice.balance) || 0;

  useEffect(() => {
    if (!open) return;
    setAmount(balance > 0 ? balance.toFixed(2) : '');
    setMethod('efectivo');
    setPaidAt(todayISO());
    setNote('');
    setError(null);
    setSaving(false);
  }, [open, invoice.id, balance]);

  const handleSubmit = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresa un monto mayor a cero.');
      return;
    }
    if (parsed > balance + 0.01) {
      setError('El monto no puede superar el saldo pendiente.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await addPayment({
        invoice_id: invoice.id,
        amount: Math.round(parsed * 100) / 100,
        paid_at: paidAt,
        method,
        note: note.trim() ? note.trim() : null,
      });
      await onSaved();
      notify('Pago registrado correctamente.', 'success');
      onClose();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Registrar pago"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? <Spinner className="h-4 w-4" /> : null}
            Guardar pago
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-surface px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Factura</span>
            <span className="font-semibold text-navy">
              N° {String(invoice.number).padStart(4, '0')}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-500">Saldo pendiente</span>
            <Money value={balance} className="font-bold text-navy" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="payment-amount">
            Monto
          </label>
          <input
            id="payment-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="input"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="label" htmlFor="payment-method">
            Método de pago
          </label>
          <select
            id="payment-method"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            className="input"
          >
            {METHODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="payment-date">
            Fecha
          </label>
          <input
            id="payment-date"
            type="date"
            value={paidAt}
            onChange={(event) => setPaidAt(event.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="payment-note">
            Nota (opcional)
          </label>
          <textarea
            id="payment-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className="input resize-none"
            placeholder="Referencia, banco, observaciones…"
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
