// Funciones de los paneles de administración (restaurante y plataforma).
import { supabase } from './supabase'
import { DEMO_EVENT, demoTables, emptyRestaurant, newToken, readDB, uid, wait, writeDB } from './demoStore'
import type {
  Member, MemberRole, MenuCategory, MenuItem, Restaurant, RestaurantSummary,
  Plan, Product, ProductSale, RestaurantBilling, ServiceRequest, SubscriptionPayment, Suggestion, TableToken, Visit,
} from '../types'
import { nextPeriodStart, periodEnd } from './billing'

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ───────── Cuenta ─────────
export async function checkPlatformAdmin(email: string): Promise<boolean> {
  if (!supabase) return email.toLowerCase() === 'admin@colontab.app' // modo demo
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
      billing: demoBilling(db, r.id),
    }))
  }
  const rows = check(
    await supabase.from('restaurants').select('*, service_requests(count), restaurant_members(email, role), restaurant_billing(plan_price, plan_currency, note, plan_id, plans(id, name, description, price, currency, months, active))').order('created_at'),
  ) as (Restaurant & {
    service_requests: { count: number }[]
    restaurant_members: { email: string; role: MemberRole }[]
    restaurant_billing: RestaurantBilling | RestaurantBilling[] | null
  })[]
  return rows.map(({ service_requests, restaurant_members, restaurant_billing, ...r }) => ({
    ...r,
    owner_email: restaurant_members.find((m) => m.role === 'owner')?.email ?? null,
    request_count: service_requests[0]?.count ?? 0,
    billing: normBilling(Array.isArray(restaurant_billing) ? restaurant_billing[0] : restaurant_billing),
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

// ───────── Visitas (NFC / QR) ─────────
export async function listVisits(restaurantId: string, since: Date): Promise<Visit[]> {
  if (!supabase) {
    return (readDB().visits ?? []).filter((v) => v.restaurant_id === restaurantId && new Date(v.created_at) >= since)
  }
  return check(
    await supabase
      .from('table_visits')
      .select('id, restaurant_id, table_number, source, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(10000),
  ) as Visit[]
}

// ───────── Menú en PDF o enlace ─────────
const MAX_PDF_MB = 15

/** Sube el PDF del menú y lo deja como menú del restaurante. Devuelve su dirección pública. */
export async function uploadMenuPdf(restaurantId: string, file: File): Promise<string> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('El archivo debe ser PDF')
  if (!supabase) {
    if (file.size > 4 * 1024 * 1024) throw new Error('En modo demo el PDF debe pesar menos de 4 MB')
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })
    await updateRestaurant(restaurantId, { menu_type: 'pdf', menu_url: url })
    return url
  }
  if (file.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`El PDF debe pesar menos de ${MAX_PDF_MB} MB`)
  const path = `${restaurantId}/menu-${Date.now()}.pdf`
  const up = await supabase.storage.from('menus').upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (up.error) {
    throw new Error(
      /bucket/i.test(up.error.message)
        ? 'Falta crear el espacio para PDFs: ejecuta supabase/migrations/006_menu_pdf_url.sql'
        : up.error.message,
    )
  }
  const url = supabase.storage.from('menus').getPublicUrl(path).data.publicUrl
  await updateRestaurant(restaurantId, { menu_type: 'pdf', menu_url: url })
  return url
}

// ───────── Códigos de mesa (QR / NFC) ─────────
export async function listTableTokens(restaurantId: string): Promise<TableToken[]> {
  if (!supabase) {
    return demoTables()
      .tables!.filter((t) => t.restaurant_id === restaurantId)
      .map(({ number, token }) => ({ number, token }))
      .sort((a, b) => a.number - b.number)
  }
  return check(
    await supabase.from('restaurant_tables').select('number, token').eq('restaurant_id', restaurantId).order('number'),
  ) as TableToken[]
}

/** Cambia el código de una mesa (o de todas si number es null). Los QR/NFC viejos dejan de funcionar. */
export async function regenerateTableTokens(restaurantId: string, number: number | null): Promise<void> {
  if (!supabase) {
    demoTables()
    return writeDB((db) => {
      for (const t of db.tables ?? []) {
        if (t.restaurant_id === restaurantId && (number === null || t.number === number)) t.token = newToken()
      }
    })
  }
  const { error } = await supabase.rpc('regenerate_table_tokens', { p_restaurant_id: restaurantId, p_number: number })
  if (error) throw new Error(error.message)
}

// ───────── Cobro anual ─────────
type RawBilling = RestaurantBilling & { plans?: Plan | Plan[] | null }

function normBilling(b: RawBilling | null | undefined): RestaurantBilling | null {
  if (!b) return null
  const { plans, ...rest } = b
  const plan = Array.isArray(plans) ? plans[0] : plans
  return {
    ...rest,
    plan_price: b.plan_price === null || b.plan_price === undefined ? null : Number(b.plan_price),
    plan: plan ? normPlan(plan) : rest.plan ?? null,
  }
}

const normPlan = (p: Plan): Plan => ({ ...p, price: Number(p.price) })

function demoBilling(db: ReturnType<typeof readDB>, restaurantId: string): RestaurantBilling | null {
  const b = db.billing?.find((x) => x.restaurant_id === restaurantId)
  if (!b) return null
  const plan = db.plans?.find((p) => p.id === b.plan_id) ?? null
  return { plan_price: b.plan_price, plan_currency: b.plan_currency, note: b.note, plan_id: b.plan_id ?? null, plan }
}

export async function getBilling(restaurantId: string): Promise<RestaurantBilling | null> {
  if (!supabase) return demoBilling(readDB(), restaurantId)
  const data = check(
    await supabase
      .from('restaurant_billing')
      .select('plan_price, plan_currency, note, plan_id, plans(id, name, description, price, currency, months, active)')
      .eq('restaurant_id', restaurantId)
      .maybeSingle(),
  ) as RawBilling | null
  return normBilling(data)
}

export async function saveBilling(
  restaurantId: string,
  billing: { plan_price: number | null; plan_currency: string; note: string | null; plan_id: string | null },
): Promise<void> {
  if (!supabase) {
    return writeDB((db) => {
      db.billing ??= []
      const found = db.billing.find((b) => b.restaurant_id === restaurantId)
      if (found) Object.assign(found, billing)
      else db.billing.push({ restaurant_id: restaurantId, ...billing })
    })
  }
  check(await supabase.from('restaurant_billing').upsert({ restaurant_id: restaurantId, ...billing, updated_at: new Date().toISOString() }))
}

const normPayment = (p: SubscriptionPayment): SubscriptionPayment => ({ ...p, amount: Number(p.amount) })

export async function listPayments(restaurantId?: string): Promise<SubscriptionPayment[]> {
  if (!supabase) {
    return (readDB().payments ?? [])
      .filter((p) => !restaurantId || p.restaurant_id === restaurantId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  let q = supabase.from('subscription_payments').select('*').order('created_at', { ascending: false }).limit(2000)
  if (restaurantId) q = q.eq('restaurant_id', restaurantId)
  return (check(await q) as SubscriptionPayment[]).map(normPayment)
}

/** Registra un pago y extiende el servicio. Devuelve el nuevo vencimiento. */
export async function registerPayment(
  restaurantId: string,
  p: { amount: number; currency: string; method: string | null; note: string | null; months: number },
): Promise<string> {
  if (!supabase) {
    await wait()
    const r = readDB().restaurants.find((x) => x.id === restaurantId)
    if (!r) throw new Error('Restaurante no encontrado')
    const start = nextPeriodStart(r.paid_until)
    const end = periodEnd(start, p.months)
    writeDB((db) => {
      db.payments ??= []
      db.payments.push({
        id: uid(), restaurant_id: restaurantId, amount: p.amount, currency: p.currency, method: p.method, note: p.note,
        period_start: start, period_end: end, created_by: 'admin@colontab.app', created_at: new Date().toISOString(),
      })
      const rr = db.restaurants.find((x) => x.id === restaurantId)
      if (rr) rr.paid_until = end
      db.billing ??= []
      const b = db.billing.find((x) => x.restaurant_id === restaurantId)
      if (!b) db.billing.push({ restaurant_id: restaurantId, plan_price: p.months === 12 ? p.amount : null, plan_currency: p.currency, note: null })
      else if (b.plan_price === null && p.months === 12) b.plan_price = p.amount
    })
    return end
  }
  const { data, error } = await supabase.rpc('register_payment', {
    p_restaurant_id: restaurantId,
    p_amount: p.amount,
    p_currency: p.currency,
    p_method: p.method,
    p_note: p.note,
    p_months: p.months,
  })
  if (error) throw new Error(error.message)
  return data as string
}

/** Cambia a mano el último día de servicio (null = sin fecha, no se bloquea). */
export async function setPaidUntil(restaurantId: string, date: string | null): Promise<void> {
  return updateRestaurant(restaurantId, { paid_until: date })
}

export async function deletePayment(id: string): Promise<void> {
  if (!supabase) return writeDB((db) => void (db.payments = (db.payments ?? []).filter((p) => p.id !== id)))
  check(await supabase.from('subscription_payments').delete().eq('id', id))
}

// ───────── Planes ─────────
export async function listPlans(): Promise<Plan[]> {
  if (!supabase) return [...(readDB().plans ?? [])].sort((a, b) => a.price - b.price)
  return (check(await supabase.from('plans').select('*').order('price')) as Plan[]).map(normPlan)
}

export async function savePlan(plan: Omit<Plan, 'id'> & { id?: string }): Promise<void> {
  if (!supabase) {
    return writeDB((db) => {
      db.plans ??= []
      const found = plan.id && db.plans.find((p) => p.id === plan.id)
      if (found) Object.assign(found, plan)
      else db.plans.push({ ...plan, id: uid() })
    })
  }
  const { id, ...fields } = plan
  if (id) check(await supabase.from('plans').update(fields).eq('id', id))
  else check(await supabase.from('plans').insert(fields))
}

export async function deletePlan(id: string): Promise<void> {
  if (!supabase) {
    return writeDB((db) => {
      db.plans = (db.plans ?? []).filter((p) => p.id !== id)
      for (const b of db.billing ?? []) if (b.plan_id === id) b.plan_id = null
    })
  }
  check(await supabase.from('plans').delete().eq('id', id))
}

// ───────── Artículos (catálogo universal) ─────────
const normProduct = (p: Product): Product => ({
  ...p,
  tiers: (p.tiers ?? []).map((t) => ({ min: Number(t.min), price: Number(t.price) })).sort((a, b) => a.min - b.min),
})

export async function listProducts(): Promise<Product[]> {
  if (!supabase) return (readDB().products ?? []).map(normProduct)
  return (check(await supabase.from('products').select('*').order('name')) as Product[]).map(normProduct)
}

export async function saveProduct(product: Omit<Product, 'id'> & { id?: string }): Promise<void> {
  const tiers = [...product.tiers].sort((a, b) => a.min - b.min)
  if (!tiers.length || tiers.length > 4) throw new Error('Pon entre 1 y 4 precios')
  if (tiers[0].min !== 1) throw new Error('El primer precio debe ser para 1 unidad')
  if (new Set(tiers.map((t) => t.min)).size !== tiers.length) throw new Error('Cada precio necesita una cantidad distinta')
  const clean = { ...product, tiers }
  if (!supabase) {
    return writeDB((db) => {
      db.products ??= []
      const found = clean.id && db.products.find((p) => p.id === clean.id)
      if (found) Object.assign(found, clean)
      else db.products.push({ ...clean, id: uid() })
    })
  }
  const { id, ...fields } = clean
  if (id) check(await supabase.from('products').update(fields).eq('id', id))
  else check(await supabase.from('products').insert(fields))
}

export async function deleteProduct(id: string): Promise<void> {
  if (!supabase) {
    return writeDB((db) => {
      db.products = (db.products ?? []).filter((p) => p.id !== id)
      for (const s of db.sales ?? []) if (s.product_id === id) s.product_id = null
    })
  }
  check(await supabase.from('products').delete().eq('id', id))
}

// ───────── Ventas ─────────
const normSale = (s: ProductSale): ProductSale => ({ ...s, unit_price: Number(s.unit_price), total: Number(s.total) })

export async function listSales(restaurantId?: string): Promise<ProductSale[]> {
  if (!supabase) {
    return (readDB().sales ?? [])
      .filter((s) => !restaurantId || s.restaurant_id === restaurantId)
      .sort((a, b) => b.sold_at.localeCompare(a.sold_at) || b.created_at.localeCompare(a.created_at))
  }
  let q = supabase.from('product_sales').select('*').order('sold_at', { ascending: false }).order('created_at', { ascending: false }).limit(5000)
  if (restaurantId) q = q.eq('restaurant_id', restaurantId)
  return (check(await q) as ProductSale[]).map(normSale)
}

export type NewSale = Omit<ProductSale, 'id' | 'created_at'>

export async function createSale(sale: NewSale): Promise<void> {
  if (!sale.restaurant_id && !sale.customer_name?.trim()) throw new Error('Elige un restaurante o escribe el nombre del cliente')
  if (!supabase) {
    return writeDB((db) => {
      db.sales ??= []
      db.sales.push({ ...sale, id: uid(), created_at: new Date().toISOString() })
    })
  }
  check(await supabase.from('product_sales').insert(sale))
}

export async function setSalePaid(id: string, paid: boolean): Promise<void> {
  if (!supabase) {
    return writeDB((db) => {
      const s = db.sales?.find((x) => x.id === id)
      if (s) s.paid = paid
    })
  }
  check(await supabase.from('product_sales').update({ paid }).eq('id', id))
}

export async function deleteSale(id: string): Promise<void> {
  if (!supabase) return writeDB((db) => void (db.sales = (db.sales ?? []).filter((s) => s.id !== id)))
  check(await supabase.from('product_sales').delete().eq('id', id))
}
