import { OPENING } from '../config.js'
import { now, todayStr } from './date.js'
import { isActive } from './bookings.js'

export const toMin = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export const toTime = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export function allSlots() {
  const out = []
  for (let m = toMin(OPENING.start); m < toMin(OPENING.end); m += OPENING.step) out.push(toTime(m))
  return out
}

const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2
const interval = (b) => [toMin(b.time), toMin(b.time) + b.duration]

/**
 * Egy nap idősávjai egy ügyintézőnél, adott ügyintézési időtartammal.
 * Minden sávhoz visszaadja, foglalható-e, és ha nem, miért.
 */
export function getSlots({ bookings, clerkId, studentId, date, duration }) {
  const close = toMin(OPENING.end)
  const today = todayStr()
  const n = now()
  const nowMin = n.getHours() * 60 + n.getMinutes()

  const sameDay = bookings.filter((b) => b.date === date && isActive(b))
  const clerkBusy = sameDay.filter((b) => b.clerkId === clerkId).map(interval)
  const studentBusy = sameDay.filter((b) => b.studentId === studentId).map(interval)

  return allSlots().map((time) => {
    const start = toMin(time)
    const end = start + duration
    let reason = null

    if (date < today || (date === today && start <= nowMin)) reason = 'Elmúlt időpont'
    else if (clerkBusy.some(([a, b]) => start >= a && start < b)) reason = 'Foglalt'
    else if (clerkBusy.some(([a, b]) => overlaps(start, end, a, b)))
      reason = 'Az ügyintézés nem fér el a következő foglalás előtt'
    else if (end > close) reason = 'Az ügyintézés túlnyúlna az ügyfélfogadási időn'
    else if (studentBusy.some(([a, b]) => overlaps(start, end, a, b)))
      reason = 'Erre az időre már van foglalásod'

    return { time, available: !reason, reason }
  })
}

export function endTime(time, duration) {
  return toTime(toMin(time) + duration)
}
