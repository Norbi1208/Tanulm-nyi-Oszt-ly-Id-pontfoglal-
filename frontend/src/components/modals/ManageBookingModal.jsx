import { useApp } from '../../context/AppContext.jsx'
import Modal from '../Modal.jsx'
import Avatar from '../Avatar.jsx'

export default function ManageBookingModal({ booking, onClose, onReject }) {
  const { userName, caseTypeName, acceptBooking, toast } = useApp()
  const student = userName(booking.studentId)

  const accept = () => {
    acceptBooking(booking.id)
    toast(`${student} foglalása megerősítve.`)
    onClose()
  }

  return (
    <Modal
      title="Foglalás kezelése"
      subtitle="Ügyintézői megerősítés"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Mégsem
          </button>
          <button type="button" className="btn btn--danger" onClick={onReject}>
            <span aria-hidden="true">✕</span> Elutasítás
          </button>
          <button type="button" className="btn btn--primary" onClick={accept}>
            <span aria-hidden="true">✓</span> Elfogadás
          </button>
        </>
      }
    >
      <div className="summary">
        <div className="summary__who">
          <Avatar name={student} variant="soft" />
          <span>
            <span className="summary__name">{student}</span>
            <span className="summary__id mono">{booking.studentId}</span>
          </span>
        </div>
        <dl className="kv">
          <dt>Ügy:</dt>
          <dd>{caseTypeName(booking.caseTypeId)}</dd>
          <dt>Foglalt időpont:</dt>
          <dd className="mono">
            {booking.date} {booking.time}
          </dd>
        </dl>
      </div>
    </Modal>
  )
}
