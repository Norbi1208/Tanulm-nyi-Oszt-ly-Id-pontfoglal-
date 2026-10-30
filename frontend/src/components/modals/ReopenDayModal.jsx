import { useApp } from '../../context/AppContext.jsx'
import Modal from '../Modal.jsx'
import { weekdayName } from '../../utils/date.js'
import { formatRange } from '../../utils/closedDays.js'

/** Megerősítés egy lezárt nap (vagy összefüggő időszak) feloldása előtt. */
export default function ReopenDayModal({ group, onClose }) {
  const { removeClosedDays, toast } = useApp()
  const single = group.ids.length === 1

  const confirm = () => {
    removeClosedDays(group.ids)
    toast(single ? `${group.from} újra foglalható.` : `${formatRange(group)} újra foglalható (${group.ids.length} nap).`)
    onClose()
  }

  return (
    <Modal
      title={single ? 'Lezárt nap feloldása' : 'Lezárt időszak feloldása'}
      subtitle={`A hallgatók újra foglalhatnak ${single ? "erre a napra" : "ezekre a napokra"}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Mégsem
          </button>
          <button type="button" className="btn btn--primary" onClick={confirm}>
            Igen, feloldom
          </button>
        </>
      }
    >
      <div className="summary">
        <dl className="kv">
          <dt>{single ? 'Dátum:' : 'Időszak:'}</dt>
          <dd className="mono">{formatRange(group)}</dd>
          <dt>Nap:</dt>
          <dd>
            {single
              ? weekdayName(group.from)
              : `${weekdayName(group.from)} – ${weekdayName(group.to)}, ${group.ids.length} munkanap`}
          </dd>
          <dt>Lezárás oka:</dt>
          <dd>{group.reason}</dd>
        </dl>
      </div>
      <p className="modal__text">
        Biztosan feloldod {single ? 'ezt a napot' : 'ezt az időszakot'}? A lezárás miatt korábban elutasított foglalások
        nem állnak vissza, a hallgatóknak újra kell foglalniuk.
      </p>
    </Modal>
  )
}
