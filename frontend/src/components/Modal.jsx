import { useEffect, useId, useRef } from 'react'

/**
 * Általános párbeszédablak. tone: 'brand' | 'danger' – a felső csík színe.
 */
export default function Modal({ title, subtitle, subtitleTone, tone = 'brand', onClose, footer, children, width = 560 }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Fókusz az első beviteli mezőre, különben magára az ablakra
    const first = dialogRef.current?.querySelector('input, select, textarea')
    ;(first ?? dialogRef.current)?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={`modal modal--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth: width }}
      >
        <div className="modal__head">
          <div>
            <h2 id={titleId} className="modal__title">
              {title}
            </h2>
            {subtitle && <p className={`modal__sub ${subtitleTone ? `modal__sub--${subtitleTone}` : ''}`}>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" aria-label="Bezárás" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  )
}
