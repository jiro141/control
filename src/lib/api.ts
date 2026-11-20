import { supabase } from './supabase';
import { describeError } from './errors';
import { BUSINESS_CURRENCY } from './format';
import { readAllPages } from './pagination';
import type {
  Customer,
  CustomerInput,
  CustomerSummary,
  InvoiceBalance,
  InvoiceFormData,
  InvoiceItem,
  Payment,
  PaymentInput,
  Profile,
  ProfileRole,
  Settings,
  SettingsInput,
} from '../types/database';

function fail(error: unknown): never {
  throw new Error(describeError(error));
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function fetchProfiles(): Promise<Profile[]> {
  try {
    return await readAllPages<Profile>((from, to) =>
      supabase.rpc('list_profiles').order('created_at').order('id').range(from, to),
    );
  } catch (error) {
    fail(error);
  }
}

export async function setProfileRole(userId: string, role: ProfileRole): Promise<void> {
  const { error } = await supabase.rpc('set_profile_role', { p_user_id: userId, p_role: role });
  if (error) fail(error);
}

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) fail(error);
  if (!data) {
    throw new Error(
      'No se encontró la configuración del negocio. Aplica la migración indicada en el README.',
    );
  }
  return data as unknown as Settings;
}

export async function saveSettings(input: SettingsInput): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .upsert({
      id: 1,
      business_name: input.business_name.trim(),
      ...BUSINESS_CURRENCY,
      phone_primary: input.phone_primary.trim(),
      phone_secondary: input.phone_secondary.trim(),
      address: cleanText(input.address),
      tax_id: cleanText(input.tax_id),
      website: cleanText(input.website),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .maybeSingle();
  if (error) fail(error);
  if (!data) {
    throw new Error(
      'No se encontró la configuración del negocio. Aplica la migración indicada en el README.',
    );
  }
  return data as unknown as Settings;
}

export async function fetchCustomers(): Promise<CustomerSummary[]> {
  const [customers, invoices] = await Promise.all([
    readAllPages<Customer>((from, to) =>
      supabase.from('customers').select('*').order('name').order('id').range(from, to),
    ),
    readAllPages<Pick<InvoiceBalance, 'customer_id' | 'balance' | 'currency_code'>>((from, to) =>
      supabase.from('invoice_balances').select('customer_id,balance,currency_code')
        .is('voided_at', null).order('id').range(from, to),
    ),
  ]).catch(fail);

  const stats = new Map<string, { count: number; outstanding: number }>();
  for (const invoice of invoices) {
    if (!invoice.customer_id) continue;
    const current = stats.get(invoice.customer_id) ?? { count: 0, outstanding: 0 };
    current.count += 1;
    if (invoice.currency_code === BUSINESS_CURRENCY.currency_code) {
      current.outstanding += Math.max(0, Number(invoice.balance) || 0);
    }
    stats.set(invoice.customer_id, current);
  }

  return customers.map((customer) => {
    const stat = stats.get(customer.id) ?? { count: 0, outstanding: 0 };
    return {
      ...customer,
      invoice_count: stat.count,
      outstanding: Math.round(stat.outstanding * 100) / 100,
    };
  });
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: input.name.trim(),
      address: cleanText(input.address),
      phone: cleanText(input.phone),
      notes: cleanText(input.notes),
    })
    .select('*')
    .single();
  if (error) fail(error);
  return data as unknown as Customer;
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      name: input.name.trim(),
      address: cleanText(input.address),
      phone: cleanText(input.phone),
      notes: cleanText(input.notes),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) fail(error);
  return data as unknown as Customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) fail(error);
  if (!data || data.length === 0) {
    throw new Error('No se encontró el cliente o no tienes permisos para eliminarlo.');
  }
}

export async function fetchInvoices(): Promise<InvoiceBalance[]> {
  return readAllPages<InvoiceBalance>((from, to) =>
    supabase.from('invoice_balances').select('*').order('number', { ascending: false }).range(from, to),
  ).catch(fail);
}

export async function fetchInvoice(id: string): Promise<InvoiceBalance> {
  const { data, error } = await supabase
    .from('invoice_balances')
    .select('*')
    .eq('id', id)
    .single();
  if (error) fail(error);
  return data as unknown as InvoiceBalance;
}

