import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isDemo } from '../lib/supabase'
import { errorText } from '../lib/useData'

export function AdminLogin() {
  const { email, loading, signIn, signUp } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [mail, setMail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (!loading && email) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/admin/login' ? from : '/admin'} replace />
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'in') await signIn(mail.trim(), password)
      else if ((await signUp(mail.trim(), password)) === 'confirm-email') {
        setInfo('Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión.')
        setMode('in')
      }
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="mc-mark" aria-hidden>CT</div>
        <h1>ColonTab Admin</h1>
        <p className="muted">Panel para restaurantes</p>

        {isDemo ? (
          <>
            <p className="note">
              Modo demo: no hay Supabase configurado. Entras como administrador de la plataforma y los datos se guardan
              en este navegador.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void signIn('admin@colontab.app', '')}
            >
              Entrar en modo demo
            </button>
          </>
        ) : (
          <>
            <div className="segmented">
              <button type="button" className={mode === 'in' ? 'active' : ''} onClick={() => setMode('in')}>Entrar</button>
              <button type="button" className={mode === 'up' ? 'active' : ''} onClick={() => setMode('up')}>Crear cuenta</button>
            </div>
            <label className="field">
              <span>Email</span>
              <input type="email" required autoComplete="email" value={mail} onChange={(e) => setMail(e.target.value)} />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {mode === 'up' && (
              <p className="hint left">Usa el mismo email que el administrador registró para tu restaurante.</p>
            )}
            {error && <p className="error">{error}</p>}
            {info && <p className="note">{info}</p>}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
