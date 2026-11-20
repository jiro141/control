import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Money } from '../components/Money';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  fetchInvoices,
  updateCustomer,
} from '../lib/api';
import { summarizeCustomers } from '../lib/customerSummary';
import { describeError } from '../lib/errors';
import type { Customer, InvoiceBalance } from '../types/database';

const noInvoices: InvoiceBalance[] = [];

export function CustomersPage() {
  const { isAdmin } = useAuth();
  const { settings, loading: settingsLoading, refresh: refreshSettings } = useSettings();
  const { notify } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<InvoiceBalance[] | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchCustomers();
      setCustomers(loaded);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      setInvoices(await fetchInvoices());
    } catch (cause) {
      setInvoices(null);
      setInvoicesError(describeError(cause));
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadInvoices();
  }, [load, loadInvoices]);

  const summary = useMemo(
    () => summarizeCustomers(customers, invoices ?? noInvoices, settings),
    [customers, invoices, settings],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return summary.customers;
    return summary.customers.filter((customer) => {
      const haystack = [customer.name, customer.address ?? '', customer.phone ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [summary.customers, search]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setAddress('');
    setPhone('');
    setNotes('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setName(customer.name);
    setAddress(customer.address ?? '');
    setPhone(customer.phone ?? '');
    setNotes(customer.notes ?? '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    if (!name.trim()) {
      setFormError('Ingresa el nombre del cliente.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      };
      if (editing) {
        await updateCustomer(editing.id, payload);
        notify('Cliente actualizado.', 'success');
      } else {
        await createCustomer(payload);
        notify('Cliente creado.', 'success');
      }
      setModalOpen(false);
      await load();
    } catch (cause) {
      setFormError(describeError(cause));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteCustomer(deleteTarget.id);
      notify('Cliente eliminado.', 'success');
      setDeleteTarget(null);
      await load();
    } catch (cause) {
      notify(describeError(cause), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Consulta los clientes y sus saldos pendientes por moneda."
        actions={isAdmin ? (
          <button type="button" onClick={openCreate} className="btn btn-accent">
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </button>
        ) : null}
      />

      <div className="card mb-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input pl-9"
            placeholder="Buscar por nombre, dirección o teléfono…"
            aria-label="Buscar clientes"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {customers.length} {customers.length === 1 ? 'cliente registrado' : 'clientes registrados'}
          </span>
          {invoices && !invoicesLoading ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {summary.outstanding.length > 0 ? (
                <>
                  <span>Saldo pendiente total</span>
                  {summary.outstanding.map((balance) => (
                    <Money key={balance.currency_code} value={balance.amount} invoice={balance} className="font-bold text-navy" />
                  ))}
                </>
              ) : !summary.unknownCurrency ? <span>Sin saldo pendiente</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      {invoicesError ? (
        <div role="alert" className="card mb-4 flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <p className="text-sm font-semibold text-navy">No se pudieron cargar los saldos de los clientes.</p>
            <p className="text-sm text-slate-600">{invoicesError}</p>
          </div>
          <button type="button" onClick={() => void loadInvoices()} className="btn btn-ghost btn-sm">
            Reintentar saldos
          </button>
        </div>
      ) : null}
      {summary.unknownCurrency ? (
        <div role="status" className="card mb-4 flex flex-wrap items-center justify-between gap-2 p-4">
          <p className="text-sm text-slate-600">
            {settingsLoading ? 'Cargando la moneda de los saldos históricos…' : 'Hay saldos históricos cuya moneda no se pudo identificar.'}
          </p>
          {!settingsLoading ? (
            <button type="button" onClick={() => void refreshSettings()} className="btn btn-ghost btn-sm">
              Reintentar moneda
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
          <Spinner className="h-6 w-6 text-sky" />
          <p className="text-sm font-medium">Cargando clientes…</p>
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
          icon={Users}
          title={customers.length === 0 ? 'No hay clientes' : 'No se encontraron clientes'}
          description={
            customers.length === 0
              ? 'Agrega tu primer cliente o créalo directamente al emitir una factura.'
              : 'Prueba con otro término de búsqueda.'
          }
          action={isAdmin ? (
            <button type="button" onClick={openCreate} className="btn btn-accent btn-sm">
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </button>
          ) : null}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((customer) => (
            <article key={customer.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-navy">
                    {customer.name}
                  </h2>
                  {invoices && !invoicesLoading ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {customer.invoice_count}{' '}
                      {customer.invoice_count === 1 ? 'factura vigente' : 'facturas vigentes'}
                    </p>
                  ) : null}
                </div>
                {isAdmin ? <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(customer)}
                    className="icon-button inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface hover:text-navy"
                    aria-label={`Editar ${customer.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(customer)}
                    className="icon-button inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label={`Eliminar ${customer.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div> : null}
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                {customer.phone ? (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{customer.phone}</span>
                  </p>
                ) : null}
                {customer.address ? (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{customer.address}</span>
                  </p>
                ) : null}
              </div>

              {customer.notes ? (
                <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                  {customer.notes}
                </p>
              ) : null}

              {invoices && !invoicesLoading ? (
                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line pt-3 text-xs">
                  <span className="text-slate-500">Saldo pendiente</span>
                  {customer.outstanding.map((balance) => (
                    <Money key={balance.currency_code} value={balance.amount} invoice={balance} className="font-bold text-red-600" />
                  ))}
                  {customer.unknown_currency ? (
                    <span className="text-slate-600">Moneda histórica por identificar</span>
                  ) : customer.outstanding.length === 0 ? (
                    <span className="font-bold text-emerald-600">Sin saldo</span>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={isAdmin && modalOpen}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="customer-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? <Spinner className="h-4 w-4" /> : null}
              Guardar
            </button>
          </>
        }
      >
        <form
          id="customer-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <div>
            <label className="label" htmlFor="customer-form-name">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="customer-form-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input"
              placeholder="Nombre o razón social"
            />
          </div>
          <div>
            <label className="label" htmlFor="customer-form-address">
              Dirección
            </label>
            <input
              id="customer-form-address"
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="input"
              placeholder="Dirección"
            />
          </div>
          <div>
            <label className="label" htmlFor="customer-form-phone">
              Teléfono
            </label>
            <input
              id="customer-form-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="input"
              placeholder="Teléfono"
            />
          </div>
          <div>
            <label className="label" htmlFor="customer-form-notes">
              Notas
            </label>
            <textarea
              id="customer-form-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="input resize-none"
              placeholder="Observaciones internas"
            />
          </div>
          {formError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={isAdmin && Boolean(deleteTarget)}
        title="Eliminar cliente"
        message={`¿Confirmas que deseas eliminar a ${deleteTarget?.name ?? ''}? Las facturas asociadas se conservarán, pero quedarán sin cliente vinculado.`}
        confirmLabel="Eliminar cliente"
        destructive
        loading={deleteLoading}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
