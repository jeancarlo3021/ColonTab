import { useEffect, useRef, useState } from 'react'
import { Modal } from '../../components/Modal'
import { nfcCanLock, nfcErrorText, nfcSupported, writeNfcUrl } from '../../lib/nfc'
import type { Restaurant } from '../../types'
import { tableLink } from '../../lib/links'

type Status = { kind: 'idle' } | { kind: 'waiting' } | { kind: 'done'; table: number } | { kind: 'error'; text: string }

export function NfcWriter(props: { restaurant: Restaurant; tokens: Map<number, string>; startTable: number; onClose: () => void }) {
  const { restaurant, tokens, startTable, onClose } = props
  const [table, setTable] = useState(startTable)
  const [lock, setLock] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [written, setWritten] = useState<number[]>([])
  const [copied, setCopied] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const supported = nfcSupported()
  const token = tokens.get(table)
  const url = token ? tableLink(token, 'nfc') : ''

  useEffect(() => () => abort.current?.abort(), [])

  async function write() {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setStatus({ kind: 'waiting' })
    try {
      await writeNfcUrl(url, { lock, signal: ctrl.signal })
      navigator.vibrate?.(150)
      setWritten((w) => (w.includes(table) ? w : [...w, table]))
      setStatus({ kind: 'done', table })
    } catch (e) {
      if (ctrl.signal.aborted) return
      setStatus({ kind: 'error', text: nfcErrorText(e) })
    }
  }

  function cancel() {
    abort.current?.abort()
    setStatus({ kind: 'idle' })
  }

  function go(n: number) {
    abort.current?.abort()
    setTable(Math.min(Math.max(1, n), restaurant.table_count))
    setStatus({ kind: 'idle' })
  }

  return (
    <Modal title="Grabar etiqueta NFC" onClose={onClose}>
      <div className="form">
        <div className="nfc-table">
          <button className="icon-btn" onClick={() => go(table - 1)} disabled={table <= 1} aria-label="Mesa anterior">←</button>
          <div>
            <small className="muted">Mesa</small>
            <strong>{table}</strong>
          </div>
          <button className="icon-btn" onClick={() => go(table + 1)} disabled={table >= restaurant.table_count} aria-label="Mesa siguiente">→</button>
        </div>
        <code className="nfc-url">{url}</code>

        {!token ? (
          <p className="error">Esta mesa todavía no tiene código. Revisa la migración 007 en Supabase.</p>
        ) : supported ? (
          <>
            {status.kind === 'waiting' && (
              <div className="nfc-status waiting">
                <div className="nfc-pulse" aria-hidden>📡</div>
                <strong>Acerca la etiqueta a la parte trasera del teléfono…</strong>
                <small className="muted">Mantenla quieta hasta que vibre.</small>
              </div>
            )}
            {status.kind === 'done' && (
              <div className="nfc-status ok">
                <div aria-hidden>✅</div>
                <strong>Mesa {status.table} grabada</strong>
                <small className="muted">Pega la etiqueta en esa mesa.</small>
              </div>
            )}
            {status.kind === 'error' && <p className="error">{status.text}</p>}

            {nfcCanLock() && status.kind !== 'waiting' && (
              <label className="toggle wrap">
                <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
                <span>Bloquear la etiqueta para que nadie la pueda cambiar (no se puede deshacer)</span>
              </label>
            )}

            {status.kind === 'waiting' ? (
              <button className="btn btn-ghost" onClick={cancel}>Cancelar</button>
            ) : status.kind === 'done' && table < restaurant.table_count ? (
              <button className="btn btn-primary" onClick={() => go(table + 1)}>Siguiente: Mesa {table + 1} →</button>
            ) : (
              <button className="btn btn-primary" onClick={() => void write()}>📡 Grabar Mesa {table}</button>
            )}
            {written.length > 0 && (
              <small className="muted">Grabadas en esta sesión: {[...written].sort((a, b) => a - b).join(', ')}</small>
            )}
          </>
        ) : (
          <div className="note">
            <strong>Este navegador no puede grabar NFC.</strong>
            <ol className="nfc-help">
              <li>Abre este panel en un <b>teléfono Android</b> con <b>Chrome</b> (enciende el NFC).</li>
              <li>O copia el enlace y grábalo con una app como <b>NFC Tools</b> (registro tipo URL).</li>
            </ol>
            <small>En iPhone se graba con la app Atajos o NFC Tools. Cualquier celular con NFC puede leer la etiqueta.</small>
          </div>
        )}

        <button
          className="btn btn-ghost"
          disabled={!token}
          onClick={() =>
            void navigator.clipboard?.writeText(url).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }
        >
          {copied ? '¡Enlace copiado!' : '📋 Copiar enlace de la mesa'}
        </button>
      </div>
    </Modal>
  )
}
