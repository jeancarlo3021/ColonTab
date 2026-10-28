import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { listMyRestaurants } from '../lib/adminApi'
import { useData } from '../lib/useData'
import { AdminHeader } from './AdminShell'
import { brandVars } from '../lib/color'

export function AdminHome() {
  const { email, isPlatformAdmin } = useAuth()
  const { data, error } = useData(() => listMyRestaurants(email!, isPlatformAdmin), [email, isPlatformAdmin])

  return (
    <div className="admin">
      <AdminHeader title="Mis restaurantes" />
      <main className="admin-main">
        {isPlatformAdmin && (
          <Link to="/admin/plataforma" className="platform-card">
            <span className="tile-emoji">🏢</span>
            <div>
              <strong>Administración de la plataforma</strong>
              <p className="muted">Crea restaurantes, asigna dueños y revisa la actividad de todos.</p>
            </div>
            <span aria-hidden>→</span>
          </Link>
        )}
        {error && <p className="error">{error}</p>}
        {!data && !error && <div className="spinner" />}
        {data && data.length === 0 && (
          <div className="panel empty">
            <div className="empty-emoji">🍽️</div>
            <p>Tu cuenta ({email}) todavía no tiene restaurantes asignados.</p>
            <p className="muted">Pide al administrador de MesaClick que te agregue con este email.</p>
          </div>
        )}
        <div className="restaurant-grid">
          {data?.map((r) => (
            <Link key={r.id} to={`/admin/r/${r.slug}`} className="restaurant-card">
              <div className="logo" style={{ width: 52, height: 52, fontSize: 20, ...brandVars(r.primary_color) }}>
                {r.logo_text}
              </div>
              <div>
                <strong>{r.name}</strong>
                <p className="muted">/{r.slug}</p>
              </div>
              {!r.active && <span className="tag tag-off">Inactivo</span>}
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
