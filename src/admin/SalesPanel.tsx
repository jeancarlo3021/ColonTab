import { useMemo, useState, type FormEvent } from 'react'
import { createSale, deleteSale, listAllRestaurants, listProducts, listSales, setSalePaid } from '../lib/adminApi'
import { crToday, formatDate, tierFor } from '../lib/billing'
import { money } from '../lib/format'
import { errorText, useData } from '../lib/useData'
import { Modal } from '../components/Modal'
import { Stat } from '../components/Stat'
import type { Product, ProductSale, RestaurantSummary } from '../types'

type Period = 'month' | 'year' | 'all'

function sumBy(list: ProductSale[]) {
  const m = new Map<string, number>()
  for (const s of list) m.set(s.currency, (m.get(s.currency) ?? 0) + s.total)
  return [...m.entries()].map(([c, v]) => money(v, c)).join(' + ') || money(0, 'CRC')
}

/** Registro de lo que vendes (placas, stickers…) a cada restaurante. */
export function SalesPanel() {
  const sales = useData(() => listSales(), [])
  const products = useData(listProducts, [])
  const restaurants = useData(listAllRestaurants, [])
  const [period, setPeriod] = useState<Period>('month')
  const [who, setWho] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = crToday()
  const nameOf = (s: ProductSale) =>
    s.restaurant_id ? restaurants.data?.find((r) => r.id === s.restaurant_id)?.name ?? 'Restaurante eliminado' : s.customer_name ?? '—'

  const list = useMemo(
    () =>
      (sales.data ?? []).filter(
        (s) =>
          (period === 'all' || (period === 'year' ? s.sold_at.slice(0, 4) === today.slice(0, 4) : s.sold_at.slice(0, 7) === today.slice(0, 7))) &&
          (!who || s.restaurant_id === who),
      ),
    [sales.data, period, who, today],
  )
  const units = list.reduce((n, s) => n + s.quantity, 0)
  const pending = list.filter((s) => !s.paid)

  async function run(fn: () => Promise<void>) {
    setError(null)
    try {
      await fn()
      sales.reload()
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <div className="stack-lg">
      <div className="stats">
        <Stat label={period === 'month' ? 'Vendido este mes' : period === 'year' ? `Vendido en ${today.slice(0, 4)}` : 'Vendido en total'} value={sumBy(list)} />
        <Stat label="Unidades" value={String(units)} />
        <Stat label="Ventas" value={String(list.length)} />
        <Stat label="Por cobrar" value={sumBy(pending)} highlight={pending.length > 0} />
      </div>

      <div className="row-between">
        <div className="inline-form">
          <div className="segmented small-seg">
            {([['month', 'Este mes'], ['year', 'Este año'], ['all', 'Todo']] as const).map(([p, label]) => (
              <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>{label}</button>
            ))}
          </div>
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filtrar por restaurante">
            <option value="">Todos los clientes</option>
            {restaurants.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary small" onClick={() => setAdding(true)} disabled={!products.data?.length}>+ Registrar venta</button>
      </div>
      {products.data?.length === 0 && <p className="muted">Primero crea tus artículos en la pestaña <b>Artículos</b>.</p>}
      {(sales.error || error) && (
        <p className="error">{sales.error ?? error}{sales.error && <> · Ejecuta <code>supabase/migrations/010_articulos_ventas_planes.sql</code>.</>}</p>
      )}

      <div className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Fecha</th><th>Cliente</th><th>Artículo</th><th>Cant.</th><th>Precio c/u</th><th>Total</th><th>Pago</th><th /></tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>{formatDate(s.sold_at)}</td>
                <td>{nameOf(s)}</td>
                <td>
                  <div className="cell-stack">
                    <span>{s.product_name}</span>
                    {s.note && <small className="muted">{s.note}</small>}
                  </div>
                </td>
                <td>{s.quantity}</td>
                <td>{money(s.unit_price, s.currency)}</td>
                <td><strong>{money(s.total, s.currency)}</strong></td>
                <td>
                  <button className={`tag ${s.paid ? 'tag-on' : 'state-soon'}`} onClick={() => void run(() => setSalePaid(s.id, !s.paid))} title="Cambiar">
                    {s.paid ? 'Pagado' : 'Pendiente'}
                  </button>
                </td>
                <td>
                  <button className="btn btn-ghost small danger" onClick={() => confirm('¿Borrar esta venta?') && void run(() => deleteSale(s.id))}>Borrar</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="muted center-text">Sin ventas en este periodo.</td></tr>}
          </tbody>
        </table>
      </div>

      {adding && products.data && restaurants.data && (
        <SaleModal
          products={products.data.filter((p) => p.active)}
          restaurants={restaurants.data}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); sales.reload() }}
        />
      )}
    </div>
  )
}

