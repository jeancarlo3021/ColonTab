import { getBilling, listPayments, listPurchases } from '../../lib/adminApi'
import { daysBetween, daysText, effectivePlanPrice, formatDate, serviceStatus, STATE_LABEL } from '../../lib/billing'
import { money } from '../../lib/format'
import { CONTACT_URL } from '../../lib/site'
import { useData } from '../../lib/useData'
import type { Restaurant } from '../../types'

/** Pestaña "Servicio" del restaurante: cuánto le queda, plan e historial de pagos. */
export function ServicePanel({ restaurant }: { restaurant: Restaurant }) {
  const s = serviceStatus(restaurant.paid_until)
  const billing = useData(() => getBilling(restaurant.id), [restaurant.id])
  const payments = useData(() => listPayments(restaurant.id), [restaurant.id, restaurant.paid_until])
  const last = payments.data?.[0]
  // Periodo que cubre la fecha actual de vencimiento (si se cambió a mano, se usa un año)
  const current = payments.data?.find((p) => p.period_end.slice(0, 10) === s.until)
  const total = current ? daysBetween(current.period_start, current.period_end) + 1 : 365
  const pct = s.daysLeft === null ? 0 : Math.max(0, Math.min(100, (s.daysLeft / total) * 100))
  const eff = effectivePlanPrice(billing.data)
  const purchases = useData(() => listPurchases(restaurant.id), [restaurant.id])

  return (
    <div className="stack-lg">
      <section className={`panel service-card ${s.state}`}>
        <div className="row-between">
          <h2 className="section-title">{billing.data?.plan ? `Plan ${billing.data.plan.name}` : 'Plan de ColonTab'}</h2>
          <span className={`tag state-${s.state}`}>{STATE_LABEL[s.state]}</span>
        </div>
        {s.state === 'none' ? (
          <p className="muted">Todavía no hay una fecha de vencimiento registrada.</p>
        ) : (
          <>
            <div className="service-big">
              <strong>{s.daysLeft! < 0 ? 0 : s.daysLeft}</strong>
              <span>{s.daysLeft === 1 ? 'día de servicio restante' : 'días de servicio restantes'}</span>
            </div>
            <div className="service-bar" aria-hidden><span style={{ width: `${pct}%` }} /></div>
            <p>
              {s.state === 'expired' ? 'Venció' : 'Vence'} el <b>{formatDate(s.until!)}</b> ({daysText(s.daysLeft!)}).
              {s.state === 'ok' && ' Te avisaremos aquí una semana antes.'}
            </p>
          </>
        )}
        <div className="service-facts">
          <div><small>Precio del plan</small><b>{eff ? `${money(eff.price, eff.currency)} / ${billing.data?.plan && billing.data.plan.months !== 12 ? `${billing.data.plan.months} meses` : 'año'}` : '—'}</b></div>
          <div><small>Último pago</small><b>{last ? formatDate(last.created_at) : '—'}</b></div>
        </div>
        <a className="btn btn-ghost small" href={CONTACT_URL} target="_blank" rel="noopener">Renovar o consultar mi plan</a>
      </section>

      <section className="panel">
        <h2 className="section-title">Historial de pagos</h2>
        {payments.error && <p className="error">{payments.error}</p>}
        {payments.data?.length === 0 && <p className="muted">Sin pagos registrados.</p>}
        <ul className="payment-list">
          {payments.data?.map((p) => (
            <li key={p.id}>
              <div>
                <strong>{money(p.amount, p.currency)}</strong>
                <small className="muted">{p.method ?? 'Pago'}{p.note ? ` · ${p.note}` : ''}</small>
              </div>
              <small>Del {formatDate(p.period_start)} al {formatDate(p.period_end)}</small>
            </li>
          ))}
        </ul>
      </section>

      {purchases.data && purchases.data.length > 0 && (
        <section className="panel">
          <h2 className="section-title">Compras (placas y artículos)</h2>
          <ul className="payment-list">
            {purchases.data.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>{p.quantity} × {p.product_name}</strong>
                  <small className="muted">{formatDate(p.sold_at)} · {money(p.unit_price, p.currency)} c/u</small>
                </div>
                <div className="cell-stack right">
                  <strong>{money(p.total, p.currency)}</strong>
                  <small className={p.paid ? 'muted' : 'error'}>{p.paid ? 'Pagado' : 'Pendiente de pago'}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
