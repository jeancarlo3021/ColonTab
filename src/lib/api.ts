import { supabase } from './supabase'
import { demoCategories, demoItems, demoRestaurant } from './demo'
import type { CartLine, MenuCategory, MenuItem, PaymentMethod, Restaurant, ServiceType } from '../types'

const wait = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms))

export async function getRestaurant(slug: string): Promise<Restaurant | null> {
  if (!supabase) return slug === demoRestaurant.slug ? demoRestaurant : null
  const { data, error } = await supabase.from('restaurants').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data as Restaurant | null
}

export async function getMenu(restaurantId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
  if (!supabase) return { categories: demoCategories, items: demoItems }
  const [cats, items] = await Promise.all([
    supabase.from('menu_categories').select('id,name,position').eq('restaurant_id', restaurantId).order('position'),
    supabase
      .from('menu_items')
      .select('id,category_id,name,description,price,image_url,available')
      .eq('restaurant_id', restaurantId)
      .eq('available', true)
      .order('name'),
  ])
  if (cats.error) throw cats.error
  if (items.error) throw items.error
  return { categories: cats.data as MenuCategory[], items: items.data as MenuItem[] }
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
    return 'demo-' + Date.now()
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
  if (!supabase) return wait()
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
  if (!supabase) return wait()
  const { error } = await supabase.from('suggestions').insert({
    restaurant_id: params.restaurantId,
    table_number: params.table,
    rating: params.rating,
    message: params.message,
  })
  if (error) throw error
}
