import { useRef, useState, type FormEvent } from 'react'
import { updateRestaurant, uploadMenuPdf } from '../../lib/adminApi'
import { errorText } from '../../lib/useData'
import { Icon } from '../../components/Icon'
import type { MenuType, Restaurant } from '../../types'

const OPTIONS: { id: MenuType; title: string; text: string }[] = [
  { id: 'custom', title: 'Personalizado', text: 'Armas el menú aquí: categorías, platillos, precios y fotos.' },
  { id: 'pdf', title: 'PDF', text: 'Subes el PDF de tu carta y se ve completo en el celular.' },
  { id: 'url', title: 'Enlace', text: 'Usas un menú que ya está publicado en otra página web.' },
]

/** Elegir de dónde sale el menú que ven los clientes. */
export function MenuSource({ restaurant, canEdit, onSaved }: { restaurant: Restaurant; canEdit: boolean; onSaved: () => void }) {
  const current = restaurant.menu_type ?? 'custom'
  const [picked, setPicked] = useState<MenuType>(current)
  const [link, setLink] = useState(current === 'url' ? restaurant.menu_url ?? '' : '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const file = useRef<HTMLInputElement>(null)

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg({ ok: true, text: ok })
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  function saveLink(e: FormEvent) {
    e.preventDefault()
    let url = link.trim()
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    try {
      new URL(url)
    } catch {
      setMsg({ ok: false, text: 'Ese enlace no es válido' })
      return
    }
    void run(() => updateRestaurant(restaurant.id, { menu_type: 'url', menu_url: url }), 'Listo: los clientes verán ese menú')
  }

  const pdfName = current === 'pdf' && restaurant.menu_url
    ? restaurant.menu_url.startsWith('data:') ? 'menu.pdf' : decodeURIComponent(restaurant.menu_url.split('/').pop() ?? 'menu.pdf')
    : null

  return (
    <section className="panel">
      <div className="row-between">
        <h2 className="section-title">Tipo de menú</h2>
        <span className="tag tag-on">Ahora: {OPTIONS.find((o) => o.id === current)?.title}</span>
      </div>
      {!canEdit && <p className="muted small-text">Solo el dueño puede cambiar el tipo de menú.</p>}
      <div className="menu-types" role="radiogroup" aria-label="Tipo de menú">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={picked === o.id}
            className={`menu-type ${picked === o.id ? 'on' : ''}`}
            disabled={!canEdit}
            onClick={() => {
              setPicked(o.id)
              setMsg(null)
            }}
          >
            <Icon name={o.id === 'custom' ? 'menu' : o.id === 'pdf' ? 'file' : 'link'} />
            <strong>{o.title}</strong>
            <small>{o.text}</small>
          </button>
        ))}
      </div>

      {canEdit && picked === 'custom' && current !== 'custom' && (
        <button
          className="btn btn-primary small"
          disabled={busy}
          onClick={() => void run(() => updateRestaurant(restaurant.id, { menu_type: 'custom' }), 'Listo: los clientes verán el menú personalizado')}
        >
          Usar el menú personalizado
        </button>
      )}

      {canEdit && picked === 'pdf' && (
        <div className="menu-source-box">
          {pdfName && (
            <p className="small-text">
              PDF actual: <a href={restaurant.menu_url!} target="_blank" rel="noreferrer">{pdfName}</a>
            </p>
          )}
          <input
            ref={file}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void run(() => uploadMenuPdf(restaurant.id, f), 'PDF subido: los clientes ya lo ven')
            }}
          />
          <button className="btn btn-primary small" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? 'Subiendo…' : pdfName ? 'Cambiar PDF' : 'Subir PDF'}
          </button>
          <small className="muted">Máximo 15 MB. Se muestra completo en Android y iPhone, página por página.</small>
        </div>
      )}

      {canEdit && picked === 'url' && (
        <form className="inline-form menu-source-box" onSubmit={saveLink}>
          <input
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://mirestaurante.com/menu"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            required
          />
          <button className="btn btn-primary small" disabled={busy}>{busy ? 'Guardando…' : 'Guardar enlace'}</button>
        </form>
      )}

      {msg && <p className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</p>}
      {current !== 'custom' && picked === current && (
        <small className="muted">
          El menú personalizado de abajo queda guardado por si quieres volver a usarlo.
        </small>
      )}
    </section>
  )
}
