import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Plus, Save, Trash2, UserRound, Users } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Money } from '../components/Money';
import { Spinner } from '../components/Spinner';
import { useToast } from '../context/ToastContext';
import {
  createInvoice,
  fetchCustomers,
  fetchInvoice,
  fetchInvoiceItems,
  InvoiceRefetchError,
  updateInvoice,
} from '../lib/api';
import { describeError } from '../lib/errors';
import { BUSINESS_CURRENCY, invoiceCurrency, parseDecimal, roundMoney } from '../lib/format';
import type {
  CustomerSummary,
  InvoiceFormData,
  InvoiceInputItem,
  InvoiceItem,
} from '../types/database';

const UNITS = [
  'unidad',
  'm³',
  'm²',
  'pie',
  'tabla',
  'pulgada',
  'saco',
  'kg',
  'tonelada',
];

let draftCounter = 0;

interface ItemDraft {
  key: string;
  quantity: string;
  description: string;
  unit: string;
  unit_price: string;
}

type ItemField = 'quantity' | 'description' | 'unit' | 'unit_price';

function createDraft(): ItemDraft {
  draftCounter += 1;
  return {
    key: `item-${draftCounter}`,
    quantity: '1',
    description: '',
    unit: 'unidad',
    unit_price: '',
  };
}

function draftFromItem(item: InvoiceItem): ItemDraft {
  draftCounter += 1;
  return {
    key: `item-${draftCounter}`,
    quantity: String(Number(item.quantity)).replace('.', ','),
    description: item.description,
    unit: item.unit,
    unit_price: String(Number(item.unit_price)).replace('.', ','),
  };
}

