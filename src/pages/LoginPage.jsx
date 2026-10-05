import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import Field from '../components/Field.jsx'
import { EyeIcon } from '../components/Icons.jsx'
import logoUrl from '../assets/sze-logo.png'

const DEMO_ACCOUNTS = [
  { id: 'ABC123', password: 'hallgato', role: 'Hallgató' },
  { id: 'UGY-001', password: 'ugyintező', role: 'Ügyintéző' },
  { id: 'ADM-001', password: 'admin', role: 'Admin' },
]

export default function LoginPage() {
  const { login, resetDemo } = useApp()
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const res = login(id, password)
    if (!res.ok) setError(res.error)
  }

  const fill = (acc) => {
    setId(acc.id)
    setPassword(acc.password)
    setError('')
  }

  return (
    <div className="login">
      <img className="login__logo" src={logoUrl} alt="Széchenyi István Egyetem – University of Győr" />
      <h1 className="login__title">Bejelentkezés</h1>
      <p className="login__sub">Azonosítóddal és jelszóddal</p>

      <form className="login__card" onSubmit={submit} noValidate>
        <Field label="Azonosító (Neptun-kód / Egyedi azonosító)">
          {(a) => (
            <input
              {...a}
              className="input input--lg input--upper"
              value={id}
              onChange={(e) => {
                setId(e.target.value.toUpperCase())
                setError('')
              }}
              placeholder="Pl.: ABC123 vagy UGY-001"
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
            />
          )}
        </Field>

        <Field label="Jelszó">
          {(a) => (
            <div className="input-wrap">
              <input
                {...a}
                type={showPw ? 'text' : 'password'}
                className="input input--lg"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="Jelszó"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="input-wrap__btn"
                aria-label={showPw ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
                aria-pressed={showPw}
                onClick={() => setShowPw((v) => !v)}
              >
                <EyeIcon off={showPw} />
              </button>
            </div>
          )}
        </Field>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--block btn--lg">
          Bejelentkezés
        </button>
      </form>

      <div className="demo">
        <p className="demo__title">Demo fiókok:</p>
        <ul className="demo__list">
          {DEMO_ACCOUNTS.map((acc) => (
            <li key={acc.id} className="demo__row">
              <span className="demo__creds">
                <code className="demo__id">{acc.id}</code>
                <span className="demo__sep">·</span>
                <span className="mono">{acc.password}</span>
                <span className="demo__sep">·</span>
                <span>{acc.role}</span>
              </span>
              <button type="button" className="link-btn" onClick={() => fill(acc)}>
                Kitöltés
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="demo__reset" onClick={resetDemo}>
          Demó adatok visszaállítása
        </button>
      </div>
    </div>
  )
}
