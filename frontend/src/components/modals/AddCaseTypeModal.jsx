import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { DURATION_RANGE } from '../../config.js'
import Modal from '../Modal.jsx'
import Field from '../Field.jsx'

export default function AddCaseTypeModal({ onClose }) {
  const { data, addCaseType, toast } = useApp()
  const clerks = data.users.filter((u) => u.role === 'clerk')

  const [name, setName] = useState('')
  const [duration, setDuration] = useState(DURATION_RANGE.default)
  const [clerkIds, setClerkIds] = useState(() => clerks.filter((c) => c.active).map((c) => c.id))
  const [error, setError] = useState('')

  const duplicate = data.caseTypes.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())
  const valid = name.trim().length >= 3 && !duplicate

  const toggle = (id) => setClerkIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const pct = ((duration - DURATION_RANGE.min) / (DURATION_RANGE.max - DURATION_RANGE.min)) * 100

  const submit = (e) => {
    e.preventDefault()
    if (!valid) return
    const res = addCaseType({ name, duration, clerkIds })
    if (!res.ok) return setError(res.error)
    const note = clerkIds.some((id) => data.users.find((u) => u.id === id)?.active)
      ? 'a hallgatók már foglalhatnak rá.'
      : 'foglalni csak aktív ügyintéző hozzárendelése után lehet rá.'
    toast(`„${res.caseType.name}” felvéve, ${note}`)
    onClose()
  }

  return (
    <Modal
      title="Új ügytípus felvétele"
      subtitle="Azonnal elérhetővé válik a foglalási rendszerben"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Mégsem
          </button>
          <button type="submit" form="add-case" className="btn btn--primary" disabled={!valid}>
            Ügytípus mentése
          </button>
        </>
      }
    >
      <form id="add-case" onSubmit={submit} noValidate>
        <Field label="Ügytípus megnevezése" error={duplicate ? 'Ilyen nevű ügytípus már létezik.' : error}>
          {(a) => (
            <input
              {...a}
              className="input"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              placeholder="Pl.: Diákigazolvány matricázás"
              autoComplete="off"
            />
          )}
        </Field>

        <Field label="Becsült ügyintézési idő">
          {(a) => (
            <div className="range-row">
              <input
                {...a}
                type="range"
                className="range"
                min={DURATION_RANGE.min}
                max={DURATION_RANGE.max}
                step={DURATION_RANGE.step}
                value={duration}
                style={{ '--pct': `${pct}%` }}
                onChange={(e) => setDuration(Number(e.target.value))}
                aria-valuetext={`${duration} perc`}
              />
              <output className="range-value mono">{duration} p</output>
            </div>
          )}
        </Field>

        <fieldset className="field fieldset">
          <legend className="field__label">Hozzárendelt ügyintézők (opcionális)</legend>
          <div className="chips">
            {clerks.map((c) => (
              <label key={c.id} className={`check-chip ${c.active ? '' : 'is-inactive'}`}>
                <input type="checkbox" checked={clerkIds.includes(c.id)} onChange={() => toggle(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
