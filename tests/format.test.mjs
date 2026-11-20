import assert from 'node:assert/strict';
import test from 'node:test';
import { BUSINESS_CURRENCY, formatMoney, invoiceCurrency } from '../src/lib/format.ts';

test('uses COP for new invoices', () => {
  assert.deepEqual(invoiceCurrency(), BUSINESS_CURRENCY);
  assert.equal(BUSINESS_CURRENCY.currency_code, 'COP');
  assert.equal(formatMoney(1234.5, '$', 'COP'), '$1.234,50 COP');
});

test('preserves a previously issued invoice currency', () => {
  const currency = invoiceCurrency({ currency_code: 'USD', currency_symbol: 'US$' });
  assert.deepEqual(currency, { currency_code: 'USD', currency_symbol: 'US$' });
  assert.equal(formatMoney(-1234.5, currency.currency_symbol, currency.currency_code), '-US$1.234,50 USD');
});
