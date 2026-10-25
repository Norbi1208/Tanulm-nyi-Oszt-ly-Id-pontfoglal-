export default function Avatar({ name, variant = 'soft', size }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <span className={`avatar avatar--${variant}`} style={size ? { width: size, height: size } : undefined} aria-hidden="true">
      {initial}
    </span>
  )
}
