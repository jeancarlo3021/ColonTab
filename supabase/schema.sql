-- MesaClick — esquema de base de datos para Supabase
-- Ejecuta este archivo en: Supabase → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- ───────── Tablas ─────────
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_text text not null default '',
  logo_url text,
  primary_color text not null default '#e0b13c',
  wifi_ssid text,
  wifi_password text,
  whatsapp text,              -- número con código de país, solo dígitos
  instagram text,
  tiktok text,
  google_review_url text,
  maps_url text,
  address text,
  hours text,
  currency text not null default 'MXN',
  created_at timestamptz not null default now()
);

create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  position int not null default 0
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category_id uuid not null references menu_categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  available boolean not null default true
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_number int not null,
  guests int,
  notes text,
  total numeric(10,2) not null default 0,
  status text not null default 'nuevo' check (status in ('nuevo','preparando','servido','pagado','cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name text not null,
  price numeric(10,2) not null,
  quantity int not null check (quantity > 0)
);

create table if not exists service_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_number int not null,
  type text not null check (type in ('waiter','bill')),
  payment_method text check (payment_method in ('efectivo','tarjeta','transferencia')),
  status text not null default 'pendiente' check (status in ('pendiente','atendido')),
  created_at timestamptz not null default now()
);

create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_number int,
  rating int check (rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- ───────── Seguridad (RLS) ─────────
-- Los clientes (anon) pueden leer restaurante y menú, y crear solicitudes/sugerencias.
-- No pueden leer pedidos ni solicitudes de otros: eso queda para el panel del personal (rol authenticated).
alter table restaurants enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table service_requests enable row level security;
alter table suggestions enable row level security;

drop policy if exists "public read restaurants" on restaurants;
create policy "public read restaurants" on restaurants for select using (true);
drop policy if exists "public read categories" on menu_categories;
create policy "public read categories" on menu_categories for select using (true);
drop policy if exists "public read items" on menu_items;
create policy "public read items" on menu_items for select using (true);

drop policy if exists "anon insert service" on service_requests;
create policy "anon insert service" on service_requests for insert to anon, authenticated with check (true);
drop policy if exists "anon insert suggestions" on suggestions;
create policy "anon insert suggestions" on suggestions for insert to anon, authenticated with check (true);

-- Personal autenticado: puede ver y actualizar todo
drop policy if exists "staff orders" on orders;
create policy "staff orders" on orders for all to authenticated using (true) with check (true);
drop policy if exists "staff order items" on order_items;
create policy "staff order items" on order_items for all to authenticated using (true) with check (true);
drop policy if exists "staff service" on service_requests;
create policy "staff service" on service_requests for select to authenticated using (true);
drop policy if exists "staff service update" on service_requests;
create policy "staff service update" on service_requests for update to authenticated using (true);
drop policy if exists "staff suggestions" on suggestions;
create policy "staff suggestions" on suggestions for select to authenticated using (true);

-- ───────── Crear pedido (precios calculados en el servidor) ─────────
create or replace function create_order(
  p_restaurant_id uuid,
  p_table_number int,
  p_guests int,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric(10,2);
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido está vacío';
  end if;

  insert into orders (restaurant_id, table_number, guests, notes)
  values (p_restaurant_id, p_table_number, p_guests, p_notes)
  returning id into v_order_id;

  insert into order_items (order_id, menu_item_id, name, price, quantity)
  select v_order_id, m.id, m.name, m.price, (x->>'quantity')::int
  from jsonb_array_elements(p_items) x
  join menu_items m on m.id = (x->>'menu_item_id')::uuid
  where m.restaurant_id = p_restaurant_id
    and m.available
    and (x->>'quantity')::int between 1 and 50;

  select coalesce(sum(price * quantity), 0) into v_total from order_items where order_id = v_order_id;
  if v_total = 0 then
    raise exception 'Ningún platillo válido en el pedido';
  end if;

  update orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

grant execute on function create_order(uuid, int, int, text, jsonb) to anon, authenticated;

-- ───────── Datos de ejemplo ─────────
insert into restaurants (slug, name, logo_text, wifi_ssid, wifi_password, whatsapp, instagram, tiktok,
  google_review_url, maps_url, address, hours)
values ('la-esquina', 'La Esquina Restaurants', 'LE', 'LaEsquina_Clientes', 'esquina2026', '5215512345678',
  'https://instagram.com/', 'https://tiktok.com/', 'https://www.google.com/maps', 'https://www.google.com/maps',
  'Av. Principal 123, Centro', E'Lun a Jue: 12:00 – 22:00\nVie y Sáb: 12:00 – 00:00\nDom: 12:00 – 18:00')
on conflict (slug) do nothing;

do $$
declare r uuid; c1 uuid; c2 uuid; c3 uuid; c4 uuid;
begin
  select id into r from restaurants where slug = 'la-esquina';
  if exists (select 1 from menu_categories where restaurant_id = r) then return; end if;

  insert into menu_categories (restaurant_id, name, position) values (r, 'Entradas', 1) returning id into c1;
  insert into menu_categories (restaurant_id, name, position) values (r, 'Platos fuertes', 2) returning id into c2;
  insert into menu_categories (restaurant_id, name, position) values (r, 'Bebidas', 3) returning id into c3;
  insert into menu_categories (restaurant_id, name, position) values (r, 'Postres', 4) returning id into c4;

  insert into menu_items (restaurant_id, category_id, name, description, price) values
    (r, c1, 'Guacamole con totopos', 'Aguacate fresco, cebolla, cilantro y chile serrano.', 95),
    (r, c1, 'Queso fundido', 'Con chorizo y tortillas de harina.', 110),
    (r, c2, 'Tacos al pastor (4)', 'Piña, cebolla y cilantro.', 120),
    (r, c2, 'Enchiladas verdes', 'Rellenas de pollo, crema y queso.', 145),
    (r, c2, 'Arrachera', 'Con frijoles charros y guacamole.', 240),
    (r, c3, 'Agua de horchata', 'Vaso de 500 ml.', 45),
    (r, c3, 'Limonada mineral', 'Natural o de pepino.', 50),
    (r, c3, 'Café de olla', 'Con canela y piloncillo.', 40),
    (r, c4, 'Flan napolitano', 'Receta de la casa.', 65),
    (r, c4, 'Churros con chocolate', 'Seis piezas.', 75);
end $$;
