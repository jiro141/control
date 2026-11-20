export const MONTHS_SHORT_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

export const MONTHS_LONG_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const numberFormatter = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDecimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const cleaned = value.trim().replace(/\s/g, '');
  // In es-CO a dot followed by exactly three digits is a grouping separator.
  if (/^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  if (/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(cleaned)) {
    return Number(cleaned.replace(',', '.'));
  }
  if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(cleaned)) {
    return Number(cleaned.replace(/,/g, ''));
  }
  return NaN;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const BUSINESS_CURRENCY = { currency_code: 'COP', currency_symbol: '$' } as const;

export function invoiceCurrency(invoice?: { currency_code?: string; currency_symbol?: string } | null) {
  return {
    currency_code: invoice?.currency_code || BUSINESS_CURRENCY.currency_code,
    currency_symbol: invoice?.currency_symbol || BUSINESS_CURRENCY.currency_symbol,
  };
}

export function formatMoney(
  value: number | string | null | undefined,
  symbol: string = BUSINESS_CURRENCY.currency_symbol,
  code?: string,
): string {
  const amount = toNumber(value);
  const sign = amount < 0 ? '-' : '';
  const formatted = `${sign}${symbol}${numberFormatter.format(Math.abs(amount))}`;
  return code ? `${formatted} ${code}` : formatted;
}

export function formatQuantity(value: number | string | null | undefined): string {
  return quantityFormatter.format(toNumber(value));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${parsed.getFullYear()}`;
}

export function formatMonthKey(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return key;
  return `${MONTHS_LONG_ES[month - 1]} ${year}`;
}

export function todayISO(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function monthKeyOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function formatInvoiceNumber(value: number): string {
  return String(Math.trunc(toNumber(value))).padStart(4, '0');
}

export function sanitizeFileName(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'archivo';
}

export function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}
