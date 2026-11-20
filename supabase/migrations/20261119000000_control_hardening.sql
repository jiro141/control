-- =========================================================
-- Control de Ventas. Instalación y actualización del esquema.
-- =========================================================

begin;

-- Mantener el mismo orden de locks que el alta de usuarios antes de cambiar su trigger.
lock table auth.users in share row exclusive mode;

create extension if not exists pgcrypto;

-- Secuencia para numeración consecutiva de facturas
create sequence if not exists public.invoice_number_seq start 1;

-- Perfiles (1:1 con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.profiles alter column role set default 'pending';

-- Helper: ¿el usuario autenticado es administrador?
-- security definer para poder leer profiles aun con RLS activo.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- El primer perfil creado es admin; el resto queda pendiente de aprobación
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  perform pg_advisory_xact_lock(519202611190001);
  select case when exists (select 1 from public.profiles) then 'pending' else 'admin' end into v_role;
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
drop function if exists public.prevent_role_escalation();

-- Completar perfiles faltantes sin modificar permisos ya asignados.
insert into public.profiles (id, full_name, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', u.email), 'pending'
from auth.users u
on conflict (id) do nothing;

create or replace function public.list_profiles()
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden ver los perfiles' using errcode = '42501';
  end if;
  return query select * from public.profiles order by created_at, id;
end;
$$;

create or replace function public.set_profile_role(p_user_id uuid, p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  perform pg_catalog.pg_advisory_xact_lock(519202611190001);
  if not public.is_admin() or p_user_id = auth.uid() then
    raise exception 'No autorizado para cambiar ese rol' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'viewer', 'pending') then
    raise exception 'Rol no válido';
  end if;
  update public.profiles set role = p_role where id = p_user_id
  returning * into v_profile;
  if not found then
    raise exception 'El perfil no existe';
  end if;
  return v_profile;
end;
$$;

-- Configuración del negocio (fila única)
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'Venta de todo tipo de madera para minería',
  currency_code text not null default 'COP',
  currency_symbol text not null default '$',
  phone_primary text not null default '+58 424-6270112',
  phone_secondary text not null default '+57 314-2880642',
  address text,
  tax_id text,
  website text,
  updated_at timestamptz not null default now()
);

-- Clientes
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

-- Facturas (con snapshot del cliente)
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.invoice_number_seq'),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_address text,
  customer_phone text,
  issue_date date not null default current_date,
  notes text,
  total numeric(14,2) not null default 0,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Detalle de factura
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null default 0,
  quantity numeric(14,3) not null default 0,
  description text not null default '',
  unit text not null default 'unidad',
  unit_price numeric(14,2) not null default 0,
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored
);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- Pagos (abonos)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_at date not null default current_date,
  method text not null default 'efectivo',
  note text,
  created_at timestamptz not null default now()
);
create index if not exists payments_invoice_id_idx on public.payments (invoice_id);

-- La primera ejecución conserva la configuración de moneda disponible para el legado.
alter table public.invoices add column if not exists currency_code text;
alter table public.invoices add column if not exists currency_symbol text;
update public.invoices
set currency_code = coalesce(currency_code, (select nullif(btrim(currency_code), '') from public.settings where id = 1), 'USD'),
    currency_symbol = coalesce(currency_symbol, (select nullif(btrim(currency_symbol), '') from public.settings where id = 1), '$')
where currency_code is null or currency_symbol is null;
alter table public.invoices alter column currency_code set default 'COP';
alter table public.invoices alter column currency_code set not null;
alter table public.invoices alter column currency_symbol set default '$';
alter table public.invoices alter column currency_symbol set not null;

alter table public.settings alter column currency_code set default 'COP';
alter table public.settings alter column currency_symbol set default '$';
insert into public.settings (id) values (1) on conflict (id) do nothing;
update public.settings set currency_code = 'COP', currency_symbol = '$'
where currency_code is distinct from 'COP' or currency_symbol is distinct from '$';
alter table public.settings drop constraint if exists settings_cop_currency;
alter table public.settings add constraint settings_cop_currency
check (currency_code = 'COP' and currency_symbol = '$');

alter table public.invoices add column if not exists voided_at timestamptz;
alter table public.invoices add column if not exists voided_by uuid;
alter table public.payments add column if not exists voided_at timestamptz;
alter table public.payments add column if not exists voided_by uuid;

alter table public.invoice_items drop constraint if exists invoice_items_valid_values;
alter table public.invoice_items add constraint invoice_items_valid_values
check (
  quantity > 0 and quantity < 'Infinity'::numeric
  and unit_price >= 0 and unit_price < 'Infinity'::numeric
  and btrim(description) <> ''
) not valid;

-- Recalcular total de la factura cuando cambian sus líneas
create or replace function public.recalc_invoice_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  target := coalesce(new.invoice_id, old.invoice_id);
  update public.invoices
     set total = coalesce((select sum(line_total) from public.invoice_items where invoice_id = target), 0),
         updated_at = now()
   where id = target;
  return null;
end;
$$;

drop trigger if exists invoice_items_recalc on public.invoice_items;
create trigger invoice_items_recalc
after insert or update or delete on public.invoice_items
for each row execute function public.recalc_invoice_total();

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

