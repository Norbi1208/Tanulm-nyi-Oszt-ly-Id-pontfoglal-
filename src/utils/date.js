import { DEMO_NOW } from '../config.js'

const pad = (n) => String(n).padStart(2, '0')

export function now() {
  return DEMO_NOW ? new Date(DEMO_NOW) : new Date()
}

/** Helyi idő szerinti ÉÉÉÉ-HH-NN */
export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr() {
  return toISODate(now())
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s, n) {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function isWeekend(s) {
  const day = parseDate(s).getDay()
  return day === 0 || day === 6
}

export function nextWorkday(s) {
  let d = s
  while (isWeekend(d)) d = addDays(d, 1)
  return d
}

export function monthKey(s) {
  return s.slice(0, 7)
}

/** Őszi félév: aug–jan, tavaszi: feb–jún, július: nyári időszak. */
export function semesterOf(date = now()) {
  const m = date.getMonth() + 1
  const y = date.getFullYear()
  if (m >= 8) return { label: 'Őszi félév', start: `${y}-08-01`, end: `${y + 1}-01-31` }
  if (m === 1) return { label: 'Őszi félév', start: `${y - 1}-08-01`, end: `${y}-01-31` }
  if (m <= 6) return { label: 'Tavaszi félév', start: `${y}-02-01`, end: `${y}-07-31` }
  return { label: 'Nyári időszak', start: `${y}-02-01`, end: `${y}-07-31` }
}
