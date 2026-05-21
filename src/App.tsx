import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useWorkspace } from './hooks/useWorkspace'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { AppLayout } from './layouts/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { BriefingPage } from './pages/BriefingPage'
import { PostsPage } from './pages/PostsPage'
import { SchedulePage } from './pages/SchedulePage'
import { AssetsPage } from './pages/AssetsPage'
import { InsightsPage, DesignSystemPage, SettingsPage } from './pages/OtherPages'
import './index.css'

export type Route = 'dashboard' | 'briefing' | 'posts' | 'schedule' | 'assets' | 'insights' | 'design' | 'settings'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { workspace, brand, subscription, credits, loading: wsLoading, refetch } = useWorkspace()
  const [route, setRoute] = useState<Route>('dashboard')

  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '') as Route
    if (fromHash) setRoute(fromHash)
  }, [])

  const navigate = (to: Route) => { setRoute(to); window.location.hash = to }

  if (authLoading || wsLoading) return <SplashScreen />
  if (!user) return <LoginPage />

  // Onboarding obrigatório se não tiver workspace ou marca
  if (!workspace || !brand || !brand.onboarding_completed) {
    return <OnboardingPage onComplete={refetch} />
  }

  const ctx = { workspace, brand, subscription, credits, navigate }

  return (
    <AppLayout route={route} navigate={navigate} credits={credits} pendingCount={0}>
      {route === 'dashboard'  && <DashboardPage {...ctx} />}
      {route === 'briefing'   && <BriefingPage  {...ctx} />}
      {route === 'posts'      && <PostsPage      workspaceId={workspace.id} userId={user.id} />}
      {route === 'schedule'   && <SchedulePage />}
      {route === 'assets'     && <AssetsPage     workspaceId={workspace.id} brandId={brand.id} />}
      {route === 'insights'   && <InsightsPage />}
      {route === 'design'     && <DesignSystemPage brand={brand} workspaceId={workspace.id} onSave={refetch} />}
      {route === 'settings'   && <SettingsPage   workspace={workspace} brand={brand} />}
    </AppLayout>
  )
}

function SplashScreen() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', flexDirection:'column', gap:16 }}>
      <div style={{ width:48, height:48, borderRadius:12, background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ color:'white', fontSize:22 }}>★</span>
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--brand)', opacity:.4, animation:`pulse 1.2s ease-in-out ${i*.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
    </div>
  )
}
