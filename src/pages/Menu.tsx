import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../context'
import { createOrder, getMenu } from '../lib/api'
import { money } from '../lib/format'
import { Modal } from '../components/Modal'
import type { MenuCategory, MenuItem } from '../types'

export function Menu() {
  const { restaurant, table, guests, cart, add, remove, clearCart, cartCount, cartTotal } = useSession()
  const [menu, setMenu] = useState<{ categories: MenuCategory[]; items: MenuItem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [showCart, setShowCart] = useState(false)
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    getMenu(restaurant.id)
      .then((m) => {
        setMenu(m)
        setActive(m.categories[0]?.id ?? null)
      })
      .catch((e: Error) => setError(e.message))
  }, [restaurant.id])

  const qty = (id: string) => cart.find((l) => l.item.id === id)?.quantity ?? 0
  const fmt = (v: number) => money(v, restaurant.currency)

  async function sendOrder() {
    setSending(true)
    setSendError(null)
    try {
      const id = await createOrder({ restaurantId: restaurant.id, table, guests, notes, lines: cart })
      setOrderId(id)
      clearCart()
      setNotes('')
      setShowCart(false)
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'No se pudo enviar el pedido.')
    } finally {
      setSending(false)
    }
  }

  const items = menu?.items.filter((i) => i.category_id === active) ?? []

  return (
    <main className="menu-page">
      <header className="topbar">
        <Link to=".." relative="path" className="icon-btn" aria-label="Volver">←</Link>
        <div>
          <h1>Menú</h1>
          <small className="muted">{restaurant.name} · Mesa {table}</small>
        </div>
      </header>

      {error && <p className="error">No se pudo cargar el menú: {error}</p>}
      {!menu && !error && <div className="center pad"><div className="spinner" /></div>}

      {menu && (
        <>
          <nav className="tabs" aria-label="Categorías">
            {menu.categories.map((c) => (
              <button key={c.id} className={`tab ${active === c.id ? 'active' : ''}`} onClick={() => setActive(c.id)}>
                {c.name}
              </button>
            ))}
          </nav>
          <ul className="items">
            {items.map((item) => (
              <li key={item.id} className="item">
                {item.image_url && <img src={item.image_url} alt="" className="item-img" />}
                <div className="item-info">
                  <strong>{item.name}</strong>
                  {item.description && <p className="muted">{item.description}</p>}
                  <span className="price">{fmt(item.price)}</span>
                </div>
                <QtyControl n={qty(item.id)} onAdd={() => add(item)} onRemove={() => remove(item.id)} />
              </li>
            ))}
            {items.length === 0 && <li className="muted pad">Sin platillos en esta categoría.</li>}
          </ul>
        </>
      )}

      {cartCount > 0 && (
        <button className="cart-bar" onClick={() => setShowCart(true)}>
          <span className="badge">{cartCount}</span>
          Ver pedido
          <span>{fmt(cartTotal)}</span>
        </button>
      )}

      {showCart && (
        <Modal title="Tu pedido" onClose={() => setShowCart(false)}>
          <ul className="cart-lines">
            {cart.map((l) => (
              <li key={l.item.id}>
                <div>
                  <strong>{l.item.name}</strong>
                  <small className="muted">{fmt(l.item.price * l.quantity)}</small>
                </div>
                <QtyControl n={l.quantity} onAdd={() => add(l.item)} onRemove={() => remove(l.item.id)} />
              </li>
            ))}
          </ul>
          <textarea
            placeholder="Notas para la cocina (opcional): sin cebolla, término medio…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={2}
          />
          <div className="total-row">
            <span>Total</span>
            <strong>{fmt(cartTotal)}</strong>
          </div>
          {sendError && <p className="error">{sendError}</p>}
          <button className="btn btn-primary" disabled={sending || cartCount === 0} onClick={sendOrder}>
            {sending ? 'Enviando…' : 'Enviar pedido a cocina'}
          </button>
        </Modal>
      )}

      {orderId && (
        <Modal title="¡Pedido enviado!" onClose={() => setOrderId(null)}>
          <div className="empty">
            <div className="empty-emoji">👨‍🍳</div>
            <p>La cocina ya recibió tu pedido. Te lo llevamos a la mesa {table}.</p>
            <small className="muted">Folio: {orderId.slice(0, 8).toUpperCase()}</small>
          </div>
          <Link className="btn btn-ghost" to="../juegos" relative="path">🎮 Jugar mientras esperas</Link>
          <button className="btn btn-primary" onClick={() => setOrderId(null)}>Seguir viendo el menú</button>
        </Modal>
      )}
    </main>
  )
}

function QtyControl({ n, onAdd, onRemove }: { n: number; onAdd: () => void; onRemove: () => void }) {
  if (n === 0) {
    return <button className="add-btn" onClick={onAdd} aria-label="Agregar">+</button>
  }
  return (
    <div className="qty">
      <button onClick={onRemove} aria-label="Quitar uno">−</button>
      <span>{n}</span>
      <button onClick={onAdd} aria-label="Agregar uno">+</button>
    </div>
  )
}
