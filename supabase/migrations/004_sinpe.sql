-- ColonTab: pagos con SINPE Móvil
-- Número y nombre del titular que verá el cliente al elegir SINPE para pagar.
alter table restaurants add column if not exists sinpe_phone text;
alter table restaurants add column if not exists sinpe_name text;
