import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Modal from '../Modal.jsx'
import Field from '../Field.jsx'

export default function AddClerkModal({ onClose }) {
  const { data, addClerk, toast } = useApp()
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const suggestedId = useMemo(() => {
    const nums = data.users
      .map((u) => /^UGY-(\d+)$/.exec(u.id)?.[1])
      .filter(Boolean)
      .map(Number)
    return `UGY-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`
  }, [data.users])

  const cleanId = id.trim().toUpperCase()
  const idTaken = cleanId && data.users.some((u) => u.id.toUpperCase() === cleanId)
  const idInvalid = cleanId && !/^[A-Z0-9-]{3,20}$/.test(cleanId)
  const pwShort = password.length > 0 && password.length < 8

  const valid = name.trim().length >= 3 && cleanId && !idTaken && !idInvalid && password.length >= 8

  const submit = (e) => {
    e.preventDefault()
    if (!valid) return
    const res = addClerk({ name, id: cleanId, password })
    if (!res.ok) return setError(res.error)
    toast(`${res.user.name} (${res.user.id}) hozzáadva, a fiók aktív.`)
    onClose()
  }

  return (
    <Modal
      title="Új ügyintéző hozzáadása"
      subtitle="Az ügyintéző azonnal aktívvá válik"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Mégsem
          </button>
          <button type="submit" form="add-clerk" className="btn btn--primary" disabled={!valid}>
            Ügyintéző hozzáadása
          </button>
        </>
      }
    >
      <form id="add-clerk" onSubmit={submit} noValidate>
        <Field label="Teljes név">
          {(a) => (
            <input {...a} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pl.: Minta Péter" autoComplete="off" />
          )}
        </Field>
        <Field
          label="Egyedi azonosító"
          error={idTaken ? 'Ez az azonosító már foglalt.' : idInvalid ? 'Csak betű, szám és kötőjel, 3–20 karakter.' : ''}
        >
          {(a) => (
            <input
              {...a}
              className="input input--upper"
              value={id}
              onChange={(e) => setId(e.target.value.toUpperCase())}
              placeholder={`Pl.: ${suggestedId}`}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Ideiglenes jelszó" error={pwShort ? 'Legalább 8 karakter szükséges.' : ''}>
          {(a) => (
            <input
              {...a}
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 karakter"
              autoComplete="new-password"
            />
          )}
        </Field>
        {error && <p className="field__error">{error}</p>}
      </form>
    </Modal>
  )
}
