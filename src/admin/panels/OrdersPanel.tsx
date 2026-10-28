import { useEffect, useRef, useState } from 'react'
import { listOrders, listPendingRequests, resolveRequest, setOrderStatus, subscribeLive } from '../../lib/adminApi'
import { money } from '../../lib/format'
import { errorText } from '../../lib/useData'
import type { Order, OrderStatus, Restaurant, ServiceRequest } from '../../types'

const COLUMNS: { status: OrderStatus; title: string; next?: OrderStatus; nextLabel?: string }[] = [
  { status: 'nuevo', title: 'Nuevos', next: 'preparando', nextLabel: 'Preparar' },
  { status: 'preparando', title: 'En cocina', next: 'servido', nextLabel: 'Marcar servido' },
  { status: 'servido', title: 'Servidos', next: 'pagado', nextLabel: 'Marcar pagado' },
]

const PAYMENT_LABEL = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '📲 Transferencia' }

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function timeAgo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    /* el navegador bloqueó el audio */
  }
}

export function OrdersPanel({ restaurant }: { restaurant: Restaurant }) {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sound, setSound] = useState(true)
  const [, forceTick] = useState(0)
  const known = useRef<Set<string> | null>(null)
  const soundRef = useRef(sound)
  useEffect(() => {
    soundRef.current = sound
  }, [sound])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [o, s] = await Promise.all([listOrders(restaurant.id, startOfToday()), listPendingRequests(restaurant.id)])
        if (!alive) return
        const ids = new Set([...o.map((x) => x.id), ...s.map((x) => x.id)])
        const prev = known.current
        if (prev && soundRef.current && [...ids].some((id) => !prev.has(id))) beep()
        known.current = ids
        setOrders(o)
        setRequests(s)
        setError(null)
      } catch (e) {
        if (alive) setError(errorText(e))
      }
    }
    void load()
    const unsubscribe = subscribeLive(restaurant.id, () => void load())
    // Respaldo por si se pierde la conexión en tiempo real
    const poll = setInterval(() => void load(), 30000)
    const clock = setInterval(() => forceTick((t) => t + 1), 30000)
    return () => {
      alive = false
      unsubscribe()
      clearInterval(poll)
      clearInterval(clock)
    }
  }, [restaurant.id])

  async function move(order: Order, status: OrderStatus) {
    setOrders((list) => list?.map((o) => (o.id === order.id ? { ...o, status } : o)) ?? null)
    try {
      await setOrderStatus(order.id, status)
    } catch (e) {
      setError(errorText(e))
    }
  }

  async function resolve(id: string) {
    setRequests((list) => list.filter((r) => r.id !== id))
    try {
      await resolveRequest(id)
    } catch (e) {
      setError(errorText(e))
    }
  }

  const fmt = (v: number) => money(v, restaurant.currency)
  const paid = orders?.filter((o) => o.status === 'pagado') ?? []
  const active = orders?.filter((o) => o.status !== 'cancelado') ?? []

  return (
    <div className="stack-lg">
      <div className="stats">
        <Stat label="Pedidos hoy" value={String(active.length)} />
        <Stat label="Vendido hoy" value={fmt(active.reduce((s, o) => s + o.total, 0))} />
        <Stat label="Cobrado" value={fmt(paid.reduce((s, o) => s + o.total, 0))} />
        <Stat label="Llamadas pendientes" value={String(requests.length)} highlight={requests.length > 0} />
      </div>

      <div className="row-between">
        <h2 className="section-title">Llamadas de mesas</h2>
        <label className="toggle">
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
          <span>Sonido al llegar pedidos</span>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {requests.length === 0 ? (
        <p className="muted">No hay mesas esperando. 👌</p>
      ) : (
        <div className="request-list">
          {requests.map((r) => (
            <div key={r.id} className={`request ${r.type}`}>
              <div>
                <strong>Mesa {r.table_number}</strong>
                <span>
                  {r.type === 'waiter' ? '🙋 Llama al mesero' : `🧾 Pide la cuenta${r.payment_method ? ' · ' + PAYMENT_LABEL[r.payment_method] : ''}`}
                </span>
                <small className="muted">{timeAgo(r.created_at)}</small>
              </div>
              <button className="btn btn-primary small" onClick={() => void resolve(r.id)}>Atendido</button>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">Pedidos de hoy</h2>
      {!orders && !error && <div className="spinner" />}
      {orders && (
        <div className="board">
          {COLUMNS.map((col) => {
            const list = orders.filter((o) => o.status === col.status)
            return (
              <section key={col.status} className="board-col">
                <h3>{col.title} <span className="count">{list.length}</span></h3>
                {list.length === 0 && <p className="muted small-text">Sin pedidos</p>}
                {list.map((o) => (
                  <article key={o.id} className={`order-card status-${o.status}`}>
                    <header>
                      <strong>Mesa {o.table_number}</strong>
                      <small className="muted">{timeAgo(o.created_at)}{o.guests ? ` · ${o.guests} pers.` : ''}</small>
                    </header>
                    <ul>
                      {o.order_items.map((i) => (
                        <li key={i.id}><b>{i.quantity}×</b> {i.name}</li>
                      ))}
                    </ul>
                    {o.notes && <p className="order-notes">📝 {o.notes}</p>}
                    <footer>
                      <strong>{fmt(o.total)}</strong>
                      <div className="order-actions">
                        {col.status === 'nuevo' && (
                          <button className="btn btn-ghost small" onClick={() => void move(o, 'cancelado')}>Cancelar</button>
                        )}
                        {col.next && (
                          <button className="btn btn-primary small" onClick={() => void move(o, col.next!)}>{col.nextLabel}</button>
                        )}
                      </div>
                    </footer>
                  </article>
                ))}
              </section>
            )
          })}
        </div>
      )}
      {paid.length > 0 && <p className="muted">✅ {paid.length} pedidos pagados hoy.</p>}
    </div>
  )
}

export function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`stat ${highlight ? 'highlight' : ''}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  )
}
