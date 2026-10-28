import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSession } from '../context'
import { recordVisit } from '../lib/api'
import type { VisitSource } from '../types'

/**
 * Al entrar a una mesa: registra la visita (NFC, QR o enlace) una vez por sesión y,
 * si llegó por NFC, muestra la bienvenida "¡Listo! Estás en la Mesa X".
 */
export function EntryWelcome() {
  const { restaurant, table } = useSession()
  const [params, setParams] = useSearchParams()
  const [show, setShow] = useState(false)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const v = params.get('v')
    const source: VisitSource = v === 'nfc' ? 'nfc' : v === 'qr' ? 'qr' : 'link'

    // Una visita por pestaña y mesa; un escaneo NFC/QR nuevo sí cuenta
    const key = `mesaclick:${restaurant.slug}:${table}:visit`
    let already = false
    try {
      already = sessionStorage.getItem(key) === '1'
      sessionStorage.setItem(key, '1')
    } catch {
      /* sin almacenamiento */
    }
    if (!already || v) void recordVisit({ restaurantId: restaurant.id, table, source }).catch(() => undefined)

    if (source === 'nfc') {
      setShow(true)
      navigator.vibrate?.([40, 60, 40]) // Android; iPhone no permite vibrar desde la web
    }
    // Quitar ?v= para que recargar no repita la bienvenida ni la visita
    if (v) {
      const next = new URLSearchParams(params)
      next.delete('v')
      setParams(next, { replace: true })
    }
  }, [params, setParams, restaurant.id, restaurant.slug, table])

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setShow(false), 2600)
    return () => clearTimeout(t)
  }, [show])

  if (!show) return null
  return (
    <div className="nfc-welcome" role="status" onClick={() => setShow(false)}>
      <div className="nfc-welcome-card">
        <div className="nfc-welcome-icon" aria-hidden>
          <span className="ring" />
          <span className="ring r2" />
          📡
        </div>
        <strong>¡Listo!</strong>
        <p>Estás en la <b>Mesa {table}</b></p>
        <small>{restaurant.name}</small>
      </div>
    </div>
  )
}
