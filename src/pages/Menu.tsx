import { useEffect, useRef, useState } from 'react'
import { useSession } from '../context'
import { getMenu } from '../lib/api'
import { money } from '../lib/format'
import { useData } from '../lib/useData'
import { ReadyToOrder } from '../components/ReadyToOrder'
import { ClientHeader } from '../components/ClientHeader'
import { PdfMenu } from '../components/PdfMenu'
import { Icon } from '../components/Icon'

export function Menu() {
  const { restaurant } = useSession()
  const type = restaurant.menu_type ?? 'custom'
  const url = restaurant.menu_url

  return (
    <main className="c-menu">
      <ClientHeader title="Menú" />
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

function CustomMenu() {
  const { restaurant } = useSession()
  const { data: menu, error } = useData(() => getMenu(restaurant.id), [restaurant.id])
  const [active, setActive] = useState<string | null>(null)
  const tabs = useRef<HTMLElement>(null)

  const categories = menu?.categories.filter((c) => menu.items.some((i) => i.category_id === c.id)) ?? []

  // Marca la categoría que se está viendo
  useEffect(() => {
    if (!categories.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id.replace('cat-', ''))
      },
      { rootMargin: '-120px 0px -60% 0px' },
    )
    categories.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [categories.map((c) => c.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mantener visible la pestaña activa
  useEffect(() => {
    tabs.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [active])

  if (error) return <p className="error pad">No se pudo cargar el menú: {error}</p>
  if (!menu) return <div className="center pad"><div className="spinner" /></div>
  if (categories.length === 0) return <p className="muted pad">Este restaurante todavía no ha publicado su menú.</p>

  const current = active ?? categories[0].id

  return (
    <>
      <nav className="c-tabs" ref={tabs} aria-label="Categorías">
        {categories.map((c) => (
          <button
            key={c.id}
            className={current === c.id ? 'on' : ''}
            onClick={() => document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {c.name}
          </button>
        ))}
      </nav>
      <div className="c-carta">
        {categories.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="c-cat">
            <h2>{c.name}</h2>
            <ul>
              {menu.items.filter((i) => i.category_id === c.id).map((item) => (
                <li key={item.id} className={`c-dish ${item.image_url ? 'has-img' : ''}`}>
                  <div className="c-dish-body">
                    <div className="c-dish-line">
                      <span className="c-dish-name">{item.name}</span>
                      <span className="c-dish-dots" aria-hidden />
                      <span className="c-dish-price">{money(item.price, restaurant.currency)}</span>
                    </div>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  {item.image_url && <img src={item.image_url} alt="" loading="lazy" />}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
