import type { SupabaseClient } from '@supabase/supabase-js';
import type { Customer, InvoiceBalance, Payment } from '../types/database';
import { readAllPages } from './pagination.ts';

type DatabaseReader = Pick<SupabaseClient, 'from'>;

export function readCustomers(database: DatabaseReader): Promise<Customer[]> {
  return readAllPages<Customer>((from, to) =>
    database.from('customers').select('*').order('name').order('id').range(from, to),
  );
}

export function readInvoiceBalances(database: DatabaseReader): Promise<InvoiceBalance[]> {
  return readAllPages<InvoiceBalance>((from, to) =>
    database.from('invoice_balances').select('*').order('number', { ascending: false }).range(from, to),
  );
}

export function readDashboardPayments(database: DatabaseReader): Promise<Payment[]> {
  // Older databases do not have a voided_at column. The dashboard excludes
  // annulments after reading the rows.
  return readAllPages<Payment>((from, to) =>
    database.from('payments').select('*').order('paid_at', { ascending: false }).order('id').range(from, to),
  );
}
