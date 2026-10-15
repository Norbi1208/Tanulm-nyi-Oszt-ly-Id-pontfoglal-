import { CANCEL_LIMIT_HOURS } from '../config.js'
import { now, parseDate } from './date.js'

export const STATUS_META = {
  pending: { label: 'Függőben', tone: 'amber' },
  confirmed: { label: 'Megerősítve', tone: 'green' },
  rejected: { label: 'Elutasítva', tone: 'red' },
  cancelled: { label: 'Lemondva', tone: 'red' },
}

/** Aktív = még foglalja az idősávot. */
export const isActive = (b) => b.status === 'pending' || b.status === 'confirmed'

export function bookingStart(b) {
  const [h, m] = b.time.split(':').map(Number)
  const d = parseDate(b.date)
  d.setHours(h, m, 0, 0)
  return d
}

export function sortByStart(list) {
  return [...list].sort((a, b) => bookingStart(a) - bookingStart(b))
}

export function canCancel(b) {
  if (!isActive(b)) return false
  return bookingStart(b) - now() >= CANCEL_LIMIT_HOURS * 3600 * 1000
}
