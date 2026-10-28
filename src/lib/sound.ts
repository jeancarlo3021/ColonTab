// Sonidos de aviso para el panel del restaurante, generados con Web Audio (sin archivos).
// Una campana suave con eco, pasada por un compresor para que se escuche fuerte en los parlantes.
import type { ServiceType } from '../types'

const VOLUME_KEY = 'mesaclick:volume'
const REPEAT_KEY = 'mesaclick:repeat'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  ctx ??= new AudioContext()
  return ctx
}

/** El navegador solo permite sonido después de un clic. Devuelve true si ya está permitido. */
export function soundUnlocked(): boolean {
  return audio()?.state === 'running'
}

export async function unlockSound(): Promise<boolean> {
  const c = audio()
  if (!c) return false
  if (c.state !== 'running') await c.resume().catch(() => undefined)
  return c.state === 'running'
}

// Desbloquea con el primer clic o tecla en cualquier parte
if (typeof window !== 'undefined') {
  const once = () => void unlockSound()
  window.addEventListener('pointerdown', once, { once: true })
  window.addEventListener('keydown', once, { once: true })
}

// Melodías (frecuencias en Hz y separación entre notas en segundos)
const MELODIES: Record<ServiceType, { notes: number[]; gap: number }> = {
  // Listo para ordenar: arpegio alegre ascendente Do-Mi-Sol-Do
  order: { notes: [523.25, 659.25, 783.99, 1046.5], gap: 0.13 },
  // Llamar al mesero: "ding-dong" clásico
  waiter: { notes: [659.25, 523.25], gap: 0.38 },
  // Pedir la cuenta: tres notas La-Do#-Mi
  bill: { notes: [880, 1108.73, 1318.51], gap: 0.16 },
}

/** Toca el aviso. volume va de 0 a 1. */
export function playChime(type: ServiceType, volume: number) {
  const c = audio()
  if (!c || volume <= 0) return
  if (c.state !== 'running') void c.resume()

  const t0 = c.currentTime + 0.03

  // Salida: volumen → compresor (sube lo bajo y evita que distorsione) → parlantes
  const master = c.createGain()
  master.gain.value = Math.min(1, volume) * 1.6
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -20
  comp.knee.value = 10
  comp.ratio.value = 6
  comp.attack.value = 0.003
  comp.release.value = 0.25
  master.connect(comp)
  comp.connect(c.destination)

  // Eco suave para que suene más "bonito" y lleno
  const delay = c.createDelay()
  delay.delayTime.value = 0.18
  const feedback = c.createGain()
  feedback.gain.value = 0.28
  const wet = c.createGain()
  wet.gain.value = 0.35
  delay.connect(feedback)
  feedback.connect(delay)
  delay.connect(wet)
  wet.connect(master)

  const { notes, gap } = MELODIES[type]
  notes.forEach((freq, i) => bell(c, freq, t0 + i * gap, master, delay))

  // Liberar nodos al terminar
  const total = (notes.length - 1) * gap + 2.5
  setTimeout(() => {
    master.disconnect()
    comp.disconnect()
    delay.disconnect()
    feedback.disconnect()
  }, total * 1000)
}

/** Una nota de campana: fundamental + armónicos con caída exponencial. */
function bell(c: AudioContext, freq: number, at: number, out: AudioNode, fx: AudioNode) {
  const partials: [ratio: number, gain: number, decay: number][] = [
    [1, 0.6, 1.6],
    [2, 0.25, 0.9],
    [3, 0.08, 0.5],
    [4.2, 0.04, 0.3], // un toque metálico
  ]
  for (const [ratio, g, decay] of partials) {
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq * ratio
    const env = c.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(g, at + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay)
    osc.connect(env)
    env.connect(out)
    env.connect(fx)
    osc.start(at)
    osc.stop(at + decay + 0.05)
  }
}

// ───── Preferencias guardadas en este navegador ─────
export function loadVolume(): number {
  try {
    const v = localStorage.getItem(VOLUME_KEY)
    return v === null ? 0.8 : Math.max(0, Math.min(1, Number(v)))
  } catch {
    return 0.8
  }
}

export function saveVolume(v: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(v))
  } catch {
    /* sin almacenamiento */
  }
}

export function loadRepeat(): boolean {
  try {
    return localStorage.getItem(REPEAT_KEY) !== '0'
  } catch {
    return true
  }
}

export function saveRepeat(v: boolean) {
  try {
    localStorage.setItem(REPEAT_KEY, v ? '1' : '0')
  } catch {
    /* sin almacenamiento */
  }
}
