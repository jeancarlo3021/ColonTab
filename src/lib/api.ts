// Funciones que usa la app del cliente (la que abre el QR).
import { supabase } from './supabase'
import { readDB, uid, wait, writeDB } from './demoStore'
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

export async function requestService(params: {
  restaurantId: string
  table: number
  type: ServiceType
  guests?: number | null
  paymentMethod?: PaymentMethod
}): Promise<void> {
  if (!supabase) {
    await wait()
    return writeDB((db) => {
      db.serviceRequests.push({
        id: uid(),
        restaurant_id: params.restaurantId,
        table_number: params.table,
        type: params.type,
        guests: params.guests ?? null,
        payment_method: params.paymentMethod ?? null,
        status: 'pendiente',
        created_at: new Date().toISOString(),
      })
    })
  }
  const { error } = await supabase.from('service_requests').insert({
    restaurant_id: params.restaurantId,
    table_number: params.table,
    type: params.type,
    guests: params.guests ?? null,
    payment_method: params.paymentMethod ?? null,
  })
  if (error) throw error
}

export async function sendSuggestion(params: {
  restaurantId: string
  table: number
  rating: number | null
  message: string
}): Promise<void> {
  if (!supabase) {
    await wait()
    return writeDB((db) => {
      db.suggestions.push({
        id: uid(),
        restaurant_id: params.restaurantId,
        table_number: params.table,
        rating: params.rating,
        message: params.message,
        created_at: new Date().toISOString(),
      })
    })
  }
  const { error } = await supabase.from('suggestions').insert({
    restaurant_id: params.restaurantId,
    table_number: params.table,
    rating: params.rating,
    message: params.message,
  })
  if (error) throw error
}

/** Registra que alguien abrió la mesa (por NFC, QR o enlace). Si falla no molesta al cliente. */
export async function recordVisit(params: { restaurantId: string; table: number; source: VisitSource }): Promise<void> {
  if (!supabase) {
    return writeDB((db) => {
      db.visits ??= []
      db.visits.push({
        id: uid(),
        restaurant_id: params.restaurantId,
        table_number: params.table,
        source: params.source,
        created_at: new Date().toISOString(),
      })
    })
  }
  await supabase
    .from('table_visits')
    .insert({ restaurant_id: params.restaurantId, table_number: params.table, source: params.source })
}
