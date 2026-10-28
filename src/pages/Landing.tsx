import { Link } from 'react-router-dom'
import { isDemo } from '../lib/supabase'

export function Landing() {
  return (
    <div className="screen center">
      <div className="landing">
        <div className="logo brand-logo" aria-hidden>MC</div>
        <h1>MesaClick</h1>
        <p className="muted">
          Tus clientes escanean el QR de su mesa y pueden ver el menú, ordenar, llamar al mesero y pedir la cuenta
          desde su celular.
        </p>
        <Link className="btn btn-primary" to="/r/la-esquina/4">Ver demo · Mesa 4</Link>
        <p className="hint">
          Cada QR apunta a <code>/r/&lt;restaurante&gt;/&lt;mesa&gt;</code>
          {isDemo && <><br />Modo demo: configura Supabase en <code>.env.local</code></>}
        </p>
      </div>
    </div>
  )
}