-- Vista con pagos, saldo y estado
create or replace view public.invoice_balances
with (security_invoker = true) as
select
  i.id, i.number, i.customer_id, i.customer_name, i.customer_address, i.customer_phone,
  i.issue_date, i.notes, i.total, i.created_by, i.created_at, i.updated_at,
  coalesce(p.paid_amount, 0)::numeric(14,2) as paid_amount,
  (case when i.voided_at is null then i.total - coalesce(p.paid_amount, 0) else 0 end)::numeric(14,2) as balance,
  case
    when i.voided_at is not null then 'anulada'
    when coalesce(p.paid_amount, 0) >= i.total then 'pagada'
    when coalesce(p.paid_amount, 0) > 0 then 'parcial'
    else 'pendiente'
  end as status,
  i.currency_code, i.currency_symbol, i.voided_at, i.voided_by
from public.invoices i
left join (
  select invoice_id, sum(amount) as paid_amount
  from public.payments
  where voided_at is null
  group by invoice_id
) p on p.invoice_id = i.id;

-- =========================================================
-- Escrituras de facturación reservadas a RPC con autorización explícita.
-- =========================================================

drop function if exists public.create_invoice(uuid, text, text, text, date, text, jsonb);
drop function if exists public.update_invoice(uuid, uuid, text, text, text, date, text, jsonb);

