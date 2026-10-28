-- ColonTab — esquema de base de datos para Supabase
-- Ejecuta este archivo completo en: Supabase → SQL Editor → New query → Run
-- Se puede volver a ejecutar sin perder datos.

create extension if not exists "pgcrypto";

-- ═════════════════ Tablas ═════════════════
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  logo_text text not null default '',
  logo_url text,
  primary_color text not null default '#00D492',
  wifi_ssid text,
  wifi_password text,
  whatsapp text,              -- número con código de país, solo dígitos
  sinpe_phone text,           -- número de SINPE Móvil (8 dígitos)
  sinpe_name text,            -- a nombre de quién está el SINPE
  instagram text,
  tiktok text,
  google_review_url text,
  maps_url text,
  address text,
  hours text,
  currency text not null default 'MXN',
  table_count int not null default 10 check (table_count between 1 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table restaurants add column if not exists table_count int not null default 10;
alter table restaurants add column if not exists active boolean not null default true;
alter table restaurants add column if not exists sinpe_phone text;
alter table restaurants add column if not exists sinpe_name text;

-- Administradores de toda la plataforma (tú)
create table if not exists platform_admins (
  email text primary key
);

-- Personal de cada restaurante. Se asocia por email: la persona se registra con ese email y obtiene acceso.
create table if not exists restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  email text not null,
  role text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  unique (restaurant_id, email)
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
create index if not exists orders_restaurant_created on orders (restaurant_id, created_at desc);

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
  table_number int not null check (table_number > 0),
  type text not null check (type in ('waiter','bill','order')),  -- order = "Estoy listo para ordenar"
  guests int check (guests between 1 and 100),
  payment_method text check (payment_method in ('efectivo','tarjeta','transferencia')),  -- transferencia = SINPE Móvil
  status text not null default 'pendiente' check (status in ('pendiente','atendido')),
  created_at timestamptz not null default now()
);

-- Para bases creadas con una versión anterior
alter table service_requests drop constraint if exists service_requests_type_check;
alter table service_requests add constraint service_requests_type_check check (type in ('waiter','bill','order'));
alter table service_requests add column if not exists guests int check (guests between 1 and 100);

create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_number int,
  rating int check (rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- ═════════════════ Funciones de permisos ═════════════════
create or replace function current_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where lower(email) = current_email())
$$;

