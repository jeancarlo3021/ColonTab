import { Link } from 'react-router-dom'
import { CONTACT_URL, FAQ, PARENT_NAME, PARENT_URL } from '../lib/site'

const STEPS = [
  { n: '1', title: 'Escanea o acerca el celular', text: 'Cada mesa tiene su código QR y su etiqueta NFC. El cliente entra directo a su mesa, sin descargar nada.' },
  { n: '2', title: 'Revisa el menú', text: 'Fotos, descripciones y precios siempre actualizados. Lo agotado no aparece.' },
  { n: '3', title: 'Toca “Estoy listo para ordenar”', text: 'El mesero recibe el aviso al instante con sonido y una notificación en pantalla.' },
]

const FEATURES = [
  { icon: '🔳', title: 'QR por mesa', text: 'Genera e imprime el código de cada mesa desde el panel, listo para pegar.' },
  { icon: '📡', title: 'Etiquetas NFC', text: 'Graba etiquetas NFC desde un Android: el cliente solo acerca su teléfono.' },
  { icon: '🔔', title: 'Avisos con sonido', text: 'Campana distinta para ordenar, llamar al mesero o pedir la cuenta, con volumen ajustable.' },
  { icon: '🪧', title: 'Notificaciones en pantalla', text: 'Aparecen aunque estés en otra aplicación y se quedan hasta atenderlas.' },
  { icon: '📲', title: 'Pago con SINPE Móvil', text: 'El cliente ve tu número de SINPE al pedir la cuenta y paga en segundos.' },
  { icon: '📋', title: 'Menú editable', text: 'Cambia precios, fotos y platillos agotados cuando quieras, sin reimprimir.' },
  { icon: '⭐', title: 'Más reseñas en Google', text: 'Botón directo para que tus clientes te califiquen, más Wi-Fi, redes y horario.' },
  { icon: '🏢', title: 'Varios restaurantes', text: 'Administra sucursales o negocios distintos, cada uno con su equipo.' },
]

export function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link to="/" className="lp-brand" aria-label="ColonTab inicio">
          <span className="mc-mark" aria-hidden>CT</span>
          <span>ColonTab</span>
        </Link>
        <Link className="lp-nav-link" to="/admin">Entrar</Link>
      </header>

      <section className="lp-hero">
        <p className="lp-eyebrow">Menú digital para restaurantes en Costa Rica</p>
        <h1>Tus clientes piden con un clic desde su mesa</h1>
        <p className="lp-lead">
          Con <strong>ColonTab</strong> cada mesa tiene un <strong>código QR</strong> y una <strong>etiqueta NFC</strong>.
          El cliente ve el menú en su celular y avisa al mesero cuando está listo para ordenar o pagar con{' '}
          <strong>SINPE Móvil</strong>. Sin descargar aplicaciones.
        </p>
        <div className="lp-actions">
          <Link className="btn btn-primary" to="/r/la-esquina/4">Ver demo en vivo</Link>
          <a className="btn btn-ghost" href={CONTACT_URL} target="_blank" rel="noopener">Quiero ColonTab</a>
        </div>
        <ul className="lp-badges" aria-label="Ventajas">
          <li>✓ Sin apps</li>
          <li>✓ QR + NFC</li>
          <li>✓ SINPE Móvil</li>
        </ul>
      </section>

      <main>
        <section className="lp-section" aria-labelledby="como-funciona">
          <h2 id="como-funciona">Cómo funciona</h2>
          <ol className="lp-steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="lp-step-n" aria-hidden>{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section" aria-labelledby="beneficios">
          <h2 id="beneficios">Todo lo que tu restaurante necesita</h2>
          <p className="lp-sub">Menos tiempo esperando al mesero, mesas que rotan más rápido y clientes más contentos.</p>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <article key={f.title}>
                <span className="lp-feature-icon" aria-hidden>{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section lp-split" aria-labelledby="para-quien">
          <div>
            <h2 id="para-quien">Hecho para sodas, restaurantes, bares y cafeterías</h2>
            <p>
              El panel muestra en vivo qué mesa está lista para ordenar, cuál llama al mesero y cuál pide la cuenta, con la
              forma de pago y cuántas personas son. Tu equipo atiende en orden y nadie se queda esperando.
            </p>
            <p>Cada restaurante administra su menú, sus mesas, sus códigos QR y NFC y su equipo desde cualquier computadora.</p>
          </div>
          <div className="lp-mock" aria-hidden>
            <div className="lp-mock-card"><span>🙋</span><div><b>Mesa 4</b><small>Listo para ordenar · 3 personas</small></div></div>
            <div className="lp-mock-card bill"><span>🧾</span><div><b>Mesa 7</b><small>Pide la cuenta · 📲 SINPE Móvil</small></div></div>
            <div className="lp-mock-card waiter"><span>🛎️</span><div><b>Mesa 2</b><small>Llama al mesero</small></div></div>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="preguntas">
          <h2 id="preguntas">Preguntas frecuentes</h2>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-cta">
          <h2>Lleva tu restaurante a la mesa del cliente</h2>
          <p>Prueba la demo o escríbenos para activar ColonTab en tu negocio.</p>
          <div className="lp-actions">
            <a className="btn btn-primary" href={CONTACT_URL} target="_blank" rel="noopener">Quiero ColonTab</a>
            <Link className="btn btn-ghost" to="/r/la-esquina/4">Ver demo</Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} ColonTab</span>
        <span>
          Un producto de <a href={PARENT_URL} target="_blank" rel="noopener">{PARENT_NAME}</a>
        </span>
        <Link to="/admin">Panel de administración</Link>
      </footer>
    </div>
  )
}
