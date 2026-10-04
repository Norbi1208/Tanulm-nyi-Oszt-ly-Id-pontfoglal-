import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Modal from '../Modal.jsx'
import Field from '../Field.jsx'
import AffectedBookings from '../AffectedBookings.jsx'
import { addDays, datesBetween, isWeekend, nextWorkday, todayStr, weekdayName } from '../../utils/date.js'
import { isActive, sortByStart } from '../../utils/bookings.js'

const MAX_DAYS = 92

export default function CloseDaysModal({ onClose }) {
  const { data, addClosedDays, toast } = useApp()
  const today = todayStr()

  const [mode, setMode] = useState('single') // 'single' | 'range'
  const [from, setFrom] = useState(() => nextWorkday(addDays(today, 1)))
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [cancelAffected, setCancelAffected] = useState(true)
  const [error, setError] = useState('')

  const end = mode === 'single' ? from : to

  const { newDates, rangeError, skippedWeekend, alreadyClosed } = useMemo(() => {
    const empty = { newDates: [], rangeError: '', skippedWeekend: 0, alreadyClosed: 0 }
    if (!from || !end) return empty
    if (from < today) return { ...empty, rangeError: 'Múltbeli nap nem zárható le.' }
    if (end < from) return { ...empty, rangeError: 'Az utolsó nap nem lehet a kezdő nap előtt.' }

    const all = datesBetween(from, end)
    if (all.length > MAX_DAYS) return { ...empty, rangeError: 'Egyszerre legfeljebb 3 hónap zárható le.' }

    const closed = new Set(data.closedDays.map((c) => c.date))
    const workdays = all.filter((d) => !isWeekend(d))
    const fresh = workdays.filter((d) => !closed.has(d))

    let msg = ''
    if (mode === 'single' && isWeekend(from)) msg = 'Hétvégén egyébként sincs ügyfélfogadás.'
    else if (mode === 'single' && closed.has(from)) msg = 'Ez a nap már le van zárva.'
    else if (!fresh.length) msg = 'Az időszak minden munkanapja le van már zárva.'

    return {
      newDates: fresh,
      rangeError: msg,
      skippedWeekend: all.length - workdays.length,
      alreadyClosed: workdays.length - fresh.length,
    }
  }, [from, end, mode, today, data.closedDays])

  const affected = useMemo(() => {
    const set = new Set(newDates)
    return sortByStart(data.bookings.filter((b) => set.has(b.date) && isActive(b)))
  }, [newDates, data.bookings])

  const valid = newDates.length > 0 && !rangeError && reason.trim().length >= 3

  const switchMode = (next) => {
    setMode(next)
    setTo(next === 'range' ? from : '')
    setError('')
  }

  const submit = (e) => {
    e.preventDefault()
    if (!valid) return
    const res = addClosedDays({ dates: newDates, reason, cancelAffected })
    if (!res.ok) return setError(res.error)
    const days = res.added === 1 ? `${newDates[0]} lezárva.` : `${res.added} nap lezárva.`
    const extra = res.affected ? ` ${res.affected} foglalás elutasítva, a hallgatók értesítést kaptak.` : ''
    toast(days + extra)
    onClose()
  }

  let summary = ''
  if (mode === 'range' && newDates.length && !rangeError) {
    const notes = []
    if (skippedWeekend) notes.push(`${skippedWeekend} hétvégi nap kimarad`)
    if (alreadyClosed) notes.push(`${alreadyClosed} nap már zárva volt`)
    summary = `${newDates.length} munkanap kerül lezárásra${notes.length ? ` (${notes.join(', ')})` : ''}.`
  } else if (mode === 'single' && newDates.length && !rangeError) {
    summary = `${from}, ${weekdayName(from)}`
  }

  return (
    <Modal
      title="Nap lezárása"
      subtitle="A lezárt napokra a hallgatók nem tudnak foglalni"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Mégsem
          </button>
          <button type="submit" form="close-days" className="btn btn--primary" disabled={!valid}>
            {mode === 'range' && newDates.length > 1 ? `${newDates.length} nap lezárása` : 'Nap lezárása'}
          </button>
        </>
      }
    >
      <form id="close-days" onSubmit={submit} noValidate>
        <div className="segmented" role="radiogroup" aria-label="Lezárás módja">
          <button type="button" role="radio" aria-checked={mode === 'single'} onClick={() => switchMode('single')}>
            Egy nap
          </button>
          <button type="button" role="radio" aria-checked={mode === 'range'} onClick={() => switchMode('range')}>
            Időszak
          </button>
        </div>

        <div className={mode === 'range' ? 'field-row' : undefined}>
          <Field label={mode === 'range' ? 'Első nap' : 'Dátum'}>
            {(a) => (
              <input
                {...a}
                type="date"
                className="input mono"
                min={today}
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  if (mode === 'range' && (!to || to < e.target.value)) setTo(e.target.value)
                  setError('')
                }}
              />
            )}
          </Field>
          {mode === 'range' && (
            <Field label="Utolsó nap">
              {(a) => (
                <input
                  {...a}
                  type="date"
                  className="input mono"
                  min={from || today}
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value)
                    setError('')
                  }}
                />
              )}
            </Field>
          )}
        </div>
        {(rangeError || summary) && (
          <p className={rangeError ? 'field__error range-summary' : 'field__hint range-summary'}>{rangeError || summary}</p>
        )}

        <Field label="Ok (a hallgatók is látják)" error={error}>
          {(a) => (
            <input
              {...a}
              className="input"
              value={reason}
              maxLength={120}
              onChange={(e) => {
                setReason(e.target.value)
                setError('')
              }}
              placeholder="Pl.: Nemzeti ünnep, belső képzés, leltár"
              autoComplete="off"
            />
          )}
        </Field>

        <AffectedBookings
          bookings={affected}
          title={`${affected.length} aktív foglalás esik ${newDates.length > 1 ? 'ezekre a napokra' : 'erre a napra'}`}
          checked={cancelAffected}
          onChange={setCancelAffected}
          showClerk
        />
      </form>
    </Modal>
  )
}
