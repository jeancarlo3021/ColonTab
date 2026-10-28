import { useState, type FormEvent } from 'react'
import { updateRestaurant, type RestaurantPatch } from '../../lib/adminApi'
import { errorText } from '../../lib/useData'
import type { Restaurant } from '../../types'

type Field = { key: keyof Restaurant; label: string; type?: string; placeholder?: string; multiline?: boolean }

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: 'Identidad',
    fields: [
      { key: 'name', label: 'Nombre del restaurante' },
      { key: 'logo_text', label: 'Iniciales del logo', placeholder: 'LE' },
      { key: 'logo_url', label: 'URL del logo (opcional)', type: 'url', placeholder: 'https://…' },
      { key: 'primary_color', label: 'Color principal', type: 'color' },
      { key: 'currency', label: 'Moneda', placeholder: 'MXN' },
    ],
  },
  {
    title: 'Wi-Fi',
    fields: [
      { key: 'wifi_ssid', label: 'Nombre de la red' },
      { key: 'wifi_password', label: 'Contraseña' },
    ],
  },
  {
    title: 'Contacto y redes',
    fields: [
      { key: 'whatsapp', label: 'WhatsApp (con código de país, solo números)', placeholder: '5215512345678' },
      { key: 'instagram', label: 'Instagram', type: 'url', placeholder: 'https://instagram.com/…' },
      { key: 'tiktok', label: 'TikTok', type: 'url', placeholder: 'https://tiktok.com/@…' },
      { key: 'google_review_url', label: 'Enlace para reseñas en Google', type: 'url' },
    ],
  },
  {
    title: 'Ubicación y horario',
    fields: [
      { key: 'address', label: 'Dirección' },
      { key: 'maps_url', label: 'Enlace de Google Maps', type: 'url' },
      { key: 'hours', label: 'Horario', multiline: true, placeholder: 'Lun a Vie: 12:00 – 22:00' },
    ],
  },
]

export function SettingsPanel({ restaurant, onSaved }: { restaurant: Restaurant; onSaved: () => void }) {
  const [form, setForm] = useState<Restaurant>(restaurant)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const patch: RestaurantPatch = {}
    for (const s of SECTIONS) {
      for (const f of s.fields) {
        const v = form[f.key]
        ;(patch as Record<string, unknown>)[f.key] = typeof v === 'string' ? v.trim() || null : v
      }
    }
    patch.name = form.name.trim() || restaurant.name
    patch.logo_text = form.logo_text.trim()
    patch.currency = (form.currency.trim() || 'MXN').toUpperCase()
    patch.whatsapp = form.whatsapp?.replace(/\D/g, '') || null
    try {
      await updateRestaurant(restaurant.id, patch)
      setMsg({ ok: true, text: 'Cambios guardados ✅' })
      onSaved()
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="settings" onSubmit={submit}>
      {SECTIONS.map((s) => (
        <section key={s.title} className="panel">
          <h2 className="section-title">{s.title}</h2>
          <div className="settings-grid">
            {s.fields.map((f) => {
              const value = (form[f.key] as string | null) ?? ''
              const onChange = (v: string) => setForm((x) => ({ ...x, [f.key]: v }))
              return (
                <label key={f.key} className={`field ${f.multiline ? 'span-2' : ''}`}>
                  <span>{f.label}</span>
                  {f.multiline ? (
                    <textarea rows={3} value={value} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
                  ) : (
                    <input type={f.type ?? 'text'} value={value} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
                  )}
                </label>
              )
            })}
          </div>
        </section>
      ))}
      <div className="save-bar">
        {msg && <span className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</span>}
        <button className="btn btn-primary small" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}
