import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartLine, MenuItem, Restaurant } from './types'

interface Session {
  restaurant: Restaurant
  table: number
  guests: number | null
  setGuests: (n: number | null) => void
  cart: CartLine[]
  add: (item: MenuItem) => void
  remove: (itemId: string) => void
  clearCart: () => void
  cartCount: number
  cartTotal: number
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

function writeStorage(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* almacenamiento no disponible */
  }
}

export function SessionProvider({ restaurant, table, children }: { restaurant: Restaurant; table: number; children: ReactNode }) {
  const prefix = `mesaclick:${restaurant.slug}:${table}`
  const [guests, setGuests] = useState<number | null>(() => readStorage(`${prefix}:guests`, null))
  const [cart, setCart] = useState<CartLine[]>(() => readStorage(`${prefix}:cart`, []))

  useEffect(() => writeStorage(`${prefix}:guests`, guests), [prefix, guests])
  useEffect(() => writeStorage(`${prefix}:cart`, cart), [prefix, cart])

  const value = useMemo<Session>(() => {
    const add = (item: MenuItem) =>
      setCart((c) => {
        const found = c.find((l) => l.item.id === item.id)
        return found
          ? c.map((l) => (l.item.id === item.id ? { ...l, quantity: l.quantity + 1 } : l))
          : [...c, { item, quantity: 1 }]
      })
    const remove = (itemId: string) =>
      setCart((c) =>
        c.flatMap((l) => (l.item.id !== itemId ? [l] : l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : [])),
      )
    return {
      restaurant,
      table,
      guests,
      setGuests,
      cart,
      add,
      remove,
      clearCart: () => setCart([]),
      cartCount: cart.reduce((s, l) => s + l.quantity, 0),
      cartTotal: cart.reduce((s, l) => s + l.quantity * l.item.price, 0),
    }
  }, [restaurant, table, guests, cart])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider')
  return ctx
}
