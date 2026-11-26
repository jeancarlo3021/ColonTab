-- Acceso del bot de filamento con la llave pública (anon) de MesaClick:
-- el bot se registra una sola vez con una clave secreta propia (se guarda solo su hash) y usa
-- estas funciones, que verifican esa clave. Sin la clave no se puede leer ni escribir nada.
create table if not exists filamento_bot_clave (
  id int primary key default 1 check (id = 1),
  hash text not null,
  created_at timestamptz not null default now()
);
alter table filamento_bot_clave enable row level security;   -- sin políticas: nadie la lee por la API

create or replace function filamento_bot_ok(p_clave text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from filamento_bot_clave where hash = encode(extensions.digest(p_clave, 'sha256'), 'hex'))
$$;

-- Solo funciona la primera vez (cuando aún no hay clave). Para cambiarla: delete from filamento_bot_clave;
create or replace function fbot_registrar(p_clave text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(coalesce(p_clave, '')) < 32 then raise exception 'clave muy corta'; end if;
  if exists (select 1 from filamento_bot_clave) then return filamento_bot_ok(p_clave); end if;
  insert into filamento_bot_clave (hash) values (encode(extensions.digest(p_clave, 'sha256'), 'hex'));
  return true;
end $$;

create or replace function fbot_bobinas(p_clave text, p_solo_activas boolean default true)
returns setof filamento_bobinas language plpgsql stable security definer set search_path = public as $$
begin
  if not filamento_bot_ok(p_clave) then raise exception 'clave del bot inválida'; end if;
  return query select * from filamento_bobinas where not p_solo_activas or not agotada order by restante_g;
end $$;

-- Crea (p_id null) o actualiza una bobina con los campos de p_datos.
create or replace function fbot_guardar(p_clave text, p_id text, p_datos jsonb)
returns filamento_bobinas language plpgsql security definer set search_path = public as $$
declare r filamento_bobinas;
begin
  if not filamento_bot_ok(p_clave) then raise exception 'clave del bot inválida'; end if;
  if p_id is null then
    insert into filamento_bobinas (material, color, color_hex, peso_g, restante_g, impresora_id, ranura)
    values (coalesce(p_datos->>'material', 'PLA'), coalesce(p_datos->>'color', '?'), p_datos->>'color_hex',
            coalesce((p_datos->>'peso_g')::numeric, 1000),
            coalesce((p_datos->>'restante_g')::numeric, (p_datos->>'peso_g')::numeric, 1000),
            p_datos->>'impresora_id', p_datos->>'ranura')
    returning * into r;
  else
    update filamento_bobinas set
      impresora_id = case when p_datos ? 'impresora_id' then p_datos->>'impresora_id' else impresora_id end,
      ranura       = case when p_datos ? 'ranura' then p_datos->>'ranura' else ranura end,
      restante_g   = case when p_datos ? 'restante_g' then (p_datos->>'restante_g')::numeric else restante_g end,
      agotada      = case when p_datos ? 'agotada' then (p_datos->>'agotada')::boolean else agotada end,
      color_hex    = case when p_datos ? 'color_hex' then p_datos->>'color_hex' else color_hex end
    where id = p_id returning * into r;
  end if;
  return r;
end $$;

create or replace function fbot_impresora(p_clave text, p_id text, p_datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not filamento_bot_ok(p_clave) then raise exception 'clave del bot inválida'; end if;
  update filamento_impresoras set
    estado = p_datos->>'estado', trabajo = p_datos->>'trabajo',
    progreso = (p_datos->>'progreso')::numeric, ip = coalesce(p_datos->>'ip', ip), visto_at = now()
  where id = p_id;
end $$;

create or replace function fbot_ranuras(p_clave text, p_filas jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not filamento_bot_ok(p_clave) then raise exception 'clave del bot inválida'; end if;
  insert into filamento_ranuras (impresora_id, ranura, color_hex, material_cfs, actualizado_at)
  select f->>'impresora_id', f->>'ranura', f->>'color_hex', f->>'material_cfs', now()
    from jsonb_array_elements(p_filas) f
  on conflict (impresora_id, ranura) do update
    set color_hex = excluded.color_hex, material_cfs = excluded.material_cfs, actualizado_at = now();
end $$;

create or replace function fbot_consumir(p_clave text, p_bobina text, p_gramos numeric, p_impresora text, p_ranura text, p_trabajo text)
returns numeric language plpgsql security definer set search_path = public as $$
begin
  if not filamento_bot_ok(p_clave) then raise exception 'clave del bot inválida'; end if;
  return filamento_consumir(p_bobina, p_gramos, p_impresora, p_ranura, p_trabajo);
end $$;

revoke all on function filamento_bot_ok(text) from public, anon, authenticated;
grant execute on function fbot_registrar(text), fbot_bobinas(text, boolean), fbot_guardar(text, text, jsonb),
  fbot_impresora(text, text, jsonb), fbot_ranuras(text, jsonb),
  fbot_consumir(text, text, numeric, text, text, text) to anon, authenticated;
