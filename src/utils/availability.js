import { OPENING } from '../config.js'
import { now, parseDate, todayStr } from './date.js'
import { bookingStart, isActive } from './bookings.js'
import { toMin } from './slots.js'

/** Munkanapok: 1 = hétfő … 5 = péntek (Date.getDay() szerint). */
export const WORKDAYS = [1, 2, 3, 4, 5]
export const WEEKDAY_LONG = { 1: 'Hétfő', 2: 'Kedd', 3: 'Szerda', 4: 'Csütörtök', 5: 'Péntek' }
const WEEKDAY_SHORT = { 1: 'H', 2: 'K', 3: 'Sze', 4: 'Cs', 5: 'P' }
const WEEKDAY_PLURAL = { 1: 'hétfőnként', 2: 'keddenként', 3: 'szerdánként', 4: 'csütörtökönként', 5: 'péntekenként' }

/** Alapértelmezett munkarend: minden munkanap a teljes ügyfélfogadási idő. */
export function defaultSchedule() {
  return Object.fromEntries(WORKDAYS.map((d) => [d, { start: OPENING.start, end: OPENING.end }]))
}

export function weekdayOf(date) {
  return parseDate(date).getDay()
}

export function weekdayPlural(date) {
  return WEEKDAY_PLURAL[weekdayOf(date)] ?? 'ezen a napon'
}

export function absenceFor(absences, clerkId, date) {
  return absences.find((a) => a.clerkId === clerkId && a.date === date) ?? null
}

/**
 * Egy ügyintéző egy adott napon:
 * { working: true, start, end } vagy { working: false, why: 'absent' | 'off', absence }
 */
export function clerkDay(clerk, date, absences) {
  if (!clerk || !date) return { working: false, why: 'off' }
  const absence = absenceFor(absences, clerk.id, date)
  if (absence) return { working: false, why: 'absent', absence }
  const hours = clerk.schedule?.[weekdayOf(date)]
  if (!hours) return { working: false, why: 'off' }
  return { working: true, start: hours.start, end: hours.end }
}

/** Beleesik-e a foglalás az adott munkarendbe? */
export function fitsSchedule(booking, schedule) {
  const hours = schedule?.[weekdayOf(booking.date)]
  if (!hours) return false
  const start = toMin(booking.time)
  return start >= toMin(hours.start) && start + booking.duration <= toMin(hours.end)
}

/** Még előttünk álló, aktív foglalás? */
export function isUpcomingActive(b) {
  return isActive(b) && b.date >= todayStr() && bookingStart(b) > now()
}

/** Rövid összefoglaló, pl. „H–Cs 09:00–15:00, P 08:00–12:00”. */
export function scheduleSummary(schedule) {
  const groups = []
  for (const d of WORKDAYS) {
    const h = schedule?.[d]
    if (!h) continue
    const last = groups[groups.length - 1]
    if (last && last.to === d - 1 && last.start === h.start && last.end === h.end) last.to = d
    else groups.push({ from: d, to: d, start: h.start, end: h.end })
  }
  if (!groups.length) return 'Nincs beosztás'
  return groups
    .map((g) => {
      const days = g.from === g.to ? WEEKDAY_SHORT[g.from] : `${WEEKDAY_SHORT[g.from]}–${WEEKDAY_SHORT[g.to]}`
      return `${days} ${g.start}–${g.end}`
    })
    .join(', ')
}
