import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Modal from '../Modal.jsx'
import Field from '../Field.jsx'
import Avatar from '../Avatar.jsx'
import { isWeekend, nextWorkday, todayStr, addDays } from '../../utils/date.js'
import { endTime, getSlots } from '../../utils/slots.js'
import { formatRange, groupClosedDays } from '../../utils/closedDays.js'
import { clerkDay, weekdayPlural } from '../../utils/availability.js'

export default function BookingModal({ onClose }) {
  const { data, currentUser, usersById, createBooking, toast } = useApp()

  // Csak olyan ügytípus foglalható, amelyhez van aktív ügyintéző
  const caseTypes = useMemo(
    () => data.caseTypes.filter((c) => c.clerkIds.some((id) => usersById[id]?.active)),
    [data.caseTypes, usersById],
  )

  const [caseTypeId, setCaseTypeId] = useState(caseTypes[0]?.id ?? '')
  const caseType = caseTypes.find((c) => c.id === caseTypeId)
  const clerks = useMemo(
    () => (caseType ? caseType.clerkIds.map((id) => usersById[id]).filter((u) => u?.active) : []),
    [caseType, usersById],
  )

  const [clerkId, setClerkId] = useState('') // üres = automatikus választás
  const closedDays = data.closedDays
  const [date, setDate] = useState(() => {
    let d = nextWorkday(addDays(todayStr(), 1))
    while (closedDays.some((c) => c.date === d)) d = nextWorkday(addDays(d, 1))
    return d
  })
  const closedDay = closedDays.find((c) => c.date === date)
  const upcomingClosed = closedDays.filter((c) => c.date >= todayStr())
  const [time, setTime] = useState('')
  const [error, setError] = useState('')

  const absences = data.clerkAbsences
  const dayOf = (c) => clerkDay(c, date, absences)

  // Ha a hallgató még nem választott, az első olyan ügyintéző, aki aznap dolgozik
  const effectiveClerkId = clerks.some((c) => c.id === clerkId)
    ? clerkId
    : (clerks.find((c) => dayOf(c).working) ?? clerks[0])?.id ?? ''
  const clerk = clerks.find((c) => c.id === effectiveClerkId)
  const clerkToday = clerkDay(clerk, date, absences)

  const slots = useMemo(() => {
    if (!caseType || !clerk || !date || isWeekend(date) || closedDay || !clerkToday.working) return []
    return getSlots({
      bookings: data.bookings,
      clerkId: clerk.id,
      studentId: currentUser.id,
      date,
      duration: caseType.duration,
      hours: clerkToday,
    })
  }, [caseType, clerk, date, closedDay, clerkToday.working, clerkToday.start, clerkToday.end, data.bookings, currentUser.id])

  const freeCount = slots.filter((s) => s.available).length

  const changeCase = (id) => {
    setCaseTypeId(id)
    setTime('')
    setError('')
  }
  const changeClerk = (id) => {
    setClerkId(id)
    setTime('')
    setError('')
  }
  const changeDate = (value) => {
    setDate(value)
    setTime('')
    setError('')
  }

  const submit = () => {
    const res = createBooking({ caseTypeId, clerkId: effectiveClerkId, date, time })
    if (!res.ok) {
      setError(res.error)
      setTime('')
      return
    }
    toast('Foglalás elküldve. Az ügyintéző megerősítése után lesz végleges.')
    onClose()
  }

  let slotMessage = null
  if (!caseTypes.length) slotMessage = 'Jelenleg egyik ügytípushoz sincs elérhető ügyintéző.'
  else if (!date) slotMessage = 'Válassz dátumot.'
  else if (date < todayStr()) slotMessage = 'Múltbeli napra nem lehet foglalni.'
  else if (isWeekend(date)) slotMessage = 'Hétvégén nincs ügyfélfogadás. Válassz egy hétköznapot.'
  else if (closedDay)
    slotMessage = `Ezen a napon a Tanulmányi Osztály zárva tart (${closedDay.reason}). Válassz másik napot.`
  else if (clerk && clerkToday.why === 'absent')
    slotMessage = `${clerk.name} ezen a napon nem elérhető. Válassz másik napot vagy ügyintézőt.`
  else if (clerk && !clerkToday.working)
    slotMessage = `${clerk.name} ${weekdayPlural(date)} nem fogad hallgatókat. Válassz másik napot vagy ügyintézőt.`
  else if (!freeCount) slotMessage = 'Erre a napra ennél az ügyintézőnél nincs szabad időpont.'

  return (
    <Modal
      title="Időpont foglalása"
      subtitle="Válassz ügyet, ügyintézőt, dátumot és időpontot"
      onClose={onClose}
      width={640}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Mégsem
          </button>
          <button type="button" className="btn btn--primary" disabled={!time} onClick={submit}>
            Foglalás mentése
          </button>
        </>
      }
    >
      <Field label="Elintézendő ügy">
        {(a) => (
          <select {...a} className="input" value={caseTypeId} onChange={(e) => changeCase(e.target.value)}>
            {caseTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.duration} perc)
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="field">
        <span className="field__label" id="clerk-label">
          Ügyintéző kiválasztása
        </span>
        <div className="choice-grid" role="radiogroup" aria-labelledby="clerk-label">
          {clerks.map((c) => {
            const selected = c.id === effectiveClerkId
            const d = dayOf(c)
            const hoursText =
              !date || isWeekend(date) || closedDay
                ? null
                : d.working
                  ? `${d.start}–${d.end}`
                  : d.why === 'absent'
                    ? 'Ezen a napon nem elérhető'
                    : 'Ezen a napon nem fogad'
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`choice ${selected ? 'is-selected' : ''} ${hoursText && !d.working ? 'is-unavailable' : ''}`}
                onClick={() => changeClerk(c.id)}
              >
                <Avatar name={c.name} variant={selected ? 'solid' : 'muted'} />
                <span className="choice__text">
                  <span className="choice__name">{c.name}</span>
                  <span className="choice__id mono">{c.id}</span>
                  {hoursText && <span className="choice__hours">{hoursText}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <Field label="Dátum" hint={closedHint(upcomingClosed)}>
        {(a) => (
          <input
            {...a}
            type="date"
            className="input mono"
            value={date}
            min={todayStr()}
            onChange={(e) => changeDate(e.target.value)}
          />
        )}
      </Field>

      <div className="field">
        <span className="field__label" id="slots-label">
          Elérhető időpontok
        </span>
        {slotMessage ? (
          <p className="slots-empty">{slotMessage}</p>
        ) : (
          <div className="slots" role="group" aria-labelledby="slots-label">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                className="slot mono"
                disabled={!s.available}
                aria-pressed={time === s.time}
                title={s.reason ?? `${s.time}–${endTime(s.time, caseType.duration)}`}
                onClick={() => {
                  setTime(s.time)
                  setError('')
                }}
              >
                {s.time}
              </button>
            ))}
          </div>
        )}
        {error ? (
          <p className="field__error">{error}</p>
        ) : (
          !slotMessage && (
            <p className="field__hint">
              {time
                ? `Kiválasztva: ${date}, ${time}–${endTime(time, caseType.duration)}`
                : 'Kattints egy szabad időpontra'}
            </p>
          )
        )}
      </div>
    </Modal>
  )
}

function closedHint(list) {
  const groups = groupClosedDays(list)
  if (!groups.length) return ''
  const shown = groups.slice(0, 3).map((g) => `${formatRange(g)} (${g.reason})`)
  const more = groups.length > 3 ? `, és további ${groups.length - 3} időszak` : ''
  return `Zárva: ${shown.join(', ')}${more}`
}
