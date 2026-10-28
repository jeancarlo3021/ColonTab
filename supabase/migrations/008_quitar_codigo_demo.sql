-- ColonTab: la Mesa 4 de La Esquina tenía el código público "demo" (cualquiera desde la portada podía
-- avisar a esa mesa). Le damos un código aleatorio como a las demás. La demo de la portada pasa a ser
-- una vista previa que no envía avisos.
update restaurant_tables set token = new_table_token() where token = 'demo';
