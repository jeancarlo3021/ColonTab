// Notificaciones del sistema (la "viñeta" de Chrome en la esquina de la pantalla).
// Se muestran aunque el panel esté en segundo plano o haya otra aplicación al frente,
// y se quedan en pantalla hasta que alguien las cierre (requireInteraction).

const PREF_KEY = 'mesaclick:notify'

export type NotifyState = 'unsupported' | 'denied' | 'default' | 'granted'

export function notifyState(): NotifyState {
  if (typeof window === 'undefined' || !('Notification' in window) || !window.isSecureContext) return 'unsupported'
  return Notification.permission as NotifyState
}

export function notifyEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== '0'
  } catch {
    return true
  }
}

export function setNotifyEnabled(v: boolean) {
  try {
    localStorage.setItem(PREF_KEY, v ? '1' : '0')
  } catch {
    /* sin almacenamiento */
  }
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null

/** El service worker permite notificaciones en Android y que el clic traiga el panel al frente. */
function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  registration ??= 'serviceWorker' in navigator
    ? navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).catch(() => null)
    : Promise.resolve(null)
  return registration
}

export async function requestNotify(): Promise<NotifyState> {
  if (notifyState() === 'unsupported') return 'unsupported'
  const result = await Notification.requestPermission()
  if (result === 'granted') {
    setNotifyEnabled(true)
    void swRegistration()
  }
  return result as NotifyState
}

// Ícono PNG dibujado una vez (las notificaciones no siempre aceptan SVG)
let iconUrl: string | null = null
function icon(): string | undefined {
  if (iconUrl) return iconUrl
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 192
    const g = c.getContext('2d')!
    g.fillStyle = '#0F1926'
    g.beginPath()
    g.roundRect(0, 0, 192, 192, 54)
    g.fill()
    g.fillStyle = '#00D492'
    g.font = 'bold 76px Comfortaa, Arial, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('CT', 96, 100)
    iconUrl = c.toDataURL('image/png')
    return iconUrl
  } catch {
    return undefined
  }
}

export async function showNotify(opts: { id: string; title: string; body: string; url: string }) {
  if (notifyState() !== 'granted' || !notifyEnabled()) return
  const options: NotificationOptions & { renotify?: boolean } = {
    body: opts.body,
    tag: opts.id,
    icon: icon(),
    badge: icon(),
    requireInteraction: true, // se queda abierta hasta que la cierren
    silent: true, // el sonido lo pone el panel con su volumen
    data: { url: opts.url },
  }
  const reg = await swRegistration()
  if (reg) return reg.showNotification(opts.title, options)
  const n = new Notification(opts.title, options)
  n.onclick = () => {
    window.focus()
    n.close()
  }
}

/** Cierra las notificaciones de llamadas que ya se atendieron. */
export async function closeNotifications(keepIds: Set<string>) {
  const reg = await swRegistration()
  if (!reg) return
  for (const n of await reg.getNotifications()) {
    if (n.tag && n.tag !== 'prueba' && !keepIds.has(n.tag)) n.close()
  }
}

// Registrar desde ya si ya había permiso
if (notifyState() === 'granted') void swRegistration()
