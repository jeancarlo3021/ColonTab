import { useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { getRestaurant } from '../lib/api'
import { SessionProvider } from '../context'
import type { Restaurant } from '../types'
import { NotFound } from './NotFound'

export function RestaurantLayout() {
  const { slug = '', mesa = '' } = useParams()
  const table = Number.parseInt(mesa, 10)
  const [restaurant, setRestaurant] = useState<Restaurant | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setRestaurant(undefined)
    getRestaurant(slug)
      .then((r) => alive && setRestaurant(r))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [slug])

  if (!Number.isInteger(table) || table <= 0) return <NotFound message="Mesa no válida. Escanea el QR de tu mesa." />
  if (error) return <NotFound message={`No pudimos cargar el restaurante: ${error}`} />
  if (restaurant === undefined) return <div className="screen center"><div className="spinner" /></div>
  if (restaurant === null) return <NotFound message="Restaurante no encontrado." />
  if (!restaurant.active) return <NotFound message="Este restaurante no está disponible por ahora." />

  return (
    <SessionProvider restaurant={restaurant} table={table}>
      <div className="screen" style={{ ['--brand' as string]: restaurant.primary_color }}>
        <Outlet />
      </div>
    </SessionProvider>
  )
}
