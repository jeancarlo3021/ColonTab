import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AdminHeader } from './AdminShell'
import { errorText, useData } from '../lib/useData'
import { nfcErrorText, nfcSupported, writeNfcUrl } from '../lib/nfc'
import { SLOTS, codigoValido, colorName, deleteBobina, getBobina, grams, patchBobina, pct, spoolUrl, type Slot } from '../lib/filamentApi'
import { SpoolEditor, ubicacion } from './FilamentPanel'

/** Ficha de una bobina: lo que abre el sticker NFC (/f/<id>). */
export function FilamentSpool() {
  const { id = '' } = useParams()
  const { data, error, reload } = useData(() => getBobina(id), [id])
  const [editing, setEditing] = useState(false)
  const [registrando, setRegistrando] = useState<false | 'uso' | 'stock' | null>(null)
  const [peso, setPeso] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const b = data?.bobina
  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg(ok)
      reload()
    } catch (e) {
      setMsg(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin">
      <AdminHeader title={b ? `${b.material} ${b.color}` : 'Bobina'} subtitle={b ? `#${b.id}` : undefined} back="/admin/plataforma?v=filamento" />
      <main className="admin-main stack-lg fil-spool">
        {error && <p className="error">{error}</p>}
        {!data && !error && <div className="spinner" />}
        {data && !b && (codigoValido(id) ? (
          <section className="panel stack-lg">
            <h2>🏷 Sticker nuevo #{id}</h2>
            <p>Este sticker todavía no tiene bobina. ¿Qué quieres hacer?</p>
            <div className="order-actions">
              <button className="btn btn-primary" onClick={() => setRegistrando('stock')}>📦 Añadir al stock (guardada)</button>
              <button className="btn btn-ghost" onClick={() => setRegistrando('uso')}>🖨 Registrarla en una impresora</button>
            </div>
            <Link className="muted small-text" to="/admin/plataforma?v=filamento">Ver inventario</Link>
          </section>
        ) : <p className="muted">No existe la bobina #{id}. <Link to="/admin/plataforma?v=filamento">Ver inventario</Link></p>)}
        {b && data && (
          <>
            <section className="panel fil-hero">
              <span className="swatch huge" style={{ background: b.color_hex ?? '#ccc' }} />
              <div className="stack-lg" style={{ gap: 8, flex: 1 }}>
                <div className="fil-big">{grams(b.restante_g)}</div>
                <div className={`fil-bar ${b.restante_g <= 30 ? 'crit' : b.restante_g <= 100 ? 'low' : ''}`}><span style={{ width: `${pct(b)}%` }} /></div>
                <small className="muted">
                  {Math.round(pct(b))}% de {grams(b.peso_g)} · usado {grams(b.usado_total_g)}
                  {b.color_hex ? ` · tono ${colorName(b.color_hex)}` : ''}{b.marca ? ` · ${b.marca}` : ''}
                </small>
                <div>{b.agotada ? <span className="tag tag-off">Agotada</span> : ubicacion(b, data.impresoras)}</div>
              </div>
            </section>

            {!b.agotada && (
              <section className="panel stack-lg">
                <h3>¿Dónde la pusiste?</h3>
                <div className="fil-pick">
                  {data.impresoras.map((imp) => (
                    <div key={imp.id} className="fil-pick-row">
                      <span className="muted">{imp.nombre}</span>
                      {SLOTS.map((s) => (
                        <button
                          key={s}
                          disabled={busy}
                          className={`btn small ${b.impresora_id === imp.id && b.ranura === s ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => void run(() => patchBobina(b.id, { impresora_id: imp.id, ranura: s as Slot }), `Puesta en ${imp.nombre} · ${s}`)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ))}
                  <button className="btn btn-ghost small" disabled={busy || !b.ranura}
                    onClick={() => void run(() => patchBobina(b.id, { impresora_id: null, ranura: null }), 'Guardada')}>
                    📤 La saqué (guardada)
                  </button>
                </div>
              </section>
            )}

            <section className="panel stack-lg">
              <h3>⚖️ Ajustar con la balanza</h3>
              <p className="muted small-text">Pesa la bobina, réstale el carrete vacío (~150–250 g) y escribe cuánto filamento le queda.</p>
              <form className="inline-form" onSubmit={(e) => {
                e.preventDefault()
                const g = Number(peso)
                if (!(g >= 0)) return
                void run(() => patchBobina(b.id, { restante_g: g, agotada: false }), 'Peso actualizado').then(() => setPeso(''))
              }}>
                <input type="number" min={0} inputMode="decimal" placeholder="Gramos que le quedan" value={peso} onChange={(e) => setPeso(e.target.value)} />
                <button className="btn btn-primary small" disabled={busy || peso === ''}>Guardar</button>
              </form>
            </section>

            <section className="panel stack-lg">
              <h3>🏷 Sticker NFC</h3>
              <NfcSpoolWriter id={b.id} />
            </section>

            <section className="panel stack-lg">
              <h3>Historial de consumo</h3>
              {data.consumos.length === 0 && <p className="muted">Todavía no ha gastado filamento.</p>}
              {data.consumos.length > 0 && (
                <table className="data-table">
                  <thead><tr><th>Fecha</th><th>Impresora</th><th>Trabajo</th><th>Gastó</th></tr></thead>
                  <tbody>
                    {data.consumos.map((c) => (
                      <tr key={c.id}>
                        <td>{new Date(c.created_at).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td>{data.impresoras.find((i) => i.id === c.impresora_id)?.nombre ?? c.impresora_id} {c.ranura}</td>
                        <td className="small-text">{c.trabajo ?? '—'}</td>
                        <td>{grams(Number(c.gramos))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {msg && <p className="note">{msg}</p>}
            <div className="order-actions">
              <button className="btn btn-ghost" onClick={() => setEditing(true)}>Editar datos</button>
              {!b.agotada ? (
                <button className="btn btn-ghost danger" disabled={busy}
                  onClick={() => confirm('¿Marcar esta bobina como agotada?') && void run(() => patchBobina(b.id, { agotada: true }), 'Marcada como agotada')}>
                  ⛔ Se acabó
                </button>
              ) : (
                <button className="btn btn-ghost" disabled={busy} onClick={() => void run(() => patchBobina(b.id, { agotada: false }), 'Reactivada')}>Reactivar</button>
              )}
              <button className="btn btn-ghost danger" disabled={busy}
                onClick={() => confirm('¿Borrar la bobina y su historial? No se puede deshacer.') &&
                  void deleteBobina(b.id).then(() => window.location.assign('/admin/plataforma?v=filamento')).catch((e) => setMsg(errorText(e)))}>
                Borrar
              </button>
            </div>
          </>
        )}
      </main>
      {registrando && data && !b && (
        <SpoolEditor
          draft={{ nuevoId: id, material: 'PLA', color: '', color_hex: null, marca: '', peso_g: 1000, restante_g: 1000,
            notas: registrando === 'stock' ? 'Stock (sellada)' : '',
            impresora_id: registrando === 'uso' ? data.impresoras[0]?.id ?? null : null, ranura: registrando === 'uso' ? 'A' : null }}
          impresoras={data.impresoras}
          onClose={() => setRegistrando(null)}
          onSaved={() => { setRegistrando(null); reload() }}
        />
      )}
      {editing && b && data && (
        <SpoolEditor draft={{ ...b }} impresoras={data.impresoras} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); reload() }} />
      )}
    </div>
  )
}

/** Enlace de la bobina para el sticker NFC, con grabado directo en Chrome Android. */
export function NfcSpoolWriter({ id }: { id: string }) {
  const url = spoolUrl(id)
  const [status, setStatus] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  async function grabar() {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setStatus('📲 Acerca el sticker NFC a la parte de atrás del celular…')
    try {
      await writeNfcUrl(url, { signal: ctrl.signal })
      setStatus('✅ Sticker grabado')
    } catch (e) {
      setStatus(nfcErrorText(e))
    }
  }

  return (
    <div className="stack-lg" style={{ gap: 10 }}>
      <code className="nfc-url">{url}</code>
      <div className="order-actions">
        {nfcSupported() && <button className="btn btn-primary small" onClick={() => void grabar()}>Grabar sticker NFC</button>}
        <button className="btn btn-ghost small" onClick={() => void navigator.clipboard?.writeText(url).then(() => setStatus('Enlace copiado'))}>Copiar enlace</button>
      </div>
      {!nfcSupported() && <small className="muted">Para grabar desde aquí usa Chrome en Android. Si no, copia el enlace y grábalo con la app NFC Tools (Escribir → URL).</small>}
      {status && <small>{status}</small>}
    </div>
  )
}
