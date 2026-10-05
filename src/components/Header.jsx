import { useApp } from '../context/AppContext.jsx'
import Avatar from './Avatar.jsx'
import logoUrl from '../assets/sze-logo.png'

export default function Header() {
  const { currentUser, logout } = useApp()

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="brand">
          <span className="brand__logo">
            <img src={logoUrl} alt="Széchenyi István Egyetem" />
          </span>
          <span className="brand__text">
            <span className="brand__title">Tanulmányi Osztály Időpontfoglaló</span>
            <span className="brand__sub">Széchenyi István Egyetem</span>
          </span>
        </div>

        {currentUser && (
          <div className="userbox">
            <div className="userbox__meta">
              <span className="userbox__name">{currentUser.name}</span>
              <span className="userbox__id mono">{currentUser.id}</span>
            </div>
            <Avatar name={currentUser.name} variant="header" />
            <button type="button" className="btn btn--logout" onClick={logout}>
              Kilépés
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
