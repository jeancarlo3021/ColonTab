// Funciones que usa la app del cliente (la que abre el QR).
import { supabase } from './supabase'
import { readDB, uid, wait, writeDB } from './demoStore'
import type { CartLine, MenuCategory, MenuItem, PaymentMethod, Restaurant, ServiceType } from '../types'

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

export async function createOrder(params: {
  restaurantId: string
  table: number
  guests: number | null
  notes: string
  lines: CartLine[]
}): Promise<string> {
  if (!supabase) {
    await wait()
    const id = uid()
    writeDB((db) => {
      const order_items = params.lines.flatMap((l) => {
        const item = db.items.find((i) => i.id === l.item.id && i.available)
        return item ? [{ id: uid(), name: item.name, price: item.price, quantity: l.quantity }] : []
      })
      db.orders.push({
        id,
        restaurant_id: params.restaurantId,
        table_number: params.table,
        guests: params.guests,
        notes: params.notes || null,
        total: order_items.reduce((s, i) => s + i.price * i.quantity, 0),
        status: 'nuevo',
        created_at: new Date().toISOString(),
        order_items,
      })
    })
    return id
  }
  // La función SQL valida precios en el servidor y crea pedido + renglones en una transacción.
  const { data, error } = await supabase.rpc('create_order', {
    p_restaurant_id: params.restaurantId,
    p_table_number: params.table,
    p_guests: params.guests,
    p_notes: params.notes || null,
    p_items: params.lines.map((l) => ({ menu_item_id: l.item.id, quantity: l.quantity })),
  })
  if (error) throw error
  return data as string
}

export async function requestService(params: {
  restaurantId: string
  table: number
  type: ServiceType
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
