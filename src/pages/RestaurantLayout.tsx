import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { getRestaurant, resolveTable } from '../lib/api'
import { SessionProvider } from '../context'
import type { Restaurant } from '../types'
import { NotFound } from './NotFound'
import { brandVars } from '../lib/color'
import { EntryWelcome } from '../components/EntryWelcome'

type Loaded = { restaurant: Restaurant; table: number } | null | undefined

/**
 * Dos formas de abrir una mesa:
 *  - /t/<código>: lo que abre el QR o NFC. El código es secreto: no se puede pasar a otra mesa
 *    cambiando la dirección.
 *  - /r/<restaurante>/<mesa>: solo vista previa (para el dueño). Los botones no envían avisos.
 */
export function RestaurantLayout() {
  const { token, slug = '', mesa = '' } = useParams()
  const { pathname, search } = useLocation()
  const [loaded, setLoaded] = useState<Loaded>(undefined)
  const [error, setError] = useState<string | null>(null)
  const previewTable = Number.parseInt(mesa, 10)

  useEffect(() => {
    let alive = true
    setLoaded(undefined)
    setError(null)
    const load = token
      ? resolveTable(token)
      : getRestaurant(slug).then((r) => (r ? { restaurant: r, table: previewTable } : null))
    load.then((v) => alive && setLoaded(v)).catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [token, slug, previewTable])

  // El QR abre directo el menú
  if (token && new URLSearchParams(search).get('v') === 'qr' && /^\/t\/[^/]+\/?$/.test(pathname)) {
    return <Navigate to={`menu${search}`} replace />
  }
  if (!token && (!Number.isInteger(previewTable) || previewTable <= 0)) return <NotFound message="Mesa no válida. Escanea el QR de tu mesa." />
  if (error) return <NotFound message={`No pudimos cargar el restaurante: ${error}`} />
  if (loaded === undefined) return <div className="screen center"><div className="spinner" /></div>
  if (loaded === null) {
    return <NotFound message={token ? 'Este código de mesa no es válido. Escanea el QR o la etiqueta NFC de tu mesa.' : 'Restaurante no encontrado.'} />
  }
  if (!loaded.restaurant.active) return <NotFound message="Este restaurante no está disponible por ahora." />

  return (
    <SessionProvider restaurant={loaded.restaurant} table={loaded.table} token={token ?? null}>
      <div className="screen" style={brandVars(loaded.restaurant.primary_color)}>
        {!token && (
          <div className="preview-banner" role="note">
            <strong>Vista previa</strong> · Los botones no envían avisos. Los clientes entran con el QR o NFC de su mesa.
          </div>
        )}
        <Outlet />
        {token && <EntryWelcome />}
      </div>
    </SessionProvider>
  )
}
