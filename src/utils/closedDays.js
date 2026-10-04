import { addDays, nextWorkday } from './date.js'

/**
 * Az egymást követő munkanapokat azonos okkal egy csoportba vonja,
 * így egy lezárt időszak egy sorként jelenik meg (a hétvége nem szakítja meg).
 */
export function groupClosedDays(list) {
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
  const groups = []
  for (const c of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.reason === c.reason && nextWorkday(addDays(last.to, 1)) === c.date) {
      last.to = c.date
      last.ids.push(c.id)
    } else {
      groups.push({ key: c.id, from: c.date, to: c.date, reason: c.reason, ids: [c.id] })
    }
  }
  return groups
}

export function formatRange(g) {
  return g.from === g.to ? g.from : `${g.from} – ${g.to}`
}
