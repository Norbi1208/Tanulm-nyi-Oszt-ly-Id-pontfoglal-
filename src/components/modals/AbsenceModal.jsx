import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Modal from '../Modal.jsx'
import Field from '../Field.jsx'
import AffectedBookings from '../AffectedBookings.jsx'
import { addDays, todayStr, weekdayName } from '../../utils/date.js'
import { clerkDay, isUpcomingActive } from '../../utils/availability.js'
import { sortByStart } from '../../utils/bookings.js'

/** Első olyan nap a megadottól kezdve, amikor az ügyintéző be van osztva. */
function firstWorkingDay(clerk, from, absences) {
  let d = from
  for (let i = 0; i < 60; i++, d = addDays(d, 1)) {
    if (clerkDay(clerk, d, absences).working) return d
  }
  return from
}

export default function AbsenceModal({ initialDate, onClose }) {
  const { data, currentUser, addAbsence, toast } = useApp()
  const today = todayStr()
  const tomorrow = firstWorkingDay(currentUser, addDays(today, 1), data.clerkAbsences)

  const [date, setDate] = useState(() => initialDate ?? firstWorkingDay(currentUser, today, data.clerkAbsences))
  const [note, setNote] = useState('')
  const [rejectAffected, setRejectAffected] = useState(true)
  const [error, setError] = useState('')

  const day = clerkDay(currentUser, date, data.clerkAbsences)

  let dayError = ''
  if (!date) dayError = 'Válaszd ki a napot.'
  else if (date < today) dayError = 'Múltbeli napra nem jelezhető távollét.'
  else if (day.why === 'absent') dayError = 'Erre a napra már jelezted, hogy nem dolgozol.'
  else if (!day.working) dayError = 'Ezen a napon nem vagy beosztva, nincs mit jelezni.'

  const affected = useMemo(
    () =>
      sortByStart(data.bookings.filter((b) => b.clerkId === currentUser.id && b.date === date && isUpcomingActive(b))),
    [data.bookings, currentUser.id, date],
  )

  const valid = !dayError

  const pick = (d) => {
    setDate(d)
    setError('')
  }

  const submit = (e) => {
    e.preventDefault()
    if (!valid) return
    const res = addAbsence({ clerkId: currentUser.id, date, note, rejectAffected })
    if (!res.ok) return setError(res.error)
    const label = date === today ? 'Mára' : `${date} napra`
    const extra = res.affected ? ` ${res.affected} foglalás elutasítva, a hallgatók értesítést kaptak.` : ''
    toast(`${label} rögzítve, hogy nem dolgozol.${extra}`)
    onClose()
  }

  return (
    <Modal
      title="Távollét jelzése"
      subtitle="Ezen a napon a hallgatók nem foglalhatnak hozzád"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Mégsem
          </button>
          <button type="submit" form="absence" className="btn btn--primary" disabled={!valid}>
            Távollét mentése
          </button>
        </>
      }
    >
      <form id="absence" onSubmit={submit} noValidate>
        <Field label="Melyik napon nem dolgozol?" error={dayError}>
          {(a) => (
            <div className="date-picks">
              <input
                {...a}
                type="date"
                className="input mono"
                min={today}
                value={date}
                onChange={(e) => pick(e.target.value)}
              />
              <button type="button" className="chip-btn" aria-pressed={date === today} onClick={() => pick(today)}>
                Ma
              </button>
              <button type="button" className="chip-btn" aria-pressed={date === tomorrow} onClick={() => pick(tomorrow)}>
                Következő munkanap
              </button>
            </div>
          )}
        </Field>
        {!dayError && (
          <p className="field__hint range-summary">
            {date}, {weekdayName(date)}: a beosztásod {day.start}–{day.end}
          </p>
        )}

        <Field label="Megjegyzés (nem kötelező)" hint="Csak az adminisztrátor látja" error={error}>
          {(a) => (
            <input
              {...a}
              className="input"
              value={note}
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Pl.: szabadság, továbbképzés"
              autoComplete="off"
            />
          )}
        </Field>

        <AffectedBookings
          bookings={dayError ? [] : affected}
          title={`${affected.length} aktív foglalásod van erre a napra`}
          checked={rejectAffected}
          onChange={setRejectAffected}
        />
      </form>
    </Modal>
  )
}
