const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { PGlite } = require('./package/dist/index.cjs')
const { pgcrypto } = require('./package/dist/contrib/pgcrypto.cjs')

const migration = readFileSync('supabase/migrations/20261119000000_control_hardening.sql', 'utf8')
const oldSchema = execFileSync('git', ['show', 'HEAD:supabase/schema.sql'], { encoding: 'utf8' })
const admin = '11111111-1111-1111-1111-111111111111'
const viewer = '22222222-2222-2222-2222-222222222222'
const pending = '33333333-3333-3333-3333-333333333333'
const existing = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const oldAdmin = '44444444-4444-4444-4444-444444444444'
const existingInvoice = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const line = (price) => JSON.stringify([{ quantity: 2, unit_price: price, description: 'Tabla' }])
const create = 'select public.create_invoice(null, $1, null, null, null, null, $2, $3) as id'
const edit = 'select public.update_invoice($1, null, $2, null, null, null, null, $3, $4) as id'
const pay = 'select public.add_payment($1, $2, null, null, null) as id'

async function checks(legacy) {
  const db = new PGlite({ extensions: { pgcrypto } })
  async function scalar(sql, args) {
    const { rows } = await db.query(sql, args)
    return Object.values(rows[0])[0]
  }
  async function signedIn(id) {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
    await db.exec('set role authenticated')
  }
  async function signup(id) {
    await db.exec('reset role')
    await db.query("insert into auth.users(id, email) values ($1, $2)", [id, id + '@example.test'])
  }
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      grant usage on schema auth to authenticated, anon;
    `)
    if (legacy) {
      await signup(existing)
      await db.exec(oldSchema)
      await signup(admin)
      await signup(oldAdmin)
      await db.exec("update public.settings set currency_code = 'EUR', currency_symbol = '€'")
      await db.query("insert into public.invoices(id, customer_name) values ($1,'Histórico')", [existingInvoice])
      await db.query("insert into public.invoice_items(invoice_id,quantity,description,unit_price) values ($1,1,'Viga',100)", [existingInvoice])
      await db.query("insert into public.payments(invoice_id,amount) values ($1,10)", [existingInvoice])
    }
    await db.exec(migration)
    if (!legacy) await signup(admin)
    await signup(viewer)
    await signup(pending)
    await signedIn(admin)
    assert.equal(await scalar("select role from public.profiles"), 'admin')
    assert.equal(await scalar("select (public.set_profile_role($1,'viewer')).role", [viewer]), 'viewer')
    await assert.rejects(db.query("select public.set_profile_role($1,'viewer')", [admin]), /No autorizado/)
    const invoice = await scalar(create, ['Cliente de prueba', line(30), true])
    assert.equal(await scalar("select currency_code from public.invoice_balances where id=$1", [invoice]), 'COP')
    assert.equal(await scalar("select count(*)::int from public.customers where name='Cliente de prueba'"), 1)
    const firstPayment = await scalar(pay, [invoice, 20])
    await assert.rejects(db.query(pay, [invoice, 40.005]), /supera el saldo/)
    await assert.rejects(db.query(edit, [invoice, 'Alta fallida', line(5), true]), /inferior a los abonos/)
    assert.equal(await scalar("select count(*)::int from public.customers where name='Alta fallida'"), 0)
    assert.equal(await scalar("select total from public.invoice_balances where id=$1", [invoice]), '60.00')
    await assert.rejects(db.query(create, ['Renglón inválido', line(-1), true]), /invoice_items_valid_values/)
    assert.equal(await scalar("select count(*)::int from public.customers where name='Renglón inválido'"), 0)
    await assert.rejects(db.query('delete from public.payments where id=$1', [firstPayment]), /permission denied/)

    for (const reader of [viewer, pending]) {
      await signedIn(reader)
      assert.equal(await scalar('select currency_code from public.settings'), 'COP')
      assert.equal(await scalar('select balance from public.invoice_balances where id=$1', [invoice]), '40.00')
      await assert.rejects(db.query(pay, [invoice, 1]), /Solo los administradores/)
      await assert.rejects(db.query('select public.list_profiles()'), /Solo los administradores/)
    }
    await db.exec('reset role; set role anon')
    await assert.rejects(db.query('select * from public.invoice_balances'), /permission denied/)
    await signedIn(admin)
    await db.query('select public.void_payment($1)', [firstPayment])
    assert.equal(await scalar('select voided_by from public.payments where id=$1', [firstPayment]), admin)
    assert.equal(await scalar('select balance from public.invoice_balances where id=$1', [invoice]), '60.00')
    const secondPayment = await scalar(pay, [invoice, 10])
    await db.query('select public.void_invoice($1)', [invoice])
    assert.equal(await scalar('select status from public.invoice_balances where id=$1', [invoice]), 'anulada')
    assert.equal(await scalar('select voided_by from public.invoice_balances where id=$1', [invoice]), admin)
    assert.equal(await scalar('select amount from public.payments where id=$1', [secondPayment]), '10.00')
    await assert.rejects(db.query(pay, [invoice, 1]), /factura anulada/)
    await assert.rejects(db.query(edit, [invoice, 'No edita', line(70), false]), /factura anulada/)

    await db.exec('reset role')
    await db.exec(migration)
    await signedIn(admin)
    assert.equal(await scalar('select status from public.invoice_balances where id=$1', [invoice]), 'anulada')
    if (legacy) {
      assert.equal(await scalar('select currency_code from public.invoice_balances where id=$1', [existingInvoice]), 'EUR')
      assert.equal(await scalar('select currency_symbol from public.invoice_balances where id=$1', [existingInvoice]), '€')
      assert.equal(await scalar('select balance from public.invoice_balances where id=$1', [existingInvoice]), '90.00')
      assert.equal(await scalar('select role from public.list_profiles() where id=$1', [existing]), 'pending')
      assert.equal(await scalar('select role from public.list_profiles() where id=$1', [oldAdmin]), 'admin')
    }
    console.log(legacy ? 'HEAD upgrade and rerun passed' : 'Fresh install and rerun passed')
  } finally {
    await db.close()
  }
}

checks(false).then(() => checks(true)).catch((error) => {
  console.error({ message: error.message, position: error.position, where: error.where, code: error.code, query: error.query?.slice(0, 80), stack: error.stack?.split('\n').slice(0, 4) })
  process.exitCode = 1
})
