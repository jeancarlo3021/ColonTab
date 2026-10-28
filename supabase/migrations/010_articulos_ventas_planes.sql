-- ColonTab: catálogo de artículos (placas, stickers…) con 4 precios por cantidad,
-- registro de ventas a restaurantes y planes de suscripción.

-- ───── Planes ─────
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  currency text not null default 'CRC',
  months int not null default 12 check (months between 1 and 36),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table restaurant_billing add column if not exists plan_id uuid references plans(id) on delete set null;

alter table plans enable row level security;
drop policy if exists "plans read" on plans;
create policy "plans read" on plans for select to authenticated using (
  is_platform_admin()
  or exists (select 1 from restaurant_billing b where b.plan_id = plans.id and is_restaurant_member(b.restaurant_id))
);
drop policy if exists "plans admin write" on plans;
create policy "plans admin write" on plans for all to authenticated using (is_platform_admin()) with check (is_platform_admin());

-- ───── Artículos (universales) ─────
-- tiers: hasta 4 precios por cantidad, ej. [{"min":1,"price":6000},{"min":10,"price":5000},…]
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  currency text not null default 'CRC',
  tiers jsonb not null default '[{"min":1,"price":0}]'
    check (jsonb_typeof(tiers) = 'array' and jsonb_array_length(tiers) between 1 and 4),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table products enable row level security;
drop policy if exists "products admin" on products;
create policy "products admin" on products for all to authenticated using (is_platform_admin()) with check (is_platform_admin());

-- ───── Ventas ─────
create table if not exists product_sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete set null,
  customer_name text,                          -- si se vende a alguien que aún no es restaurante
  product_id uuid references products(id) on delete set null,
  product_name text not null,                  -- se guarda el nombre por si el artículo se borra
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  total numeric(12,2) not null check (total >= 0),
  currency text not null default 'CRC',
  sold_at date not null default cr_today(),
  paid boolean not null default true,
  note text,
  created_by text default current_email(),
  created_at timestamptz not null default now(),
  check (restaurant_id is not null or coalesce(customer_name, '') <> '')
);
create index if not exists product_sales_sold_at on product_sales (sold_at desc);
create index if not exists product_sales_restaurant on product_sales (restaurant_id);

alter table product_sales enable row level security;
drop policy if exists "sales admin" on product_sales;
create policy "sales admin" on product_sales for all to authenticated using (is_platform_admin()) with check (is_platform_admin());
-- El restaurante ve lo que te ha comprado
drop policy if exists "sales member read" on product_sales;
create policy "sales member read" on product_sales for select to authenticated
  using (restaurant_id is not null and is_restaurant_member(restaurant_id));
