import { useId } from 'react'

export default function Field({ label, error, hint, children }) {
  const id = useId()
  const msgId = `${id}-msg`
  const child = typeof children === 'function' ? children({ id, 'aria-describedby': error || hint ? msgId : undefined, 'aria-invalid': !!error }) : children
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {child}
      {(error || hint) && (
        <p id={msgId} className={error ? 'field__error' : 'field__hint'}>
          {error || hint}
        </p>
      )}
    </div>
  )
}
