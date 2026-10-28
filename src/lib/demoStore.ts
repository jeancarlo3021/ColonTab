// Base de datos falsa en el navegador (localStorage) para probar la app sin Supabase.
// Los pedidos que hace un cliente en una pestaña aparecen en el panel abierto en otra.
import type { Member, MenuCategory, MenuItem, Order, Plan, Product, ProductSale, Restaurant, RestaurantBilling, ServiceRequest, SubscriptionPayment, Suggestion, Visit } from '../types'
import { addDays, crToday, periodEnd } from './billing'

export interface DemoDB {
  restaurants: Restaurant[]
  categories: (MenuCategory & { restaurant_id: string })[]
  items: (MenuItem & { restaurant_id: string })[]
  orders: Order[]
  serviceRequests: ServiceRequest[]
  suggestions: Suggestion[]
  members: Member[]
  visits?: Visit[]
  /** Códigos secretos de cada mesa (QR/NFC) */
  tables?: { restaurant_id: string; number: number; token: string }[]
  billing?: (RestaurantBilling & { restaurant_id: string })[]
  payments?: SubscriptionPayment[]
  plans?: Plan[]
  products?: Product[]
  sales?: ProductSale[]
}

const KEY = 'mesaclick:demo-db:v1'
export const DEMO_EVENT = 'mesaclick-demo-change'

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export function emptyRestaurant(partial: Partial<Restaurant> & Pick<Restaurant, 'slug' | 'name'>): Restaurant {
  return {
    id: uid(),
    logo_text: partial.name.slice(0, 2).toUpperCase(),
    logo_url: null,
    primary_color: '#00D492',
    wifi_ssid: null,
    wifi_password: null,
    whatsapp: null,
    sinpe_phone: null,
    sinpe_name: null,
    instagram: null,
    tiktok: null,
    google_review_url: null,
    maps_url: null,
    address: null,
    hours: null,
    currency: 'MXN',
    table_count: 10,
    active: true,
    menu_type: 'custom',
    menu_url: null,
    paid_until: null,
    ...partial,
  }
}

