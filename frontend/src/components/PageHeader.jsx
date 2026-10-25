import { now, semesterOf, todayStr } from '../utils/date.js'

export default function PageHeader({ title, subtitle }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-head__title">{title}</h1>
        <p className="page-head__sub">{subtitle}</p>
      </div>
      <span className="date-pill mono">
        {todayStr()} · {semesterOf(now()).label}
      </span>
    </div>
  )
}
