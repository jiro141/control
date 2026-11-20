import type { Customer, CustomerBalance, CustomerSummary, InvoiceBalance } from '../types/database';

type Currency = Pick<CustomerBalance, 'currency_code' | 'currency_symbol'>;

function addBalance(balances: Map<string, CustomerBalance>, currency: Currency, amountInCents: number) {
  const existing = balances.get(currency.currency_code);
  if (existing) {
    existing.amount += amountInCents;
  } else {
    balances.set(currency.currency_code, {
      currency_code: currency.currency_code,
      currency_symbol: currency.currency_symbol,
      amount: amountInCents,
    });
  }
}

function sortedAmounts(balances: Map<string, CustomerBalance>): CustomerBalance[] {
  return [...balances.values()]
    .sort((left, right) => left.currency_code.localeCompare(right.currency_code))
    .map((balance) => ({ ...balance, amount: balance.amount / 100 }));
}

export function summarizeCustomers(
  customers: Customer[],
  invoices: InvoiceBalance[],
  legacyCurrency: Currency | null,
) {
  const byCustomer = new Map(customers.map((customer) => [
    customer.id,
    { count: 0, balances: new Map<string, CustomerBalance>(), unknownCurrency: false },
  ]));
  const totals = new Map<string, CustomerBalance>();
  let unknownCurrency = false;

  for (const invoice of invoices) {
    if (!invoice.customer_id || invoice.status === 'anulada' || invoice.voided_at) continue;
    const customer = byCustomer.get(invoice.customer_id);
    if (!customer) continue;
    customer.count += 1;

    const amount = Math.round(Number(invoice.balance) * 100);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const currency = invoice.currency_code
      ? { currency_code: invoice.currency_code, currency_symbol: invoice.currency_symbol }
      : legacyCurrency;

    if (!currency?.currency_code) {
      customer.unknownCurrency = true;
      unknownCurrency = true;
      continue;
    }

    addBalance(customer.balances, currency, amount);
    addBalance(totals, currency, amount);
  }

  const summaries: CustomerSummary[] = customers.map((customer) => {
    const stat = byCustomer.get(customer.id);
    return {
      ...customer,
      invoice_count: stat?.count ?? 0,
      outstanding: stat ? sortedAmounts(stat.balances) : [],
      unknown_currency: stat?.unknownCurrency ?? false,
    };
  });

  return { customers: summaries, outstanding: sortedAmounts(totals), unknownCurrency };
}
