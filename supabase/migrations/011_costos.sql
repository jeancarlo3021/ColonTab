-- ColonTab: costo de cada artículo para saber la ganancia de cada venta.
-- El costo es privado: el restaurante ve sus compras (con my_purchases) pero nunca tu costo.

alter table products add column if not exists cost numeric(10,2) not null default 0 check (cost >= 0);
alter table product_sales add column if not exists unit_cost numeric(10,2) not null default 0 check (unit_cost >= 0);

-- El restaurante ya no lee la tabla de ventas directo (vería el costo): usa esta función
drop policy if exists "sales member read" on product_sales;

create or replace function my_purchases(p_restaurant_id uuid)
returns table (id uuid, product_name text, quantity int, unit_price numeric, total numeric, currency text, sold_at date, paid boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.product_name, s.quantity, s.unit_price, s.total, s.currency, s.sold_at, s.paid
  from product_sales s
  where s.restaurant_id = p_restaurant_id and is_restaurant_member(p_restaurant_id)
  order by s.sold_at desc, s.created_at desc
$$;
grant execute on function my_purchases(uuid) to authenticated;

-- Seguridad: la primera versión de schema.sql agregaba este correo de ejemplo como administrador
delete from platform_admins where lower(email) = 'tu-email@ejemplo.com';
