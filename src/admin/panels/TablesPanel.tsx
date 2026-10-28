import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { listTableTokens, listVisits, regenerateTableTokens, updateRestaurant } from '../../lib/adminApi'
import { tableLink } from '../../lib/links'
import { errorText, useData } from '../../lib/useData'
import { Stat } from '../../components/Stat'
import type { Restaurant, Visit, VisitSource } from '../../types'
import { NfcWriter } from './NfcWriter'

type Counts = Record<VisitSource, number> & { total: number }
const empty = (): Counts => ({ nfc: 0, qr: 0, link: 0, total: 0 })

function daysAgo(n: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

export function TablesPanel({ restaurant, canEdit, onSaved }: { restaurant: Restaurant; canEdit: boolean; onSaved: () => void }) {
  const [count, setCount] = useState(restaurant.table_count)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nfcTable, setNfcTable] = useState<number | null>(null)
  const [range, setRange] = useState<0 | 6 | 29>(6) // hoy, 7 días, 30 días
  const visits = useData(() => listVisits(restaurant.id, daysAgo(range)), [restaurant.id, range])
  const tokens = useData(() => listTableTokens(restaurant.id), [restaurant.id, restaurant.table_count])
  const tokenOf = useMemo(() => new Map((tokens.data ?? []).map((t) => [t.number, t.token])), [tokens.data])

  async function regenerate(number: number | null) {
    const what = number === null ? 'TODAS las mesas' : `la Mesa ${number}`
    if (!confirm(`¿Cambiar el código de ${what}?\n\nLos QR y etiquetas NFC actuales de ${number === null ? 'todas las mesas' : 'esa mesa'} dejarán de funcionar y tendrás que imprimirlos o grabarlos de nuevo.`)) return
    setError(null)
    try {
      await regenerateTableTokens(restaurant.id, number)
      tokens.reload()
    } catch (e) {
      setError(errorText(e))
    }
  }
  const tables = Array.from({ length: restaurant.table_count }, (_, i) => i + 1)

  const { totals, byTable } = useMemo(() => {
    const totals = empty()
    const byTable = new Map<number, Counts>()
    for (const v of (visits.data ?? []) as Visit[]) {
      totals[v.source]++
      totals.total++
      const t = byTable.get(v.table_number) ?? empty()
      t[v.source]++
      t.total++
      byTable.set(v.table_number, t)
    }
    return { totals, byTable }
  }, [visits.data])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await updateRestaurant(restaurant.id, { table_count: Math.max(1, Math.min(500, count)) })
      onSaved()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const pct = (n: number) => (totals.total ? ` · ${Math.round((n / totals.total) * 100)}%` : '')

  return (
    <div className="stack-lg">
      <section className="panel no-print">
        <div className="row-between">
          <h2 className="section-title">Visitas a las mesas</h2>
          <div className="segmented small-seg">
            {([[0, 'Hoy'], [6, '7 días'], [29, '30 días']] as const).map(([r, label]) => (
              <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{label}</button>
            ))}
          </div>
        </div>
        {visits.error ? (
          <p className="error">
            No se pudieron cargar las visitas. Si aún no lo hiciste, ejecuta <code>supabase/migrations/005_visitas.sql</code> en Supabase.
          </p>
        ) : (
          <div className="stats">
            <Stat label="Total" value={visits.data ? String(totals.total) : '—'} />
            <Stat label="📡 Por NFC" value={visits.data ? `${totals.nfc}${pct(totals.nfc)}` : '—'} />
            <Stat label="🔳 Por QR" value={visits.data ? `${totals.qr}${pct(totals.qr)}` : '—'} />
            <Stat label="🔗 Enlace directo" value={visits.data ? `${totals.link}${pct(totals.link)}` : '—'} />
          </div>
        )}
        <small className="muted">
          “Enlace directo” son visitas sin marca: QR impresos antes de este cambio o enlaces compartidos.
        </small>
      </section>

      <div className="row-between no-print">
        <div className="inline-form">
          <label className="field inline">
            <span>Número de mesas</span>
            <input type="number" min={1} max={500} value={count} disabled={!canEdit} onChange={(e) => setCount(Number(e.target.value))} />
          </label>
          {canEdit && (
            <button className="btn btn-ghost small" disabled={busy || count === restaurant.table_count} onClick={() => void save()}>
              Guardar
            </button>
          )}
        </div>
        <div className="order-actions">
          {canEdit && <button className="btn btn-ghost small" onClick={() => void regenerate(null)}>Cambiar todos los códigos</button>}
          <button className="btn btn-ghost small" onClick={() => setNfcTable(1)}>📡 Grabar etiquetas NFC</button>
          <button className="btn btn-primary small" onClick={() => window.print()}>🖨️ Imprimir QRs</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {tokens.error && (
        <p className="error no-print">
          No se pudieron cargar los códigos de las mesas. Ejecuta <code>supabase/migrations/007_codigos_de_mesa.sql</code> en Supabase.
        </p>
      )}
      <p className="muted no-print">
        🔒 Cada QR y etiqueta lleva un código secreto de su mesa: nadie puede pasar a otra mesa cambiando la dirección.
      </p>
      <p className="muted no-print">
        Imprime cada código y pégalo en su mesa, o graba una etiqueta NFC. Al escanearlo o acercar el celular, el cliente
        entra directo a esa mesa.
      </p>
      <div className="qr-grid">
        {tables.map((n) => (
          <QrCard
            key={n}
            restaurant={restaurant}
            table={n}
            token={tokenOf.get(n)}
            counts={byTable.get(n)}
            onNfc={() => setNfcTable(n)}
            onRegenerate={canEdit ? () => void regenerate(n) : undefined}
          />
        ))}
      </div>
      {nfcTable !== null && <NfcWriter restaurant={restaurant} tokens={tokenOf} startTable={nfcTable} onClose={() => setNfcTable(null)} />}
    </div>
  )
}

