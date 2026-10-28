// Cobro anual: fechas y estado del servicio (hora de Costa Rica).

/** Días antes del vencimiento en que empiezan los avisos. */
export const ALERT_DAYS = 7

export type ServiceState = 'none' | 'ok' | 'soon' | 'expired'

/** Hoy en Costa Rica, "AAAA-MM-DD". */
export function crToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date())
}

function toUTC(iso: string) {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
}

export function daysBetween(from: string, to: string) {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000)
}

export function addDays(iso: string, days: number) {
  return new Date(toUTC(iso) + days * 86_400_000).toISOString().slice(0, 10)
}

/** Igual que en la base: N meses desde `start`, menos un día. */
export function periodEnd(start: string, months: number) {
  const d = new Date(toUTC(start))
  d.setUTCMonth(d.getUTCMonth() + months)
  return addDays(d.toISOString().slice(0, 10), -1)
}

/** Desde cuándo cuenta un pago nuevo: el día siguiente al vencimiento, o hoy si ya venció. */
export function nextPeriodStart(paidUntil: string | null | undefined) {
  const today = crToday()
  if (!paidUntil) return today
  const next = addDays(paidUntil, 1)
  return next > today ? next : today
}

/**
 * Estado del servicio. `paid_until` es el último día con servicio.
 * daysLeft: 0 = vence hoy, negativo = vencido.
 */
export function serviceStatus(paidUntil: string | null | undefined): { state: ServiceState; daysLeft: number | null; until: string | null } {
  if (!paidUntil) return { state: 'none', daysLeft: null, until: null }
  const daysLeft = daysBetween(crToday(), paidUntil)
  const state: ServiceState = daysLeft < 0 ? 'expired' : daysLeft <= ALERT_DAYS ? 'soon' : 'ok'
  return { state, daysLeft, until: paidUntil.slice(0, 10) }
}

export function formatDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** "quedan 12 días", "vence hoy", "venció hace 3 días" */
export function daysText(daysLeft: number) {
  if (daysLeft < -1) return `venció hace ${-daysLeft} días`
  if (daysLeft === -1) return 'venció ayer'
  if (daysLeft === 0) return 'vence hoy'
  if (daysLeft === 1) return 'vence mañana'
  return `quedan ${daysLeft} días`
}

export const STATE_LABEL: Record<ServiceState, string> = {
  none: 'Sin fecha',
  ok: 'Al día',
  soon: 'Por vencer',
  expired: 'Vencido',
}
