import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { OPENING } from '../../config.js'
import Modal from '../Modal.jsx'
import AffectedBookings from '../AffectedBookings.jsx'
import { allSlots, toMin, toTime } from '../../utils/slots.js'
import { WEEKDAY_LONG, WORKDAYS, fitsSchedule, isUpcomingActive } from '../../utils/availability.js'
import { sortByStart } from '../../utils/bookings.js'
import { todayStr } from '../../utils/date.js'

const START_OPTIONS = allSlots(OPENING.start, OPENING.end)
const END_OPTIONS = [...START_OPTIONS.slice(1), OPENING.end]

function initialRows(schedule) {
  return Object.fromEntries(
    WORKDAYS.map((d) => {
      const h = schedule?.[d]
      return [d, { on: !!h, start: h?.start ?? OPENING.start, end: h?.end ?? OPENING.end }]
    }),
  )
}

function toSchedule(rows) {
  return Object.fromEntries(WORKDAYS.map((d) => [d, rows[d].on ? { start: rows[d].start, end: rows[d].end } : null]))
}

export default function ScheduleModal({ clerk, onClose }) {
  const { data, updateClerkSchedule, toast } = useApp()
  const [rows, setRows] = useState(() => initialRows(clerk.schedule))
  const [rejectAffected, setRejectAffected] = useState(true)
  const [error, setError] = useState('')

  const schedule = useMemo(() => toSchedule(rows), [rows])
  const changed = JSON.stringify(schedule) !== JSON.stringify(toSchedule(initialRows(clerk.schedule)))

  const affected = useMemo(
    () =>
      sortByStart(
        data.bookings.filter((b) => b.clerkId === clerk.id && isUpcomingActive(b) && !fitsSchedule(b, schedule)),
      ),
    [data.bookings, clerk.id, schedule],
  )

  const absences = data.clerkAbsences.filter((a) => a.clerkId === clerk.id && a.date >= todayStr())

  const setRow = (d, patch) => {
    setError('')
    setRows((r) => {
      const next = { ...r[d], ...patch }
      // Ha a kezdés a vég után kerülne, a vég igazodik hozzá (legalább 1 óra, legfeljebb zárásig)
      if (toMin(next.end) <= toMin(next.start)) next.end = toTime(Math.min(toMin(next.start) + 60, toMin(OPENING.end)))
      return { ...r, [d]: next }
    })
  }

  const copyFirstToAll = () => {
    const first = WORKDAYS.map((d) => rows[d]).find((r) => r.on)
    if (!first) return
    setRows(Object.fromEntries(WORKDAYS.map((d) => [d, { ...first }])))
  }

  const save = () => {
    const res = updateClerkSchedule(clerk.id, schedule, { rejectAffected })
    if (!res.ok) return setError(res.error)
    const extra = res.affected ? ` ${res.affected} foglalás elutasítva, a hallgatók értesítést kaptak.` : ''
    toast(`${clerk.name} munkarendje mentve.${extra}`)
    onClose()
  }

  return (
    <Modal
      title={`Munkarend: ${clerk.name}`}
      subtitle="Mely napokon és mettől meddig fogadja a hallgatókat"
      onClose={onClose}
      width={620}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Mégsem
          </button>
          <button type="button" className="btn btn--primary" disabled={!changed} onClick={save}>
            Munkarend mentése
          </button>
        </>
      }
    >
      <div className="sched">
        {WORKDAYS.map((d) => {
          const r = rows[d]
          return (
            <div key={d} className={`sched__row ${r.on ? '' : 'is-off'}`}>
              <label className="sched__day">
                <input type="checkbox" checked={r.on} onChange={(e) => setRow(d, { on: e.target.checked })} />
                {WEEKDAY_LONG[d]}
              </label>
              {r.on ? (
                <div className="sched__times">
                  <select
                    className="input input--sm mono"
                    aria-label={`${WEEKDAY_LONG[d]} kezdés`}
                    value={r.start}
                    onChange={(e) => setRow(d, { start: e.target.value })}
                  >
                    {START_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="sched__dash">–</span>
                  <select
                    className="input input--sm mono"
                    aria-label={`${WEEKDAY_LONG[d]} befejezés`}
                    value={r.end}
                    onChange={(e) => setRow(d, { end: e.target.value })}
                  >
                    {END_OPTIONS.filter((t) => toMin(t) > toMin(r.start)).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="sched__off">Nem dolgozik</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="sched__foot">
        <button type="button" className="link-btn" onClick={copyFirstToAll}>
          Az első munkanap idejének másolása minden napra
        </button>
        <span className="field__hint">
          Ügyfélfogadás: {OPENING.start}–{OPENING.end}
        </span>
      </div>

      {absences.length > 0 && (
        <p className="field__hint sched__absences">
          Jelzett távollétek: {absences.map((a) => (a.note ? `${a.date} (${a.note})` : a.date)).join(', ')}
        </p>
      )}

      {error && <p className="field__error">{error}</p>}

      <AffectedBookings
        bookings={affected}
        title={`${affected.length} közelgő foglalás kívül esik az új munkarenden`}
        checked={rejectAffected}
        onChange={setRejectAffected}
      />
    </Modal>
  )
}
