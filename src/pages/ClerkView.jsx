import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Card, { EmptyRow, TableWrap } from '../components/Card.jsx'
import ManageBookingModal from '../components/modals/ManageBookingModal.jsx'
import RejectModal from '../components/modals/RejectModal.jsx'
import AbsenceModal from '../components/modals/AbsenceModal.jsx'
import { todayStr, weekdayName } from '../utils/date.js'
import { WEEKDAY_LONG, WORKDAYS, clerkDay, weekdayOf } from '../utils/availability.js'
import { isActive, sortByStart } from '../utils/bookings.js'

export default function ClerkView() {
  const { data, currentUser, userName, caseTypeName, removeAbsence, toast } = useApp()
  const [managing, setManaging] = useState(null) // { booking, step: 'manage' | 'reject' }
  const [absenceFor, setAbsenceFor] = useState(null) // null | { initialDate }

  const today = todayStr()
  const mine = sortByStart(data.bookings.filter((b) => b.clerkId === currentUser.id))
  const pending = mine.filter((b) => b.status === 'pending')
  const decided = mine.filter((b) => b.status !== 'pending')
  const todayCount = mine.filter((b) => b.date === today && isActive(b)).length
  const confirmedCount = mine.filter((b) => b.status === 'confirmed').length

  const close = () => setManaging(null)

  const todayStatus = clerkDay(currentUser, today, data.clerkAbsences)
  const todayWeekday = weekdayOf(today)
  const myAbsences = data.clerkAbsences.filter((a) => a.clerkId === currentUser.id && a.date >= today)

  const undoAbsence = (a) => {
    removeAbsence(a.id)
    toast(`${a.date === today ? 'Mára' : a.date} visszavonva, újra foglalható vagy.`)
  }

  return (
    <>
      <PageHeader title="Ügyintéző nézet" subtitle="Kezelj és erősíts meg hallgatói foglalásokat" />

      <div className="stats stats--3">
        <StatCard label="Függőben" value={pending.length} hint="megerősítésre vár" tone="amber" />
        <StatCard label="Ma" value={todayCount} hint="mai időpont" tone="brand" />
        <StatCard label="Megerősítve" value={confirmedCount} hint="összes" tone="green" />
      </div>

      {todayStatus.why === 'absent' && (
        <div className="info info--amber">
          <p className="info__title">Mára jelezted, hogy nem dolgozol</p>
          <p>A hallgatók ma nem foglalhatnak hozzád. Ha mégis bent vagy, a Munkarendem kártyán visszavonhatod.</p>
        </div>
      )}

      <Card title="Megerősítésre váró foglalások">
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Hallgató</th>
                <th>Neptun</th>
                <th>Ügy</th>
                <th>Dátum</th>
                <th>Idő</th>
                <th>Műveletek</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 && <EmptyRow colSpan={6}>Nincs megerősítésre váró foglalás.</EmptyRow>}
              {pending.map((b) => (
                <tr key={b.id}>
                  <td className="strong">{userName(b.studentId)}</td>
                  <td className="mono muted">{b.studentId}</td>
                  <td>{caseTypeName(b.caseTypeId)}</td>
                  <td className="mono">{b.date}</td>
                  <td className="mono">{b.time}</td>
                  <td>
                    <button type="button" className="link-btn" onClick={() => setManaging({ booking: b, step: 'manage' })}>
                      Kezelés →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card
        title="Munkarendem"
        action={
          <div className="card__actions">
            {todayStatus.working && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAbsenceFor({ initialDate: today })}>
                Ma mégsem dolgozom
              </button>
            )}
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setAbsenceFor({})}>
              + Távollét jelzése
            </button>
          </div>
        }
      >
        <div className="workplan">
          <div>
            <h3 className="workplan__title">Heti beosztás</h3>
            <ul className="workplan__week">
              {WORKDAYS.map((d) => {
                const h = currentUser.schedule?.[d]
                return (
                  <li key={d} className={d === todayWeekday ? 'is-today' : undefined}>
                    <span>{WEEKDAY_LONG[d]}</span>
                    <span className={h ? 'mono' : 'workplan__off'}>{h ? `${h.start}–${h.end}` : 'Nem dolgozik'}</span>
                  </li>
                )
              })}
            </ul>
            <p className="field__hint">A heti beosztást az adminisztrátor állítja be.</p>
          </div>
          <div>
            <h3 className="workplan__title">Jelzett távollétek</h3>
            {myAbsences.length === 0 ? (
              <p className="workplan__empty">Nincs jelzett távolléted. Ha egy napon mégsem dolgozol, itt jelezheted.</p>
            ) : (
              <ul className="workplan__absences">
                {myAbsences.map((a) => (
                  <li key={a.id}>
                    <span>
                      <span className="mono">{a.date}</span>{' '}
                      <span className="workplan__muted">
                        {a.date === today ? 'ma' : weekdayName(a.date)}
                        {a.note && `, ${a.note}`}
                      </span>
                    </span>
                    <button type="button" className="link-btn" onClick={() => undoAbsence(a)}>
                      Visszavonás
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card title="Összes foglalás">
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Hallgató</th>
                <th>Ügy</th>
                <th>Dátum</th>
                <th>Idő</th>
                <th>Állapot</th>
              </tr>
            </thead>
            <tbody>
              {decided.length === 0 && <EmptyRow colSpan={5}>Még nincs elbírált foglalásod.</EmptyRow>}
              {decided.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="strong">{userName(b.studentId)}</span>
                    <span className="sub mono">{b.studentId}</span>
                  </td>
                  <td>{caseTypeName(b.caseTypeId)}</td>
                  <td className="mono">{b.date}</td>
                  <td className="mono">{b.time}</td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {absenceFor && <AbsenceModal initialDate={absenceFor.initialDate} onClose={() => setAbsenceFor(null)} />}

      {managing?.step === 'manage' && (
        <ManageBookingModal
          booking={managing.booking}
          onClose={close}
          onReject={() => setManaging({ booking: managing.booking, step: 'reject' })}
        />
      )}
      {managing?.step === 'reject' && (
        <RejectModal
          booking={managing.booking}
          onClose={close}
          onBack={() => setManaging({ booking: managing.booking, step: 'manage' })}
        />
      )}
    </>
  )
}
