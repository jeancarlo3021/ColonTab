import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useSession } from '../context'
import { getMenu } from '../lib/api'
import { money } from '../lib/format'
import { useData } from '../lib/useData'
import { ReadyToOrder } from '../components/ReadyToOrder'
import { PdfMenu } from '../components/PdfMenu'
import { Icon } from '../components/Icon'

export function Menu() {
  const { restaurant, table } = useSession()
  const type = restaurant.menu_type ?? 'custom'
  const url = restaurant.menu_url

  return (
    <main className="menu-page">
      <header className="topbar">
        <Link to=".." relative="path" className="icon-btn" aria-label="Volver">←</Link>
        <div>
          <h1>Menú</h1>
          <small className="muted">{restaurant.name} · Mesa {table}</small>
        </div>
      </header>

      {type === 'pdf' && url ? (
        <PdfMenu url={url} />
      ) : type === 'url' && url ? (
        <ExternalMenu url={url} name={restaurant.name} />
      ) : (
        <CustomMenu />
      )}

      <ReadyToOrder variant="bar" />
    </main>
  )
}

/** Menú publicado en otro sitio: se abre en otra pestaña. */
function ExternalMenu({ url, name }: { url: string; name: string }) {
  let host = url
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    /* enlace sin formato */
  }
  return (
    <section className="c-external">
      <Icon name="link" size={34} />
      <h2>La carta de {name} está en su sitio web</h2>
      <p>Se abre en otra pestaña. Cuando ya sepas qué quieres, vuelve aquí y toca <b>Estoy listo para ordenar</b>.</p>
      <a className="c-primary-btn" href={url} target="_blank" rel="noopener">
        Abrir la carta <Icon name="external" size={18} />
      </a>
      <small>{host}</small>
    </section>
  )
}

/** Menú armado en ColonTab (diseño original con pestañas por categoría). */
function CustomMenu() {
  const { restaurant } = useSession()
  const { data: menu, error } = useData(() => getMenu(restaurant.id), [restaurant.id])
  const [picked, setPicked] = useState<string | null>(null)
  const active = picked ?? menu?.categories[0]?.id ?? null
  const items = menu?.items.filter((i) => i.category_id === active) ?? []

  return (
    <>
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
    </>
  )
}