create or replace function public.create_invoice(
  p_customer_id uuid,
  p_customer_name text,
  p_customer_address text,
  p_customer_phone text,
  p_issue_date date,
  p_notes text,
  p_items jsonb,
  p_create_customer boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_id uuid;
  v_item jsonb;
  v_position integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden crear facturas' using errcode = '42501';
  end if;
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'El nombre del cliente es obligatorio';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La factura debe tener al menos un artículo';
  end if;

  if p_create_customer then
    insert into public.customers (name, address, phone)
    values (
      btrim(p_customer_name),
      nullif(btrim(coalesce(p_customer_address, '')), ''),
      nullif(btrim(coalesce(p_customer_phone, '')), '')
    )
    returning id into p_customer_id;
  end if;

  insert into public.invoices (
    customer_id, customer_name, customer_address, customer_phone, issue_date, notes
  ) values (
    p_customer_id,
    btrim(p_customer_name),
    nullif(btrim(coalesce(p_customer_address, '')), ''),
    nullif(btrim(coalesce(p_customer_phone, '')), ''),
    coalesce(p_issue_date, current_date),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_invoice_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.invoice_items (
      invoice_id, position, quantity, description, unit, unit_price
    ) values (
      v_invoice_id,
      v_position,
      coalesce((v_item->>'quantity')::numeric, 0),
      coalesce(nullif(btrim(coalesce(v_item->>'description', '')), ''), ''),
      coalesce(nullif(btrim(coalesce(v_item->>'unit', '')), ''), 'unidad'),
      coalesce((v_item->>'unit_price')::numeric, 0)
    );
    v_position := v_position + 1;
  end loop;

  return v_invoice_id;
end;
$$;

create or replace function public.update_invoice(
  p_id uuid,
  p_customer_id uuid,
  p_customer_name text,
  p_customer_address text,
  p_customer_phone text,
  p_issue_date date,
  p_notes text,
  p_items jsonb,
  p_create_customer boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_position integer := 0;
  v_voided_at timestamptz;
  v_total numeric;
  v_paid numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden editar facturas' using errcode = '42501';
  end if;
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'El nombre del cliente es obligatorio';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La factura debe tener al menos un artículo';
  end if;

  select voided_at into v_voided_at from public.invoices where id = p_id for update;
  if not found then
    raise exception 'La factura no existe';
  end if;
  if v_voided_at is not null then
    raise exception 'No se puede editar una factura anulada';
  end if;

  if p_create_customer then
    insert into public.customers (name, address, phone)
    values (
      btrim(p_customer_name),
      nullif(btrim(coalesce(p_customer_address, '')), ''),
      nullif(btrim(coalesce(p_customer_phone, '')), '')
    )
    returning id into p_customer_id;
  end if;

  update public.invoices set
    customer_id = p_customer_id,
    customer_name = btrim(p_customer_name),
    customer_address = nullif(btrim(coalesce(p_customer_address, '')), ''),
    customer_phone = nullif(btrim(coalesce(p_customer_phone, '')), ''),
    issue_date = coalesce(p_issue_date, current_date),
    notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_id;

  delete from public.invoice_items where invoice_id = p_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.invoice_items (
      invoice_id, position, quantity, description, unit, unit_price
    ) values (
      p_id,
      v_position,
      coalesce((v_item->>'quantity')::numeric, 0),
      coalesce(nullif(btrim(coalesce(v_item->>'description', '')), ''), ''),
      coalesce(nullif(btrim(coalesce(v_item->>'unit', '')), ''), 'unidad'),
      coalesce((v_item->>'unit_price')::numeric, 0)
    );
    v_position := v_position + 1;
  end loop;

  select total into v_total from public.invoices where id = p_id;
  select coalesce(sum(amount), 0) into v_paid
  from public.payments where invoice_id = p_id and voided_at is null;
  if v_total < v_paid then
    raise exception 'El total de la factura no puede ser inferior a los abonos vigentes';
  end if;

  return p_id;
end;
$$;

create or replace function public.add_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_paid_at date,
  p_method text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
  v_paid numeric;
  v_payment_id uuid;
  v_amount numeric;
  v_voided_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden registrar pagos' using errcode = '42501';
  end if;
  select total, voided_at into v_total, v_voided_at
  from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'La factura no existe';
  end if;
  if v_voided_at is not null then
    raise exception 'No se puede registrar un pago en una factura anulada';
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where invoice_id = p_invoice_id and voided_at is null;

  v_amount := round(p_amount, 2);
  if v_amount is null or v_amount <= 0 or v_amount >= 'Infinity'::numeric then
    raise exception 'El monto debe ser mayor que cero';
  end if;

  if v_amount > v_total - v_paid then
    raise exception 'El monto supera el saldo pendiente de la factura';
  end if;

  insert into public.payments (invoice_id, amount, paid_at, method, note)
  values (
    p_invoice_id,
    v_amount,
    coalesce(p_paid_at, current_date),
    coalesce(nullif(btrim(coalesce(p_method, '')), ''), 'efectivo'),
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

create or replace function public.void_invoice(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden anular facturas' using errcode = '42501';
  end if;
  perform 1 from public.invoices where id = p_id for update;
  if not found then
    raise exception 'La factura no existe';
  end if;
  update public.invoices set voided_at = now(), voided_by = auth.uid()
  where id = p_id and voided_at is null;
end;
$$;

create or replace function public.void_payment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden anular pagos' using errcode = '42501';
  end if;
  select invoice_id into v_invoice_id from public.payments where id = p_id;
  if not found then
    raise exception 'El pago no existe';
  end if;
  perform 1 from public.invoices where id = v_invoice_id for update;
  update public.payments set voided_at = now(), voided_by = auth.uid()
  where id = p_id and voided_at is null;
end;
$$;

revoke all on function public.create_invoice(uuid, text, text, text, date, text, jsonb, boolean) from public, anon;
grant execute on function public.create_invoice(uuid, text, text, text, date, text, jsonb, boolean) to authenticated;

revoke all on function public.update_invoice(uuid, uuid, text, text, text, date, text, jsonb, boolean) from public, anon;
grant execute on function public.update_invoice(uuid, uuid, text, text, text, date, text, jsonb, boolean) to authenticated;

revoke all on function public.add_payment(uuid, numeric, date, text, text) from public, anon;
grant execute on function public.add_payment(uuid, numeric, date, text, text) to authenticated;

revoke all on function public.list_profiles(), public.set_profile_role(uuid, text),
  public.void_invoice(uuid), public.void_payment(uuid) from public, anon;
grant execute on function public.list_profiles(), public.set_profile_role(uuid, text),
  public.void_invoice(uuid), public.void_payment(uuid) to authenticated;

-- =========================================================
-- RLS
-- =========================================================
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

-- Perfiles: cada usuario ve y edita su propia fila (el alta la hace el trigger)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- El insert lo maneja el trigger security definer, no se permite desde el cliente
drop policy if exists "profiles_insert_own" on public.profiles;

-- Configuración del negocio: lectura compartida, edición solo administrativa.
drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings for select to authenticated using (true);
drop policy if exists "settings_insert" on public.settings;
create policy "settings_insert" on public.settings for insert to authenticated with check (public.is_admin());
drop policy if exists "settings_update" on public.settings;
create policy "settings_update" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Las cuentas con sesión comparten datos operativos.
drop policy if exists "customers_all" on public.customers;
drop policy if exists "customers_read" on public.customers;
create policy "customers_read" on public.customers for select to authenticated using (true);
drop policy if exists "customers_write" on public.customers;
create policy "customers_write" on public.customers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "invoices_all" on public.invoices;
drop policy if exists "invoices_read" on public.invoices;
create policy "invoices_read" on public.invoices for select to authenticated using (true);
drop policy if exists "invoice_items_all" on public.invoice_items;
drop policy if exists "invoice_items_read" on public.invoice_items;
create policy "invoice_items_read" on public.invoice_items for select to authenticated using (true);
drop policy if exists "payments_all" on public.payments;
drop policy if exists "payments_read" on public.payments;
create policy "payments_read" on public.payments for select to authenticated using (true);

grant usage on schema public to anon, authenticated;

revoke all on public.profiles, public.settings, public.customers, public.invoices,
  public.invoice_items, public.payments, public.invoice_balances from public, anon, authenticated;
revoke all on sequence public.invoice_number_seq from public, anon, authenticated;
revoke all on function public.handle_new_user(), public.recalc_invoice_total(), public.set_updated_at()
  from public, anon, authenticated;

grant select on public.profiles, public.settings, public.customers, public.invoices,
  public.invoice_items, public.payments, public.invoice_balances to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant insert, update on public.settings to authenticated;
grant insert, update, delete on public.customers to authenticated;

commit;
