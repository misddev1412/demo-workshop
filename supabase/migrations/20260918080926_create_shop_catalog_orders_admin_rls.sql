-- Shop Demo: integer VND amounts, protected orders, owner-managed admin allowlist.
create schema shop_private;
revoke all on schema shop_private from public, anon, authenticated, service_role;
grant usage on schema shop_private to authenticated;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  price bigint not null check (price >= 0),
  image_url text
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  recipient_name text not null check (btrim(recipient_name) <> ''),
  recipient_phone text not null check (btrim(recipient_phone) <> ''),
  shipping_address text not null check (btrim(shipping_address) <> ''),
  total_amount bigint not null check (total_amount >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipping', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.order_items (
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  primary key (order_id, product_id)
);
create index order_items_product_id_idx on public.order_items(product_id);

create table shop_private.admin_allowlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table shop_private.admin_allowlist is
  'Only the project owner via privileged SQL may grant/revoke admins. No application role may write here.';
alter table shop_private.admin_allowlist enable row level security;
revoke all on shop_private.admin_allowlist from public, anon, authenticated, service_role;

-- Narrow internal lookup: derives identity exclusively from Supabase Auth.
create function shop_private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from shop_private.admin_allowlist
    where user_id = (select auth.uid())
  );
$$;
revoke all on function shop_private.is_admin() from public, anon, authenticated, service_role;
grant execute on function shop_private.is_admin() to authenticated;

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.products, public.orders, public.order_items from public, anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.orders, public.order_items to authenticated;

create policy products_public_read on public.products
  for select to anon, authenticated using (true);
create policy products_admin_insert on public.products
  for insert to authenticated with check ((select shop_private.is_admin()));
create policy products_admin_update on public.products
  for update to authenticated using ((select shop_private.is_admin()))
  with check ((select shop_private.is_admin()));
create policy products_admin_delete on public.products
  for delete to authenticated using ((select shop_private.is_admin()));
create policy orders_admin_only on public.orders
  for all to authenticated using ((select shop_private.is_admin()))
  with check ((select shop_private.is_admin()));
create policy order_items_admin_only on public.order_items
  for all to authenticated using ((select shop_private.is_admin()))
  with check ((select shop_private.is_admin()));
