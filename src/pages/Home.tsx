import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../context'
import { requestService, sendSuggestion } from '../lib/api'
import { Logo } from '../components/Logo'
import { Modal } from '../components/Modal'
import { Toast } from '../components/Toast'
import { ReadyToOrder } from '../components/ReadyToOrder'
import { Icon, type IconName } from '../components/Icon'
import type { PaymentMethod, Restaurant } from '../types'

type Sheet = null | 'waiter' | 'bill' | 'wifi' | 'social' | 'hours' | 'suggest' | 'guests'

export function Home() {
  const { restaurant, table, guests, setGuests } = useSession()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [toast, setToast] = useState<string | null>(null)
  const close = useCallback(() => setSheet(null), [])
  const clearToast = useCallback(() => setToast(null), [])

  const whatsappUrl = restaurant.whatsapp
    ? `https://wa.me/${restaurant.whatsapp}?text=${encodeURIComponent(`Hola, estoy en la mesa ${table}.`)}`
    : null

  const menuType = restaurant.menu_type ?? 'custom'
  const menuSub = menuType === 'pdf' ? 'Carta en PDF' : menuType === 'url' ? 'Se abre la carta del restaurante' : 'Platillos, bebidas y precios'
  const hasSocial = !!(restaurant.instagram || restaurant.tiktok)

  return (
    <main className="c-home">
      <header className="c-top">
        <div className="c-top-brand">
          <Logo restaurant={restaurant} size={40} />
          <span>{restaurant.name}</span>
        </div>
        <div className="c-table" aria-label={`Mesa ${table}`}>
          <span className="c-table-label">Mesa</span>
          <span className="c-table-num">{String(table).padStart(2, '0')}</span>
        </div>
        <p className="c-top-note">¿No es tu mesa? Escanea el código de la tuya.</p>
      </header>

      <section className="c-guests" aria-label="Número de personas">
        <span className="c-guests-label"><Icon name="users" size={18} /> ¿Cuántos son?</span>
        <div className="c-seg" role="group">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} className={guests === n ? 'on' : ''} onClick={() => setGuests(guests === n ? null : n)} aria-pressed={guests === n}>
              {n}
            </button>
          ))}
          <button className={guests && guests > 6 ? 'on' : ''} onClick={() => setSheet('guests')} aria-label="Más de 6">
            {guests && guests > 6 ? guests : '7+'}
          </button>
        </div>
      </section>

      <Link to="menu" className="c-menu-link">
        <Icon name="menu" size={28} />
        <span>
          <strong>Ver el menú</strong>
          <small>{menuSub}</small>
        </span>
        <Icon name="chevron" />
      </Link>

      <Group title="Servicio">
        <Row icon="bell" label="Llamar al mesero" onClick={() => setSheet('waiter')} />
        <Row icon="receipt" label="Pedir la cuenta" sub="Tarjeta, efectivo o SINPE Móvil" onClick={() => setSheet('bill')} />
      </Group>

      <Group title="Mientras esperas">
        <Row icon="games" label="Juegos" sub="Gato y memoria" to="juegos" />
        {restaurant.wifi_ssid && <Row icon="wifi" label="Wi-Fi" sub={restaurant.wifi_ssid} onClick={() => setSheet('wifi')} />}
      </Group>

      <Group title="El restaurante">
        {whatsappUrl && <Row icon="chat" label="Escríbenos por WhatsApp" href={whatsappUrl} />}
        {hasSocial && <Row icon="camera" label="Redes sociales" onClick={() => setSheet('social')} />}
        {restaurant.google_review_url && <Row icon="star" label="Califícanos en Google" href={restaurant.google_review_url} />}
        <Row icon="pin" label="Cómo llegar y horario" sub={restaurant.address ?? undefined} onClick={() => setSheet('hours')} />
        <Row icon="idea" label="Sugerencias" sub="Cuéntanos cómo mejorar" onClick={() => setSheet('suggest')} />
      </Group>

      <footer className="powered">Hecho con <a href="https://www.colontab.com" target="_blank" rel="noopener"><strong>ColonTab</strong></a></footer>

      <ReadyToOrder variant="bar" />

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
          restaurant={restaurant}
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
              <a className="btn btn-ghost" href={restaurant.instagram} target="_blank" rel="noreferrer"><Icon name="camera" size={20} /> Instagram</a>
            )}
            {restaurant.tiktok && (
              <a className="btn btn-ghost" href={restaurant.tiktok} target="_blank" rel="noreferrer"><Icon name="external" size={20} /> TikTok</a>
            )}
          </div>
        </Modal>
      )}
      {sheet === 'hours' && (
        <Modal title="Cómo llegar y horario" onClose={close}>
          {restaurant.address && <p className="address">{restaurant.address}</p>}
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="c-group">
      <h2>{title}</h2>
      <ul>{children}</ul>
    </section>
  )
}

function Row(props: { icon: IconName; label: string; sub?: string; onClick?: () => void; to?: string; href?: string }) {
  const inner = (
    <>
      <Icon name={props.icon} className="c-row-icon" />
      <span className="c-row-text">
        <span>{props.label}</span>
        {props.sub && <small>{props.sub}</small>}
      </span>
      <Icon name={props.href ? 'external' : 'chevron'} size={18} className="c-row-go" />
    </>
  )
  return (
    <li>
      {props.to ? (
        <Link className="c-row" to={props.to}>{inner}</Link>
      ) : props.href ? (
        <a className="c-row" href={props.href} target="_blank" rel="noreferrer">{inner}</a>
      ) : (
        <button className="c-row" onClick={props.onClick}>{inner}</button>
      )}
    </li>
  )
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

/** 88888888 → 8888-8888 */
function formatPhone(p: string) {
  const d = p.replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4)}` : d
}

function BillSheet(props: { restaurant: Restaurant; onClose: () => void; onConfirm: (m: PaymentMethod) => Promise<void> }) {
  const { sinpe_phone, sinpe_name } = props.restaurant
  const [method, setMethod] = useState<PaymentMethod>('tarjeta')
  const { busy, error, run } = useSubmit(props.onClose)
  const options: { id: PaymentMethod; label: string }[] = [
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transferencia', label: 'SINPE Móvil' },
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
      {method === 'transferencia' && sinpe_phone && (
        <div className="sinpe-box">
          <WifiRow label="SINPE Móvil" value={formatPhone(sinpe_phone)} copyValue={sinpe_phone.replace(/\D/g, '')} />
          {sinpe_name && <small className="muted">A nombre de <b>{sinpe_name}</b></small>}
          <small className="muted">Cuando llegue el mesero, muéstrale el comprobante.</small>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} onClick={() => run(() => props.onConfirm(method))}>
        {busy ? 'Enviando…' : 'Pedir la cuenta'}
      </button>
    </Modal>
  )
}

function WifiRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
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
          navigator.clipboard?.writeText(copyValue ?? value).then(() => {
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
