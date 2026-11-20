\set ON_ERROR_STOP on

-- Run in an empty test database, never an existing application database.
do $$
begin
  if current_database() not like 'control_test\_%'
    or to_regclass('auth.users') is not null
    or to_regclass('public.invoices') is not null then
    raise exception 'La prueba requiere una base vacía con nombre control_test_*';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end;
$$;

create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to authenticated, anon;
set plpgsql.check_asserts = on;

\if :{?legacy_schema}
insert into auth.users (id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
\i :legacy_schema
insert into auth.users (id)
values ('11111111-1111-1111-1111-111111111111'), ('44444444-4444-4444-4444-444444444444');
update public.settings set currency_code = 'EUR', currency_symbol = '€';
insert into public.invoices (id, customer_name)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Histórico');
insert into public.invoice_items (invoice_id, quantity, description, unit_price)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'Viga', 100);
insert into public.payments (invoice_id, amount)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 10);
\endif

\ir ../migrations/20261119000000_control_hardening.sql

\if :{?legacy_schema}
do $$
begin
  assert (select currency_code = 'EUR' and currency_symbol = '€' and balance = 90
  from public.invoice_balances where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  assert (select role = 'pending' from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  assert (select role = 'admin' from public.profiles where id = '44444444-4444-4444-4444-444444444444');
end;
$$;
\else
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
\endif
insert into auth.users (id)
values ('22222222-2222-2222-2222-222222222222'), ('33333333-3333-3333-3333-333333333333');

do $$
declare
  admin_id constant uuid := '11111111-1111-1111-1111-111111111111';
  viewer_id constant uuid := '22222222-2222-2222-2222-222222222222';
  pending_id constant uuid := '33333333-3333-3333-3333-333333333333';
  invoice_id uuid;
  payment_id uuid;
  reader_id uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  assert (select role = 'admin' from public.profiles);
  assert (public.set_profile_role(viewer_id, 'viewer')).role = 'viewer';
  begin
    perform public.set_profile_role(admin_id, 'viewer');
    raise exception 'Se cambió el rol del administrador actual';
  exception when insufficient_privilege then null;
  end;
  invoice_id := public.create_invoice(null, 'Cliente de prueba', null, null, null, null,
    '[{"quantity":2,"unit_price":30,"description":"Tabla"}]', true);
  assert (select currency_code = 'COP' and total = 60 from public.invoice_balances where id = invoice_id);
  assert (select count(*) = 1 from public.customers where name = 'Cliente de prueba');

  payment_id := public.add_payment(invoice_id, 20, null, null, null);
  begin
    perform public.add_payment(invoice_id, 40.005, null, null, null);
    raise exception 'Se admitió un monto que redondea por encima del saldo';
  exception when raise_exception then
    if sqlerrm not like '%supera el saldo%' then raise; end if;
  end;
  begin
    perform public.update_invoice(invoice_id, null, 'Alta fallida', null, null, null, null,
      '[{"quantity":2,"unit_price":5,"description":"Tabla"}]', true);
    raise exception 'Se admitió un total inferior a los abonos';
  exception when raise_exception then
    if sqlerrm not like '%inferior a los abonos%' then raise; end if;
  end;
  assert (select total = 60 from public.invoice_balances where id = invoice_id);
  assert (select count(*) = 0 from public.customers where name = 'Alta fallida');
  begin
    perform public.create_invoice(null, 'Línea inválida', null, null, null, null,
      '[{"quantity":2,"unit_price":-1,"description":"Tabla"}]', true);
    raise exception 'Se admitió un precio negativo';
  exception when check_violation then null;
  end;
  assert (select count(*) = 0 from public.customers where name = 'Línea inválida');
  begin
    delete from public.payments where id = payment_id;
    raise exception 'Se pudo borrar un pago directamente';
  exception when insufficient_privilege then null;
  end;

  foreach reader_id in array array[viewer_id, pending_id] loop
    perform set_config('request.jwt.claim.sub', reader_id::text, true);
    assert (select currency_code = 'COP' from public.settings);
    assert (select balance = 40 from public.invoice_balances where id = invoice_id);
    begin
      perform public.add_payment(invoice_id, 1, null, null, null);
      raise exception 'Se registró un pago sin permisos';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.list_profiles();
      raise exception 'Se expusieron perfiles ajenos';
    exception when insufficient_privilege then null;
    end;
  end loop;

  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform 1 from public.invoice_balances;
    raise exception 'Los datos se expusieron a un rol anónimo';
  exception when insufficient_privilege then null;
  end;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.void_payment(payment_id);
  assert (select voided_by = admin_id and voided_at is not null from public.payments where id = payment_id);
  assert (select balance = 60 from public.invoice_balances where id = invoice_id);
  payment_id := public.add_payment(invoice_id, 10, null, null, null);
  perform public.void_invoice(invoice_id);
  assert (select status = 'anulada' and voided_by = admin_id and voided_at is not null
    from public.invoice_balances where id = invoice_id);
  assert (select amount = 10 from public.payments where id = payment_id);
  begin
    perform public.add_payment(invoice_id, 1, null, null, null);
    raise exception 'Se admitió un pago en una factura anulada';
  exception when raise_exception then
    if sqlerrm not like '%factura anulada%' then raise; end if;
  end;
  begin
    perform public.update_invoice(invoice_id, null, 'No edita', null, null, null, null,
      '[{"quantity":2,"unit_price":70,"description":"Tabla"}]', false);
    raise exception 'Se admitió la edición de una factura anulada';
  exception when raise_exception then
    if sqlerrm not like '%factura anulada%' then raise; end if;
  end;
end;
$$;

reset role;
\ir ../migrations/20261119000000_control_hardening.sql
do $$
begin
  assert (select count(*) = 1 from public.invoice_balances where status = 'anulada');
end;
$$;
