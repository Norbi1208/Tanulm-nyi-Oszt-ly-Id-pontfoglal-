export default function Card({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card__head">
          <h2 className="card__title">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function TableWrap({ children }) {
  return <div className="table-wrap">{children}</div>
}

export function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="table__empty">
        {children}
      </td>
    </tr>
  )
}
