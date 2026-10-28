import { useState, type FormEvent, type ReactNode } from 'react'
import { getMenu } from '../../lib/api'
import { deleteCategory, deleteItem, saveCategory, saveItem } from '../../lib/adminApi'
import { money } from '../../lib/format'
import { errorText, useData } from '../../lib/useData'
import { Modal } from '../../components/Modal'
import type { MenuCategory, MenuItem, Restaurant } from '../../types'

type Draft = Omit<MenuItem, 'id'> & { id?: string }

export function MenuPanel({ restaurant }: { restaurant: Restaurant }) {
  const { data, error, reload } = useData(() => getMenu(restaurant.id, true), [restaurant.id])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [newCat, setNewCat] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setActionError(null)
    try {
      await fn()
      reload()
    } catch (e) {
      setActionError(errorText(e))
    }
  }

  if (error) return <p className="error">{error}</p>
  if (!data) return <div className="spinner" />

  const { categories, items } = data
  const fmt = (v: number) => money(v, restaurant.currency)

  return (
    <div className="stack-lg">
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!newCat.trim()) return
          void run(async () => {
            await saveCategory(restaurant.id, { name: newCat.trim(), position: categories.length + 1 })
            setNewCat('')
          })
        }}
      >
        <input placeholder="Nueva categoría (ej. Bebidas)" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
        <button className="btn btn-primary small">Agregar categoría</button>
      </form>
      {actionError && <p className="error">{actionError}</p>}
      {categories.length === 0 && <p className="muted">Crea tu primera categoría para empezar a agregar platillos.</p>}

      {categories.map((cat, idx) => (
        <CategoryBlock
          key={cat.id}
          category={cat}
          isFirst={idx === 0}
          isLast={idx === categories.length - 1}
          onRename={(name) => run(() => saveCategory(restaurant.id, { ...cat, name }))}
          onMove={(dir) => {
            const other = categories[idx + dir]
            void run(async () => {
              await saveCategory(restaurant.id, { ...cat, position: other.position })
              await saveCategory(restaurant.id, { ...other, position: cat.position })
            })
          }}
          onDelete={() => {
            const count = items.filter((i) => i.category_id === cat.id).length
            if (confirm(`¿Eliminar "${cat.name}"${count ? ` y sus ${count} platillos` : ''}?`)) void run(() => deleteCategory(cat.id))
          }}
          onAdd={() =>
            setDraft({ category_id: cat.id, name: '', description: '', price: 0, image_url: null, available: true })
          }
        >
          {items.filter((i) => i.category_id === cat.id).map((item) => (
            <div key={item.id} className={`menu-row ${item.available ? '' : 'off'}`}>
              {item.image_url ? <img src={item.image_url} alt="" /> : <div className="menu-row-ph">🍽️</div>}
              <div className="menu-row-info">
                <strong>{item.name}</strong>
                {item.description && <small className="muted">{item.description}</small>}
              </div>
              <span className="price">{fmt(item.price)}</span>
              <label className="toggle" title="Disponible">
                <input
                  type="checkbox"
                  checked={item.available}
                  onChange={(e) => void run(() => saveItem(restaurant.id, { ...item, available: e.target.checked }))}
                />
                <span>{item.available ? 'Disponible' : 'Agotado'}</span>
              </label>
              <button className="btn btn-ghost small" onClick={() => setDraft(item)}>Editar</button>
            </div>
          ))}
        </CategoryBlock>
      ))}

      {draft && (
        <ItemEditor
          draft={draft}
          categories={categories}
          onClose={() => setDraft(null)}
          onSave={async (d) => {
            await saveItem(restaurant.id, d)
            setDraft(null)
            reload()
          }}
          onDelete={
            draft.id
              ? async () => {
                  await deleteItem(draft.id!)
                  setDraft(null)
                  reload()
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

function CategoryBlock(props: {
  category: MenuCategory
  isFirst: boolean
  isLast: boolean
  onRename: (name: string) => Promise<void>
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
  onAdd: () => void
  children: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(props.category.name)
  return (
    <section className="panel">
      <div className="row-between">
        {editing ? (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault()
              void props.onRename(name.trim() || props.category.name).then(() => setEditing(false))
            }}
          >
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary small">Guardar</button>
          </form>
        ) : (
          <h2 className="section-title">{props.category.name}</h2>
        )}
        <div className="order-actions">
          <button className="icon-btn" disabled={props.isFirst} onClick={() => props.onMove(-1)} aria-label="Subir">↑</button>
          <button className="icon-btn" disabled={props.isLast} onClick={() => props.onMove(1)} aria-label="Bajar">↓</button>
          <button className="btn btn-ghost small" onClick={() => setEditing((v) => !v)}>Renombrar</button>
          <button className="btn btn-ghost small danger" onClick={props.onDelete}>Eliminar</button>
        </div>
      </div>
      <div className="menu-rows">{props.children}</div>
      <button className="btn btn-ghost" onClick={props.onAdd}>+ Agregar platillo</button>
    </section>
  )
}

function ItemEditor(props: {
  draft: Draft
  categories: MenuCategory[]
  onClose: () => void
  onSave: (d: Draft) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [d, setD] = useState<Draft>(props.draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  async function wrap(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void wrap(() => props.onSave({ ...d, name: d.name.trim(), description: d.description?.trim() || null, image_url: d.image_url?.trim() || null }))
  }

  return (
    <Modal title={d.id ? 'Editar platillo' : 'Nuevo platillo'} onClose={props.onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Nombre</span>
          <input required value={d.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field"><span>Descripción</span>
          <textarea rows={2} value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </label>
        <div className="field-row">
          <label className="field"><span>Precio</span>
            <input type="number" min={0} step="0.01" required value={d.price} onChange={(e) => set('price', Number(e.target.value))} />
          </label>
          <label className="field"><span>Categoría</span>
            <select value={d.category_id} onChange={(e) => set('category_id', e.target.value)}>
              {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span>URL de la foto (opcional)</span>
          <input type="url" placeholder="https://…" value={d.image_url ?? ''} onChange={(e) => set('image_url', e.target.value)} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={d.available} onChange={(e) => set('available', e.target.checked)} />
          <span>Disponible</span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        {props.onDelete && (
          <button
            type="button"
            className="btn btn-ghost danger"
            disabled={busy}
            onClick={() => confirm('¿Eliminar este platillo?') && void wrap(props.onDelete!)}
          >
            Eliminar platillo
          </button>
        )}
      </form>
    </Modal>
  )
}
