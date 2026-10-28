// Funciones de los paneles de administración (restaurante y plataforma).
import { supabase } from './supabase'
import { DEMO_EVENT, emptyRestaurant, readDB, uid, wait, writeDB } from './demoStore'
import type {
  Member, MemberRole, MenuCategory, MenuItem, Restaurant, RestaurantSummary,
  ServiceRequest, Suggestion,
} from '../types'

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ───────── Cuenta ─────────
export async function checkPlatformAdmin(email: string): Promise<boolean> {
  if (!supabase) return true
  const data = check(await supabase.from('platform_admins').select('email').eq('email', email.toLowerCase()).maybeSingle())
  return !!data
}

export async function listMyRestaurants(email: string, isPlatformAdmin: boolean): Promise<Restaurant[]> {
  if (!supabase) return readDB().restaurants
  if (isPlatformAdmin) return check(await supabase.from('restaurants').select('*').order('name')) as Restaurant[]
  const members = check(await supabase.from('restaurant_members').select('restaurant_id').eq('email', email.toLowerCase()))
  const ids = (members as { restaurant_id: string }[]).map((m) => m.restaurant_id)
  if (ids.length === 0) return []
  return check(await supabase.from('restaurants').select('*').in('id', ids).order('name')) as Restaurant[]
}

// ───────── Restaurante ─────────
export async function getRestaurantAdmin(slug: string): Promise<Restaurant | null> {
  if (!supabase) return readDB().restaurants.find((r) => r.slug === slug) ?? null
  return check(await supabase.from('restaurants').select('*').eq('slug', slug).maybeSingle()) as Restaurant | null
}

export type RestaurantPatch = Partial<Omit<Restaurant, 'id'>>

export async function updateRestaurant(id: string, patch: RestaurantPatch): Promise<void> {
  if (!supabase) {
    await wait()
    return writeDB((db) => {
      const r = db.restaurants.find((x) => x.id === id)
      if (r) Object.assign(r, patch)
    })
  }
  check(await supabase.from('restaurants').update(patch).eq('id', id))
}

// ───────── Plataforma ─────────
export async function listAllRestaurants(): Promise<RestaurantSummary[]> {
  if (!supabase) {
    const db = readDB()
    return db.restaurants.map((r) => ({
      ...r,
      owner_email: db.members.find((m) => m.restaurant_id === r.id && m.role === 'owner')?.email ?? null,
      request_count: db.serviceRequests.filter((o) => o.restaurant_id === r.id).length,
    }))
  }
  const rows = check(
    await supabase.from('restaurants').select('*, service_requests(count), restaurant_members(email, role)').order('created_at'),
  ) as (Restaurant & { service_requests: { count: number }[]; restaurant_members: { email: string; role: MemberRole }[] })[]
  return rows.map(({ service_requests, restaurant_members, ...r }) => ({
    ...r,
    owner_email: restaurant_members.find((m) => m.role === 'owner')?.email ?? null,
    request_count: service_requests[0]?.count ?? 0,
  }))
}

export async function createRestaurant(input: {
  name: string
  slug: string
  ownerEmail: string
  primaryColor: string
  tableCount: number
}): Promise<void> {
  const base = {
    name: input.name,
    slug: input.slug,
    logo_text: input.name.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'CT',
    primary_color: input.primaryColor,
    table_count: input.tableCount,
  }
  const email = input.ownerEmail.trim().toLowerCase()
  if (!supabase) {
    await wait()
    if (readDB().restaurants.some((r) => r.slug === input.slug)) throw new Error('Ya existe un restaurante con ese enlace')
    return writeDB((db) => {
      const r = emptyRestaurant(base)
      db.restaurants.push(r)
      if (email) db.members.push({ id: uid(), restaurant_id: r.id, email, role: 'owner' })
    })
  }
  const created = check(await supabase.from('restaurants').insert(base).select('id').single()) as { id: string }
  if (email) {
    check(await supabase.from('restaurant_members').insert({ restaurant_id: created.id, email, role: 'owner' }))
  }
}

export async function deleteRestaurant(id: string): Promise<void> {
  if (!supabase) {
    await wait()
    return writeDB((db) => {
      db.restaurants = db.restaurants.filter((r) => r.id !== id)
      db.members = db.members.filter((m) => m.restaurant_id !== id)
      db.categories = db.categories.filter((c) => c.restaurant_id !== id)
      db.items = db.items.filter((i) => i.restaurant_id !== id)
      db.orders = db.orders.filter((o) => o.restaurant_id !== id)
      db.serviceRequests = db.serviceRequests.filter((s) => s.restaurant_id !== id)
      db.suggestions = db.suggestions.filter((s) => s.restaurant_id !== id)
    })
  }
  check(await supabase.from('restaurants').delete().eq('id', id))
}

