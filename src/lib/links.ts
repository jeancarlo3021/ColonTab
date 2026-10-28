// Enlaces de cada mesa (QR y NFC).
import { SITE_URL } from './site'
import type { VisitSource } from '../types'

/** Dirección pública final, sin redirecciones (colontab.com → www.colontab.com cuesta un salto extra). */
export function publicOrigin(): string {
  const env = import.meta.env.VITE_PUBLIC_URL as string | undefined
  if (env) return env.replace(/\/$/, '')
  if (typeof window === 'undefined') return SITE_URL
  return window.location.hostname.endsWith('colontab.com') ? SITE_URL : window.location.origin
}

/** Enlace de una mesa con su código secreto. `via` marca de dónde viene la visita (nfc o qr). */
export function tableLink(token: string, via?: Exclude<VisitSource, 'link'>) {
  return `${publicOrigin()}/t/${token}${via ? `?v=${via}` : ''}`
}

/** Vista previa de una mesa (no envía avisos). */
export function previewPath(slug: string, table: number) {
  return `/r/${slug}/${table}`
}

/** Enlaces viejos: lee "la-esquina-4" → { slug: 'la-esquina', table: 4 } */
export function parseShortCode(code: string): { slug: string; table: number } | null {
  const m = /^([a-z0-9-]+)-(\d{1,3})$/.exec(code.toLowerCase())
  return m ? { slug: m[1], table: Number(m[2]) } : null
}
