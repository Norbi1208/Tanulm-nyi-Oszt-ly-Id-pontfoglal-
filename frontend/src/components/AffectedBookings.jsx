import { useApp } from '../context/AppContext.jsx'
import { WarningIcon } from './Icons.jsx'

const MAX_LISTED = 5

/**
 * Figyelmeztetés a módosítás által érintett foglalásokról, választással:
 * elutasítja őket a rendszer (értesítéssel), vagy megmaradnak.
 */
export default function AffectedBookings({ bookings, title, checked, onChange, showClerk = false }) {
  const { userName, caseTypeName } = useApp()
  if (!bookings.length) return null

  return (
    <div className="warn-box">
      <p className="warn-box__title">
        <WarningIcon /> {title}
      </p>
      <ul className="warn-box__list">
        {bookings.slice(0, MAX_LISTED).map((b) => (
          <li key={b.id}>
            <span className="mono">
              {b.date} {b.time}
            </span>
            <span>{userName(b.studentId)}</span>
            <span className="warn-box__muted">
              {caseTypeName(b.caseTypeId)}
              {showClerk && `, ${userName(b.clerkId)}`}
            </span>
          </li>
        ))}
        {bookings.length > MAX_LISTED && (
          <li className="warn-box__muted">és további {bookings.length - MAX_LISTED} foglalás</li>
        )}
      </ul>
      <label className="check-line">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        Foglalások elutasítása, a hallgatók értesítést kapnak az okáról
      </label>
      {!checked && (
        <p className="warn-box__muted">A foglalások megmaradnak, ezeket külön kell kezelni.</p>
      )}
    </div>
  )
}
