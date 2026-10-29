import { useState, type FormEvent } from 'react'
import { assignPlan, deletePlan, listAllRestaurants, listPlans, savePlan } from '../lib/adminApi'
import { money } from '../lib/format'
import { errorText, useData } from '../lib/useData'
import { Modal } from '../components/Modal'
import type { Plan } from '../types'

type Draft = Omit<Plan, 'id'> & { id?: string }

/** Planes de suscripción que se asignan a cada restaurante (en Cobros → Editar). */
export function PlansPanel() {
  const plans = useData(listPlans, [])
  const restaurants = useData(listAllRestaurants, [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const on = (id: string) => (restaurants.data ?? []).filter((r) => r.billing?.plan_id === id)
  const usage = (id: string) => on(id).length

  async function assign(restaurantId: string, planId: string | null) {
    setError(null)
    try {
      await assignPlan(restaurantId, planId)
      restaurants.reload()
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <div className="stack-lg">
      <div className="row-between">
        <p className="muted">Crea tus planes y asígnalos a cada restaurante en <b>Cobros → Editar</b>. Al registrar un pago se usa el precio del plan.</p>
        <button className="btn btn-primary small" onClick={() => setDraft({ name: '', description: '', price: 0, currency: 'CRC', months: 12, active: true })}>
          + Nuevo plan
        </button>
      </div>
      {plans.error && <p className="error">{plans.error}. Si aún no lo hiciste, ejecuta <code>supabase/migrations/010_articulos_ventas_planes.sql</code>.</p>}
      {plans.data?.length === 0 && <p className="muted">Todavía no hay planes.</p>}
      {error && <p className="error">No se pudo asignar el plan: {error}</p>}
      <div className="product-grid">
        {plans.data?.map((p) => (
          <article key={p.id} className={`panel plan-card ${p.active ? '' : 'off'}`}>
            <div className="row-between">
              <h3>{p.name}</h3>
              {!p.active && <span className="tag">Oculto</span>}
            </div>
            <div className="plan-price">
              <strong>{money(p.price, p.currency)}</strong>
              <span className="muted">/ {p.months === 12 ? 'año' : `${p.months} meses`}</span>
            </div>
            {p.description && <p className="muted small-text">{p.description}</p>}
            <div className="plan-members">
              <small className="muted">{usage(p.id)} {usage(p.id) === 1 ? 'restaurante' : 'restaurantes'} con este plan</small>
              {on(p.id).map((r) => (
                <div key={r.id} className="plan-member">
                  <span>{r.name}</span>
                  <button className="link-btn" onClick={() => void assign(r.id, null)} title="Quitar de este plan">Quitar</button>
                </div>
              ))}
              {(restaurants.data ?? []).some((r) => r.billing?.plan_id !== p.id) && p.active && (
                <select
                  className="plan-select"
                  value=""
                  onChange={(e) => e.target.value && void assign(e.target.value, p.id)}
                  aria-label={`Asignar el plan ${p.name} a un restaurante`}
                >
                  <option value="">+ Asignar a un restaurante…</option>
                  {(restaurants.data ?? []).filter((r) => r.billing?.plan_id !== p.id).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}{r.billing?.plan ? ` (ahora: ${r.billing.plan.name})` : ''}</option>
                  ))}
                </select>
              )}
            </div>
            <button className="btn btn-ghost small" onClick={() => setDraft({ ...p })}>Editar</button>
          </article>
        ))}
      </div>
      {draft && <PlanEditor draft={draft} inUse={draft.id ? usage(draft.id) : 0} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); plans.reload() }} />}
    </div>
  )
}

function PlanEditor({ draft, inUse, onClose, onSaved }: { draft: Draft; inUse: number; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await savePlan({ ...d, name: d.name.trim(), description: d.description?.trim() || null })
      onSaved()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={d.id ? 'Editar plan' : 'Nuevo plan'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Nombre</span>
          <input required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Básico" />
        </label>
        <label className="field"><span>Qué incluye (opcional)</span>
          <input value={d.description ?? ''} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="Menú, QR/NFC y avisos al mesero" />
        </label>
        <div className="field-row">
          <label className="field"><span>Precio</span>
            <input type="number" min={0} step="0.01" required value={d.price} onChange={(e) => setD({ ...d, price: Number(e.target.value) })} />
          </label>
          <label className="field"><span>Moneda</span>
            <select value={d.currency} onChange={(e) => setD({ ...d, currency: e.target.value })}>
              <option value="CRC">₡ Colones</option>
              <option value="USD">$ Dólares</option>
            </select>
          </label>
          <label className="field"><span>Meses</span>
            <input type="number" min={1} max={36} required value={d.months} onChange={(e) => setD({ ...d, months: Number(e.target.value) })} />
          </label>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />
          <span>Disponible para asignar</span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        {d.id && (
          <button
            type="button"
            className="btn btn-ghost danger"
            onClick={() =>
              confirm(inUse ? `${inUse} restaurante(s) tienen este plan y quedarán sin plan. ¿Eliminarlo?` : '¿Eliminar este plan?') &&
              void deletePlan(d.id!).then(onSaved).catch((e) => setError(errorText(e)))
            }
          >
            Eliminar plan
          </button>
        )}
      </form>
    </Modal>
  )
}
