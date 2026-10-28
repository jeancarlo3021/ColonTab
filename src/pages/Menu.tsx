import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useSession } from '../context'
import { getMenu } from '../lib/api'
import { money } from '../lib/format'
import { useData } from '../lib/useData'
import { ReadyToOrder } from '../components/ReadyToOrder'

export function Menu() {
  const { restaurant, table } = useSession()
  const { data: menu, error } = useData(() => getMenu(restaurant.id), [restaurant.id])
  const [picked, setPicked] = useState<string | null>(null)
  const active = picked ?? menu?.categories[0]?.id ?? null
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
              <button key={c.id} className={`tab ${active === c.id ? 'active' : ''}`} onClick={() => setPicked(c.id)}>
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
                </div>
                <span className="price">{money(item.price, restaurant.currency)}</span>
              </li>
            ))}
            {items.length === 0 && <li className="muted pad">Sin platillos en esta categoría.</li>}
          </ul>
        </>
      )}

      <ReadyToOrder variant="bar" />
    </main>
  )
}
