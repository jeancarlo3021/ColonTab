import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../context'
import { requestService } from '../lib/api'
import { Toast } from './Toast'
import { Icon } from './Icon'

const COOLDOWN_MS = 45_000

/** Botón "Estoy listo para ordenar": avisa al mesero que la mesa quiere pedir. */
export function ReadyToOrder({ variant = 'big' }: { variant?: 'big' | 'bar' }) {
  const { restaurant, table, guests } = useSession()
  const key = `mesaclick:${restaurant.slug}:${table}:ready-at`
  const [sentAt, setSentAt] = useState<number>(() => {
    try {
      return Number(sessionStorage.getItem(key)) || 0
    } catch {
      return 0
    }
  })
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const waiting = now - sentAt < COOLDOWN_MS
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [waiting])

  async function send() {
    setBusy(true)
    try {
      await requestService({ restaurantId: restaurant.id, table, type: 'order', guests })
      const t = Date.now()
      setSentAt(t)
      setNow(t)
      try {
        sessionStorage.setItem(key, String(t))
      } catch {
        /* sin almacenamiento */
      }
      setToast('¡Listo! Un mesero viene a tomar tu orden 🙌')
    } catch {
      setToast('No se pudo enviar el aviso. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {(() => {
        const button = (
          <button className={variant === 'bar' ? 'ready-bar' : 'cta'} disabled={busy || waiting} onClick={() => void send()}>
            <Icon name={waiting ? 'check' : 'hand'} size={22} />
            {busy ? 'Avisando…' : waiting ? 'Mesero avisado, ya viene' : 'Estoy listo para ordenar'}
          </button>
        )
        return variant === 'bar' ? <div className="c-dock">{button}</div> : button
      })()}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}
