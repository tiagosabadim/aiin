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
import { VisualContextPage } from './pages/VisualContextPage'
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
  if (!workspace || !brand || !brand.onboarding_completed) {
    return <OnboardingPage onComplete={refetch} />
  }

  // Validação visual obrigatória após onboarding
  if (brand.onboarding_completed && !(brand as any).visual_context_approved) {
    return <VisualContextPage workspace={workspace} brand={brand} onApprove={refetch} />
  }

  const ctx = { workspace, brand, subscription, credits, navigate }

  return (
    <AppLayout route={route} navigate={navigate} credits={credits} pendingCount={0}>
      {route === 'dashboard'  && <DashboardPage {...ctx} />}
      {route === 'briefing'   && <BriefingPage  {...ctx} />}
      {route === 'posts'      && <PostsPage      workspaceId={workspace.id} userId={user.id} />}
      {route === 'schedule'   && <SchedulePage   workspaceId={workspace.id} />}
      {route === 'assets'     && <AssetsPage     workspaceId={workspace.id} brandId={brand.id} />}
      {route === 'insights'   && <InsightsPage workspaceId={workspace.id} brand={brand} />}
      {route === 'design'     && <DesignSystemPage brand={brand} workspaceId={workspace.id} onSave={refetch} />}
      {route === 'settings'   && <SettingsPage   workspace={workspace} brand={brand} />}
    </AppLayout>
  )
}

function SplashScreen() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', flexDirection:'column', gap:20 }}>
      <div style={{ width:52, height:52, borderRadius:16, background:'var(--gradient)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'white', boxShadow:'0 8px 24px rgba(247,37,133,.3)' }}>★</div>
      <div style={{ display:'flex', gap:6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-pink)', animation:`pulse 1.2s ease-in-out ${i*.2}s infinite` }} />
        ))}
      </div>
    </div>
  )
}