function todayISO(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function InvoiceFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { notify } = useToast();

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [currency, setCurrency] = useState<{ currency_code: string; currency_symbol: string }>(BUSINESS_CURRENCY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [issueDate, setIssueDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>(() => [createDraft()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const loadedCustomers = await fetchCustomers();
      setCustomers(loadedCustomers);

      if (id) {
        const [invoice, invoiceItems] = await Promise.all([
          fetchInvoice(id),
          fetchInvoiceItems(id),
        ]);
        if (invoice.status === 'anulada') throw new Error('La factura está anulada.');
        setCurrency(invoiceCurrency(invoice));
        const hasCustomer =
          Boolean(invoice.customer_id) &&
          loadedCustomers.some((customer) => customer.id === invoice.customer_id);
        setCustomerMode(hasCustomer ? 'existing' : 'new');
        setCustomerId(hasCustomer ? invoice.customer_id ?? '' : '');
        setCustomerName(invoice.customer_name);
        setCustomerAddress(invoice.customer_address ?? '');
        setCustomerPhone(invoice.customer_phone ?? '');
        setIssueDate(invoice.issue_date.slice(0, 10));
        setNotes(invoice.notes ?? '');
        setItems(
          invoiceItems.length > 0
            ? invoiceItems.map((item) => draftFromItem(item))
            : [createDraft()],
        );
      } else {
        setCurrency(BUSINESS_CURRENCY);
        setCustomerMode('new');
        setCustomerId('');
        setCustomerName('');
        setCustomerAddress('');
        setCustomerPhone('');
        setIssueDate(todayISO());
        setNotes('');
        setItems([createDraft()]);
      }
    } catch (cause) {
      setLoadError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleModeChange = (mode: 'existing' | 'new') => {
    if (mode === customerMode) return;
    setCustomerMode(mode);
    if (mode === 'new') {
      setCustomerId('');
      setCustomerName('');
      setCustomerAddress('');
      setCustomerPhone('');
      return;
    }
    if (!customerId && customers.length > 0) {
      const first = customers[0];
      setCustomerId(first.id);
      setCustomerName(first.name);
      setCustomerAddress(first.address ?? '');
      setCustomerPhone(first.phone ?? '');
    }
  };

  const handleSelectCustomer = (value: string) => {
    setCustomerId(value);
    const customer = customers.find((entry) => entry.id === value);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerAddress(customer.address ?? '');
      setCustomerPhone(customer.phone ?? '');
    }
  };

  const updateItem = (key: string, field: ItemField, value: string) => {
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addItem = () => {
    setItems((current) => [...current, createDraft()]);
  };

  const removeItem = (key: string) => {
    setItems((current) => {
      if (current.length === 1) {
        return [createDraft()];
      }
      return current.filter((item) => item.key !== key);
    });
  };

  const itemsTotal = useMemo(() => {
    let total = 0;
    for (const item of items) {
      const quantity = parseDecimal(item.quantity);
      const price = parseDecimal(item.unit_price);
      if (Number.isFinite(quantity) && Number.isFinite(price)) {
        total += roundMoney(roundQuantity(quantity) * roundMoney(price));
      }
    }
    return roundMoney(total);
  }, [items]);

  const handleSubmit = async () => {
    setFormError(null);

    if (customerMode === 'existing' && !customerId) {
      setFormError('Selecciona un cliente o cambia a la opción Nuevo cliente.');
      return;
    }
    if (
      customerMode === 'existing' &&
      !customers.some((customer) => customer.id === customerId)
    ) {
      setFormError('El cliente seleccionado ya no está disponible. Elige otro.');
      return;
    }
    if (!customerName.trim()) {
      setFormError('Ingresa el nombre del cliente.');
      return;
    }
    if (!issueDate) {
      setFormError('Selecciona la fecha de emisión.');
      return;
    }

    const usableRows = items.filter(
      (item) =>
        item.description.trim() !== '' ||
        item.unit_price.trim() !== '' ||
        (item.quantity.trim() !== '' && item.quantity.trim() !== '1'),
    );

    if (usableRows.length === 0) {
      setFormError('Agrega al menos un artículo con descripción, cantidad y precio.');
      return;
    }

    const payloadItems: InvoiceInputItem[] = [];
    for (const item of usableRows) {
      const description = item.description.trim();
      if (!description) {
        setFormError('Todos los artículos deben tener una descripción.');
        return;
      }
      const quantity = roundQuantity(parseDecimal(item.quantity));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setFormError(`La cantidad de "${description}" debe ser mayor a cero.`);
        return;
      }
      const price = parseDecimal(item.unit_price);
      if (!Number.isFinite(price) || price < 0) {
        setFormError(`El precio de "${description}" debe ser un número válido.`);
        return;
      }
      payloadItems.push({
        quantity,
        description,
        unit: item.unit.trim() || 'unidad',
        unit_price: roundMoney(price),
      });
    }

    setSaving(true);
    try {
      let resolvedCustomerId: string | null =
        customerMode === 'existing' ? customerId || null : null;
      let resolvedCustomerName = customerName.trim();
      let resolvedCustomerAddress = customerAddress.trim() || null;
      let resolvedCustomerPhone = customerPhone.trim() || null;

      if (customerMode === 'new') {
        const normalizedName = resolvedCustomerName.toLowerCase();
        const existing = customers.find(
          (customer) => customer.name.trim().toLowerCase() === normalizedName,
        );

        if (existing) {
          resolvedCustomerId = existing.id;
          resolvedCustomerName = existing.name;
          resolvedCustomerAddress = existing.address;
          resolvedCustomerPhone = existing.phone;
          setCustomerId(existing.id);
        }
      }

      const payload: InvoiceFormData = {
        customer_id: resolvedCustomerId,
        create_customer: customerMode === 'new' && resolvedCustomerId === null,
        customer_name: resolvedCustomerName,
        customer_address: resolvedCustomerAddress,
        customer_phone: resolvedCustomerPhone,
        issue_date: issueDate,
        notes: notes.trim() || null,
        items: payloadItems,
      };

      const saved = isEdit && id
        ? await updateInvoice(id, payload)
        : await createInvoice(payload);

      notify(isEdit ? 'Factura actualizada.' : 'Factura creada.', 'success');
      navigate(`/facturas/${saved.id}`, { replace: true });
    } catch (cause) {
      // La factura ya se creó: navegar al detalle en lugar de arriesgar un duplicado.
      if (cause instanceof InvoiceRefetchError) {
        notify('Factura creada. Abriendo el detalle…', 'success');
        navigate(`/facturas/${cause.invoiceId}`, { replace: true });
        return;
      }
      setFormError(describeError(cause));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Spinner className="h-6 w-6 text-sky" />
        <p className="text-sm font-medium">
          {isEdit ? 'Cargando factura…' : 'Cargando datos…'}
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader
          title={isEdit ? 'Editar factura' : 'Nueva factura'}
          backTo={isEdit && id ? `/facturas/${id}` : '/facturas'}
        />
        <div className="card p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-3 text-sm font-semibold text-navy">{loadError}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void load()} className="btn btn-primary">
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

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Editar factura' : 'Nueva factura'}
        subtitle={
          isEdit
            ? 'Actualiza los datos de la factura y sus artículos.'
            : 'El número se asigna automáticamente al guardar.'
        }
        backTo={isEdit && id ? `/facturas/${id}` : '/facturas'}
      />

      {formError ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <section className="card p-4 sm:p-5">
            <h2 className="text-sm font-bold text-navy">Datos del cliente</h2>

            <div className="mt-3 inline-flex rounded-xl bg-surface p-1">
              <button
                type="button"
                onClick={() => handleModeChange('existing')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  customerMode === 'existing'
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Cliente existente
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('new')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  customerMode === 'new'
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                <UserRound className="h-3.5 w-3.5" />
                Nuevo cliente
              </button>
            </div>

            {customerMode === 'existing' ? (
              <div className="mt-4">
                <label className="label" htmlFor="customer-select">
                  Cliente
                </label>
                {customers.length === 0 ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    No hay clientes registrados. Usa la opción Nuevo cliente.
                  </p>
                ) : (
                  <select
                    id="customer-select"
                    value={customerId}
                    onChange={(event) => handleSelectCustomer(event.target.value)}
                    className="input"
                  >
                    <option value="">Selecciona un cliente…</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-sky-light px-3 py-2 text-xs font-medium text-navy">
                Al guardar, el cliente se registrará automáticamente en la lista de
                clientes.
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="customer-name">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="input"
                  placeholder="Nombre o razón social"
                />
              </div>
              <div>
                <label className="label" htmlFor="customer-address">
                  Dirección
                </label>
                <input
                  id="customer-address"
                  type="text"
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  className="input"
                  placeholder="Dirección del cliente"
                />
              </div>
              <div>
                <label className="label" htmlFor="customer-phone">
                  Teléfono
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  className="input"
                  placeholder="Teléfono del cliente"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="issue-date">
                  Fecha de emisión <span className="text-red-500">*</span>
                </label>
                <input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className="input sm:max-w-xs"
                />
              </div>
            </div>
          </section>

          <section className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-navy">Artículos</h2>
                <p className="text-xs text-slate-500">
                  {items.length} {items.length === 1 ? 'línea' : 'líneas'} en la factura
                </p>
              </div>
              <button type="button" onClick={addItem} className="btn btn-ghost btn-sm">
                <Plus className="h-4 w-4" />
                Agregar artículo
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {items.map((item, index) => {
                const lineTotal = roundMoney(
                  parseDecimal(item.quantity) * parseDecimal(item.unit_price),
                );
                return (
                  <div key={item.key} className="rounded-xl border border-line p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Artículo {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="icon-button inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label={`Eliminar artículo ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-12">
                      <div className="xl:col-span-2">
                        <label className="label" htmlFor={`${item.key}-qty`}>
                          Cantidad
                        </label>
                        <input
                          id={`${item.key}-qty`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.001"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.key, 'quantity', event.target.value)
                          }
                          className="input"
                          placeholder="0"
                        />
                      </div>
                      <div className="xl:col-span-4">
                        <label className="label" htmlFor={`${item.key}-desc`}>
                          Descripción
                        </label>
                        <input
                          id={`${item.key}-desc`}
                          type="text"
                          value={item.description}
                          onChange={(event) =>
                            updateItem(item.key, 'description', event.target.value)
                          }
                          className="input"
                          placeholder="Descripción del artículo"
                        />
                      </div>
                      <div className="xl:col-span-2">
                        <label className="label" htmlFor={`${item.key}-unit`}>
                          Unidad
                        </label>
                        <input
                          id={`${item.key}-unit`}
                          type="text"
                          list="unit-options"
                          value={item.unit}
                          onChange={(event) =>
                            updateItem(item.key, 'unit', event.target.value)
                          }
                          className="input"
                          placeholder="unidad"
                        />
                      </div>
                      <div className="xl:col-span-2">
                        <label className="label" htmlFor={`${item.key}-price`}>
                          Precio unit.
                        </label>
                        <input
                          id={`${item.key}-price`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(event) =>
                            updateItem(item.key, 'unit_price', event.target.value)
                          }
                          className="input"
                          placeholder="0,00"
                        />
                      </div>
                      <div className="col-span-2 xl:col-span-2">
                        <span className="label">Total</span>
                        <div className="flex min-h-[42px] items-center justify-end rounded-xl bg-surface px-3 py-2 text-right text-sm font-bold text-navy">
                          <Money value={lineTotal} invoice={currency} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <datalist id="unit-options">
              {UNITS.map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
          </section>

          <section className="card p-4 sm:p-5">
            <label className="label" htmlFor="invoice-notes">
              Notas (opcional)
            </label>
            <textarea
              id="invoice-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Observaciones que se mostrarán en la factura…"
            />
          </section>
        </div>

        <div>
          <div className="card p-5 lg:sticky lg:top-20">
            <h2 className="text-sm font-bold text-navy">Resumen</h2>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Artículos</span>
                <span className="font-semibold text-navy">
                  {items.filter((item) => item.description.trim() !== '').length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Cliente</span>
                <span className="max-w-[60%] break-words text-right font-semibold text-navy">
                  {customerName.trim() || 'Sin definir'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Fecha</span>
                <span className="font-semibold text-navy">
                  {issueDate ? issueDate.split('-').reverse().join('/') : '—'}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-navy px-4 py-3 text-white">
              <span className="text-xs font-semibold uppercase tracking-wide">Total</span>
              <Money value={itemsTotal} invoice={currency} className="text-right text-lg font-extrabold" />
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="btn btn-primary w-full"
                disabled={saving}
              >
                {saving ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isEdit ? 'Guardar cambios' : 'Guardar factura'}
              </button>
              <Link
                to={isEdit && id ? `/facturas/${id}` : '/facturas'}
                className="btn btn-ghost w-full"
              >
                Cancelar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
