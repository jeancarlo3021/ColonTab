-- ColonTab: visitas a las mesas (para saber cuántos entran por NFC y cuántos por QR)
create table if not exists table_visits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_number int not null check (table_number > 0),
  source text not null default 'link' check (source in ('nfc','qr','link')),
  created_at timestamptz not null default now()
);
create index if not exists table_visits_restaurant_created on table_visits (restaurant_id, created_at desc);

alter table table_visits enable row level security;
drop policy if exists "visits insert" on table_visits;
create policy "visits insert" on table_visits for insert to anon, authenticated
  with check (exists (select 1 from restaurants r where r.id = restaurant_id and r.active));
drop policy if exists "visits staff read" on table_visits;
create policy "visits staff read" on table_visits for select to authenticated using (is_restaurant_member(restaurant_id));
