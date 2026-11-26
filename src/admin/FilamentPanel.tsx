import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { Stat } from '../components/Stat'
import { errorText, useData } from '../lib/useData'
import {
  MATERIALES, SLOTS, UMBRAL_G, colorName, grams, loadFilamento, pct, saveBobina, spoolUrl,
  type Bobina, type BobinaDraft, type Impresora, type Ranura, type Slot,
} from '../lib/filamentApi'
import { NfcSpoolWriter } from './FilamentSpool'

type Draft = BobinaDraft & { id?: string }
const nuevo = (over: Partial<Draft> = {}): Draft => ({
  material: 'PLA', color: '', color_hex: null, marca: '', peso_g: 1000, restante_g: 1000, notas: '',
  impresora_id: null, ranura: null, ...over,
})

/** Inventario de filamento y lo que tiene cada ranura del CFS de cada impresora. */
export function FilamentPanel() {
  const { data, error, reload } = useData(loadFilamento, [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [creado, setCreado] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [verAgotadas, setVerAgotadas] = useState(false)

  const activas = (data?.bobinas ?? []).filter((b) => !b.agotada)
  const lista = (data?.bobinas ?? [])
    .filter((b) => verAgotadas || !b.agotada)
    .filter((b) => [b.id, b.material, b.color, b.marca ?? ''].some((v) => v.toLowerCase().includes(query.toLowerCase())))

  return (
    <div className="stack-lg">
      <div className="stats">
        <Stat label="Bobinas activas" value={data ? String(activas.length) : '—'} />
        <Stat label="Filamento disponible" value={data ? `${(activas.reduce((s, b) => s + Math.max(0, b.restante_g), 0) / 1000).toFixed(1)} kg` : '—'} />
        <Stat label="Por acabarse" value={data ? String(activas.filter((b) => b.restante_g <= UMBRAL_G).length) : '—'} />
      </div>
      {error && <p className="error">{error}</p>}
      {!data && !error && <div className="spinner" />}

      {data && (
        <div className="fil-printers">
          {data.impresoras.map((imp) => (
            <PrinterCard
              key={imp.id}
              imp={imp}
              ranuras={data.ranuras.filter((r) => r.impresora_id === imp.id)}
              bobinas={activas}
              onRegistrar={(slot, hex) => setDraft(nuevo({ impresora_id: imp.id, ranura: slot, color_hex: hex, color: hex ? colorName(hex) : '' }))}
            />
          ))}
        </div>
      )}

      <div className="row-between">
        <input className="search" placeholder="Buscar por color, material, marca o código…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="order-actions">
          <label className="toggle small-text">
            <input type="checkbox" checked={verAgotadas} onChange={(e) => setVerAgotadas(e.target.checked)} />
            <span>Ver agotadas</span>
          </label>
          <button className="btn btn-primary small" onClick={() => setDraft(nuevo())}>+ Nueva bobina</button>
        </div>
      </div>

      {data && (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Bobina</th><th>Queda</th><th>Dónde está</th><th>Usado</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((b) => (
                <tr key={b.id} className={b.agotada ? 'fil-off' : ''}>
                  <td>
                    <div className="cell-restaurant">
                      <span className="swatch" style={{ background: b.color_hex ?? '#ccc' }} />
                      <div>
                        <strong>{b.material} {b.color}</strong>
                        <small className="muted">#{b.id}{b.marca ? ` · ${b.marca}` : ''}</small>
                      </div>
                    </div>
                  </td>
                  <td style={{ minWidth: 160 }}><Barra b={b} /></td>
                  <td>{b.agotada ? <span className="tag tag-off">Agotada</span> : ubicacion(b, data.impresoras)}</td>
                  <td>{grams(b.usado_total_g)}</td>
                  <td>
                    <div className="order-actions">
                      <Link className="btn btn-ghost small" to={`/f/${b.id}`}>Abrir</Link>
                      <button className="btn btn-ghost small" onClick={() => setDraft({ ...b })}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr><td colSpan={5} className="muted center-text">Todavía no hay bobinas. Regístralas desde las ranuras de arriba o con “+ Nueva bobina”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted small-text">
        Las impresoras se actualizan solas cada pocos segundos desde el bot de filamento de la PC del taller: el gasto de
        cada impresión se resta de la bobina que está en la ranura que la imprimió.
      </p>

      {draft && data && (
        <SpoolEditor
          draft={draft}
          impresoras={data.impresoras}
          onClose={() => setDraft(null)}
          onSaved={(id, isNew) => {
            setDraft(null)
            reload()
            if (isNew) setCreado(id)
          }}
        />
      )}
      {creado && (
        <Modal title="Bobina registrada ✅" onClose={() => setCreado(null)}>
          <div className="stack-lg">
            <p>Graba este enlace en el sticker NFC de la bobina. Al acercar el celular se abre su ficha con lo que le queda.</p>
            <NfcSpoolWriter id={creado} />
            <Link className="btn btn-ghost" to={`/f/${creado}`}>Abrir la ficha</Link>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function Barra({ b }: { b: Pick<Bobina, 'restante_g' | 'peso_g'> }) {
  const p = pct(b)
  const nivel = b.restante_g <= 30 ? 'crit' : b.restante_g <= UMBRAL_G ? 'low' : ''
  return (
    <div className="fil-bar-wrap">
      <div className={`fil-bar ${nivel}`}><span style={{ width: `${p}%` }} /></div>
      <small><b>{grams(b.restante_g)}</b> <span className="muted">de {grams(b.peso_g)}</span></small>
    </div>
  )
}

export function ubicacion(b: Pick<Bobina, 'impresora_id' | 'ranura'>, impresoras: Impresora[]) {
  if (!b.impresora_id || !b.ranura) return <span className="muted">Guardada</span>
  const imp = impresoras.find((i) => i.id === b.impresora_id)
  return <span className="tag tag-on">{imp?.nombre ?? b.impresora_id} · {b.ranura}</span>
}

function hace(iso: string | null) {
  if (!iso) return 'sin datos'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 90) return 'en línea'
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  return `hace ${Math.round(s / 3600)} h`
}

const ESTADO: Record<string, string> = {
  printing: '🖨 Imprimiendo', paused: '⏸ En pausa', complete: '✅ Terminó', standby: '💤 Libre',
  cancelled: '⛔ Cancelada', error: '⚠️ Error',
}

function PrinterCard({ imp, ranuras, bobinas, onRegistrar }: {
  imp: Impresora; ranuras: Ranura[]; bobinas: Bobina[]; onRegistrar: (slot: Slot, hex: string | null) => void
}) {
  const online = imp.visto_at && Date.now() - new Date(imp.visto_at).getTime() < 120_000
  return (
    <article className="panel fil-printer">
      <div className="row-between">
        <h3>{imp.nombre}</h3>
        <span className={`tag ${online ? 'tag-on' : 'tag-off'}`}>{online ? (ESTADO[imp.estado ?? ''] ?? imp.estado ?? 'En línea') : `Sin conexión (${hace(imp.visto_at)})`}</span>
      </div>
      {online && imp.estado === 'printing' && imp.trabajo && (
        <small className="muted">{imp.trabajo}{imp.progreso != null ? ` · ${Math.round(imp.progreso)}%` : ''}</small>
      )}
      <div className="fil-slots">
        {SLOTS.map((s) => {
          const r = ranuras.find((x) => x.ranura === s)
          const b = bobinas.find((x) => x.impresora_id === imp.id && x.ranura === s)
          const hex = b?.color_hex ?? r?.color_hex ?? null
          return (
            <div key={s} className="fil-slot">
              <div className="fil-slot-head">
                <span className="swatch big" style={{ background: hex ?? 'transparent', borderStyle: hex ? 'solid' : 'dashed' }} />
                <b>{s}</b>
              </div>
              {b ? (
                <Link to={`/f/${b.id}`} className="fil-slot-body">
                  <span>{b.material} {b.color}</span>
                  <Barra b={b} />
                </Link>
              ) : r?.color_hex ? (
                <div className="fil-slot-body">
                  <span className="muted small-text">{colorName(r.color_hex)} sin registrar</span>
                  <button className="btn btn-ghost small" onClick={() => onRegistrar(s, r.color_hex)}>Registrar</button>
                </div>
              ) : (
                <div className="fil-slot-body"><span className="muted small-text">Vacía</span></div>
              )}
            </div>
          )
        })}
      </div>
    </article>
  )
}

export function SpoolEditor({ draft, impresoras, onClose, onSaved }: {
  draft: Draft; impresoras: Impresora[]; onClose: () => void; onSaved: (id: string, isNew: boolean) => void
}) {
  const [d, setD] = useState<Draft>(draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const slotValue = d.impresora_id && d.ranura ? `${d.impresora_id}:${d.ranura}` : ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { id, material, color, color_hex, marca, peso_g, restante_g, notas, impresora_id, ranura } = d
      const saved = await saveBobina({ id, material, color, color_hex, marca, peso_g, restante_g, notas, impresora_id: impresora_id ?? null, ranura: ranura ?? null })
      onSaved(saved, !d.id)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={d.id ? `Editar bobina #${d.id}` : 'Nueva bobina'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field-row">
          <label className="field"><span>Material</span>
            <select value={d.material} onChange={(e) => setD({ ...d, material: e.target.value })}>
              {MATERIALES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="field"><span>Marca (opcional)</span>
            <input value={d.marca ?? ''} onChange={(e) => setD({ ...d, marca: e.target.value })} placeholder="Creality Hyper" />
          </label>
        </div>
        <div className="field-row">
          <label className="field"><span>Color</span>
            <input required autoFocus value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} placeholder="Negro mate" />
          </label>
          <label className="field"><span>Tono</span>
            <input type="color" value={d.color_hex ?? '#888888'} onChange={(e) => setD({ ...d, color_hex: e.target.value })} />
          </label>
        </div>
        <div className="field-row">
          <label className="field"><span>Peso neto de la bobina (g)</span>
            <input type="number" min={1} step="1" required value={d.peso_g}
              onChange={(e) => {
                const v = Number(e.target.value)
                setD({ ...d, peso_g: v, restante_g: d.id ? d.restante_g : v })
              }} />
          </label>
          <label className="field"><span>Le queda (g)</span>
            <input type="number" min={0} step="1" required value={d.restante_g} onChange={(e) => setD({ ...d, restante_g: Number(e.target.value) })} />
            <small className="muted">Si ya está usada: peso en balanza − carrete vacío.</small>
          </label>
        </div>
        <label className="field"><span>¿Dónde está?</span>
          <select value={slotValue} onChange={(e) => {
            const [imp, s] = e.target.value ? e.target.value.split(':') : [null, null]
            setD({ ...d, impresora_id: imp, ranura: (s as Slot | null) })
          }}>
            <option value="">Guardada (no está en una impresora)</option>
            {impresoras.map((i) => SLOTS.map((s) => <option key={`${i.id}:${s}`} value={`${i.id}:${s}`}>{i.nombre} · ranura {s}</option>))}
          </select>
        </label>
        <label className="field"><span>Notas (opcional)</span>
          <input value={d.notas ?? ''} onChange={(e) => setD({ ...d, notas: e.target.value })} placeholder="Secada el 20/11, lote…" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        {d.id && <small className="muted">Enlace NFC: {spoolUrl(d.id)}</small>}
      </form>
    </Modal>
  )
}
