-- ColonTab: cada mesa tiene un código secreto. El QR/NFC lleva ese código, no el número,
-- así nadie puede cambiar de mesa editando la dirección. Los avisos, sugerencias y visitas
-- solo se aceptan con un código válido (validado aquí en la base de datos).

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

-- (La Mesa 4 de La Esquina usaba el código público "demo"; ver 008_quitar_codigo_demo.sql)

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
