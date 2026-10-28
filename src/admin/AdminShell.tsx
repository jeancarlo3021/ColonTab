import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isDemo } from '../lib/supabase'

export function RequireAuth({ children, platform = false }: { children: ReactNode; platform?: boolean }) {
  const { loading, email, isPlatformAdmin } = useAuth()
  const location = useLocation()
  if (loading) return <div className="admin-loading"><div className="spinner" /></div>
  if (!email) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  if (platform && !isPlatformAdmin) return <Navigate to="/admin" replace />
  return <>{children}</>
}

export function AdminHeader({ title, subtitle, back }: { title: string; subtitle?: ReactNode; back?: string }) {
  const { email, signOut } = useAuth()
  return (
    <header className="admin-header">
      <div className="admin-header-left">
        {back && <Link to={back} className="icon-btn" aria-label="Volver">←</Link>}
        <div className="logo admin-mark" aria-hidden>MC</div>
        <div>
          <h1>{title}</h1>
          {subtitle && <small className="muted">{subtitle}</small>}
        </div>
      </div>
      <div className="admin-header-right">
        {isDemo && <span className="tag tag-warn">Modo demo</span>}
        <span className="muted admin-email">{email}</span>
        <button className="btn btn-ghost small" onClick={() => void signOut()}>Salir</button>
      </div>
    </header>
  )
}