function QrCard(props: {
  restaurant: Restaurant
  table: number
  token?: string
  counts?: Counts
  onNfc: () => void
  onRegenerate?: () => void
}) {
  const { restaurant, table, token, counts, onNfc, onRegenerate } = props
  const [src, setSrc] = useState<string | null>(null)
  const qrUrl = token ? tableLink(token, 'qr') : null
  useEffect(() => {
    if (!qrUrl) return setSrc(null)
    QRCode.toDataURL(qrUrl, { margin: 1, width: 360, color: { dark: '#0f1926', light: '#ffffff' } }).then(setSrc).catch(() => setSrc(null))
  }, [qrUrl])
  return (
    <div className="qr-card">
      <small className="muted">{restaurant.name}</small>
      <strong>Mesa {table}</strong>
      {src ? <img src={src} alt={`QR mesa ${table}`} /> : <div className="qr-ph" />}
      <small>Escanea o acerca tu celular 📱</small>
      <small className="qr-visits no-print" title="Visitas en el periodo elegido">
        {counts ? `${counts.total} ${counts.total === 1 ? 'visita' : 'visitas'} · 📡 ${counts.nfc} · 🔳 ${counts.qr}` : 'Sin visitas'}
      </small>
      <div className="qr-links no-print">
        {/* "Abrir" usa el enlace sin marca para no contar como visita por QR */}
        {token && <a href={tableLink(token)} target="_blank" rel="noreferrer">Abrir</a>}
        {src && <a href={src} download={`${restaurant.slug}-mesa-${table}.png`}>Descargar</a>}
        <button onClick={onNfc} disabled={!token}>NFC</button>
        {onRegenerate && <button onClick={onRegenerate} title="Cambiar el código de esta mesa">Nuevo código</button>}
      </div>
    </div>
  )
}
