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
  const { currentUser } = useApp()
  const View = currentUser ? VIEWS[currentUser.role] : LoginPage

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
