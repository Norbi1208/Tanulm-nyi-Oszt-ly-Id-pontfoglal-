import { useApp } from '../../context/AppContext.jsx'
import Modal from '../Modal.jsx'
import { WarningIcon } from '../Icons.jsx'

export default function CancelModal({ booking, onClose }) {
  const { caseTypeName, cancelBooking, toast } = useApp()

  const confirm = () => {
    const res = cancelBooking(booking.id)
    toast(res.ok ? 'Foglalás lemondva. Az időpont újra szabad.' : res.error, res.ok ? 'success' : 'error')
    onClose()
  }

  return (
    <Modal
      title="Időpont lemondása"
      subtitle="Ez a művelet nem vonható vissza"
      tone="danger"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Nem, megtartom
          </button>
          <button type="button" className="btn btn--danger" onClick={confirm}>
            Igen, lemondom
          </button>
        </>
      }
    >
      <div className="danger-box">
        <p className="danger-box__title">
          <WarningIcon /> Lemondásra kerülő időpont
        </p>
        <dl className="kv">
          <dt>Ügy:</dt>
          <dd>{caseTypeName(booking.caseTypeId)}</dd>
          <dt>Dátum:</dt>
          <dd className="mono">{booking.date}</dd>
          <dt>Időpont:</dt>
          <dd className="mono">{booking.time}</dd>
        </dl>
      </div>
      <p className="modal__text">
        Biztosan le szeretnéd mondani a foglalást? A lemondott időpont más hallgatók számára elérhetővé válik.
      </p>
    </Modal>
  )
}
