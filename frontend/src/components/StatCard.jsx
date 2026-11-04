export default function StatCard({ label, value, hint, tone = 'brand' }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value stat__value--${tone}`}>{value}</span>
      <span className="stat__hint">{hint}</span>
    </div>
  )
}
