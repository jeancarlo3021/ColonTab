export function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`stat ${highlight ? 'highlight' : ''}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  )
}
