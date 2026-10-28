-- ColonTab: menú personalizado, en PDF o en un enlace externo
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
