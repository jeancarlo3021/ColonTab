import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getRestaurantAdmin, listMembers } from '../lib/adminApi'
import { useData } from '../lib/useData'
import { AdminHeader } from './AdminShell'
import { CallsPanel } from './panels/CallsPanel'
import { MenuPanel } from './panels/MenuPanel'
import { TablesPanel } from './panels/TablesPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { SuggestionsPanel } from './panels/SuggestionsPanel'
import { TeamPanel } from './panels/TeamPanel'
import { ServicePanel } from './panels/ServicePanel'
import { ServiceAlertOnce, ServiceBanner, ServiceBlocked, serviceSummary } from './ServiceNotice'
import { serviceStatus } from '../lib/billing'

type Tab = 'mesas-live' | 'menu' | 'mesas' | 'sugerencias' | 'ajustes' | 'equipo' | 'servicio'

export function RestaurantAdmin() {
  const { slug = '' } = useParams()
  const { email, isPlatformAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('mesas-live')
  const restaurant = useData(() => getRestaurantAdmin(slug), [slug])
  const r = restaurant.data
  const members = useData(() => (r ? listMembers(r.id) : Promise.resolve([])), [r?.id])

  const myRole = members.data?.find((m) => m.email === email?.toLowerCase())?.role
  const isOwner = isPlatformAdmin || myRole === 'owner'

  if (restaurant.error) return <AdminError message={restaurant.error} />
  if (restaurant.data === undefined) return <div className="admin-loading"><div className="spinner" /></div>
  if (!r) return <AdminError message="Restaurante no encontrado o sin acceso." />

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'mesas-live', label: '🛎️ Llamadas', show: true },
    { id: 'menu', label: '📋 Menú', show: true },
    { id: 'mesas', label: '🔳 Mesas y QR', show: true },
    { id: 'sugerencias', label: '💡 Sugerencias', show: true },
    { id: 'ajustes', label: '⚙️ Ajustes', show: isOwner },
    { id: 'equipo', label: '👥 Equipo', show: isOwner },
    { id: 'servicio', label: '💳 Servicio', show: isOwner },
  ]
  const service = serviceStatus(r.paid_until)
  const blocked = service.state === 'expired' && !isPlatformAdmin
  const summary = serviceSummary(r)

  return (
    <div className="admin">
      <AdminHeader
        title={r.name}
        back="/admin"
        subtitle={
          <>
            Panel del restaurante · <a href={`/r/${r.slug}/1`} target="_blank" rel="noreferrer">ver como cliente ↗</a>
            {!r.active && <span className="tag tag-off" style={{ marginLeft: 8 }}>Inactivo</span>}
            {summary && (
              <>
                <br />
                <span className={`header-service ${service.state}`}>{summary}</span>
              </>
            )}
          </>
        }
      />
      {blocked ? (
        <main className="admin-main"><ServiceBlocked restaurant={r} /></main>
      ) : (
      <>
      <nav className="admin-tabs">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main className="admin-main">
        <ServiceBanner restaurant={r} onOpen={isOwner ? () => setTab('servicio') : undefined} />
        <ServiceAlertOnce restaurant={r} onOpen={() => setTab(isOwner ? 'servicio' : tab)} />
        {tab === 'mesas-live' && <CallsPanel restaurant={r} />}
        {tab === 'menu' && <MenuPanel restaurant={r} canEdit={isOwner} onSaved={restaurant.reload} />}
        {tab === 'mesas' && <TablesPanel restaurant={r} canEdit={isOwner} onSaved={restaurant.reload} />}
        {tab === 'sugerencias' && <SuggestionsPanel restaurant={r} />}
        {tab === 'ajustes' && isOwner && <SettingsPanel restaurant={r} onSaved={restaurant.reload} />}
        {tab === 'equipo' && isOwner && <TeamPanel restaurant={r} canAddOwners={isPlatformAdmin} />}
        {tab === 'servicio' && isOwner && <ServicePanel restaurant={r} />}
      </main>
      </>
      )}
    </div>
  )
}

function AdminError({ message }: { message: string }) {
  return (
    <div className="admin">
      <AdminHeader title="ColonTab" back="/admin" />
      <main className="admin-main">
        <div className="panel empty"><div className="empty-emoji">🔒</div><p>{message}</p></div>
      </main>
    </div>
  )
}
