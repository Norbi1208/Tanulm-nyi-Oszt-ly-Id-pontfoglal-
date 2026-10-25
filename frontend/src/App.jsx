import { useApp } from './context/AppContext.jsx'
import Header from './components/Header.jsx'
import Toasts from './components/Toasts.jsx'
import LoginPage from './pages/LoginPage.jsx'
import StudentView from './pages/StudentView.jsx'
import ClerkView from './pages/ClerkView.jsx'
import AdminView from './pages/AdminView.jsx'

const VIEWS = {
  student: StudentView,
  clerk: ClerkView,
  admin: AdminView,
}

export default function App() {
  const { currentUser, authReady } = useApp()
  const View = (currentUser && VIEWS[currentUser.role]) || LoginPage

  // Amíg a backendtől megtudjuk, be van-e jelentkezve valaki
  if (!authReady) {
    return (
      <>
        <Header />
        <main className="page page--login">
          <p className="page-loading">Betöltés…</p>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className={currentUser ? 'page' : 'page page--login'}>
        <View />
      </main>
      <Toasts />
    </>
  )
}
