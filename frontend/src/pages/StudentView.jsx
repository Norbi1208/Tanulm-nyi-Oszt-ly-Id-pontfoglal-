import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Card, { EmptyRow, TableWrap } from '../components/Card.jsx'
import BookingModal from '../components/modals/BookingModal.jsx'
import CancelModal from '../components/modals/CancelModal.jsx'
import { now, semesterOf } from '../utils/date.js'
import { bookingStart, canCancel, isActive, sortByStart } from '../utils/bookings.js'
import { CANCEL_LIMIT_HOURS } from '../config.js'

export default function StudentView() {
  const { data, currentUser, userName, caseTypeName, dismissNotice } = useApp()
  const [showNew, setShowNew] = useState(false)
  const [toCancel, setToCancel] = useState(null)

  const n = now()
  const sem = semesterOf(n)
  const mine = sortByStart(data.bookings.filter((b) => b.studentId === currentUser.id))
  const upcoming = mine.filter((b) => isActive(b) && bookingStart(b) >= n).length
  const cancelled = mine.filter((b) => b.status === 'cancelled' && b.date >= sem.start && b.date <= sem.end).length
  const notices = mine.filter((b) => b.status === 'rejected' && !b.studentNotified)

  return (
    <>
      <PageHeader title="Hallgató nézet" subtitle="Foglalj időpontot a Tanulmányi Osztályra" />

      <div className="stats stats--3">
        <StatCard label="Összes foglalás" value={mine.length} hint="saját fiók" tone="brand" />
        <StatCard label="Közelgő" value={upcoming} hint="aktív időpont" tone="brand-dark" />
        <StatCard label="Lemondott" value={cancelled} hint="ebben a félévben" tone="red" />
      </div>

      {notices.map((b) => (
        <div key={b.id} className="notice" role="alert">
          <div>
            <p className="notice__title">
              Elutasított foglalás: {caseTypeName(b.caseTypeId)}, <span className="mono">{b.date} {b.time}</span>
            </p>
            <p className="notice__text">Indoklás: {b.rejectReason}</p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => dismissNotice(b.id)}>
            Rendben
          </button>
        </div>
      ))}

      <Card
        title="Foglalásaim"
        action={
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowNew(true)}>
            + Új foglalás
          </button>
        }
      >
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Ügy</th>
                <th>Dátum</th>
                <th>Időpont</th>
                <th>Ügyintéző</th>
                <th>Állapot</th>
                <th>
                  <span className="sr-only">Műveletek</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {mine.length === 0 && (
                <EmptyRow colSpan={6}>Még nincs foglalásod. Az „Új foglalás” gombbal kérhetsz időpontot.</EmptyRow>
              )}
              {mine.map((b) => (
                <tr key={b.id}>
                  <td className="strong">{caseTypeName(b.caseTypeId)}</td>
                  <td className="mono">{b.date}</td>
                  <td className="mono">{b.time}</td>
                  <td className="muted">{userName(b.clerkId)}</td>
                  <td>
                    <StatusBadge status={b.status} />
                    {b.status === 'rejected' && b.rejectReason && <p className="cell-note">{b.rejectReason}</p>}
                  </td>
                  <td className="actions">
                    {canCancel(b) ? (
                      <button type="button" className="link-btn link-btn--danger" onClick={() => setToCancel(b)}>
                        Lemondás
                      </button>
                    ) : (
                      isActive(b) &&
                      bookingStart(b) > n && (
                        <span className="cell-note" title={`Lemondani legkésőbb ${CANCEL_LIMIT_HOURS} órával előtte lehet`}>
                          Már nem mondható le
                        </span>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <aside className="info">
        <p className="info__title">Tájékoztató</p>
        <p>Időpontot legkésőbb {CANCEL_LIMIT_HOURS} órával a tervezett időpont előtt lehet lemondani.</p>
      </aside>

      {showNew && <BookingModal onClose={() => setShowNew(false)} />}
      {toCancel && <CancelModal booking={toCancel} onClose={() => setToCancel(null)} />}
    </>
  )
}
