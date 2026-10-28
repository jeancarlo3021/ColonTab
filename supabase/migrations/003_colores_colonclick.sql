-- ColonTab: color por defecto de la marca ColonClick (verde #00D492)
alter table restaurants alter column primary_color set default '#00D492';
-- Cambia al verde los restaurantes que seguían con el dorado anterior por defecto
update restaurants set primary_color = '#00D492' where lower(primary_color) = '#e0b13c';
