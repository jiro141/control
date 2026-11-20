import { useSettings } from '../context/SettingsContext';
import { formatMoney } from '../lib/format';

interface MoneyProps {
  value: number | string | null | undefined;
  className?: string;
  symbol?: string;
}

export function Money({ value, className, symbol }: MoneyProps) {
  const { settings } = useSettings();
  const resolvedSymbol = symbol ?? settings?.currency_symbol ?? '$';
  return <span className={className}>{formatMoney(value, resolvedSymbol)}</span>;
}
