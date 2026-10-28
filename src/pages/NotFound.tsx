import { Link } from 'react-router-dom'

export function NotFound({ message = 'Página no encontrada.' }: { message?: string }) {
  return (
    <div className="screen center">
      <div className="empty">
        <div className="empty-emoji">🍽️</div>
        <p>{message}</p>
        <Link className="btn btn-ghost" to="/">Ir al inicio</Link>
      </div>
    </div>
  )
}
