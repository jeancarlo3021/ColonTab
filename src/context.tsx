import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Restaurant } from './types'

interface Session {
  restaurant: Restaurant
  table: number
  guests: number | null
  setGuests: (n: number | null) => void
}

const SessionContext = createContext<Session | null>(null)

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function SessionProvider({ restaurant, table, children }: { restaurant: Restaurant; table: number; children: ReactNode }) {
  const key = `mesaclick:${restaurant.slug}:${table}:guests`
  const [guests, setGuests] = useState<number | null>(() => readStorage(key, null))

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(guests))
    } catch {
      /* almacenamiento no disponible */
    }
  }, [key, guests])

  const value = useMemo<Session>(() => ({ restaurant, table, guests, setGuests }), [restaurant, table, guests])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider')
  return ctx
}
