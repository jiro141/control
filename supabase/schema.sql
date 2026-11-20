-- =========================================================
-- Control de Ventas - Esquema Supabase
-- Ejecutar en el SQL Editor del proyecto (una sola vez)
-- =========================================================

create extension if not exists pgcrypto;

-- Secuencia para numeración consecutiva de facturas
create sequence if not exists public.invoice_number_seq start 1;

-- Perfiles (1:1 con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Configuración del negocio (fila única)
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'Venta de todo tipo de madera para minería',
  currency_code text not null default 'USD',
  currency_symbol text not null default '$',
  phone_primary text not null default '+58 424-6270112',
  phone_secondary text not null default '+57 314-2880642',
  address text,
  tax_id text,
  website text,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

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

-- Recalcular total de la factura cuando cambian sus líneas
create or replace function public.recalc_invoice_total()
returns trigger
language plpgsql
security definer
set search_path = public
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
  (i.total - coalesce(p.paid_amount, 0))::numeric(14,2) as balance,
  case
    when coalesce(p.paid_amount, 0) >= i.total and i.total > 0 then 'pagada'
    when coalesce(p.paid_amount, 0) > 0 then 'parcial'
    else 'pendiente'
  end as status
from public.invoices i
left join (
  select invoice_id, sum(amount) as paid_amount
  from public.payments
  group by invoice_id
) p on p.invoice_id = i.id;

-- RLS
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings for select to authenticated using (true);
drop policy if exists "settings_update" on public.settings;
create policy "settings_update" on public.settings for update to authenticated using (true) with check (true);

drop policy if exists "customers_all" on public.customers;
create policy "customers_all" on public.customers for all to authenticated using (true) with check (true);
drop policy if exists "invoices_all" on public.invoices;
create policy "invoices_all" on public.invoices for all to authenticated using (true) with check (true);
drop policy if exists "invoice_items_all" on public.invoice_items;
create policy "invoice_items_all" on public.invoice_items for all to authenticated using (true) with check (true);
drop policy if exists "payments_all" on public.payments;
create policy "payments_all" on public.payments for all to authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on public.invoice_balances to authenticated;
