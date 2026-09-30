import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Modal from '../Modal.jsx'
import Field from '../Field.jsx'
import Avatar from '../Avatar.jsx'
import { isWeekend, nextWorkday, todayStr, addDays } from '../../utils/date.js'
import { endTime, getSlots } from '../../utils/slots.js'

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

  const [clerkId, setClerkId] = useState(clerks[0]?.id ?? '')
  const [date, setDate] = useState(() => nextWorkday(addDays(todayStr(), 1)))
  const [time, setTime] = useState('')
  const [error, setError] = useState('')

  const effectiveClerkId = clerks.some((c) => c.id === clerkId) ? clerkId : clerks[0]?.id ?? ''

  const slots = useMemo(() => {
    if (!caseType || !effectiveClerkId || !date || isWeekend(date)) return []
    return getSlots({
      bookings: data.bookings,
      clerkId: effectiveClerkId,
      studentId: currentUser.id,
      date,
      duration: caseType.duration,
    })
  }, [caseType, effectiveClerkId, date, data.bookings, currentUser.id])

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
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`choice ${selected ? 'is-selected' : ''}`}
                onClick={() => changeClerk(c.id)}
              >
                <Avatar name={c.name} variant={selected ? 'solid' : 'muted'} />
                <span className="choice__text">
                  <span className="choice__name">{c.name}</span>
                  <span className="choice__id mono">{c.id}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <Field label="Dátum">
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
