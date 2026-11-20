import { formatMoney, invoiceCurrency } from '../lib/format';

interface MoneyProps {
  value: number | string | null | undefined;
  className?: string;
  invoice?: { currency_code: string; currency_symbol: string };
}

export function Money({ value, className, invoice }: MoneyProps) {
  const { currency_symbol, currency_code } = invoiceCurrency(invoice);
  return (
    <span className={`money-amount ${className ?? ''}`}>
      {formatMoney(value, currency_symbol, currency_code)}
    </span>
  );
}