// ───────── Menú ─────────
export async function saveCategory(restaurantId: string, cat: Partial<MenuCategory> & { name: string }): Promise<void> {
  if (!supabase) {
    return writeDB((db) => {
      const found = cat.id && db.categories.find((c) => c.id === cat.id)
      if (found) Object.assign(found, cat)
      else db.categories.push({ id: uid(), restaurant_id: restaurantId, position: cat.position ?? 99, name: cat.name })
    })
  }
  if (cat.id) check(await supabase.from('menu_categories').update({ name: cat.name, position: cat.position }).eq('id', cat.id))
  else check(await supabase.from('menu_categories').insert({ restaurant_id: restaurantId, name: cat.name, position: cat.position ?? 99 }))
}

export async function deleteCategory(id: string): Promise<void> {
  if (!supabase) {
    return writeDB((db) => {
      db.categories = db.categories.filter((c) => c.id !== id)
      db.items = db.items.filter((i) => i.category_id !== id)
    })
  }
  check(await supabase.from('menu_categories').delete().eq('id', id))
}

export async function saveItem(restaurantId: string, item: Omit<MenuItem, 'id'> & { id?: string }): Promise<void> {
  if (!supabase) {
    return writeDB((db) => {
      const found = item.id && db.items.find((i) => i.id === item.id)
      if (found) Object.assign(found, item)
      else db.items.push({ ...item, id: uid(), restaurant_id: restaurantId })
    })
  }
  const { id, ...fields } = item
  if (id) check(await supabase.from('menu_items').update(fields).eq('id', id))
  else check(await supabase.from('menu_items').insert({ ...fields, restaurant_id: restaurantId }))
}

export async function deleteItem(id: string): Promise<void> {
  if (!supabase) return writeDB((db) => void (db.items = db.items.filter((i) => i.id !== id)))
  check(await supabase.from('menu_items').delete().eq('id', id))
}

// ───────── Pedidos y llamadas ─────────
export async function listPendingRequests(restaurantId: string): Promise<ServiceRequest[]> {
  if (!supabase) {
    return readDB().serviceRequests.filter((s) => s.restaurant_id === restaurantId && s.status === 'pendiente')
  }
  return check(
    await supabase
      .from('service_requests')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pendiente')
      .order('created_at'),
  ) as ServiceRequest[]
}

export async function resolveRequest(id: string): Promise<void> {
  if (!supabase) {
    return writeDB((db) => {
      const s = db.serviceRequests.find((x) => x.id === id)
      if (s) s.status = 'atendido'
    })
  }
  check(await supabase.from('service_requests').update({ status: 'atendido' }).eq('id', id))
}

/** Avisa cuando llegan o cambian llamadas de mesas. Devuelve la función para dejar de escuchar. */
export function subscribeLive(restaurantId: string, onChange: () => void): () => void {
  if (!supabase) {
    const onStorage = (e: StorageEvent) => e.key?.startsWith('mesaclick:demo-db') && onChange()
    window.addEventListener(DEMO_EVENT, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(DEMO_EVENT, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }
  const client = supabase
  const filter = `restaurant_id=eq.${restaurantId}`
  const channel = client
    .channel(`live-${restaurantId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests', filter }, onChange)
    .subscribe()
  return () => void client.removeChannel(channel)
}

// ───────── Sugerencias ─────────
export async function listSuggestions(restaurantId: string): Promise<Suggestion[]> {
  if (!supabase) {
    return readDB()
      .suggestions.filter((s) => s.restaurant_id === restaurantId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  return check(
    await supabase.from('suggestions').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(200),
  ) as Suggestion[]
}

export async function deleteSuggestion(id: string): Promise<void> {
  if (!supabase) return writeDB((db) => void (db.suggestions = db.suggestions.filter((s) => s.id !== id)))
  check(await supabase.from('suggestions').delete().eq('id', id))
}

// ───────── Equipo ─────────
export async function listMembers(restaurantId: string): Promise<Member[]> {
  if (!supabase) return readDB().members.filter((m) => m.restaurant_id === restaurantId)
  return check(await supabase.from('restaurant_members').select('id, restaurant_id, email, role').eq('restaurant_id', restaurantId).order('role')) as Member[]
}

export async function addMember(restaurantId: string, email: string, role: MemberRole): Promise<void> {
  const clean = email.trim().toLowerCase()
  if (!supabase) {
    if (readDB().members.some((m) => m.restaurant_id === restaurantId && m.email === clean)) throw new Error('Ese email ya está en el equipo')
    return writeDB((db) => void db.members.push({ id: uid(), restaurant_id: restaurantId, email: clean, role }))
  }
  check(await supabase.from('restaurant_members').insert({ restaurant_id: restaurantId, email: clean, role }))
}

export async function removeMember(id: string): Promise<void> {
  if (!supabase) return writeDB((db) => void (db.members = db.members.filter((m) => m.id !== id)))
  check(await supabase.from('restaurant_members').delete().eq('id', id))
}
