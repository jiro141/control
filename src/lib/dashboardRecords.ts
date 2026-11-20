import type { InvoiceBalance, Payment, Settings } from '../types/database';

type Currency = Pick<Settings, 'currency_code' | 'currency_symbol'>;

interface CurrencyGroup {
  currency: Currency;
  invoices: InvoiceBalance[];
  payments: Payment[];
}

export function groupDashboardRecords(
  invoices: InvoiceBalance[],
  payments: Payment[],
  legacyCurrency: Currency,
  preferredCurrency: Currency,
) {
  const groups = new Map<string, CurrencyGroup>();
  const invoiceGroups = new Map<string, CurrencyGroup>();

  const history = invoices.map((invoice) => {
    const snapshot = invoice.currency_code ? invoice : legacyCurrency;
    const code = snapshot.currency_code;
    const currency = {
      currency_code: code,
      currency_symbol: snapshot.currency_symbol || preferredCurrency.currency_symbol,
    };
    const normalized = { ...invoice, ...currency };

    if (invoice.status !== 'anulada' && !invoice.voided_at) {
      let group = groups.get(code);
      if (!group) {
        group = {
          currency: code === preferredCurrency.currency_code ? preferredCurrency : currency,
          invoices: [],
          payments: [],
        };
        groups.set(code, group);
      }
      group.invoices.push(normalized);
      invoiceGroups.set(invoice.id, group);
    }
    return normalized;
  });

  for (const payment of payments) {
    if (!payment.voided_at) {
      invoiceGroups.get(payment.invoice_id)?.payments.push(payment);
    }
  }

  if (groups.size === 0) {
    groups.set(preferredCurrency.currency_code, {
      currency: preferredCurrency,
      invoices: [],
      payments: [],
    });
  }

  const defaultGroup = groups.get(preferredCurrency.currency_code) ?? [...groups.values()][0];
  return { groups, defaultGroup, history };
}
