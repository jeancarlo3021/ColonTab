// Control de filamento de las impresoras 3D (solo administrador de la plataforma).
import { supabase } from './supabase'
import { SITE_URL } from './site'

export const SLOTS = ['A', 'B', 'C', 'D'] as const
export type Slot = (typeof SLOTS)[number]
export const MATERIALES = ['PLA', 'PETG', 'TPU', 'ABS', 'ASA', 'PLA-CF'] as const
export const UMBRAL_G = 100

export interface Impresora {
  id: string
  nombre: string
  ip: string | null
  estado: string | null
  trabajo: string | null
  progreso: number | null
  visto_at: string | null
}
export interface Ranura {
  impresora_id: string
  ranura: Slot
  color_hex: string | null
  material_cfs: string | null
}
export interface Bobina {
  id: string
  material: string
  color: string
  color_hex: string | null
  marca: string | null
  peso_g: number
  restante_g: number
  usado_total_g: number
  impresora_id: string | null
  ranura: Slot | null
  agotada: boolean
  notas: string | null
  created_at: string
  actualizada_at: string
}
export interface Consumo {
  id: number
  bobina_id: string
  impresora_id: string | null
  ranura: string | null
  gramos: number
  trabajo: string | null
  created_at: string
}
export type BobinaDraft = Pick<Bobina, 'material' | 'color' | 'color_hex' | 'marca' | 'peso_g' | 'restante_g' | 'notas'> & {
  impresora_id?: string | null
  ranura?: Slot | null
}

function db() {
  if (!supabase) throw new Error('El control de filamento necesita Supabase (no funciona en modo demo).')
  return supabase
}
function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) {
    if (/filamento_/.test(res.error.message) && /does not exist|schema cache/.test(res.error.message))
      throw new Error('Falta ejecutar supabase/migrations/012_filamento.sql en Supabase.')
    throw new Error(res.error.message)
  }
  return res.data
}
const num = (b: Bobina): Bobina => ({ ...b, peso_g: Number(b.peso_g), restante_g: Number(b.restante_g), usado_total_g: Number(b.usado_total_g) })

export const spoolUrl = (id: string) => `${SITE_URL}/f/${id}`

export async function loadFilamento(): Promise<{ impresoras: Impresora[]; ranuras: Ranura[]; bobinas: Bobina[] }> {
  const s = db()
  const [i, r, b] = await Promise.all([
    s.from('filamento_impresoras').select('*').order('id'),
    s.from('filamento_ranuras').select('*'),
    s.from('filamento_bobinas').select('*').order('restante_g'),
  ])
  return {
    impresoras: check(i) as Impresora[],
    ranuras: check(r) as Ranura[],
    bobinas: (check(b) as Bobina[]).map(num),
  }
}

export async function getBobina(id: string): Promise<{ bobina: Bobina | null; consumos: Consumo[]; impresoras: Impresora[] }> {
  const s = db()
  const [b, c, i] = await Promise.all([
    s.from('filamento_bobinas').select('*').eq('id', id).maybeSingle(),
    s.from('filamento_consumos').select('*').eq('bobina_id', id).order('created_at', { ascending: false }).limit(30),
    s.from('filamento_impresoras').select('*').order('id'),
  ])
  const bobina = check(b) as Bobina | null
  return { bobina: bobina && num(bobina), consumos: check(c) as Consumo[], impresoras: check(i) as Impresora[] }
}

export const nuevoCodigo = () => Math.random().toString(16).slice(2, 8)
export const codigoValido = (id: string) => /^[a-z0-9]{4,12}$/.test(id)

export async function saveBobina(d: BobinaDraft & { id?: string; nuevoId?: string }): Promise<string> {
  const s = db()
  if (!d.color.trim()) throw new Error('Escribe el color')
  if (!(d.peso_g > 0)) throw new Error('El peso debe ser mayor que 0')
  const { nuevoId, ...rest } = d
  const row = { ...rest, color: d.color.trim(), marca: d.marca?.trim() || null, notas: d.notas?.trim() || null }
  if (nuevoId) {
    if (!codigoValido(nuevoId)) throw new Error('Código de sticker inválido')
    check(await s.from('filamento_bobinas').insert({ ...row, id: nuevoId }))
    return nuevoId
  }
  if (d.id) {
    check(await s.from('filamento_bobinas').update(row).eq('id', d.id))
    return d.id
  }
  const created = check(await s.from('filamento_bobinas').insert(row).select('id').single()) as { id: string }
  return created.id
}

export async function patchBobina(id: string, patch: Partial<Bobina>): Promise<void> {
  check(await db().from('filamento_bobinas').update(patch).eq('id', id))
}

export async function deleteBobina(id: string): Promise<void> {
  check(await db().from('filamento_bobinas').delete().eq('id', id))
}

export function pct(b: Pick<Bobina, 'restante_g' | 'peso_g'>) {
  return Math.max(0, Math.min(100, (b.restante_g / Math.max(1, b.peso_g)) * 100))
}

/** Nombre aproximado para el color que reporta el CFS. */
export function colorName(hex: string | null): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return '—'
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const base: Record<string, number[]> = {
    negro: [0, 0, 0], blanco: [255, 255, 255], gris: [128, 128, 128], rojo: [200, 30, 30], naranja: [240, 130, 20],
    amarillo: [240, 220, 30], verde: [30, 160, 60], 'verde azulado': [10, 160, 140], azul: [30, 70, 200],
    celeste: [100, 180, 240], morado: [120, 50, 170], rosado: [240, 130, 180], café: [120, 80, 40],
    beige: [215, 190, 150], dorado: [190, 150, 60],
  }
  let best = 'negro'
  let bestD = Infinity
  for (const [k, v] of Object.entries(base)) {
    const d = v.reduce((s, x, i) => s + (x - rgb[i]) ** 2, 0)
    if (d < bestD) [best, bestD] = [k, d]
  }
  return best
}

export function grams(n: number) {
  return `${Math.round(n).toLocaleString('es-CR')} g`
}
