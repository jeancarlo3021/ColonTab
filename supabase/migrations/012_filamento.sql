-- ColonTab: control de filamento de las impresoras 3D (solo el administrador de la plataforma).
-- El bot de filamento (en la PC del taller) escribe aquí con la llave de servicio; la web lee y edita.

create table if not exists filamento_impresoras (
  id text primary key,                 -- 'primera', 'segunda'
  nombre text not null,
  ip text,
  estado text,                         -- 'printing', 'standby', 'complete'…
  trabajo text,                        -- archivo que está imprimiendo
  progreso numeric(5,2),
  visto_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists filamento_ranuras (
  impresora_id text not null references filamento_impresoras(id) on delete cascade,
  ranura text not null check (ranura in ('A','B','C','D')),
  color_hex text,                      -- color que reporta el CFS ('#B28B33'), null = vacía
  material_cfs text,
  actualizado_at timestamptz not null default now(),
  primary key (impresora_id, ranura)
);

create table if not exists filamento_bobinas (
  id text primary key default substr(md5(random()::text), 1, 6),
  material text not null default 'PLA',
  color text not null,
  color_hex text,
  marca text,
  peso_g numeric(8,2) not null default 1000 check (peso_g > 0),
  restante_g numeric(8,2) not null default 1000,
  usado_total_g numeric(10,2) not null default 0,
  impresora_id text references filamento_impresoras(id) on delete set null,
  ranura text check (ranura in ('A','B','C','D')),
  agotada boolean not null default false,
  notas text,
  created_at timestamptz not null default now(),
  actualizada_at timestamptz not null default now()
);
create index if not exists filamento_bobinas_slot on filamento_bobinas (impresora_id, ranura) where not agotada;

create table if not exists filamento_consumos (
  id bigint generated always as identity primary key,
  bobina_id text references filamento_bobinas(id) on delete cascade,
  impresora_id text,
  ranura text,
  gramos numeric(8,2) not null,
  trabajo text,
  created_at timestamptz not null default now()
);
create index if not exists filamento_consumos_bobina on filamento_consumos (bobina_id, created_at desc);

-- Una bobina activa por ranura: al asignar una, la que estaba ahí queda guardada (sin ranura)
create or replace function filamento_una_por_ranura() returns trigger
language plpgsql as $$
begin
  new.actualizada_at := now();
  if new.ranura is not null and new.impresora_id is not null and not new.agotada then
    update filamento_bobinas set impresora_id = null, ranura = null, actualizada_at = now()
     where impresora_id = new.impresora_id and ranura = new.ranura and id <> new.id and not agotada;
  end if;
  if new.agotada then
    new.impresora_id := null;
    new.ranura := null;
  end if;
  return new;
end $$;
drop trigger if exists filamento_una_por_ranura on filamento_bobinas;
create trigger filamento_una_por_ranura before insert or update on filamento_bobinas
  for each row execute function filamento_una_por_ranura();

alter table filamento_impresoras enable row level security;
alter table filamento_ranuras enable row level security;
alter table filamento_bobinas enable row level security;
alter table filamento_consumos enable row level security;

drop policy if exists "filamento admin" on filamento_impresoras;
create policy "filamento admin" on filamento_impresoras for all to authenticated using (is_platform_admin()) with check (is_platform_admin());
drop policy if exists "filamento admin" on filamento_ranuras;
create policy "filamento admin" on filamento_ranuras for all to authenticated using (is_platform_admin()) with check (is_platform_admin());
drop policy if exists "filamento admin" on filamento_bobinas;
create policy "filamento admin" on filamento_bobinas for all to authenticated using (is_platform_admin()) with check (is_platform_admin());
drop policy if exists "filamento admin" on filamento_consumos;
create policy "filamento admin" on filamento_consumos for all to authenticated using (is_platform_admin()) with check (is_platform_admin());

insert into filamento_impresoras (id, nombre, ip) values
  ('primera', 'Primera', '192.168.0.8'),
  ('segunda', 'Segunda', '192.168.0.6')
on conflict (id) do nothing;

-- El bot descuenta el gasto de forma atómica y agrupa el historial por impresión.
create or replace function filamento_consumir(p_bobina text, p_gramos numeric, p_impresora text, p_ranura text, p_trabajo text)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_restante numeric;
begin
  update filamento_bobinas
     set restante_g = restante_g - p_gramos, usado_total_g = usado_total_g + p_gramos
   where id = p_bobina
  returning restante_g into v_restante;
  if not found then return null; end if;
  update filamento_consumos set gramos = gramos + p_gramos
   where id = (select id from filamento_consumos
                where bobina_id = p_bobina and coalesce(trabajo, '') = coalesce(p_trabajo, '')
                  and impresora_id = p_impresora and created_at > now() - interval '18 hours'
                order by created_at desc limit 1);
  if not found then
    insert into filamento_consumos (bobina_id, impresora_id, ranura, gramos, trabajo)
    values (p_bobina, p_impresora, p_ranura, p_gramos, p_trabajo);
  end if;
  return v_restante;
end $$;
revoke all on function filamento_consumir(text, numeric, text, text, text) from public, anon, authenticated;
grant execute on function filamento_consumir(text, numeric, text, text, text) to service_role;
