import { Link } from 'react-router-dom'
import { useSession } from '../context'
import { Icon } from './Icon'

/** Barra superior de las pantallas del cliente (menú, juegos). */
export function ClientHeader({ title }: { title: string }) {
  const { restaurant, table } = useSession()
  return (
    <header className="c-bar">
      <Link to=".." relative="path" className="c-bar-back" aria-label="Volver a la mesa">
        <Icon name="back" />
      </Link>
      <div className="c-bar-title">
        <h1>{title}</h1>
        <small>{restaurant.name}</small>
      </div>
      <Link to=".." relative="path" className="c-bar-table" aria-label={`Mesa ${table}, ver opciones`}>
        <small>Mesa</small>
        <strong>{String(table).padStart(2, '0')}</strong>
      </Link>
    </header>
  )
}
