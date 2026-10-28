import { deleteSuggestion, listSuggestions } from '../../lib/adminApi'
import { useData } from '../../lib/useData'
import type { Restaurant } from '../../types'
import { Stat } from '../../components/Stat'

export function SuggestionsPanel({ restaurant }: { restaurant: Restaurant }) {
  const { data, error, reload } = useData(() => listSuggestions(restaurant.id), [restaurant.id])
  if (error) return <p className="error">{error}</p>
  if (!data) return <div className="spinner" />

  const rated = data.filter((s) => s.rating)
  const avg = rated.length ? rated.reduce((s, x) => s + (x.rating ?? 0), 0) / rated.length : 0

  return (
    <div className="stack-lg">
      <div className="stats">
        <Stat label="Sugerencias" value={String(data.length)} />
        <Stat label="Calificación promedio" value={rated.length ? `${avg.toFixed(1)} ★` : '—'} />
      </div>
      {data.length === 0 && <p className="muted">Aún no hay sugerencias de clientes.</p>}
      <div className="suggestion-list">
        {data.map((s) => (
          <article key={s.id} className="panel suggestion">
            <div className="row-between">
              <span className="stars-static">{s.rating ? '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating) : 'Sin calificación'}</span>
              <small className="muted">
                {s.table_number ? `Mesa ${s.table_number} · ` : ''}
                {new Date(s.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
              </small>
            </div>
            <p>{s.message}</p>
            <button
              className="btn btn-ghost small danger"
              onClick={() => confirm('¿Eliminar esta sugerencia?') && void deleteSuggestion(s.id).then(reload)}
            >
              Eliminar
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
