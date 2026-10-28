import { useState, type FormEvent } from 'react'
import { addMember, listMembers, removeMember } from '../../lib/adminApi'
import { useAuth } from '../../lib/auth'
import { errorText, useData } from '../../lib/useData'
import type { MemberRole, Restaurant } from '../../types'

export function TeamPanel({ restaurant, canAddOwners }: { restaurant: Restaurant; canAddOwners: boolean }) {
  const { email: me } = useAuth()
  const { data, error, reload } = useData(() => listMembers(restaurant.id), [restaurant.id])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('staff')
  const [actionError, setActionError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setActionError(null)
    try {
      await addMember(restaurant.id, email, role)
      setEmail('')
      reload()
    } catch (err) {
      setActionError(errorText(err))
    }
  }

  return (
    <div className="stack-lg">
      <section className="panel">
        <h2 className="section-title">Agregar al equipo</h2>
        <p className="muted">
          La persona debe crear su cuenta en <code>{window.location.origin}/admin/login</code> con este mismo email.
        </p>
        <form className="inline-form" onSubmit={submit}>
          <input type="email" required placeholder="mesero@restaurante.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
            <option value="staff">Personal (pedidos y menú)</option>
            {canAddOwners && <option value="owner">Dueño (todo)</option>}
          </select>
          <button className="btn btn-primary small">Agregar</button>
        </form>
        {actionError && <p className="error">{actionError}</p>}
      </section>

      {error && <p className="error">{error}</p>}
      <section className="panel">
        <h2 className="section-title">Equipo</h2>
        {data?.length === 0 && <p className="muted">Sin personas asignadas.</p>}
        <ul className="member-list">
          {data?.map((m) => (
            <li key={m.id}>
              <div>
                <strong>{m.email}</strong>
                {m.email === me?.toLowerCase() && <span className="muted"> (tú)</span>}
              </div>
              <span className={`tag ${m.role === 'owner' ? 'tag-on' : ''}`}>{m.role === 'owner' ? 'Dueño' : 'Personal'}</span>
              {(m.role === 'staff' || canAddOwners) && (
                <button
                  className="btn btn-ghost small danger"
                  onClick={() =>
                    confirm(`¿Quitar a ${m.email}?`) &&
                    void removeMember(m.id).then(reload).catch((e) => setActionError(errorText(e)))
                  }
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