create or replace function is_restaurant_member(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_platform_admin()
      or exists (select 1 from restaurant_members where restaurant_id = rid and lower(email) = current_email())
$$;

create or replace function is_restaurant_owner(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_platform_admin()
      or exists (select 1 from restaurant_members
                 where restaurant_id = rid and lower(email) = current_email() and role = 'owner')
$$;

-- ═════════════════ Seguridad (RLS) ═════════════════
alter table restaurants enable row level security;
alter table platform_admins enable row level security;
alter table restaurant_members enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table service_requests enable row level security;
alter table suggestions enable row level security;

-- Borra políticas anteriores para poder re-ejecutar el archivo
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $$;

-- Restaurantes: el público ve los activos; el personal ve el suyo; dueños editan; solo la plataforma crea/borra
create policy "restaurants read" on restaurants for select using (active or is_restaurant_member(id));
create policy "restaurants update" on restaurants for update to authenticated
  using (is_restaurant_owner(id)) with check (is_restaurant_owner(id));
create policy "restaurants insert" on restaurants for insert to authenticated with check (is_platform_admin());
create policy "restaurants delete" on restaurants for delete to authenticated using (is_platform_admin());

-- Plataforma: cada quien solo puede comprobar si es admin
create policy "platform self" on platform_admins for select to authenticated using (lower(email) = current_email());

-- Equipo: se ve a sí mismo y su restaurante; dueños y plataforma lo administran
create policy "members read" on restaurant_members for select to authenticated
  using (lower(email) = current_email() or is_restaurant_member(restaurant_id));
create policy "members insert" on restaurant_members for insert to authenticated
  with check (is_restaurant_owner(restaurant_id) and (role = 'staff' or is_platform_admin()));
create policy "members delete" on restaurant_members for delete to authenticated
  using (is_restaurant_owner(restaurant_id) and (role = 'staff' or is_platform_admin()));

-- Menú: lectura pública, edición del personal
create policy "categories read" on menu_categories for select using (true);
create policy "categories write" on menu_categories for all to authenticated
  using (is_restaurant_member(restaurant_id)) with check (is_restaurant_member(restaurant_id));
create policy "items read" on menu_items for select using (true);
create policy "items write" on menu_items for all to authenticated
  using (is_restaurant_member(restaurant_id)) with check (is_restaurant_member(restaurant_id));

-- Pedidos: los crea la función create_order; los ve y actualiza el personal
create policy "orders staff read" on orders for select to authenticated using (is_restaurant_member(restaurant_id));
create policy "orders staff update" on orders for update to authenticated
  using (is_restaurant_member(restaurant_id)) with check (is_restaurant_member(restaurant_id));
create policy "order items staff read" on order_items for select to authenticated
  using (exists (select 1 from orders o where o.id = order_id and is_restaurant_member(o.restaurant_id)));

-- Llamadas al mesero / cuenta (los clientes las crean con request_service, ver "Códigos de mesa")
create policy "service staff read" on service_requests for select to authenticated using (is_restaurant_member(restaurant_id));
create policy "service staff update" on service_requests for update to authenticated
  using (is_restaurant_member(restaurant_id)) with check (is_restaurant_member(restaurant_id));

-- Sugerencias (los clientes las crean con send_suggestion)
create policy "suggestions staff read" on suggestions for select to authenticated using (is_restaurant_member(restaurant_id));
create policy "suggestions staff delete" on suggestions for delete to authenticated using (is_restaurant_member(restaurant_id));

-- ═════════════════ Visitas a las mesas (NFC / QR) ═════════════════
create table if not exists table_visits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_number int not null check (table_number > 0),
  source text not null default 'link' check (source in ('nfc','qr','link')),
  created_at timestamptz not null default now()
);
create index if not exists table_visits_restaurant_created on table_visits (restaurant_id, created_at desc);

alter table table_visits enable row level security;
drop policy if exists "visits staff read" on table_visits;
create policy "visits staff read" on table_visits for select to authenticated using (is_restaurant_member(restaurant_id));

-- ═════════════════ Crear pedido (precios calculados en el servidor) ═════════════════
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
  if not exists (select 1 from restaurants where id = p_restaurant_id and active) then
    raise exception 'Restaurante no disponible';
  end if;
  if p_table_number is null or p_table_number <= 0 then
    raise exception 'Mesa no válida';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido está vacío';
  end if;

  insert into orders (restaurant_id, table_number, guests, notes)
  values (p_restaurant_id, p_table_number, p_guests, left(p_notes, 500))
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

-- ═════════════════ Tiempo real (panel del restaurante) ═════════════════
do $$
begin
  begin alter publication supabase_realtime add table orders; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table service_requests; exception when duplicate_object then null; end;
end $$;

-- ═════════════════ Datos de ejemplo ═════════════════
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

-- ═════════════════ Menú: personalizado, PDF o enlace ═════════════════
alter table restaurants add column if not exists menu_type text not null default 'custom';
alter table restaurants add column if not exists menu_url text;
alter table restaurants drop constraint if exists restaurants_menu_type_check;
alter table restaurants add constraint restaurants_menu_type_check check (menu_type in ('custom','pdf','url'));

-- Espacio público para los PDF de menú (máx. 15 MB, solo PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menus', 'menus', true, 15728640, array['application/pdf'])
on conflict (id) do update set public = true, file_size_limit = 15728640, allowed_mime_types = array['application/pdf'];

-- Cualquiera puede ver los PDF; solo el dueño (o la plataforma) sube o borra en la carpeta de su restaurante
drop policy if exists "menus public read" on storage.objects;
create policy "menus public read" on storage.objects for select using (bucket_id = 'menus');

drop policy if exists "menus owner insert" on storage.objects;
create policy "menus owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'menus' and is_restaurant_owner(((storage.foldername(name))[1])::uuid));

drop policy if exists "menus owner update" on storage.objects;
create policy "menus owner update" on storage.objects for update to authenticated
  using (bucket_id = 'menus' and is_restaurant_owner(((storage.foldername(name))[1])::uuid));

drop policy if exists "menus owner delete" on storage.objects;
create policy "menus owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'menus' and is_restaurant_owner(((storage.foldername(name))[1])::uuid));

-- ═════════════════ Códigos de mesa (QR/NFC no editables) ═════════════════

-- Código aleatorio de 12 letras y números (~72 bits)
create or replace function new_table_token() returns text
language sql volatile set search_path = public, extensions as $$
  select translate(encode(gen_random_bytes(9), 'base64'), '+/', 'Xz')
$$;

create table if not exists restaurant_tables (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  number int not null check (number > 0),
  token text not null unique default new_table_token(),
  created_at timestamptz not null default now(),
  primary key (restaurant_id, number)
);

-- Solo el personal ve los códigos (para imprimir QR y grabar NFC)
alter table restaurant_tables enable row level security;
drop policy if exists "tables staff read" on restaurant_tables;
create policy "tables staff read" on restaurant_tables for select to authenticated using (is_restaurant_member(restaurant_id));

-- Crear códigos para las mesas nuevas cuando se crea un restaurante o cambia la cantidad de mesas
create or replace function sync_restaurant_tables() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into restaurant_tables (restaurant_id, number)
  select new.id, n from generate_series(1, new.table_count) n
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists restaurants_sync_tables on restaurants;
create trigger restaurants_sync_tables after insert or update of table_count on restaurants
  for each row execute function sync_restaurant_tables();

-- Códigos para las mesas que ya existen
insert into restaurant_tables (restaurant_id, number)
select r.id, n from restaurants r, generate_series(1, r.table_count) n
on conflict do nothing;

-- Mesa 4 de La Esquina = demo pública de la portada (colontab.com/t/demo)
update restaurant_tables set token = 'demo'
where number = 4 and restaurant_id = (select id from restaurants where slug = 'la-esquina')
  and not exists (select 1 from restaurant_tables where token = 'demo');

-- ───── Funciones públicas (lo único que puede hacer un cliente) ─────
create or replace function resolve_table(p_token text)
returns table (restaurant_id uuid, slug text, table_number int)
language sql stable security definer set search_path = public as $$
  select r.id, r.slug, t.number
  from restaurant_tables t join restaurants r on r.id = t.restaurant_id
  where t.token = p_token and r.active and t.number <= r.table_count
$$;

create or replace function request_service(p_token text, p_type text, p_payment_method text default null, p_guests int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from resolve_table(p_token);
  if not found then raise exception 'Mesa no válida. Escanea el código de tu mesa.'; end if;
  -- Evita avisos repetidos de la misma mesa en pocos segundos
  if exists (
    select 1 from service_requests s
    where s.restaurant_id = v.restaurant_id and s.table_number = v.table_number and s.type = p_type
      and s.status = 'pendiente' and s.created_at > now() - interval '20 seconds'
  ) then return; end if;
  insert into service_requests (restaurant_id, table_number, type, payment_method, guests)
  values (v.restaurant_id, v.table_number, p_type, p_payment_method, p_guests);
end $$;

create or replace function send_suggestion(p_token text, p_rating int, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from resolve_table(p_token);
  if not found then raise exception 'Mesa no válida. Escanea el código de tu mesa.'; end if;
  insert into suggestions (restaurant_id, table_number, rating, message)
  values (v.restaurant_id, v.table_number, p_rating, left(p_message, 1000));
end $$;

create or replace function record_visit(p_token text, p_source text)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from resolve_table(p_token);
  if not found then return; end if;
  insert into table_visits (restaurant_id, table_number, source)
  values (v.restaurant_id, v.table_number, case when p_source in ('nfc','qr') then p_source else 'link' end);
end $$;

-- Cambiar códigos (si un QR se filtró). p_number null = todas las mesas
create or replace function regenerate_table_tokens(p_restaurant_id uuid, p_number int default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_restaurant_owner(p_restaurant_id) then raise exception 'Solo el dueño puede cambiar los códigos'; end if;
  update restaurant_tables set token = new_table_token()
  where restaurant_id = p_restaurant_id and (p_number is null or number = p_number);
end $$;

grant execute on function resolve_table(text) to anon, authenticated;
grant execute on function request_service(text, text, text, int) to anon, authenticated;
grant execute on function send_suggestion(text, int, text) to anon, authenticated;
grant execute on function record_visit(text, text) to anon, authenticated;
grant execute on function regenerate_table_tokens(uuid, int) to authenticated;
revoke execute on function regenerate_table_tokens(uuid, int) from anon;

-- Ya no se puede insertar directo: solo por las funciones de arriba (que validan el código)
drop policy if exists "service insert" on service_requests;
drop policy if exists "suggestions insert" on suggestions;
drop policy if exists "visits insert" on table_visits;

-- ═════════════════ TU CUENTA DE ADMINISTRADOR ═════════════════
-- Cambia el email por el tuyo y vuelve a ejecutar esta línea.
-- Después regístrate en /admin/login con ese mismo email.
insert into platform_admins (email) values (lower('TU-EMAIL@ejemplo.com')) on conflict do nothing;