function seed(): DemoDB {
  const r = emptyRestaurant({
    id: 'demo-la-esquina',
    slug: 'la-esquina',
    name: 'La Esquina Restaurants',
    logo_text: 'LE',
    wifi_ssid: 'LaEsquina_Clientes',
    wifi_password: 'esquina2026',
    whatsapp: '5215512345678',
    sinpe_phone: '88888888',
    sinpe_name: 'La Esquina S.A.',
    instagram: 'https://instagram.com/',
    tiktok: 'https://tiktok.com/',
    google_review_url: 'https://www.google.com/maps',
    maps_url: 'https://www.google.com/maps',
    address: 'Av. Principal 123, Centro',
    hours: 'Lun a Jue: 12:00 – 22:00\nVie y Sáb: 12:00 – 00:00\nDom: 12:00 – 18:00',
  })
  r.paid_until = periodEnd(addDays(crToday(), -165), 12)
  const cats = ['Entradas', 'Platos fuertes', 'Bebidas', 'Postres'].map((name, i) => ({
    id: `c${i + 1}`, restaurant_id: r.id, name, position: i + 1,
  }))
  const item = (id: string, category_id: string, name: string, price: number, description: string) => ({
    id, restaurant_id: r.id, category_id, name, price, description, image_url: null, available: true,
  })
  return {
    restaurants: [r],
    categories: cats,
    items: [
      item('m1', 'c1', 'Guacamole con totopos', 95, 'Aguacate fresco, cebolla, cilantro y chile serrano.'),
      item('m2', 'c1', 'Queso fundido', 110, 'Con chorizo y tortillas de harina.'),
      item('m3', 'c2', 'Tacos al pastor (4)', 120, 'Piña, cebolla y cilantro.'),
      item('m4', 'c2', 'Enchiladas verdes', 145, 'Rellenas de pollo, crema y queso.'),
      item('m5', 'c2', 'Arrachera', 240, 'Con frijoles charros y guacamole.'),
      item('m6', 'c3', 'Agua de horchata', 45, 'Vaso de 500 ml.'),
      item('m7', 'c3', 'Limonada mineral', 50, 'Natural o de pepino.'),
      item('m8', 'c3', 'Café de olla', 40, 'Con canela y piloncillo.'),
      item('m9', 'c4', 'Flan napolitano', 65, 'Receta de la casa.'),
      item('m10', 'c4', 'Churros con chocolate', 75, 'Seis piezas.'),
    ],
    orders: [],
    serviceRequests: [],
    suggestions: [],
    members: [{ id: uid(), restaurant_id: r.id, email: 'dueno@laesquina.mx', role: 'owner' }],
    billing: [{ restaurant_id: r.id, plan_price: null, plan_currency: 'CRC', note: null, plan_id: 'plan-basico' }],
    plans: [
      { id: 'plan-basico', name: 'Básico', description: 'Menú, QR/NFC y avisos al mesero', price: 120000, currency: 'CRC', months: 12, active: true },
      { id: 'plan-pro', name: 'Pro', description: 'Todo lo del Básico + varias sucursales y soporte prioritario', price: 180000, currency: 'CRC', months: 12, active: true },
    ],
    products: [
      {
        id: 'prod-placa', name: 'Placa NFC + QR para mesa', description: 'Placa acrílica con etiqueta NFC y código QR', currency: 'CRC', active: true,
        tiers: [{ min: 1, price: 6000 }, { min: 10, price: 5000 }, { min: 25, price: 4500 }, { min: 50, price: 4000 }],
      },
      {
        id: 'prod-sticker', name: 'Sticker QR', description: 'Sticker resistente al agua', currency: 'CRC', active: true,
        tiers: [{ min: 1, price: 1500 }, { min: 10, price: 1200 }, { min: 25, price: 1000 }, { min: 50, price: 800 }],
      },
    ],
    sales: [
      {
        id: uid(), restaurant_id: r.id, customer_name: null, product_id: 'prod-placa', product_name: 'Placa NFC + QR para mesa',
        quantity: 10, unit_price: 5000, total: 50000, currency: 'CRC', sold_at: addDays(crToday(), -160), paid: true, note: null,
        created_at: new Date().toISOString(),
      },
    ],
    payments: [demoPayment(r.id, addDays(crToday(), -165))],
  }
}

let memory: DemoDB | null = null

export function readDB(): DemoDB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DemoDB
  } catch {
    /* sin almacenamiento */
  }
  memory ??= seed()
  return memory
}

export function writeDB(mutate: (db: DemoDB) => void): void {
  const db = readDB()
  mutate(db)
  memory = db
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new Event(DEMO_EVENT))
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* sin almacenamiento */
  }
  memory = null
  window.dispatchEvent(new Event(DEMO_EVENT))
}

export const wait = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms))

/** Código aleatorio de 12 letras y números, igual que en la base de datos. */
export function newToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

/** Asegura que cada mesa de cada restaurante demo tenga su código. */
export function demoTables(): DemoDB {
  const db = readDB()
  const tables = db.tables ?? []
  const missing: NonNullable<DemoDB['tables']> = []
  for (const r of db.restaurants) {
    for (let n = 1; n <= r.table_count; n++) {
      if (!tables.some((t) => t.restaurant_id === r.id && t.number === n)) {
        missing.push({ restaurant_id: r.id, number: n, token: newToken() })
      }
    }
  }
  if (!db.tables || missing.length) writeDB((d) => void (d.tables = [...(d.tables ?? []), ...missing]))
  return readDB()
}

function demoPayment(restaurantId: string, start: string): SubscriptionPayment {
  return {
    id: uid(), restaurant_id: restaurantId, amount: 120000, currency: 'CRC', method: 'SINPE Móvil', note: 'Plan anual',
    period_start: start, period_end: periodEnd(start, 12), created_by: 'admin@colontab.app', created_at: new Date(`${start}T15:00:00Z`).toISOString(),
  }
}
