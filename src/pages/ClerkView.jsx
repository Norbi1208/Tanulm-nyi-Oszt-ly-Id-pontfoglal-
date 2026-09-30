import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Card, { EmptyRow, TableWrap } from '../components/Card.jsx'
import ManageBookingModal from '../components/modals/ManageBookingModal.jsx'
import RejectModal from '../components/modals/RejectModal.jsx'
import { todayStr } from '../utils/date.js'
import { isActive, sortByStart } from '../utils/bookings.js'

export default function ClerkView() {
  const { data, currentUser, userName, caseTypeName } = useApp()
  const [managing, setManaging] = useState(null) // { booking, step: 'manage' | 'reject' }

  const today = todayStr()
  const mine = sortByStart(data.bookings.filter((b) => b.clerkId === currentUser.id))
  const pending = mine.filter((b) => b.status === 'pending')
  const decided = mine.filter((b) => b.status !== 'pending')
  const todayCount = mine.filter((b) => b.date === today && isActive(b)).length
  const confirmedCount = mine.filter((b) => b.status === 'confirmed').length

  const close = () => setManaging(null)

  return (
    <>
      <PageHeader title="Ügyintéző nézet" subtitle="Kezelj és erősíts meg hallgatói foglalásokat" />

      <div className="stats stats--3">
        <StatCard label="Függőben" value={pending.length} hint="megerősítésre vár" tone="amber" />
        <StatCard label="Ma" value={todayCount} hint="mai időpont" tone="brand" />
        <StatCard label="Megerősítve" value={confirmedCount} hint="összes" tone="green" />
      </div>

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
