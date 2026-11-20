import { supabase } from './supabase';
import { describeError } from './errors';
import type {
  Customer,
  CustomerInput,
  CustomerSummary,
  InvoiceBalance,
  InvoiceFormData,
  InvoiceItem,
  Payment,
  PaymentInput,
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

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) fail(error);
  if (!data) {
    throw new Error(
      'No se encontró la configuración del negocio. Ejecuta supabase/schema.sql en Supabase.',
    );
  }
  return data as unknown as Settings;
}

export async function saveSettings(input: SettingsInput): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .update({
      business_name: input.business_name.trim(),
      currency_code: input.currency_code.trim(),
      currency_symbol: input.currency_symbol.trim() || '$',
      phone_primary: input.phone_primary.trim(),
      phone_secondary: input.phone_secondary.trim(),
      address: cleanText(input.address),
      tax_id: cleanText(input.tax_id),
      website: cleanText(input.website),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select('*')
    .maybeSingle();
  if (error) fail(error);
  if (!data) {
    throw new Error(
      'No se encontró la configuración del negocio. Ejecuta supabase/schema.sql en Supabase.',
    );
  }
  return data as unknown as Settings;
}

export async function fetchCustomers(): Promise<CustomerSummary[]> {
  const [customersResult, invoicesResult] = await Promise.all([
    supabase.from('customers').select('*').order('name', { ascending: true }),
    supabase.from('invoice_balances').select('customer_id,total,balance'),
  ]);
  if (customersResult.error) fail(customersResult.error);
  if (invoicesResult.error) fail(invoicesResult.error);

  const customers = (customersResult.data ?? []) as unknown as Customer[];
  const invoices = (invoicesResult.data ?? []) as unknown as Pick<
    InvoiceBalance,
    'customer_id' | 'total' | 'balance'
  >[];

  const stats = new Map<string, { count: number; outstanding: number }>();
  for (const invoice of invoices) {
    if (!invoice.customer_id) continue;
    const current = stats.get(invoice.customer_id) ?? { count: 0, outstanding: 0 };
    current.count += 1;
    current.outstanding += Math.max(0, Number(invoice.balance) || 0);
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
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) fail(error);
}

export async function fetchInvoices(): Promise<InvoiceBalance[]> {
  const { data, error } = await supabase
    .from('invoice_balances')
    .select('*')
    .order('number', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as InvoiceBalance[];
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
  const { data, error } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('position', { ascending: true });
  if (error) fail(error);
  return (data ?? []) as unknown as InvoiceItem[];
}

export async function fetchPayments(invoiceId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('paid_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as Payment[];
}

export async function fetchAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('paid_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as Payment[];
}

function itemsPayload(invoiceId: string, items: InvoiceFormData['items']) {
  return items.map((item, index) => ({
    invoice_id: invoiceId,
    position: index,
    quantity: item.quantity,
    description: item.description.trim(),
    unit: item.unit.trim() || 'unidad',
    unit_price: item.unit_price,
  }));
}

function headerPayload(form: InvoiceFormData) {
  return {
    customer_id: form.customer_id,
    customer_name: form.customer_name.trim(),
    customer_address: cleanText(form.customer_address),
    customer_phone: cleanText(form.customer_phone),
    issue_date: form.issue_date,
    notes: cleanText(form.notes),
  };
}

export async function createInvoice(form: InvoiceFormData): Promise<InvoiceBalance> {
  if (form.items.length === 0) {
    throw new Error('La factura debe tener al menos un artículo.');
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert(headerPayload(form))
    .select('id')
    .single();
  if (error) fail(error);

  const invoiceId = (data as { id: string }).id;

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(itemsPayload(invoiceId, form.items));
  if (itemsError) {
    await supabase.from('invoices').delete().eq('id', invoiceId);
    fail(itemsError);
  }

  return fetchInvoice(invoiceId);
}

export async function updateInvoice(
  id: string,
  form: InvoiceFormData,
): Promise<InvoiceBalance> {
  if (form.items.length === 0) {
    throw new Error('La factura debe tener al menos un artículo.');
  }

  const { error: headerError } = await supabase
    .from('invoices')
    .update(headerPayload(form))
    .eq('id', id);
  if (headerError) fail(headerError);

  const { error: deleteError } = await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', id);
  if (deleteError) fail(deleteError);

  const { error: insertError } = await supabase
    .from('invoice_items')
    .insert(itemsPayload(id, form.items));
  if (insertError) fail(insertError);

  return fetchInvoice(id);
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) fail(error);
}

export async function addPayment(input: PaymentInput): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      invoice_id: input.invoice_id,
      amount: input.amount,
      paid_at: input.paid_at,
      method: input.method,
      note: cleanText(input.note),
    })
    .select('*')
    .single();
  if (error) fail(error);
  return data as unknown as Payment;
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', id);
  if (error) fail(error);
}
