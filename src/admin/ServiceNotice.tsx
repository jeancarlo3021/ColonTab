import { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { CONTACT_URL } from '../lib/site'
import { crToday, daysText, formatDate, serviceStatus } from '../lib/billing'
import type { Restaurant } from '../types'

/** Texto corto del servicio para la cabecera del panel. */
export function serviceSummary(r: Restaurant) {
  const s = serviceStatus(r.paid_until)
  if (s.state === 'none' || s.daysLeft === null) return null
  return s.state === 'expired' ? `Servicio vencido el ${formatDate(s.until!)}` : `Servicio hasta el ${formatDate(s.until!)} · ${daysText(s.daysLeft)}`
}

function soonTitle(daysLeft: number) {
  if (daysLeft === 0) return 'Tu servicio vence hoy'
  if (daysLeft === 1) return 'Tu servicio vence mañana'
  return `Quedan ${daysLeft} días de servicio`
}

/** Franja de aviso cuando falta una semana o menos (o ya venció y lo ve la plataforma). */
export function ServiceBanner({ restaurant, onOpen }: { restaurant: Restaurant; onOpen?: () => void }) {
  const s = serviceStatus(restaurant.paid_until)
  if (s.state !== 'soon' && s.state !== 'expired') return null
  return (
    <div className={`service-banner ${s.state}`} role="alert">
      <strong>{s.state === 'expired' ? '⛔ Servicio vencido' : `⚠️ ${soonTitle(s.daysLeft!)}`}</strong>
      <span>
        {s.state === 'expired'
          ? `Venció el ${formatDate(s.until!)}. Las mesas no pueden enviar avisos.`
          : `Vence el ${formatDate(s.until!)}. Renueva tu plan anual para que el sistema no se bloquee.`}
      </span>
      {onOpen && <button className="btn btn-ghost small" onClick={onOpen}>Ver detalles</button>}
    </div>
  )
}

/** Ventana de aviso una vez al día durante la última semana. */
export function ServiceAlertOnce({ restaurant, onOpen }: { restaurant: Restaurant; onOpen: () => void }) {
  const s = serviceStatus(restaurant.paid_until)
  const key = `colontab:aviso-servicio:${restaurant.id}:${crToday()}`
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (s.state !== 'soon') return
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      /* sin almacenamiento: se muestra igual */
    }
    setOpen(true)
  }, [key, s.state])

  if (!open || s.daysLeft === null) return null
  return (
    <Modal title="Tu servicio está por vencer" onClose={() => setOpen(false)}>
      <div className="form">
        <div className="service-countdown soon">
          <strong>{s.daysLeft === 0 ? 'Hoy' : s.daysLeft}</strong>
          <span>{s.daysLeft === 0 ? 'es el último día' : s.daysLeft === 1 ? 'día restante' : 'días restantes'}</span>
        </div>
        <p>
          El servicio de ColonTab para <b>{restaurant.name}</b> vence el <b>{formatDate(s.until!)}</b>. Después de esa fecha
          las mesas no podrán llamar al mesero y el panel se bloqueará hasta renovar.
        </p>
        <a className="btn btn-primary" href={CONTACT_URL} target="_blank" rel="noopener">Renovar mi plan</a>
        <button className="btn btn-ghost" onClick={() => { setOpen(false); onOpen() }}>Ver mi servicio</button>
      </div>
    </Modal>
  )
}

/** Pantalla cuando el servicio venció (para el dueño y su personal). */
export function ServiceBlocked({ restaurant }: { restaurant: Restaurant }) {
  const s = serviceStatus(restaurant.paid_until)
  return (
    <div className="panel empty service-blocked">
      <div className="empty-emoji">⛔</div>
      <h2>El servicio de {restaurant.name} está suspendido</h2>
      <p>
        Tu plan anual de ColonTab venció el <b>{s.until ? formatDate(s.until) : '—'}</b>. Mientras tanto, las mesas no pueden
        enviar avisos y el panel está bloqueado. Tus datos, menú y códigos QR se conservan.
      </p>
      <a className="btn btn-primary" href={CONTACT_URL} target="_blank" rel="noopener">Renovar mi plan</a>
      <small className="muted">En cuanto se registre tu pago, todo vuelve a funcionar al instante.</small>
    </div>
  )
}
