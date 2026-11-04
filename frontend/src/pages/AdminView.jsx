import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Card, { EmptyRow, TableWrap } from '../components/Card.jsx'
import AddClerkModal from '../components/modals/AddClerkModal.jsx'
import AddCaseTypeModal from '../components/modals/AddCaseTypeModal.jsx'
import CloseDaysModal from '../components/modals/CloseDaysModal.jsx'
import ScheduleModal from '../components/modals/ScheduleModal.jsx'
import ReopenDayModal from '../components/modals/ReopenDayModal.jsx'
import { scheduleSummary } from '../utils/availability.js'
import { monthKey, todayStr, weekdayName } from '../utils/date.js'
import { formatRange, groupClosedDays } from '../utils/closedDays.js'
import { STATUS_META, sortByStart } from '../utils/bookings.js'

export default function AdminView() {
  const { data, userName, caseTypeName, toggleClerk, toast } = useApp()
  const [modal, setModal] = useState(null) // 'clerk' | 'case' | 'closed' | { schedule: clerk } | { reopen: csoport }
  const [filter, setFilter] = useState('all')

  const today = todayStr()
  const month = monthKey(today)
  const closedGroups = groupClosedDays(data.closedDays.filter((c) => c.date >= today))
  const clerks = data.users.filter((u) => u.role === 'clerk')
  const absencesOf = (id) => data.clerkAbsences.filter((a) => a.clerkId === id && a.date >= today)
  const thisMonth = data.bookings.filter((b) => monthKey(b.date) === month)
  const bookings = sortByStart(filter === 'all' ? data.bookings : data.bookings.filter((b) => b.status === filter))

  const onToggle = (c) => {
    toggleClerk(c.id)
    toast(c.active ? `${c.name} inaktív lett, nem foglalható és nem tud belépni.` : `${c.name} újra aktív.`)
  }

  return (
    <>
      <PageHeader title="Adminisztrátor nézet" subtitle="Rendszer áttekintése és konfigurálás" />

      <div className="stats stats--4">
        <StatCard label="Összes foglalás" value={thisMonth.length} hint="ebben a hónapban" tone="brand" />
        <StatCard label="Ügyintézők" value={clerks.filter((c) => c.active).length} hint="aktív" tone="green" />
        <StatCard label="Ügytípusok" value={data.caseTypes.length} hint="aktív" tone="amber" />
        <StatCard
          label="Lemondások"
          value={thisMonth.filter((b) => b.status === 'cancelled').length}
          hint="ebben a hónapban"
          tone="red"
        />
      </div>

      <Card
        title="Ügyintézők"
        action={
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setModal('clerk')}>
            + Hozzáadás
          </button>
        }
      >
        <TableWrap>
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Név</th>
                <th>Azonosító</th>
                <th>Munkarend</th>
                <th>Közelgő távollét</th>
                <th>Státusz</th>
                <th>
                  <span className="sr-only">Műveletek</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {clerks.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="mono brand-text">{c.id}</td>
                  <td className="mono muted">{scheduleSummary(c.schedule)}</td>
                  <td className="muted">
                    {absencesOf(c.id).length === 0
                      ? '–'
                      : absencesOf(c.id)
                          .slice(0, 3)
                          .map((a) => (a.date === today ? 'ma' : a.date))
                          .join(', ') + (absencesOf(c.id).length > 3 ? ` +${absencesOf(c.id).length - 3}` : '')}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="badge-btn"
                      onClick={() => onToggle(c)}
                      title={c.active ? 'Kattints az inaktiváláshoz' : 'Kattints az aktiváláshoz'}
                    >
                      <StatusBadge status="x" label={c.active ? 'Aktív' : 'Inaktív'} tone={c.active ? 'green' : 'red'} />
                    </button>
                  </td>
                  <td className="actions">
                    <button type="button" className="link-btn" onClick={() => setModal({ schedule: c })}>
                      Munkarend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <div className="grid-2">
        <Card
          title="Ügytípusok"
          action={
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setModal('case')}>
              + Felvétel
            </button>
          }
        >
          <TableWrap>
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Megnevezés</th>
                  <th>Időtartam</th>
                </tr>
              </thead>
              <tbody>
                {data.caseTypes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.name}
                      {!c.clerkIds.some((id) => data.users.find((u) => u.id === id)?.active) && (
                        <span className="sub">Nincs aktív ügyintéző hozzárendelve, nem foglalható</span>
                      )}
                    </td>
                    <td>
                      <span className="tag mono">{c.duration} perc</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>

        <Card
          title="Lezárt napok"
          action={
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setModal('closed')}>
              + Nap lezárása
            </button>
          }
        >
          <TableWrap>
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Dátum</th>
                  <th>Nap</th>
                  <th>Ok</th>
                  <th>
                    <span className="sr-only">Műveletek</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {closedGroups.length === 0 && (
                  <EmptyRow colSpan={4}>Nincs lezárt nap, minden hétköznap foglalható.</EmptyRow>
                )}
                {closedGroups.map((g) => (
                  <tr key={g.key}>
                    <td className="mono">{formatRange(g)}</td>
                    <td className="muted">
                      {g.ids.length === 1
                        ? weekdayName(g.from)
                        : `${weekdayName(g.from)} – ${weekdayName(g.to)}, ${g.ids.length} munkanap`}
                    </td>
                    <td>{g.reason}</td>
                    <td className="actions">
                      <button type="button" className="link-btn" onClick={() => setModal({ reopen: g })}>
                        Feloldás
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>

      <Card
        title="Összes foglalás áttekintése"
        action={
          <label className="filter">
            <span className="sr-only">Szűrés állapotra</span>
            <select className="input input--sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Minden állapot</option>
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <TableWrap>
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Hallgató</th>
                <th>Neptun</th>
                <th>Ügy</th>
                <th>Dátum</th>
                <th>Idő</th>
                <th>Ügyintéző</th>
                <th>Állapot</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 && <EmptyRow colSpan={7}>Nincs a szűrésnek megfelelő foglalás.</EmptyRow>}
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{userName(b.studentId)}</td>
                  <td className="mono muted">{b.studentId}</td>
                  <td>{caseTypeName(b.caseTypeId)}</td>
                  <td className="mono">{b.date}</td>
                  <td className="mono brand-text">{b.time}</td>
                  <td className="muted">{userName(b.clerkId)}</td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {modal === 'clerk' && <AddClerkModal onClose={() => setModal(null)} />}
      {modal === 'case' && <AddCaseTypeModal onClose={() => setModal(null)} />}
      {modal === 'closed' && <CloseDaysModal onClose={() => setModal(null)} />}
      {modal?.schedule && <ScheduleModal clerk={modal.schedule} onClose={() => setModal(null)} />}
      {modal?.reopen && <ReopenDayModal group={modal.reopen} onClose={() => setModal(null)} />}
    </>
  )
}
