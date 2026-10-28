import { Link } from 'react-router-dom'
import { isDemo } from '../lib/supabase'

export function Landing() {
  return (
    <div className="screen center landing-screen">
      <div className="landing">
        <div className="mc-mark big" aria-hidden>MC</div>
        <h1>MesaClick</h1>
        <p className="muted">
          Tus clientes escanean el QR de su mesa, ven el menú y avisan al mesero cuando están listos para ordenar o quieren la cuenta
          desde su celular.
        </p>
        <Link className="btn btn-primary" to="/r/la-esquina/4">Ver demo · Mesa 4</Link>
        <Link className="btn btn-ghost" to="/admin">Entrar al panel de administración</Link>
        <p className="hint">
          Cada QR apunta a <code>/r/&lt;restaurante&gt;/&lt;mesa&gt;</code>
          {isDemo && <><br />Modo demo: configura Supabase en <code>.env</code></>}
        </p>
      </div>
    </div>
  )
}
