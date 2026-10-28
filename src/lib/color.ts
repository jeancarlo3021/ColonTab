// Utilidades de color para los colores de cada restaurante.
import type { CSSProperties } from 'react'

export const NAVY = '#0F1926'
export const GREEN = '#00D492'

/** Devuelve azul marino o blanco, el que mejor se lea sobre el color dado. */
export function onColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return NAVY
  const n = parseInt(m[1], 16)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  // Contraste contra azul marino (L≈0.011) vs blanco (L=1)
  return (L + 0.05) / (0.011 + 0.05) >= (1 + 0.05) / (L + 0.05) ? NAVY : '#ffffff'
}

/** Variables CSS para pintar una sección con el color de un restaurante. */
export function brandVars(hex: string | null | undefined): CSSProperties {
  const color = hex || GREEN
  return { ['--brand' as string]: color, ['--on-brand' as string]: onColor(color) }
}
