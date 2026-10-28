import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { updateRestaurant } from '../../lib/adminApi'
import { errorText } from '../../lib/useData'
import type { Restaurant } from '../../types'

export function tableUrl(slug: string, n: number) {
  return `${window.location.origin}/r/${slug}/${n}`
}

export function TablesPanel({ restaurant, canEdit, onSaved }: { restaurant: Restaurant; canEdit: boolean; onSaved: () => void }) {
  const [count, setCount] = useState(restaurant.table_count)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tables = Array.from({ length: restaurant.table_count }, (_, i) => i + 1)

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

  return (
    <div className="stack-lg">
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
        <button className="btn btn-primary small" onClick={() => window.print()}>🖨️ Imprimir QRs</button>
      </div>
      {error && <p className="error">{error}</p>}
      <p className="muted no-print">Imprime cada código y pégalo en su mesa. Al escanearlo, el cliente entra directo a esa mesa.</p>
      <div className="qr-grid">
        {tables.map((n) => <QrCard key={n} restaurant={restaurant} table={n} />)}
      </div>
    </div>
  )
}

function QrCard({ restaurant, table }: { restaurant: Restaurant; table: number }) {
  const [src, setSrc] = useState<string | null>(null)
  const url = tableUrl(restaurant.slug, table)
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#1d1a14', light: '#ffffff' } }).then(setSrc).catch(() => setSrc(null))
  }, [url])
  return (
    <div className="qr-card">
      <small className="muted">{restaurant.name}</small>
      <strong>Mesa {table}</strong>
      {src ? <img src={src} alt={`QR mesa ${table}`} /> : <div className="qr-ph" />}
      <small>Escanea para ver el menú y ordenar</small>
      <div className="qr-links no-print">
        <a href={url} target="_blank" rel="noreferrer">Abrir</a>
        {src && <a href={src} download={`${restaurant.slug}-mesa-${table}.png`}>Descargar</a>}
      </div>
    </div>
  )
}
