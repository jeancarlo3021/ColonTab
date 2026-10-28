import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createRestaurant, deleteRestaurant, listAllRestaurants, slugify, updateRestaurant } from '../lib/adminApi'
import { resetDemo } from '../lib/demoStore'
import { isDemo } from '../lib/supabase'
import { errorText, useData } from '../lib/useData'
import { Modal } from '../components/Modal'
import { AdminHeader } from './AdminShell'
import { brandVars, GREEN } from '../lib/color'
import { Stat } from '../components/Stat'
import type { RestaurantSummary } from '../types'

export function PlatformAdmin() {
  const { data, error, reload } = useData(listAllRestaurants, [])
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
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

  const list = (data ?? []).filter((r) =>
    [r.name, r.slug, r.owner_email ?? ''].some((v) => v.toLowerCase().includes(query.toLowerCase())),
  )

  return (
    <div className="admin">
      <AdminHeader title="Plataforma MesaClick" subtitle="Administración de todos los restaurantes" back="/admin" />
      <main className="admin-main stack-lg">
        <div className="stats">
          <Stat label="Restaurantes" value={String(data?.length ?? '—')} />
          <Stat label="Activos" value={String(data?.filter((r) => r.active).length ?? '—')} />
          <Stat label="Llamadas de mesas" value={String(data?.reduce((s, r) => s + r.request_count, 0) ?? '—')} />
        </div>

        <div className="row-between">
          <input className="search" placeholder="Buscar por nombre, enlace o dueño…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn btn-primary small" onClick={() => setCreating(true)}>+ Nuevo restaurante</button>
        </div>
        {(error || actionError) && <p className="error">{error ?? actionError}</p>}
        {!data && !error && <div className="spinner" />}

        {data && (
          <div className="panel table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Restaurante</th>
                  <th>Dueño</th>
                  <th>Mesas</th>
                  <th>Llamadas</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <Row
                    key={r.id}
                    r={r}
                    onToggle={() => void run(() => updateRestaurant(r.id, { active: !r.active }))}
                    onDelete={() => {
                      const typed = prompt(`Esto borra "${r.name}" con su menú y pedidos.\nEscribe "${r.slug}" para confirmar:`)
                      if (typed === r.slug) void run(() => deleteRestaurant(r.id))
                    }}
                  />
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={6} className="muted center-text">No hay restaurantes.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {isDemo && (
          <button
            className="btn btn-ghost small"
            onClick={() => confirm('¿Borrar todos los datos de demostración?') && (resetDemo(), reload())}
          >
            Reiniciar datos de demo
          </button>
        )}
      </main>

      {creating && (
        <CreateRestaurant
          existingSlugs={(data ?? []).map((r) => r.slug)}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function Row({ r, onToggle, onDelete }: { r: RestaurantSummary; onToggle: () => void; onDelete: () => void }) {
  return (
    <tr>
      <td>
        <div className="cell-restaurant">
          <div className="logo" style={{ width: 36, height: 36, fontSize: 14, ...brandVars(r.primary_color) }}>{r.logo_text}</div>
          <div>
            <strong>{r.name}</strong>
            <small className="muted">/r/{r.slug}</small>
          </div>
        </div>
      </td>
      <td>{r.owner_email ?? <span className="muted">Sin dueño</span>}</td>
      <td>{r.table_count}</td>
      <td>{r.request_count}</td>
      <td>
        <button className={`tag ${r.active ? 'tag-on' : 'tag-off'}`} onClick={onToggle} title="Cambiar estado">
          {r.active ? 'Activo' : 'Inactivo'}
        </button>
      </td>
      <td>
        <div className="order-actions">
          <Link className="btn btn-ghost small" to={`/admin/r/${r.slug}`}>Administrar</Link>
          <a className="btn btn-ghost small" href={`/r/${r.slug}/1`} target="_blank" rel="noreferrer">Ver ↗</a>
          <button className="btn btn-ghost small danger" onClick={onDelete}>Eliminar</button>
        </div>
      </td>
    </tr>
  )
}

function CreateRestaurant(props: { existingSlugs: string[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [color, setColor] = useState(GREEN)
  const [tables, setTables] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalSlug = slugTouched ? slugify(slug) : slugify(name)
  const taken = props.existingSlugs.includes(finalSlug)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!finalSlug || taken) return
    setBusy(true)
    setError(null)
    try {
      await createRestaurant({ name: name.trim(), slug: finalSlug, ownerEmail, primaryColor: color, tableCount: tables })
      props.onCreated()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Nuevo restaurante" onClose={props.onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Nombre</span>
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tacos El Güero" />
        </label>
        <label className="field"><span>Enlace</span>
          <div className="prefix-input">
            <span>/r/</span>
            <input
              value={slugTouched ? slug : finalSlug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
            />
          </div>
          {taken && <small className="error">Ese enlace ya existe</small>}
        </label>
        <label className="field"><span>Email del dueño</span>
          <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="dueno@restaurante.com" />
          <small className="muted">Con este email crea su cuenta y entra a su panel.</small>
        </label>
        <div className="field-row">
          <label className="field"><span>Color</span>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <label className="field"><span>Mesas</span>
            <input type="number" min={1} max={500} value={tables} onChange={(e) => setTables(Number(e.target.value))} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !finalSlug || taken}>{busy ? 'Creando…' : 'Crear restaurante'}</button>
      </form>
    </Modal>
  )
}
