import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../context'
import { requestService, sendSuggestion } from '../lib/api'
import { Logo } from '../components/Logo'
import { Modal } from '../components/Modal'
import { Toast } from '../components/Toast'
import type { PaymentMethod } from '../types'

type Sheet = null | 'waiter' | 'bill' | 'wifi' | 'social' | 'hours' | 'suggest' | 'guests'

export function Home() {
  const { restaurant, table, guests, setGuests, cartCount } = useSession()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [toast, setToast] = useState<string | null>(null)
  const close = useCallback(() => setSheet(null), [])
  const clearToast = useCallback(() => setToast(null), [])

  const whatsappUrl = restaurant.whatsapp
    ? `https://wa.me/${restaurant.whatsapp}?text=${encodeURIComponent(`Hola, estoy en la mesa ${table}.`)}`
    : null

  return (
    <main className="home">
      <header className="hero">
        <Logo restaurant={restaurant} />
        <p className="welcome">Te damos la bienvenida a</p>
        <h1>{restaurant.name}</h1>
        <span className="table-pill">🍴 Mesa {table}</span>
        <p className="hint">¿No es tu mesa? Escanea el QR de tu mesa</p>
      </header>

      <section className="guests" aria-label="Número de personas">
        <p className="hint">👥 ¿Cuántos son? · opcional</p>
        <div className="guest-row">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              className={`chip ${guests === n ? 'active' : ''}`}
              onClick={() => setGuests(guests === n ? null : n)}
              aria-pressed={guests === n}
            >
              {n}
            </button>
          ))}
          <button
            className={`chip ${guests && guests > 6 ? 'active' : ''}`}
            onClick={() => setSheet('guests')}
            aria-label="Más de 6"
          >
            {guests && guests > 6 ? guests : '+'}
          </button>
        </div>
      </section>

      <Link to="menu" className="cta">
        <span className="cta-dot" />
        Ver el menú y ordenar
        {cartCount > 0 && <span className="badge">{cartCount}</span>}
      </Link>

      <div className="grid">
        <Tile emoji="🙋" label="Llamar al mesero" onClick={() => setSheet('waiter')} />
        <Tile emoji="🧾" label="Pedir la cuenta / Pagar" onClick={() => setSheet('bill')} />
        <Tile emoji="🎮" label="Juegos mientras esperas" to="juegos" />
        {restaurant.wifi_ssid && <Tile emoji="📶" label="Wi-Fi" onClick={() => setSheet('wifi')} />}
        {whatsappUrl && <Tile emoji="💬" label="Escríbenos por WhatsApp" href={whatsappUrl} />}
        {(restaurant.instagram || restaurant.tiktok) && (
          <Tile emoji="📸" label="Redes sociales" onClick={() => setSheet('social')} />
        )}
        {restaurant.google_review_url && (
          <Tile emoji="⭐" label="Califícanos en Google" href={restaurant.google_review_url} />
        )}
        <Tile emoji="📍" label="Cómo llegar y horario" onClick={() => setSheet('hours')} />
        <Tile emoji="💡" label="Sugerencias" onClick={() => setSheet('suggest')} wide />
      </div>

      <footer className="powered">Hecho con <strong>MesaClick</strong></footer>

      {sheet === 'waiter' && (
        <ConfirmService
          title="Llamar al mesero"
          text={`Avisaremos al personal que la mesa ${table} necesita atención.`}
          onClose={close}
          onConfirm={async () => {
            await requestService({ restaurantId: restaurant.id, table, type: 'waiter' })
            setToast('¡Listo! Un mesero viene en camino 🙌')
          }}
        />
      )}
      {sheet === 'bill' && (
        <BillSheet
          onClose={close}
          onConfirm={async (paymentMethod) => {
            await requestService({ restaurantId: restaurant.id, table, type: 'bill', paymentMethod })
            setToast('Tu cuenta está en camino 🧾')
          }}
        />
      )}
      {sheet === 'wifi' && (
        <Modal title="Wi-Fi" onClose={close}>
          <WifiRow label="Red" value={restaurant.wifi_ssid ?? ''} />
          {restaurant.wifi_password && <WifiRow label="Contraseña" value={restaurant.wifi_password} />}
        </Modal>
      )}
      {sheet === 'social' && (
        <Modal title="Síguenos" onClose={close}>
          <div className="stack">
            {restaurant.instagram && (
              <a className="btn btn-ghost" href={restaurant.instagram} target="_blank" rel="noreferrer">📸 Instagram</a>
            )}
            {restaurant.tiktok && (
              <a className="btn btn-ghost" href={restaurant.tiktok} target="_blank" rel="noreferrer">🎵 TikTok</a>
            )}
          </div>
        </Modal>
      )}
      {sheet === 'hours' && (
        <Modal title="Cómo llegar y horario" onClose={close}>
          {restaurant.address && <p className="address">📍 {restaurant.address}</p>}
          {restaurant.hours && <p className="hours">{restaurant.hours}</p>}
          {restaurant.maps_url && (
            <a className="btn btn-primary" href={restaurant.maps_url} target="_blank" rel="noreferrer">Abrir en Maps</a>
          )}
        </Modal>
      )}
      {sheet === 'suggest' && (
        <SuggestSheet
          onClose={close}
          onSend={async (rating, message) => {
            await sendSuggestion({ restaurantId: restaurant.id, table, rating, message })
            setToast('¡Gracias por tu sugerencia! 💛')
          }}
        />
      )}
      {sheet === 'guests' && (
        <GuestsSheet
          initial={guests && guests > 6 ? guests : 7}
          onClose={close}
          onSave={(n) => {
            setGuests(n)
            close()
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </main>
  )
}

function Tile(props: { emoji: string; label: string; onClick?: () => void; to?: string; href?: string; wide?: boolean }) {
  const cls = `tile ${props.wide ? 'wide' : ''}`
  const inner = (
    <>
      <span className="tile-emoji" aria-hidden>{props.emoji}</span>
      <span>{props.label}</span>
    </>
  )
  if (props.to) return <Link className={cls} to={props.to}>{inner}</Link>
  if (props.href) return <a className={cls} href={props.href} target="_blank" rel="noreferrer">{inner}</a>
  return <button className={cls} onClick={props.onClick}>{inner}</button>
}

function useSubmit(onClose: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo salió mal, intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

function ConfirmService(props: { title: string; text: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const { busy, error, run } = useSubmit(props.onClose)
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <p>{props.text}</p>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} onClick={() => run(props.onConfirm)}>
        {busy ? 'Enviando…' : 'Confirmar'}
      </button>
    </Modal>
  )
}

function BillSheet(props: { onClose: () => void; onConfirm: (m: PaymentMethod) => Promise<void> }) {
  const [method, setMethod] = useState<PaymentMethod>('tarjeta')
  const { busy, error, run } = useSubmit(props.onClose)
  const options: { id: PaymentMethod; label: string }[] = [
    { id: 'tarjeta', label: '💳 Tarjeta' },
    { id: 'efectivo', label: '💵 Efectivo' },
    { id: 'transferencia', label: '📲 Transferencia' },
  ]
  return (
    <Modal title="Pedir la cuenta" onClose={props.onClose}>
      <p>¿Cómo quieres pagar?</p>
      <div className="stack">
        {options.map((o) => (
          <button key={o.id} className={`option ${method === o.id ? 'active' : ''}`} onClick={() => setMethod(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} onClick={() => run(() => props.onConfirm(method))}>
        {busy ? 'Enviando…' : 'Pedir la cuenta'}
      </button>
    </Modal>
  )
}

function WifiRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="wifi-row">
      <div>
        <small className="muted">{label}</small>
        <div className="wifi-value">{value}</div>
      </div>
      <button
        className="btn btn-ghost small"
        onClick={() =>
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }
      >
        {copied ? '¡Copiado!' : 'Copiar'}
      </button>
    </div>
  )
}

function SuggestSheet(props: { onClose: () => void; onSend: (rating: number | null, message: string) => Promise<void> }) {
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const { busy, error, run } = useSubmit(props.onClose)
  return (
    <Modal title="Sugerencias" onClose={props.onClose}>
      <div className="stars" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`star ${rating && n <= rating ? 'on' : ''}`} onClick={() => setRating(n)} aria-label={`${n} estrellas`}>
            ★
          </button>
        ))}
      </div>
      <textarea
        placeholder="Cuéntanos cómo podemos mejorar…"
        value={message}
        maxLength={1000}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
      />
      {error && <p className="error">{error}</p>}
      <button
        className="btn btn-primary"
        disabled={busy || !message.trim()}
        onClick={() => run(() => props.onSend(rating, message.trim()))}
      >
        {busy ? 'Enviando…' : 'Enviar'}
      </button>
    </Modal>
  )
}

function GuestsSheet(props: { initial: number; onClose: () => void; onSave: (n: number) => void }) {
  const [n, setN] = useState(props.initial)
  return (
    <Modal title="¿Cuántos son?" onClose={props.onClose}>
      <div className="stepper">
        <button className="chip" onClick={() => setN((v) => Math.max(1, v - 1))} aria-label="Menos">−</button>
        <span className="stepper-value">{n}</span>
        <button className="chip" onClick={() => setN((v) => Math.min(50, v + 1))} aria-label="Más">+</button>
      </div>
      <button className="btn btn-primary" onClick={() => props.onSave(n)}>Guardar</button>
    </Modal>
  )
}
