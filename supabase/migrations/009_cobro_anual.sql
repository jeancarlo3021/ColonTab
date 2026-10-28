-- ColonTab: cobro anual por restaurante.
-- paid_until = último día con servicio. null = sin fecha (no se bloquea hasta registrar el primer pago).
-- Al vencer: los clientes no pueden avisar ni dejar sugerencias, y el panel del restaurante se bloquea.

alter table restaurants add column if not exists paid_until date;

-- Precio del plan: tabla aparte porque "restaurants" la puede leer cualquier cliente
create table if not exists restaurant_billing (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  plan_price numeric(10,2) check (plan_price >= 0),
  plan_currency text not null default 'CRC',
  note text,
  updated_at timestamptz not null default now()
);
alter table restaurant_billing enable row level security;
drop policy if exists "billing read" on restaurant_billing;
create policy "billing read" on restaurant_billing for select to authenticated using (is_restaurant_member(restaurant_id));
drop policy if exists "billing admin write" on restaurant_billing;
create policy "billing admin write" on restaurant_billing for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create table if not exists subscription_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'CRC',
  method text,
  note text,
  period_start date not null,
  period_end date not null,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists subscription_payments_restaurant on subscription_payments (restaurant_id, created_at desc);

-- El dueño ve su historial; solo la plataforma registra (con register_payment) o borra
alter table subscription_payments enable row level security;
drop policy if exists "payments read" on subscription_payments;
create policy "payments read" on subscription_payments for select to authenticated using (is_restaurant_member(restaurant_id));
drop policy if exists "payments admin delete" on subscription_payments;
create policy "payments admin delete" on subscription_payments for delete to authenticated using (is_platform_admin());

-- Fecha de hoy en Costa Rica
create or replace function cr_today() returns date
language sql stable as $$ select (now() at time zone 'America/Costa_Rica')::date $$;

-- El dueño puede editar su restaurante, pero no el vencimiento ni si está activo
create or replace function protect_billing_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not is_platform_admin() and (
       new.paid_until is distinct from old.paid_until
    or new.active is distinct from old.active
  ) then
    raise exception 'Solo el administrador de ColonTab puede cambiar el vencimiento o el estado del restaurante';
  end if;
  return new;
end $$;

drop trigger if exists restaurants_protect_billing on restaurants;
create trigger restaurants_protect_billing before update on restaurants
  for each row execute function protect_billing_fields();

-- Registrar un pago: extiende el servicio N meses desde el vencimiento actual (o desde hoy si ya venció)
create or replace function register_payment(
  p_restaurant_id uuid, p_amount numeric, p_currency text default 'CRC',
  p_method text default null, p_note text default null, p_months int default 12
) returns date
language plpgsql security definer set search_path = public as $$
declare v_until date; v_start date; v_end date;
begin
  if not is_platform_admin() then raise exception 'Solo el administrador de ColonTab puede registrar pagos'; end if;
  if p_months is null or p_months not between 1 and 36 then raise exception 'Cantidad de meses no válida'; end if;
  select paid_until into v_until from restaurants where id = p_restaurant_id for update;
  if not found then raise exception 'Restaurante no encontrado'; end if;
  v_start := greatest(coalesce(v_until + 1, cr_today()), cr_today());
  v_end := (v_start + make_interval(months => p_months))::date - 1;
  insert into subscription_payments (restaurant_id, amount, currency, method, note, period_start, period_end, created_by)
  values (p_restaurant_id, p_amount, coalesce(p_currency, 'CRC'), p_method, p_note, v_start, v_end, current_email());
  update restaurants set paid_until = v_end where id = p_restaurant_id;
  -- Si aún no tiene precio anual, se toma el de este pago (cuando es de 12 meses)
  insert into restaurant_billing (restaurant_id, plan_price, plan_currency)
  values (p_restaurant_id, case when p_months = 12 then p_amount end, coalesce(p_currency, 'CRC'))
  on conflict (restaurant_id) do update
    set plan_price = coalesce(restaurant_billing.plan_price, excluded.plan_price), updated_at = now();
  return v_end;
end $$;
grant execute on function register_payment(uuid, numeric, text, text, text, int) to authenticated;

-- ───── Las mesas solo funcionan si el restaurante está activo y con servicio al día ─────
drop function if exists resolve_table(text);
create function resolve_table(p_token text)
returns table (restaurant_id uuid, slug text, table_number int, available boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.slug, t.number,
         (r.active and (r.paid_until is null or r.paid_until >= cr_today()))
  from restaurant_tables t join restaurants r on r.id = t.restaurant_id
  where t.token = p_token and t.number <= r.table_count
$$;
grant execute on function resolve_table(text) to anon, authenticated;

create or replace function request_service(p_token text, p_type text, p_payment_method text default null, p_guests int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from resolve_table(p_token);
  if not found then raise exception 'Mesa no válida. Escanea el código de tu mesa.'; end if;
  if not v.available then raise exception 'Este restaurante no está disponible por ahora.'; end if;
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
  if not v.available then raise exception 'Este restaurante no está disponible por ahora.'; end if;
  insert into suggestions (restaurant_id, table_number, rating, message)
  values (v.restaurant_id, v.table_number, p_rating, left(p_message, 1000));
end $$;

create or replace function record_visit(p_token text, p_source text)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from resolve_table(p_token);
  if not found or not v.available then return; end if;
  insert into table_visits (restaurant_id, table_number, source)
  values (v.restaurant_id, v.table_number, case when p_source in ('nfc','qr') then p_source else 'link' end);
end $$;
