import { STATUS_META } from '../utils/bookings.js'

export default function StatusBadge({ status, label, tone }) {
  const meta = STATUS_META[status] ?? { label: label ?? status, tone: tone ?? 'gray' }
  return <span className={`badge badge--${tone ?? meta.tone}`}>{label ?? meta.label}</span>
}
