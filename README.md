# ColonTab

Menú digital por QR para restaurantes. El cliente escanea el QR de su mesa y desde su celular puede:

- Ver el menú (solo consulta, sin carrito): **personalizado**, **PDF** (se dibuja completo con PDF.js en Android y iPhone)
  o **enlace** a un menú publicado en otro sitio. Se elige en el panel → Menú → Tipo de menú
- Tocar **"Estoy listo para ordenar"**: el mesero recibe el aviso con sonido y va a tomar la orden
- Llamar al mesero / pedir la cuenta (con forma de pago)
- Jugar mientras espera (Gato y Memoria)
- Ver Wi-Fi, WhatsApp, redes sociales, reseña en Google, ubicación y horario
- Enviar sugerencias con calificación

Stack: **Vite + React + TypeScript**, **Supabase** (base de datos) y **Vercel** (hosting).

## Rutas

| URL | Pantalla |
| --- | --- |
| `/` | Página de inicio de ColonTab |
| `/r/<slug>/<mesa>` | Bienvenida de la mesa (lo que abre el QR) |
| `/r/<slug>/<mesa>/menu` | Menú con botón "Estoy listo para ordenar" |
| `/r/<slug>/<mesa>/juegos` | Juegos |
| `/admin/login` | Entrar o crear cuenta (personal y administradores) |
| `/admin` | Lista de mis restaurantes |
| `/admin/r/<slug>` | **Panel del restaurante**: llamadas de mesas en vivo con sonido ajustable, menú, mesas y QR, sugerencias, ajustes, equipo |
| `/admin/plataforma` | **Panel de la plataforma**: crear restaurantes, asignar dueños, activar/desactivar, eliminar |

## Roles

| Rol | Cómo se asigna | Qué puede hacer |
| --- | --- | --- |
| Administrador de plataforma | Su email en la tabla `platform_admins` (por SQL) | Todo, en todos los restaurantes |
| Dueño (`owner`) | Lo asigna la plataforma al crear el restaurante | Su restaurante completo, incluidos ajustes y equipo |
| Personal (`staff`) | Lo agrega el dueño en la pestaña Equipo | Llamadas, menú, QR y sugerencias |

El acceso se da por email: la persona crea su cuenta en `/admin/login` con el email que se le asignó.

Ejemplo de QR para la mesa 4: `https://tu-dominio.vercel.app/r/la-esquina/4`

## Desarrollo local

```bash
npm install
npm run dev
```

Sin variables de entorno funciona en **modo demo** con datos de ejemplo.

## Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Abre **SQL Editor** y ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql)
   (crea las tablas, permisos RLS y un restaurante de ejemplo `la-esquina`).
   Si ya lo habías ejecutado antes, corre también los archivos de [`supabase/migrations/`](supabase/migrations/) en orden.
3. Pon tu email de administrador al final del SQL (línea `platform_admins`) o ejecuta:
   `insert into platform_admins (email) values ('tu@email.com');`
4. En **Authentication → URL Configuration** pon la URL de tu sitio (por ejemplo la de Vercel) como *Site URL*.
5. Si ya habías ejecutado una versión anterior del SQL, ejecuta también, en orden, los archivos de
   [`supabase/migrations/002_listo_para_ordenar.sql`](supabase/migrations/002_listo_para_ordenar.sql).
6. Copia `.env.example` a `.env` y pon tu URL y anon key (Project Settings → API).

Tablas: `restaurants`, `menu_categories`, `menu_items`, `orders`, `order_items`, `service_requests`, `suggestions`.

Los clientes (rol `anon`) solo pueden leer el restaurante y el menú, y crear llamadas y sugerencias.
Solo el personal del restaurante puede verlas.

## Cobro anual por restaurante

- **Tu panel → Cobros** (solo administrador de la plataforma): estado de cada restaurante (al día, por vencer,
  vencido, sin fecha), cobrado en el año, **Registrar pago** (suma 12 meses al vencimiento, o desde hoy si ya venció),
  **Editar** (precio anual y fecha a mano), **Historial** y **Avisar** (correo prellenado o mensaje para WhatsApp).
- **Panel del restaurante → Servicio**: días restantes, fecha de vencimiento, precio y pagos.
- **7 días antes**: franja de aviso en el panel y una ventana una vez al día.
- **Al día siguiente del vencimiento**: el panel del restaurante se bloquea y sus mesas no pueden enviar avisos
  (la base de datos los rechaza). El último día pagado todavía funciona. La plataforma siempre puede entrar.
- Sin fecha = no se bloquea (para restaurantes que aún no pagan el primer año).
- El dueño no puede cambiar su fecha ni el precio (lo impide la base de datos). El precio vive en `restaurant_billing`,
  que los clientes no pueden leer.
- Requiere [`supabase/migrations/009_cobro_anual.sql`](supabase/migrations/009_cobro_anual.sql).

## Artículos, ventas de placas y planes

En **tu panel → Plataforma** hay cinco secciones: Restaurantes, Cobros, **Ventas**, **Artículos** y **Planes**.

