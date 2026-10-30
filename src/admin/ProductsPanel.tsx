import { useState, type FormEvent } from 'react'
import { deleteProduct, listProducts, saveProduct } from '../lib/adminApi'
import { money } from '../lib/format'
import { errorText, useData } from '../lib/useData'
import { Modal } from '../components/Modal'
import type { PriceTier, Product } from '../types'

type Draft = Omit<Product, 'id'> & { id?: string }
const DEFAULT_MINS = [1, 10, 25, 50]

/** Catálogo universal de artículos (placas, stickers…) con hasta 4 precios por cantidad. */
export function ProductsPanel() {
  const { data, error, reload } = useData(listProducts, [])
  const [draft, setDraft] = useState<Draft | null>(null)

  return (
    <div className="stack-lg">
      <div className="row-between">
        <p className="muted">
          Artículos que vendes a cualquier restaurante. Cada uno tiene hasta 4 precios según la cantidad: al registrar una
          venta, el precio por unidad se elige solo.
        </p>
        <button
          className="btn btn-primary small"
          onClick={() =>
            setDraft({ name: '', description: '', currency: 'CRC', cost: 0, active: true, tiers: DEFAULT_MINS.map((min) => ({ min, price: 0 })) })
          }
        >
          + Nuevo artículo
        </button>
      </div>
      {error && <p className="error">{error}. Si aún no lo hiciste, ejecuta <code>supabase/migrations/010_articulos_ventas_planes.sql</code>.</p>}
      {data?.length === 0 && <p className="muted">Todavía no hay artículos.</p>}
      <div className="product-grid">
        {data?.map((p) => (
          <article key={p.id} className={`panel product-card ${p.active ? '' : 'off'}`}>
            <div className="row-between">
              <h3>{p.name}</h3>
              {!p.active && <span className="tag">Oculto</span>}
            </div>
            {p.description && <p className="muted small-text">{p.description}</p>}
            <div className="cost-line">
              <span>Costo</span>
              <b>{money(p.cost, p.currency)} <small className="muted">c/u</small></b>
            </div>
            <table className="tier-table">
              <thead>
                <tr><th>Cantidad</th><th>Precio c/u</th><th>Ganas c/u</th></tr>
              </thead>
              <tbody>
                {p.tiers.map((t, i) => {
                  const gain = t.price - p.cost
                  return (
                    <tr key={t.min}>
                      <td>{i === 0 ? '1 unidad' : `Desde ${t.min}`}</td>
                      <td>{money(t.price, p.currency)}</td>
                      <td className={gain < 0 ? 'loss' : 'gain'}>
                        {money(gain, p.currency)}
                        {t.price > 0 && <small> {Math.round((gain / t.price) * 100)}%</small>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <button className="btn btn-ghost small" onClick={() => setDraft({ ...p, tiers: p.tiers.map((t) => ({ ...t })) })}>Editar</button>
          </article>
        ))}
      </div>
      {draft && (
        <ProductEditor
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => { setDraft(null); reload() }}
        />
      )}
    </div>
  )
}

function ProductEditor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft)
  // Siempre 4 filas; las vacías no se guardan (la primera es obligatoria)
  const [rows, setRows] = useState<{ min: string; price: string }[]>(() =>
    Array.from({ length: 4 }, (_, i) => {
      const t = draft.tiers[i]
      return t ? { min: String(t.min), price: String(t.price) } : { min: '', price: '' }
    }),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setRow = (i: number, k: 'min' | 'price', v: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const tiers: PriceTier[] = rows
      .map((r, i) => ({ min: i === 0 ? 1 : Number(r.min), price: Number(r.price) }))
      .filter((_, i) => i === 0 || (rows[i].min !== '' && rows[i].price !== ''))
    setBusy(true)
    setError(null)
    try {
      await saveProduct({ ...d, name: d.name.trim(), description: d.description?.trim() || null, tiers })
      onSaved()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={d.id ? 'Editar artículo' : 'Nuevo artículo'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Nombre</span>
          <input required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Placa NFC + QR para mesa" />
        </label>
        <label className="field"><span>Descripción (opcional)</span>
          <input value={d.description ?? ''} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="Acrílico, 10×10 cm" />
        </label>
        <div className="field-row">
          <label className="field"><span>Costo por unidad</span>
            <input type="number" min={0} step="0.01" required value={d.cost} onChange={(e) => setD({ ...d, cost: Number(e.target.value) })} />
            <small className="muted">Lo que te cuesta a ti. Solo lo ves tú.</small>
          </label>
          <label className="field"><span>Moneda</span>
            <select value={d.currency} onChange={(e) => setD({ ...d, currency: e.target.value })}>
              <option value="CRC">₡ Colones</option>
              <option value="USD">$ Dólares</option>
            </select>
          </label>
        </div>
        <div className="tier-editor">
          <span className="field-label">Precios por cantidad (precio de cada unidad)</span>
          {rows.map((r, i) => (
            <div key={i} className="tier-row">
              <span className="muted">{i === 0 ? '1 unidad' : 'Desde'}</span>
              {i === 0 ? (
                <span className="tier-one" />
              ) : (
                <input type="number" min={2} inputMode="numeric" placeholder={String(DEFAULT_MINS[i])} value={r.min} onChange={(e) => setRow(i, 'min', e.target.value)} aria-label={`Cantidad mínima del precio ${i + 1}`} />
              )}
              <span className="muted">{i === 0 ? '' : 'unidades'}</span>
              <input type="number" min={0} step="0.01" inputMode="decimal" placeholder="Precio c/u" required={i === 0} value={r.price} onChange={(e) => setRow(i, 'price', e.target.value)} aria-label={`Precio ${i + 1}`} />
              <small className={`tier-gain ${r.price !== '' && Number(r.price) < d.cost ? 'loss' : ''}`}>
                {r.price !== '' ? `ganas ${money(Number(r.price) - d.cost, d.currency)}` : ''}
              </small>
            </div>
          ))}
          <small className="muted">Deja vacías las filas que no uses.</small>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />
          <span>Disponible para vender</span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        {d.id && (
          <button
            type="button"
            className="btn btn-ghost danger"
            onClick={() =>
              confirm('¿Eliminar este artículo? Las ventas ya registradas se conservan.') &&
              void deleteProduct(d.id!).then(onSaved).catch((e) => setError(errorText(e)))
            }
          >
            Eliminar artículo
          </button>
        )}
      </form>
    </Modal>
  )
}
