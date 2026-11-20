import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { summarizeCustomers } from '../src/lib/customerSummary.ts';
import { readCustomers, readInvoiceBalances } from '../src/lib/dashboardQueries.ts';

const customers = [
  { id: 'selected', name: 'Maderas del Sur' },
  { id: 'other', name: 'Maderas del Sur' },
];
const usd = { currency_code: 'USD', currency_symbol: 'US$' };
const cop = { currency_code: 'COP', currency_symbol: '$' };

test('reads the directory for an authenticated viewer independently of the invoice view', async () => {
  const database = createClient('https://example.invalid', 'test-key', {
    accessToken: async () => 'viewer-token',
    global: {
      fetch: async (input, options) => {
        const url = new URL(input);
        assert.equal(new Headers(options.headers).get('authorization'), 'Bearer viewer-token');
        if (url.pathname === '/rest/v1/invoice_balances') {
          return Response.json({ code: '42501', message: 'permission denied' }, { status: 403 });
        }
        assert.equal(url.pathname, '/rest/v1/customers');
        assert.equal(url.searchParams.get('order'), 'name.asc,id.asc');
        const offset = Number(url.searchParams.get('offset'));
        return Response.json(customers.slice(offset, offset + 1));
      },
    },
  });

  await assert.rejects(readInvoiceBalances(database), { code: '42501' });
  assert.deepEqual(await readCustomers(database), customers);
});

test('associates earlier invoice records to the selected customer and uses the business currency', () => {
  const invoices = [
    { customer_id: 'selected', status: 'parcial', balance: '125.25' },
    { customer_id: 'other', status: 'pendiente', balance: '5.25' },
    { customer_id: null, customer_name: 'Maderas del Sur', status: 'pendiente', balance: 200 },
  ];
  const result = summarizeCustomers(customers, invoices, usd);

  assert.deepEqual(result.customers[0].outstanding, [{ ...usd, amount: 125.25 }]);
  assert.deepEqual(result.customers[1].outstanding, [{ ...usd, amount: 5.25 }]);
  assert.deepEqual(result.outstanding, [{ ...usd, amount: 130.5 }]);
  assert.equal(result.customers[0].invoice_count, 1);
});

test('separates currencies and omits cancelled invoices from customer balances', () => {
  const invoices = [
    { ...usd, customer_id: 'selected', status: 'parcial', balance: 20.1 },
    { ...usd, customer_id: 'selected', status: 'pendiente', balance: 0.2 },
    { ...cop, customer_id: 'selected', status: 'parcial', balance: 1000 },
    { ...cop, customer_id: 'selected', status: 'pagada', balance: -50 },
    { ...usd, customer_id: 'selected', status: 'anulada', balance: 35 },
    { ...cop, customer_id: 'other', status: 'parcial', balance: 5, voided_at: '2026-01-01' },
  ];
  const result = summarizeCustomers(customers, invoices, cop);
  assert.deepEqual(result.outstanding, [{ ...cop, amount: 1000 }, { ...usd, amount: 20.3 }]);
  assert.deepEqual(result.customers[0].outstanding, result.outstanding);
  assert.equal(result.customers[0].invoice_count, 4);
  assert.equal(result.customers[1].invoice_count, 0);
});

test('reports an unidentified older currency without adding it to another currency total', () => {
  const result = summarizeCustomers(customers, [
    { customer_id: 'selected', status: 'pendiente', balance: 80 },
    { ...cop, customer_id: 'selected', status: 'pendiente', balance: 20 },
  ], null);
  assert.equal(result.unknownCurrency, true);
  assert.equal(result.customers[0].unknown_currency, true);
  assert.deepEqual(result.outstanding, [{ ...cop, amount: 20 }]);
});
