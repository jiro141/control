export function excelCurrencyFormat(currency: { currency_symbol: string; currency_code: string }): string {
  const symbol = currency.currency_symbol.replace(/"/g, '').trim() || '$';
  const code = currency.currency_code.replace(/"/g, '').trim();
  return `"${symbol}"#,##0.00" ${code}"`;
}