function SaleModal(props: { products: Product[]; restaurants: RestaurantSummary[]; onClose: () => void; onSaved: () => void }) {
  const [restaurantId, setRestaurantId] = useState(props.restaurants[0]?.id ?? '')
  const [customer, setCustomer] = useState('')
  const [productId, setProductId] = useState(props.products[0]?.id ?? '')
  const [qty, setQty] = useState(1)
  const [custom, setCustom] = useState<string>('')
  const [date, setDate] = useState(crToday())
  const [paid, setPaid] = useState(true)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const product = props.products.find((p) => p.id === productId)
  const tier = product ? tierFor(product.tiers, qty) : null
  const unit = custom !== '' ? Number(custom) : tier?.price ?? 0
  const total = Math.round(unit * qty * 100) / 100

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!product) return
    setBusy(true)
    setError(null)
    try {
      await createSale({
        restaurant_id: restaurantId || null,
        customer_name: restaurantId ? null : customer.trim(),
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: unit,
        total,
        currency: product.currency,
        sold_at: date,
        paid,
        note: note.trim() || null,
      })
      props.onSaved()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Registrar venta" onClose={props.onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Cliente</span>
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
            {props.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            <option value="">Otro cliente (no es restaurante en ColonTab)</option>
          </select>
        </label>
        {!restaurantId && (
          <label className="field"><span>Nombre del cliente</span>
            <input required value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Soda Doña María" />
          </label>
        )}
        <label className="field"><span>Artículo</span>
          <select value={productId} onChange={(e) => { setProductId(e.target.value); setCustom('') }}>
            {props.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {product && (
          <div className="tier-chips" aria-label="Precios por cantidad">
            {product.tiers.map((t) => (
              <button
                type="button"
                key={t.min}
                className={`tier-chip ${tier?.min === t.min && custom === '' ? 'on' : ''}`}
                onClick={() => { setQty(Math.max(qty, t.min)); setCustom('') }}
              >
                {t.min === 1 ? '1+' : `${t.min}+`} · {money(t.price, product.currency)}
              </button>
            ))}
          </div>
        )}
        <div className="field-row">
          <label className="field"><span>Cantidad</span>
            <input type="number" min={1} required value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label className="field"><span>Precio c/u</span>
            <input type="number" min={0} step="0.01" value={custom !== '' ? custom : tier?.price ?? 0} onChange={(e) => setCustom(e.target.value)} />
          </label>
          <label className="field"><span>Fecha</span>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <p className="note">
          {product && (custom === ''
            ? <>Precio aplicado: <b>{tier!.min === 1 ? '1 unidad' : `desde ${tier!.min}`}</b> → {money(tier!.price, product.currency)} c/u.</>
            : <>Precio cambiado a mano.</>)}{' '}
          Total: <b>{product ? money(total, product.currency) : '—'}</b>
        </p>
        <label className="field"><span>Nota (opcional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Factura, mesas 1–12…" />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          <span>Ya está pagado</span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !product}>{busy ? 'Guardando…' : 'Registrar venta'}</button>
      </form>
    </Modal>
  )
}
