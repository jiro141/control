export type InvoiceStatus = 'pendiente' | 'parcial' | 'pagada' | 'anulada';

export type ProfileRole = 'admin' | 'viewer' | 'pending';

export type PaymentMethod =
  | 'efectivo'
  | 'transferencia'
  | 'pago móvil'
  | 'zelle'
  | 'otro';

export interface Profile {
  id: string;
  full_name: string | null;
  role: ProfileRole;
  created_at: string;
}

export interface Settings {
  id: number;
  business_name: string;
  currency_code: string;
  currency_symbol: string;
  phone_primary: string;
  phone_secondary: string;
  address: string | null;
  tax_id: string | null;
  website: string | null;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface CustomerSummary extends Customer {
  invoice_count: number;
  outstanding: CustomerBalance[];
  unknown_currency: boolean;
}

export interface CustomerBalance {
  currency_code: string;
  currency_symbol: string;
  amount: number;
}

export interface Invoice {
  id: string;
  number: number;
  customer_id: string | null;
  customer_name: string;
  customer_address: string | null;
  customer_phone: string | null;
  issue_date: string;
  notes: string | null;
  total: number;
  currency_code: string;
  currency_symbol: string;
  voided_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceBalance extends Invoice {
  paid_amount: number;
  balance: number;
  status: InvoiceStatus;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  position: number;
  quantity: number;
  description: string;
  unit: string;
  unit_price: number;
  line_total: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  paid_at: string;
  method: string;
  note: string | null;
  created_at: string;
  voided_at: string | null;
}

export interface InvoiceInputItem {
  quantity: number;
  description: string;
  unit: string;
  unit_price: number;
}

export interface InvoiceFormData {
  customer_id: string | null;
  create_customer: boolean;
  customer_name: string;
  customer_address: string | null;
  customer_phone: string | null;
  issue_date: string;
  notes: string | null;
  items: InvoiceInputItem[];
}

export interface CustomerInput {
  name: string;
  address: string | null;
  phone: string | null;
  notes: string | null;
}

export interface PaymentInput {
  invoice_id: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  note: string | null;
}

export type SettingsInput = Omit<Settings, 'id' | 'updated_at' | 'currency_code' | 'currency_symbol'>;
