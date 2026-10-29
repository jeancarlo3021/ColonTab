import { useMemo, useState, type FormEvent } from 'react'
import { assignPlan, deletePayment, listAllRestaurants, listPayments, listPlans, registerPayment, saveBilling, setPaidUntil } from '../lib/adminApi'
import { PlanSelect } from './PlanSelect'
import {
  ALERT_DAYS, crToday, daysText, effectivePlanPrice, formatDate, nextPeriodStart, periodEnd, serviceStatus, STATE_LABEL, type ServiceState,
} from '../lib/billing'
import { money } from '../lib/format'
import { errorText, useData } from '../lib/useData'
import { Modal } from '../components/Modal'
import { Stat } from '../components/Stat'
import type { RestaurantSummary } from '../types'

type Filter = 'all' | 'soon' | 'expired' | 'none'
const METHODS = ['SINPE Móvil', 'Transferencia', 'Efectivo', 'Tarjeta', 'Otro']
const ORDER: Record<ServiceState, number> = { expired: 0, soon: 1, none: 2, ok: 3 }

/** Mensaje de aviso para el dueño (correo o WhatsApp). */
function reminderText(r: RestaurantSummary) {
  const s = serviceStatus(r.paid_until)
  const eff = effectivePlanPrice(r.billing)
  const price = eff ? ` (${money(eff.price, eff.currency)})` : ''
  if (s.state === 'expired') {
    return `Hola, el servicio de ColonTab para ${r.name} venció el ${formatDate(s.until!)} y está suspendido: las mesas no pueden enviar avisos. Para reactivarlo, renueva tu plan anual${price}. ¡Gracias!`
  }
  return `Hola, te recordamos que el servicio de ColonTab para ${r.name} vence el ${formatDate(s.until ?? crToday())} (${s.daysLeft !== null ? daysText(s.daysLeft) : ''}). Para que no se bloquee, renueva tu plan anual${price}. ¡Gracias!`
}

