import { money } from '../lib/format'
import type { Plan } from '../types'

/** Selector de plan para usar dentro de tablas. */
export function PlanSelect({ plans, value, onChange }: { plans: Plan[]; value: string | null; onChange: (planId: string | null) => void }) {
  return (
    <select
      className="plan-select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label="Plan del restaurante"
    >
      <option value="">Sin plan</option>
      {plans.filter((p) => p.active || p.id === value).map((p) => (
        <option key={p.id} value={p.id}>{p.name} · {money(p.price, p.currency)}</option>
      ))}
    </select>
  )
}
