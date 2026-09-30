import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Card, { EmptyRow, TableWrap } from '../components/Card.jsx'
import AddClerkModal from '../components/modals/AddClerkModal.jsx'
import AddCaseTypeModal from '../components/modals/AddCaseTypeModal.jsx'
import { monthKey, todayStr } from '../utils/date.js'
import { STATUS_META, sortByStart } from '../utils/bookings.js'

export default function AdminView() {
  const { data, userName, caseTypeName, toggleClerk, toast } = useApp()
  const [modal, setModal] = useState(null) // 'clerk' | 'case'
  const [filter, setFilter] = useState('all')

  const month = monthKey(todayStr())
  const clerks = data.users.filter((u) => u.role === 'clerk')
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

      <div className="grid-2">
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
                  <th>Státusz</th>
                </tr>
              </thead>
              <tbody>
                {clerks.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="mono brand-text">{c.id}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>

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
    </>
  )
}
