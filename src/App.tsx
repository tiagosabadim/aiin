import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { AppLayout } from './layouts/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { BriefingPage } from './pages/BriefingPage'
import { PostsPage } from './pages/PostsPage'
import { SchedulePage } from './pages/SchedulePage'
import { AssetsPage } from './pages/AssetsPage'
import { InsightsPage, DesignSystemPage, SettingsPage } from './pages/OtherPages'
import './index.css'

export type Route =
  | 'dashboard'
  | 'briefing'
  | 'posts'
  | 'schedule'
  | 'assets'
  | 'insights'
  | 'design'
  | 'settings'

export default function App() {
  const { user, loading } = useAuth()
  const [route, setRoute] = useState<Route>('dashboard')

  // Sincroniza rota com hash da URL (navegação simples sem react-router)
  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '') as Route
    if (fromHash) setRoute(fromHash)
  }, [])

  const navigate = (to: Route) => {
    setRoute(to)
    window.location.hash = to
  }

  if (loading) return <SplashScreen />
  if (!user)   return <LoginPage />

  return (
    <AppLayout route={route} navigate={navigate}>
      {route === 'dashboard'  && <DashboardPage navigate={navigate} />}
      {route === 'briefing'   && <BriefingPage />}
      {route === 'posts'      && <PostsPage />}
      {route === 'schedule'   && <SchedulePage />}
      {route === 'assets'     && <AssetsPage />}
      {route === 'insights'   && <InsightsPage />}
      {route === 'design'     && <DesignSystemPage />}
      {route === 'settings'   && <SettingsPage />}
    </AppLayout>
  )
}

function SplashScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 'var(--radius-md)',
        background: 'var(--brand)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            fill="white" />
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--brand)',
            opacity: 0.4,
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
