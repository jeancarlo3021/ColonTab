import { useEffect, useRef, useState } from 'react'
import { listPendingRequests, resolveRequest, subscribeLive } from '../../lib/adminApi'
import { loadRepeat, loadVolume, playChime, saveRepeat, saveVolume, soundUnlocked, unlockSound } from '../../lib/sound'
import { errorText } from '../../lib/useData'
import {
  closeNotifications, notifyEnabled, notifyState, requestNotify, setNotifyEnabled, showNotify, type NotifyState,
} from '../../lib/notify'
import { Stat } from '../../components/Stat'
import type { Restaurant, ServiceRequest, ServiceType } from '../../types'

const REPEAT_EVERY_MS = 20_000

const LABEL: Record<ServiceType, { icon: string; text: string }> = {
  order: { icon: '🙋', text: 'Listo para ordenar' },
  waiter: { icon: '🛎️', text: 'Llama al mesero' },
  bill: { icon: '🧾', text: 'Pide la cuenta' },
}
const PAYMENT_LABEL = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '📲 SINPE Móvil' }

function timeAgo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export function CallsPanel({ restaurant }: { restaurant: Restaurant }) {
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [volume, setVolume] = useState(loadVolume)
  const [repeat, setRepeat] = useState(loadRepeat)
  const [unlocked, setUnlocked] = useState(soundUnlocked)
  const [notify, setNotify] = useState<NotifyState>(notifyState)
  const [notifyOn, setNotifyOn] = useState(notifyEnabled)
  const [, tick] = useState(0)
  const known = useRef<Set<string> | null>(null)
  const settings = useRef({ volume, repeat })

  useEffect(() => {
    settings.current = { volume, repeat }
    saveVolume(volume)
    saveRepeat(repeat)
  }, [volume, repeat])

  // Revisa si el navegador ya permitió el sonido tras el primer clic
  useEffect(() => {
    if (unlocked) return
    const check = () => setTimeout(() => setUnlocked(soundUnlocked()), 50)
    window.addEventListener('pointerdown', check)
    return () => window.removeEventListener('pointerdown', check)
  }, [unlocked])

  // Carga + tiempo real
  useEffect(() => {
    let alive = true
    known.current = null
    const load = async () => {
      try {
        const list = await listPendingRequests(restaurant.id)
        if (!alive) return
        const prev = known.current
        const fresh = prev ? list.filter((r) => !prev.has(r.id)) : []
        if (fresh.length) playChime(fresh[fresh.length - 1].type, settings.current.volume)
        for (const r of fresh) {
          void showNotify({
            id: r.id,
            title: `${LABEL[r.type].icon} Mesa ${r.table_number} · ${LABEL[r.type].text}`,
            body: [
              restaurant.name,
              r.guests ? `${r.guests} ${r.guests === 1 ? 'persona' : 'personas'}` : '',
              r.payment_method ? PAYMENT_LABEL[r.payment_method] : '',
            ].filter(Boolean).join(' · '),
            url: `/admin/r/${restaurant.slug}`,
          })
        }
        known.current = new Set(list.map((r) => r.id))
        void closeNotifications(known.current)
        setRequests(list)
        setError(null)
      } catch (e) {
        if (alive) setError(errorText(e))
      }
    }
    void load()
    const unsubscribe = subscribeLive(restaurant.id, () => void load())
    const poll = setInterval(() => void load(), 15_000) // respaldo si se cae el tiempo real
    return () => {
      alive = false
      unsubscribe()
      clearInterval(poll)
    }
  }, [restaurant.id, restaurant.name, restaurant.slug])

  // Repetir el aviso mientras haya mesas esperando + refrescar "hace X min"
  const pending = requests ?? []
  const oldest = pending[0]?.type
  useEffect(() => {
    const t = setInterval(() => {
      tick((n) => n + 1)
      if (oldest && settings.current.repeat) playChime(oldest, settings.current.volume)
    }, REPEAT_EVERY_MS)
    return () => clearInterval(t)
  }, [oldest])

  // Número de mesas esperando en la pestaña del navegador
  useEffect(() => {
    const base = document.title
    document.title = pending.length ? `(${pending.length}) Mesas esperando · ColonTab` : base
    return () => {
      document.title = base
    }
  }, [pending.length])

  async function resolve(id: string) {
    setRequests((list) => list?.filter((r) => r.id !== id) ?? null)
    known.current?.delete(id)
    if (known.current) void closeNotifications(known.current)
    try {
      await resolveRequest(id)
    } catch (e) {
      setError(errorText(e))
    }
  }

  const count = (t: ServiceType) => pending.filter((r) => r.type === t).length

  return (
    <div className="stack-lg">
      {!unlocked && (
        <button
          className="sound-unlock"
          onClick={() =>
            void unlockSound().then((ok) => {
              setUnlocked(ok)
              if (ok) playChime('order', volume)
            })
          }
        >
          🔇 Haz clic aquí para activar el sonido de avisos
        </button>
      )}

      <section className="panel sound-panel">
        <div className="sound-row">
          <span className="sound-title">🔔 Sonido de avisos</span>
          <div className="volume">
            <button className="icon-btn" onClick={() => setVolume(0)} aria-label="Silenciar">
              {volume === 0 ? '🔇' : '🔈'}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              aria-label="Volumen"
              style={{ ['--fill' as string]: `${volume * 100}%` }}
            />
            <span className="volume-value">{Math.round(volume * 100)}%</span>
          </div>
        </div>
        <div className="sound-row">
          <div className="order-actions">
            <span className="muted small-text">Probar:</span>
            {(['order', 'waiter', 'bill'] as const).map((t) => (
              <button key={t} className="btn btn-ghost small" onClick={() => playChime(t, volume)}>
                {LABEL[t].icon} {LABEL[t].text}
              </button>
            ))}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            <span>Repetir cada 20 s mientras haya mesas esperando</span>
          </label>
        </div>
        <div className="sound-row notify-row">
          <div>
            <span className="sound-title">🪧 Notificaciones en pantalla</span>
            <p className="muted small-text">
              Aparecen en la esquina aunque estés en otra aplicación y se quedan hasta que las cierres.
            </p>
          </div>
          {notify === 'unsupported' && <span className="muted small-text">Este navegador no permite notificaciones.</span>}
          {notify === 'denied' && (
            <span className="small-text error">
              Bloqueadas. Haz clic en el candado 🔒 junto a la dirección → Notificaciones → Permitir, y recarga.
            </span>
          )}
          {notify === 'default' && (
            <button className="btn btn-primary small" onClick={() => void requestNotify().then(setNotify)}>
              Activar notificaciones
            </button>
          )}
          {notify === 'granted' && (
            <div className="order-actions">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={notifyOn}
                  onChange={(e) => {
                    setNotifyOn(e.target.checked)
                    setNotifyEnabled(e.target.checked)
                  }}
                />
                <span>{notifyOn ? 'Activadas' : 'Apagadas'}</span>
              </label>
              <button
                className="btn btn-ghost small"
                disabled={!notifyOn}
                onClick={() =>
                  void showNotify({
                    id: 'prueba',
                    title: '🙋 Mesa 4 · Listo para ordenar',
                    body: `${restaurant.name} · Notificación de prueba`,
                    url: `/admin/r/${restaurant.slug}`,
                  })
                }
              >
                Probar
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="stats">
        <Stat label="Mesas esperando" value={String(pending.length)} highlight={pending.length > 0} />
        <Stat label="🙋 Listos para ordenar" value={String(count('order'))} />
        <Stat label="🛎️ Llaman al mesero" value={String(count('waiter'))} />
        <Stat label="🧾 Piden la cuenta" value={String(count('bill'))} />
      </div>

      {error && <p className="error">{error}</p>}
      {!requests && !error && <div className="spinner" />}
      {requests && pending.length === 0 && (
        <div className="panel empty">
          <div className="empty-emoji">👌</div>
          <p>No hay mesas esperando.</p>
          <small className="muted">Cuando un cliente toque un botón, aparecerá aquí con sonido.</small>
        </div>
      )}

      <div className="call-grid">
        {pending.map((r) => (
          <article key={r.id} className={`call call-${r.type}`}>
            <div className="call-icon" aria-hidden>{LABEL[r.type].icon}</div>
            <div className="call-info">
              <strong className="call-table">Mesa {r.table_number}</strong>
              <span className="call-text">{LABEL[r.type].text}</span>
              <small className="muted">
                {timeAgo(r.created_at)}
                {r.guests ? ` · ${r.guests} ${r.guests === 1 ? 'persona' : 'personas'}` : ''}
                {r.payment_method ? ` · ${PAYMENT_LABEL[r.payment_method]}` : ''}
              </small>
            </div>
            <button className="btn btn-primary small" onClick={() => void resolve(r.id)}>Atendido</button>
          </article>
        ))}
      </div>
    </div>
  )
}
