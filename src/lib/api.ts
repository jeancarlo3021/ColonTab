// Funciones que usa la app del cliente (la que abre el QR).
import { supabase } from './supabase'
import { demoTables, readDB, uid, wait, writeDB } from './demoStore'
import { serviceStatus } from './billing'
import type { MenuCategory, MenuItem, PaymentMethod, Restaurant, ServiceType, VisitSource } from '../types'

export async function getRestaurant(slug: string): Promise<Restaurant | null> {
  if (!supabase) return readDB().restaurants.find((r) => r.slug === slug) ?? null
  const { data, error } = await supabase.from('restaurants').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data as Restaurant | null
}

export async function getMenu(
  restaurantId: string,
  includeUnavailable = false,
): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
  if (!supabase) {
    const db = readDB()
    return {
      categories: db.categories.filter((c) => c.restaurant_id === restaurantId).sort((a, b) => a.position - b.position),
      items: db.items
        .filter((i) => i.restaurant_id === restaurantId && (includeUnavailable || i.available))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  }
  let itemsQuery = supabase
    .from('menu_items')
    .select('id,category_id,name,description,price,image_url,available')
    .eq('restaurant_id', restaurantId)
  if (!includeUnavailable) itemsQuery = itemsQuery.eq('available', true)
  const [cats, items] = await Promise.all([
    supabase.from('menu_categories').select('id,name,position').eq('restaurant_id', restaurantId).order('position'),
    itemsQuery.order('name'),
  ])
  if (cats.error) throw cats.error
  if (items.error) throw items.error
  return {
    categories: cats.data as MenuCategory[],
    items: (items.data as MenuItem[]).map((i) => ({ ...i, price: Number(i.price) })),
  }
}

/** Activo y con el servicio al día (el último día pagado todavía cuenta). */
export function isAvailable(r: Restaurant) {
  return r.active && serviceStatus(r.paid_until).state !== 'expired'
}

/** Mensaje cuando se abre una mesa sin código (vista previa del restaurante). */
export const PREVIEW_MESSAGE = 'Esto es una vista previa. Escanea el QR o la etiqueta NFC de tu mesa para avisar al personal.'

/**
 * Busca la mesa de un código de QR/NFC. El código es secreto y aleatorio: cambiar la dirección
 * no permite pasar a otra mesa. La base de datos vuelve a validarlo en cada aviso.
 */
export async function resolveTable(token: string): Promise<{ restaurant: Restaurant; table: number; available: boolean } | null> {
  if (!/^[A-Za-z0-9]{4,32}$/.test(token)) return null
  if (!supabase) {
    const db = demoTables()
    const t = db.tables!.find((x) => x.token === token)
    const restaurant = t && db.restaurants.find((r) => r.id === t.restaurant_id)
    if (!t || !restaurant || t.number > restaurant.table_count) return null
    return { restaurant, table: t.number, available: isAvailable(restaurant) }
  }
  const { data, error } = await supabase.rpc('resolve_table', { p_token: token })
  if (error) throw error
  const row = (data as { slug: string; table_number: number; available?: boolean }[] | null)?.[0]
  if (!row) return null
  const restaurant = await getRestaurant(row.slug)
  if (!restaurant) return null
  // "available" viene de la base (activo y con servicio al día); si aún no existe la columna, se calcula aquí
  return { restaurant, table: row.table_number, available: row.available ?? isAvailable(restaurant) }
}

/** Mesa de un código en modo demo (o null). */
function demoTable(token: string | null) {
  if (!token) throw new Error(PREVIEW_MESSAGE)
  const db = demoTables()
  const t = db.tables!.find((x) => x.token === token)
  const r = t && db.restaurants.find((x) => x.id === t.restaurant_id)
  if (!t || !r || t.number > r.table_count) throw new Error('Mesa no válida. Escanea el código de tu mesa.')
  if (!isAvailable(r)) throw new Error('Este restaurante no está disponible por ahora.')
  return { restaurantId: r.id, table: t.number }
}

export async function requestService(params: {
  token: string | null
  type: ServiceType
  guests?: number | null
  paymentMethod?: PaymentMethod
}): Promise<void> {
  if (!supabase) {
    await wait()
    const { restaurantId, table } = demoTable(params.token)
    return writeDB((db) => {
      const dup = db.serviceRequests.some(
        (s) => s.restaurant_id === restaurantId && s.table_number === table && s.type === params.type &&
          s.status === 'pendiente' && Date.now() - new Date(s.created_at).getTime() < 20_000,
      )
      if (dup) return
      db.serviceRequests.push({
        id: uid(),
        restaurant_id: restaurantId,
        table_number: table,
        type: params.type,
        guests: params.guests ?? null,
        payment_method: params.paymentMethod ?? null,
        status: 'pendiente',
        created_at: new Date().toISOString(),
      })
    })
  }
  if (!params.token) throw new Error(PREVIEW_MESSAGE)
  const { error } = await supabase.rpc('request_service', {
    p_token: params.token,
    p_type: params.type,
    p_payment_method: params.paymentMethod ?? null,
    p_guests: params.guests ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function sendSuggestion(params: { token: string | null; rating: number | null; message: string }): Promise<void> {
  if (!supabase) {
    await wait()
    const { restaurantId, table } = demoTable(params.token)
    return writeDB((db) => {
      db.suggestions.push({
        id: uid(),
        restaurant_id: restaurantId,
        table_number: table,
        rating: params.rating,
        message: params.message,
        created_at: new Date().toISOString(),
      })
    })
  }
  if (!params.token) throw new Error(PREVIEW_MESSAGE)
  const { error } = await supabase.rpc('send_suggestion', { p_token: params.token, p_rating: params.rating, p_message: params.message })
  if (error) throw new Error(error.message)
}

/** Registra que alguien abrió la mesa (por NFC, QR o enlace). Si falla no molesta al cliente. */
export async function recordVisit(params: { token: string; source: VisitSource }): Promise<void> {
  if (!supabase) {
    const { restaurantId, table } = demoTable(params.token)
    return writeDB((db) => {
      db.visits ??= []
      db.visits.push({ id: uid(), restaurant_id: restaurantId, table_number: table, source: params.source, created_at: new Date().toISOString() })
    })
  }
  await supabase.rpc('record_visit', { p_token: params.token, p_source: params.source })
}