export async function fetchInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  return readAllPages<InvoiceItem>((from, to) =>
    supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId)
      .order('position').order('id').range(from, to),
  ).catch(fail);
}

export async function fetchPayments(invoiceId: string): Promise<Payment[]> {
  return readAllPages<Payment>((from, to) =>
    supabase.from('payments').select('*').eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false }).order('created_at', { ascending: false })
      .order('id').range(from, to),
  ).catch(fail);
}

export async function fetchAllPayments(): Promise<Payment[]> {
  return readAllPages<Payment>((from, to) =>
    supabase.from('payments').select('*').is('voided_at', null)
      .order('paid_at', { ascending: false }).order('id').range(from, to),
  ).catch(fail);
}

export class InvoiceRefetchError extends Error {
  readonly invoiceId: string;

  constructor(invoiceId: string, cause: unknown) {
    super(
      `La factura se creó (ID ${invoiceId}) pero no se pudo cargar su detalle: ${describeError(cause)}`,
    );
    this.name = 'InvoiceRefetchError';
    this.invoiceId = invoiceId;
  }
}

async function loadInvoiceWithRetry(invoiceId: string): Promise<InvoiceBalance> {
  try {
    return await fetchInvoice(invoiceId);
  } catch (firstError) {
    try {
      return await fetchInvoice(invoiceId);
    } catch (secondError) {
      throw new InvoiceRefetchError(invoiceId, secondError ?? firstError);
    }
  }
}

function invoiceRpcArgs(form: InvoiceFormData) {
  return {
    p_customer_id: form.customer_id,
    p_customer_name: form.customer_name.trim(),
    p_customer_address: cleanText(form.customer_address),
    p_customer_phone: cleanText(form.customer_phone),
    p_issue_date: form.issue_date,
    p_notes: cleanText(form.notes),
    p_items: form.items,
    p_create_customer: form.create_customer,
  };
}

export async function createInvoice(form: InvoiceFormData): Promise<InvoiceBalance> {
  if (form.items.length === 0) {
    throw new Error('La factura debe tener al menos un artículo.');
  }

  const { data, error } = await supabase.rpc('create_invoice', invoiceRpcArgs(form));
  if (error) fail(error);

  const invoiceId = data as string | null;
  if (!invoiceId) {
    throw new Error('No se pudo crear la factura.');
  }

  return loadInvoiceWithRetry(invoiceId);
}

export async function updateInvoice(
  id: string,
  form: InvoiceFormData,
): Promise<InvoiceBalance> {
  if (form.items.length === 0) {
    throw new Error('La factura debe tener al menos un artículo.');
  }

  const { error } = await supabase.rpc('update_invoice', {
    p_id: id,
    ...invoiceRpcArgs(form),
  });
  if (error) fail(error);

  return fetchInvoice(id);
}

export async function voidInvoice(id: string): Promise<void> {
  const { error } = await supabase.rpc('void_invoice', { p_id: id });
  if (error) fail(error);
}

export async function addPayment(input: PaymentInput): Promise<Payment> {
  const { data, error } = await supabase.rpc('add_payment', {
    p_invoice_id: input.invoice_id,
    p_amount: input.amount,
    p_paid_at: input.paid_at,
    p_method: input.method,
    p_note: cleanText(input.note),
  });
  if (error) {
    if (error.code === 'P0001') {
      throw new Error(error.message);
    }
    fail(error);
  }

  const paymentId = data as string | null;
  if (!paymentId) {
    throw new Error('No se pudo registrar el pago.');
  }

  const { data: row, error: rowError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (!rowError && row) {
    return row as unknown as Payment;
  }

  const fallback: Payment = {
    id: paymentId,
    invoice_id: input.invoice_id,
    amount: input.amount,
    paid_at: input.paid_at,
    method: input.method,
    note: cleanText(input.note),
    created_at: new Date().toISOString(),
    voided_at: null,
  };
  return fallback;
}

export async function voidPayment(id: string): Promise<void> {
  const { error } = await supabase.rpc('void_payment', { p_id: id });
  if (error) fail(error);
}
