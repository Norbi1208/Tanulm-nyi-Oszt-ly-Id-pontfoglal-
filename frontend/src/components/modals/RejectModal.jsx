import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Modal from '../Modal.jsx'
import Field from '../Field.jsx'

export default function RejectModal({ booking, onBack, onClose }) {
  const { rejectBooking, userName, toast } = useApp()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    const res = rejectBooking(booking.id, reason)
    if (!res.ok) return setError(res.error)
    toast(`${userName(booking.studentId)} foglalása elutasítva. A hallgató látja az indoklást.`)
    onClose()
  }

  return (
    <Modal
      title="Elutasítás oka"
      subtitle="A hallgató értesítést kap az elutasítás okáról"
      subtitleTone="brand"
      tone="danger"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Vissza
          </button>
          <button type="button" className="btn btn--danger" disabled={!reason.trim()} onClick={submit}>
            Elutasítás véglegesítése
          </button>
        </>
      }
    >
      <Field label="Elutasítás indoklása" error={error}>
        {(a) => (
          <textarea
            {...a}
            className="input textarea"
            rows={4}
            maxLength={500}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setError('')
            }}
            placeholder="Pl.: A megadott időpontban nem áll rendelkezésre ügyintéző. Kérjük, foglaljon másik időpontot."
          />
        )}
      </Field>
    </Modal>
  )
}
