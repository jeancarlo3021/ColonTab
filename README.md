# MesaClick

Menú digital por QR para restaurantes. El cliente escanea el QR de su mesa y desde su celular puede:

- Ver el menú y ordenar (el pedido llega a Supabase)
- Llamar al mesero / pedir la cuenta (con forma de pago)
- Jugar mientras espera (Gato y Memoria)
- Ver Wi-Fi, WhatsApp, redes sociales, reseña en Google, ubicación y horario
- Enviar sugerencias con calificación

Stack: **Vite + React + TypeScript**, **Supabase** (base de datos) y **Vercel** (hosting).

## Rutas

| URL | Pantalla |
| --- | --- |
| `/` | Página de inicio de MesaClick |
| `/r/<slug>/<mesa>` | Bienvenida de la mesa (lo que abre el QR) |
| `/r/<slug>/<mesa>/menu` | Menú y carrito |
| `/r/<slug>/<mesa>/juegos` | Juegos |
| `/admin/login` | Entrar o crear cuenta (personal y administradores) |
| `/admin` | Lista de mis restaurantes |
| `/admin/r/<slug>` | **Panel del restaurante**: pedidos en vivo, llamadas, menú, mesas y QR, sugerencias, ajustes, equipo |
| `/admin/plataforma` | **Panel de la plataforma**: crear restaurantes, asignar dueños, activar/desactivar, eliminar |

## Roles

| Rol | Cómo se asigna | Qué puede hacer |
| --- | --- | --- |
| Administrador de plataforma | Su email en la tabla `platform_admins` (por SQL) | Todo, en todos los restaurantes |
| Dueño (`owner`) | Lo asigna la plataforma al crear el restaurante | Su restaurante completo, incluidos ajustes y equipo |
| Personal (`staff`) | Lo agrega el dueño en la pestaña Equipo | Pedidos, llamadas, menú, QR y sugerencias |

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
   (crea las tablas, permisos RLS, la función `create_order` y un restaurante de ejemplo `la-esquina`).
3. Pon tu email de administrador al final del SQL (línea `platform_admins`) o ejecuta:
   `insert into platform_admins (email) values ('tu@email.com');`
4. En **Authentication → URL Configuration** pon la URL de tu sitio (por ejemplo la de Vercel) como *Site URL*.
5. Copia `.env.example` a `.env` y pon tu URL y anon key (Project Settings → API).

Tablas: `restaurants`, `menu_categories`, `menu_items`, `orders`, `order_items`, `service_requests`, `suggestions`.

Los clientes (rol `anon`) solo pueden leer el restaurante y el menú, y crear pedidos, llamadas y sugerencias.
Leer pedidos queda reservado a usuarios autenticados (para un futuro panel del personal).

## Desplegar en Vercel

1. Sube el proyecto a GitHub.
2. En Vercel: **Add New → Project**, importa el repo (detecta Vite solo).
3. En **Environment Variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Deploy. El archivo `vercel.json` ya redirige todas las rutas a `index.html`.

O desde la terminal: `npx vercel` y luego `npx vercel --prod`.
