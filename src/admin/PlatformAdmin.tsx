import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { assignPlan, createRestaurant, deleteRestaurant, listAllRestaurants, listPlans, slugify, updateRestaurant } from '../lib/adminApi'
import { resetDemo } from '../lib/demoStore'
import { isDemo } from '../lib/supabase'
import { errorText, useData } from '../lib/useData'
import { Modal } from '../components/Modal'
import { AdminHeader } from './AdminShell'
import { brandVars, GREEN } from '../lib/color'
import { Stat } from '../components/Stat'
import { BillingPanel } from './BillingPanel'
import { SalesPanel } from './SalesPanel'
import { ProductsPanel } from './ProductsPanel'
import { PlansPanel } from './PlansPanel'
import { serviceStatus, STATE_LABEL } from '../lib/billing'
import type { Plan, RestaurantSummary } from '../types'
import { PlanSelect } from './PlanSelect'
import { money } from '../lib/format'

export function PlatformAdmin() {
  const { data, error, reload } = useData(listAllRestaurants, [])
  const plans = useData(listPlans, [])
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<'restaurants' | 'billing' | 'sales' | 'products' | 'plans'>('restaurants')
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
      <AdminHeader title="Plataforma ColonTab" subtitle="Administración de todos los restaurantes" back="/admin" />
      <main className="admin-main stack-lg">
        <div className="segmented view-switch">
          <button
            className={view === 'restaurants' ? 'active' : ''}
            onClick={() => {
              // Al volver, recargar: en las otras pestañas pudieron cambiar planes o fechas
              if (view !== 'restaurants') {
                reload()
                plans.reload()
              }
              setView('restaurants')
            }}
          >
            🏢 Restaurantes
          </button>
          <button className={view === 'billing' ? 'active' : ''} onClick={() => setView('billing')}>💳 Cobros</button>
          <button className={view === 'sales' ? 'active' : ''} onClick={() => setView('sales')}>🧾 Ventas</button>
          <button className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}>📦 Artículos</button>
          <button className={view === 'plans' ? 'active' : ''} onClick={() => setView('plans')}>⭐ Planes</button>
        </div>
        {view === 'billing' ? <BillingPanel /> : view === 'sales' ? <SalesPanel /> : view === 'products' ? <ProductsPanel /> : view === 'plans' ? <PlansPanel /> : <>
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
                  <th>Plan</th>
                  <th>Mesas</th>
                  <th>Llamadas</th>
                  <th>Estado</th>
                  <th>Servicio</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <Row
                    key={r.id}
                    r={r}
                    plans={plans.data ?? []}
                    onPlan={(planId) => void run(() => assignPlan(r.id, planId))}
                    onToggle={() => void run(() => updateRestaurant(r.id, { active: !r.active }))}
                    onDelete={() => {
                      const typed = prompt(`Esto borra "${r.name}" con su menú y pedidos.\nEscribe "${r.slug}" para confirmar:`)
                      if (typed === r.slug) void run(() => deleteRestaurant(r.id))
                    }}
                  />
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={8} className="muted center-text">No hay restaurantes.</td></tr>
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
        </>}
      </main>

      {creating && (
        <CreateRestaurant
          existingSlugs={(data ?? []).map((r) => r.slug)}
          plans={plans.data ?? []}
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

function Row({ r, plans, onPlan, onToggle, onDelete }: { r: RestaurantSummary; plans: Plan[]; onPlan: (planId: string | null) => void; onToggle: () => void; onDelete: () => void }) {
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
      <td>
        <PlanSelect plans={plans} value={r.billing?.plan_id ?? null} onChange={onPlan} />
      </td>
      <td>{r.table_count}</td>
      <td>{r.request_count}</td>
      <td>
        <button className={`tag ${r.active ? 'tag-on' : 'tag-off'}`} onClick={onToggle} title="Cambiar estado">
          {r.active ? 'Activo' : 'Inactivo'}
        </button>
      </td>
      <td>
        {(() => {
          const st = serviceStatus(r.paid_until)
          return <span className={`tag state-${st.state}`}>{STATE_LABEL[st.state]}</span>
        })()}
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

/** Enlace único a partir del nombre: si ya existe, agrega -2, -3… */
function uniqueSlug(name: string, taken: string[]): string {
  const base = slugify(name) || 'restaurante'
  let slug = base
  for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`
  return slug
}

function CreateRestaurant(props: { existingSlugs: string[]; plans: Plan[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [tables, setTables] = useState(10)
  const [planId, setPlanId] = useState<string>(props.plans.find((p) => p.active)?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slug = uniqueSlug(name, props.existingSlugs)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createRestaurant({ name: name.trim(), slug, ownerEmail, primaryColor: GREEN, tableCount: tables, planId: planId || null })
      props.onCreated()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Nuevo restaurante" onClose={props.onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Nombre del restaurante</span>
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tacos El Güero" />
          {name.trim() && <small className="muted">Enlace: /r/{slug}</small>}
        </label>
        <label className="field"><span>Email del dueño</span>
          <input type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="dueno@restaurante.com" />
          <small className="muted">Con este email crea su cuenta y entra a su panel.</small>
        </label>
        <label className="field"><span>Cantidad de mesas</span>
          <input type="number" required min={1} max={500} value={tables} onChange={(e) => setTables(Number(e.target.value))} />
        </label>
        <label className="field"><span>Plan</span>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Sin plan (asignar después)</option>
            {props.plans.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {money(p.price, p.currency)} / {p.months === 12 ? 'año' : `${p.months} meses`}</option>
            ))}
          </select>
          {props.plans.length === 0 && <small className="muted">Crea tus planes en la pestaña ⭐ Planes.</small>}
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !name.trim()}>{busy ? 'Creando…' : 'Crear restaurante'}</button>
      </form>
    </Modal>
  )
}