export function BillingPanel() {
  const restaurants = useData(listAllRestaurants, [])
  const payments = useData(() => listPayments(), [])
  const plans = useData(listPlans, [])
  const [planError, setPlanError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [paying, setPaying] = useState<RestaurantSummary | null>(null)
  const [editing, setEditing] = useState<RestaurantSummary | null>(null)
  const [history, setHistory] = useState<RestaurantSummary | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const reload = () => {
    restaurants.reload()
    payments.reload()
  }

  const rows = useMemo(
    () =>
      (restaurants.data ?? [])
        .map((r) => ({ r, s: serviceStatus(r.paid_until) }))
        .sort((a, b) => ORDER[a.s.state] - ORDER[b.s.state] || (a.s.daysLeft ?? 9e9) - (b.s.daysLeft ?? 9e9)),
    [restaurants.data],
  )
  const count = (st: ServiceState) => rows.filter((x) => x.s.state === st).length
  const year = crToday().slice(0, 4)
  const yearTotals = useMemo(() => {
    const t = new Map<string, number>()
    for (const p of payments.data ?? []) if (p.created_at.slice(0, 4) === year) t.set(p.currency, (t.get(p.currency) ?? 0) + p.amount)
    return [...t.entries()]
  }, [payments.data, year])
  const visible = rows.filter((x) => filter === 'all' || x.s.state === filter)

  return (
    <div className="stack-lg">
      <div className="stats">
        <Stat label="Al día" value={String(count('ok'))} />
        <Stat label={`Vencen en ${ALERT_DAYS} días`} value={String(count('soon'))} highlight={count('soon') > 0} />
        <Stat label="Vencidos (bloqueados)" value={String(count('expired'))} />
        <Stat label="Sin fecha" value={String(count('none'))} />
        <Stat
          label={`Cobrado en ${year}`}
          value={yearTotals.length ? yearTotals.map(([c, v]) => money(v, c)).join(' + ') : money(0, 'CRC')}
        />
      </div>

      <div className="segmented billing-filter">
        {([['all', 'Todos'], ['soon', 'Por vencer'], ['expired', 'Vencidos'], ['none', 'Sin fecha']] as const).map(([f, label]) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{label}</button>
        ))}
      </div>

      {restaurants.error && <p className="error">{restaurants.error}</p>}
      {planError && <p className="error">No se pudo asignar el plan: {planError}</p>}
      {payments.error && (
        <p className="error">No se pudieron cargar los pagos. Ejecuta <code>supabase/migrations/009_cobro_anual.sql</code> en Supabase.</p>
      )}

      <div className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Restaurante</th>
              <th>Plan anual</th>
              <th>Vence</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map(({ r, s }) => (
              <tr key={r.id}>
                <td>
                  <div className="cell-stack">
                    <strong>{r.name}</strong>
                    <small className="muted">{r.owner_email ?? 'Sin dueño'}</small>
                  </div>
                </td>
                <td>
                  {(() => {
                    const eff = effectivePlanPrice(r.billing)
                    return (
                      <div className="cell-stack">
                        <PlanSelect
                          plans={plans.data ?? []}
                          value={r.billing?.plan_id ?? null}
                          onChange={(planId) => {
                            setPlanError(null)
                            void assignPlan(r.id, planId).then(reload).catch((e) => setPlanError(errorText(e)))
                          }}
                        />
                        {eff && <small className="muted">{money(eff.price, eff.currency)}{r.billing?.plan_price != null ? ' (precio especial)' : ''}</small>}
                      </div>
                    )
                  })()}
                </td>
                <td>
                  {s.until ? (
                    <div className="cell-stack">
                      <span>{formatDate(s.until)}</span>
                      <small className="muted">{daysText(s.daysLeft!)}</small>
                    </div>
                  ) : (
                    <span className="muted">Sin fecha</span>
                  )}
                </td>
                <td><span className={`tag state-${s.state}`}>{STATE_LABEL[s.state]}</span></td>
                <td>
                  <div className="order-actions">
                    <button className="btn btn-primary small" onClick={() => setPaying(r)}>Registrar pago</button>
                    <button className="btn btn-ghost small" onClick={() => setEditing(r)}>Editar</button>
                    <button className="btn btn-ghost small" onClick={() => setHistory(r)}>Historial</button>
                    {(s.state === 'soon' || s.state === 'expired') && (
                      <>
                        {r.owner_email && (
                          <a
                            className="btn btn-ghost small"
                            href={`mailto:${r.owner_email}?subject=${encodeURIComponent(`Tu servicio de ColonTab ${s.state === 'expired' ? 'venció' : 'está por vencer'}`)}&body=${encodeURIComponent(reminderText(r))}`}
                          >
                            Avisar por correo
                          </a>
                        )}
                        <button
                          className="btn btn-ghost small"
                          onClick={() =>
                            void navigator.clipboard?.writeText(reminderText(r)).then(() => {
                              setCopied(r.id)
                              setTimeout(() => setCopied(null), 1500)
                            })
                          }
                        >
                          {copied === r.id ? '¡Copiado!' : 'Copiar mensaje'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="muted center-text">No hay restaurantes en esta lista.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small-text">
        Cuando faltan {ALERT_DAYS} días o menos, el restaurante ve un aviso en su panel cada día. El día después del vencimiento
        se bloquea: sus mesas no pueden enviar avisos y su panel queda suspendido hasta que registres el pago.
      </p>

      {paying && <PaymentModal r={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); reload() }} />}
      {editing && <EditModal r={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload() }} />}
      {history && <HistoryModal r={history} onClose={() => setHistory(null)} onChanged={reload} />}
    </div>
  )
}

function PaymentModal({ r, onClose, onDone }: { r: RestaurantSummary; onClose: () => void; onDone: () => void }) {
  const eff = effectivePlanPrice(r.billing)
  const [amount, setAmount] = useState(eff?.price ?? 0)
  const [currency, setCurrency] = useState(eff?.currency ?? 'CRC')
  const [method, setMethod] = useState(METHODS[0])
  const [months, setMonths] = useState(r.billing?.plan?.months ?? 12)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const start = nextPeriodStart(r.paid_until)
  const end = periodEnd(start, months)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await registerPayment(r.id, { amount, currency, method, note: note.trim() || null, months })
      onDone()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={`Registrar pago · ${r.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field-row">
          <label className="field"><span>Monto</span>
            <input type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <label className="field"><span>Moneda</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="CRC">₡ Colones</option>
              <option value="USD">$ Dólares</option>
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field"><span>Forma de pago</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <label className="field"><span>Meses de servicio</span>
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {[...new Set([months, 12, 6, 3, 1, 24])].map((m) => <option key={m} value={m}>{m === 12 ? '12 (un año)' : m}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span>Nota (opcional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="N.º de comprobante, factura…" />
        </label>
        <p className="note">
          Cubre del <b>{formatDate(start)}</b> al <b>{formatDate(end)}</b>.
          {r.paid_until && start !== crToday() && ' Se suma al vencimiento actual.'}
        </p>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Registrar pago'}</button>
      </form>
    </Modal>
  )
}

function EditModal({ r, onClose, onDone }: { r: RestaurantSummary; onClose: () => void; onDone: () => void }) {
  const plans = useData(listPlans, [])
  const [planId, setPlanId] = useState<string>(r.billing?.plan_id ?? '')
  const [price, setPrice] = useState<string>(r.billing?.plan_price != null ? String(r.billing.plan_price) : '')
  const [currency, setCurrency] = useState(r.billing?.plan_currency ?? 'CRC')
  const [until, setUntil] = useState(r.paid_until?.slice(0, 10) ?? '')
  const [note, setNote] = useState(r.billing?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveBilling(r.id, { plan_id: planId || null, plan_price: price === '' ? null : Number(price), plan_currency: currency, note: note.trim() || null })
      if ((until || null) !== (r.paid_until?.slice(0, 10) ?? null)) await setPaidUntil(r.id, until || null)
      onDone()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={`Plan · ${r.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Plan</span>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Sin plan</option>
            {plans.data?.filter((p) => p.active || p.id === planId).map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {money(p.price, p.currency)} / {p.months === 12 ? 'año' : `${p.months} meses`}</option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label className="field"><span>Precio especial (opcional)</span>
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={planId ? 'Usa el del plan' : '120000'} />
          </label>
          <label className="field"><span>Moneda</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="CRC">₡ Colones</option>
              <option value="USD">$ Dólares</option>
            </select>
          </label>
        </div>
        <label className="field"><span>Último día de servicio</span>
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          <small className="muted">Déjalo vacío para que no tenga fecha (no se bloquea). Para extender con un pago, usa “Registrar pago”.</small>
        </label>
        <label className="field"><span>Nota interna</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Descuento, contacto de pagos…" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Modal>
  )
}

function HistoryModal({ r, onClose, onChanged }: { r: RestaurantSummary; onClose: () => void; onChanged: () => void }) {
  const { data, error, reload } = useData(() => listPayments(r.id), [r.id])
  return (
    <Modal title={`Pagos · ${r.name}`} onClose={onClose}>
      {error && <p className="error">{error}</p>}
      {data?.length === 0 && <p className="muted">Sin pagos registrados.</p>}
      <ul className="payment-list">
        {data?.map((p) => (
          <li key={p.id}>
            <div>
              <strong>{money(p.amount, p.currency)}</strong>
              <small className="muted">{formatDate(p.created_at)} · {p.method ?? 'Pago'}{p.note ? ` · ${p.note}` : ''}</small>
              <small>Del {formatDate(p.period_start)} al {formatDate(p.period_end)}</small>
            </div>
            <button
              className="btn btn-ghost small danger"
              onClick={() =>
                confirm('¿Borrar este pago del historial? (No cambia la fecha de vencimiento; ajústala con “Editar” si hace falta.)') &&
                void deletePayment(p.id).then(() => { reload(); onChanged() })
              }
            >
              Borrar
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
