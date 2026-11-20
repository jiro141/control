import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { readDashboardPayments, readInvoiceBalances } from '../src/lib/dashboardQueries.ts';
import { groupDashboardRecords } from '../src/lib/dashboardRecords.ts';
import { BUSINESS_CURRENCY } from '../src/lib/format.ts';

const usd = { currency_code: 'USD', currency_symbol: 'US$' };
const legacyInvoice = { id: 'old-invoice', number: 1, total: 200, status: 'parcial' };
const legacyPayment = { id: 'old-payment', invoice_id: legacyInvoice.id, amount: 50 };

test('reads invoices and payments from the earlier schema without querying new columns', async () => {
  const database = createClient('https://example.invalid', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        const url = new URL(input);
        const invoices = url.pathname.endsWith('/invoice_balances');
        assert.equal(url.pathname, invoices ? '/rest/v1/invoice_balances' : '/rest/v1/payments');
        assert.equal(url.searchParams.get('select'), '*');
        assert.equal(url.searchParams.get('order'), invoices ? 'number.desc' : 'paid_at.desc,id.asc');
        assert.equal(url.searchParams.has('voided_at'), false);
        assert.equal(url.searchParams.has('currency_code'), false);
        const rows = Number(url.searchParams.get('offset')) === 0 ? [invoices ? legacyInvoice : legacyPayment] : [];
        return Response.json(rows);
      },
    },
  });

  const [invoices, payments] = await Promise.all([
    readInvoiceBalances(database),
    readDashboardPayments(database),
  ]);
  const { defaultGroup } = groupDashboardRecords(invoices, payments, usd, BUSINESS_CURRENCY);

  assert.deepEqual(defaultGroup.currency, usd);
  assert.deepEqual(defaultGroup.invoices, [{ ...legacyInvoice, ...usd }]);
  assert.deepEqual(defaultGroup.payments, [legacyPayment]);
});

test('shows historical invoices when they are the only active currency', () => {
  const historical = { ...legacyInvoice, ...usd };
  const { defaultGroup } = groupDashboardRecords(
    [historical],
    [legacyPayment],
    BUSINESS_CURRENCY,
    BUSINESS_CURRENCY,
  );

  assert.deepEqual(defaultGroup.currency, usd);
  assert.equal(defaultGroup.invoices[0].total, 200);
  assert.equal(defaultGroup.payments[0].amount, 50);
});

test('separates currencies and leaves annulled invoices and payments out of totals', () => {
  const historical = { ...legacyInvoice, ...usd };
  const current = { ...legacyInvoice, ...BUSINESS_CURRENCY, id: 'current' };
  const cancelled = { ...current, id: 'cancelled', status: 'anulada' };
  const payment = { id: 'active', invoice_id: current.id, amount: 30 };
  const { groups, defaultGroup, history } = groupDashboardRecords(
    [historical, current, cancelled],
    [
      legacyPayment,
      payment,
      { id: 'voided-payment', invoice_id: current.id, amount: 10, voided_at: '2026-11-19' },
      { id: 'payment-of-voided-invoice', invoice_id: cancelled.id, amount: 25 },
    ],
    BUSINESS_CURRENCY,
    BUSINESS_CURRENCY,
  );

  assert.deepEqual(defaultGroup.invoices, [current]);
  assert.deepEqual(defaultGroup.payments, [payment]);
  assert.deepEqual(groups.get('USD').invoices, [historical]);
  assert.deepEqual(groups.get('USD').payments, [legacyPayment]);
  assert.deepEqual(history, [historical, current, cancelled]);
});
