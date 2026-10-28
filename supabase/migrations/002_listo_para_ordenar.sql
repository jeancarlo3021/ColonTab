-- MesaClick: "Estoy listo para ordenar"
-- Ejecuta esto en Supabase → SQL Editor si ya habías ejecutado schema.sql antes.
alter table service_requests drop constraint if exists service_requests_type_check;
alter table service_requests add constraint service_requests_type_check check (type in ('waiter','bill','order'));
alter table service_requests add column if not exists guests int check (guests between 1 and 100);