- **Artículos**: catálogo universal (placas NFC/QR, stickers…). Cada artículo tiene hasta **4 precios por cantidad**
  (1 unidad, desde 10, desde 25, desde 50 — las cantidades se pueden cambiar).
- **Ventas**: registra lo que vendes a cada restaurante (o a otro cliente). El precio por unidad se elige solo según la
  cantidad y se puede cambiar a mano. Totales del mes/año, unidades y **por cobrar** (ventas pendientes).
  El restaurante ve sus compras en su pestaña **Servicio**.
- **Planes**: nombre, precio, moneda y meses. Se asignan en **Cobros → Editar**; al registrar un pago se usa el
  precio del plan (o un precio especial para ese restaurante).
- Requiere [`supabase/migrations/010_articulos_ventas_planes.sql`](supabase/migrations/010_articulos_ventas_planes.sql).

## Notificaciones en pantalla

En la pestaña **Llamadas** se activan las notificaciones del sistema: cuando una mesa llama aparece la
viñeta de Chrome en la esquina, aunque haya otra aplicación al frente, y se queda hasta cerrarla.
Al tocarla se abre el panel. Se cierran solas cuando alguien marca la llamada como atendida.
Requiere que el panel siga abierto en alguna pestaña (puede estar minimizado).

## Etiquetas NFC

En **Mesas y QR → Grabar etiquetas NFC** se graba el enlace de cada mesa en una etiqueta NFC (NTAG213/215
sirven). Al acercar el celular a la etiqueta, el cliente entra directo a su mesa, igual que con el QR.

- Para grabar desde el panel se necesita **Chrome en Android** con NFC encendido y el sitio en HTTPS (Vercel ya lo es).
- Graba en serie: al terminar una mesa pasa a la siguiente.
- Opción de **bloquear** la etiqueta para que nadie la cambie (no se puede deshacer).
- Desde computadora o iPhone: copia el enlace y grábalo con una app como NFC Tools.

### Códigos de mesa (no se puede cambiar de mesa por la dirección)

- Cada mesa tiene un **código secreto aleatorio** (tabla `restaurant_tables`). El QR y el NFC llevan
  `https://www.colontab.com/t/<código>`, nunca el número de mesa.
- Los clientes solo pueden avisar, sugerir y registrar visitas con las funciones `request_service`,
  `send_suggestion` y `record_visit`, que **validan el código en la base de datos** (no hay inserción directa).
- `/r/<restaurante>/<mesa>` es solo **vista previa** para el dueño: los botones no envían avisos.
- En **Mesas y QR** el dueño puede cambiar el código de una mesa o de todas si un QR se filtra.
- La demo de la portada es una vista previa (`/r/la-esquina/4`): no envía avisos a ninguna mesa real.
- Requiere [`007_codigos_de_mesa.sql`](supabase/migrations/007_codigos_de_mesa.sql) y [`008_quitar_codigo_demo.sql`](supabase/migrations/008_quitar_codigo_demo.sql).

### Enlaces de mesa, bienvenida y visitas

- El **QR abre directo el menú**; la etiqueta NFC abre la pantalla de la mesa con la bienvenida.
- Cada QR y etiqueta lleva la dirección final, sin redirecciones. `?v=nfc` o `?v=qr` marca por dónde entró
  el cliente. Los enlaces viejos `/m/...` y `/r/...` solo abren la vista previa.
- Al entrar por NFC aparece "¡Listo! Estás en la Mesa X". (No vibra: los navegadores no dejan vibrar a una página que aún no se ha tocado.)
- Las visitas se guardan en `table_visits` y se ven en **Mesas y QR** (hoy, 7 y 30 días, por mesa).
  Requiere [`supabase/migrations/005_visitas.sql`](supabase/migrations/005_visitas.sql).

## Sonido de avisos

El panel toca una campana distinta para cada aviso (listo para ordenar, mesero, cuenta), generada en el
navegador y comprimida para que se escuche fuerte en los parlantes. El volumen y la opción de repetir cada
20 s se guardan en cada computadora. Los navegadores exigen un clic antes de permitir sonido: el panel muestra
un aviso para activarlo.

## SEO (Google)

- La portada (`/`) se **pre-genera en la build** (`scripts/prerender.mjs`): el HTML ya trae todo el texto,
  así Google la lee sin ejecutar JavaScript. Las demás rutas usan `app.html`.
- Título, descripción, vista previa para compartir (`public/og-image.png`) y datos estructurados
  (Organization, WebSite, SoftwareApplication, FAQPage) salen de [`src/lib/site.ts`](src/lib/site.ts).
- `public/robots.txt` y `public/sitemap.xml` (actualiza `lastmod` cuando cambies la portada).
- Las mesas (`/r/...`) y el panel (`/admin...`) llevan `X-Robots-Tag: noindex` desde `vercel.json`.

## Desplegar en Vercel

1. Sube el proyecto a GitHub.
2. En Vercel: **Add New → Project**, importa el repo (detecta Vite solo).
3. En **Environment Variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Deploy. El archivo `vercel.json` ya redirige todas las rutas a `index.html`.

O desde la terminal: `npx vercel` y luego `npx vercel --prod`.
