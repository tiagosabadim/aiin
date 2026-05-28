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
import { CampaignsPage } from './pages/CampaignsPage'
import { AdminPage } from './pages/AdminPage'
import './index.css'

export type Route = 'dashboard' | 'briefing' | 'campaigns' | 'posts' | 'schedule' | 'assets' | 'insights' | 'design' | 'settings'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { workspace, brand, subscription, credits, loading: wsLoading, refetch } = useWorkspace()
  const [route, setRoute] = useState<Route>('dashboard')
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null)

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

  // Reabrir onboarding em step específico (ex: resetar contexto visual → step 6)
  if (onboardingStep !== null) {
    return <OnboardingPage
      onComplete={() => { setOnboardingStep(null); refetch() }}
      initialStep={onboardingStep as any}
      existingBrand={brand}
      existingWorkspace={workspace}
    />
  }

  // Validação visual obrigatória após onboarding
  // visual_context_approved gerenciado dentro do OnboardingPage (step 6)

  if (route === ("admin" as any)) return <AdminPage />

  const openOnboardingAt = (step: number) => setOnboardingStep(step)
  const ctx = { workspace, brand, subscription, credits, navigate, openOnboardingAt }

  return (
    <AppLayout route={route} navigate={navigate} credits={credits} pendingCount={0}>
      {route === 'dashboard'  && <DashboardPage {...ctx} />}
      {route === 'briefing'   && <BriefingPage  {...ctx} />}
      {route === 'campaigns'  && <CampaignsPage {...ctx} />}
      {route === 'posts'      && <PostsPage      workspaceId={workspace.id} userId={user.id} />}
      {route === 'schedule'   && <SchedulePage   workspaceId={workspace.id} />}
      {route === 'assets'     && <AssetsPage     workspaceId={workspace.id} brandId={brand.id} />}
      {route === 'insights'   && <InsightsPage workspaceId={workspace.id} brand={brand} />}
      {route === 'design'     && <DesignSystemPage brand={brand} workspaceId={workspace.id} onSave={refetch} openOnboardingAt={openOnboardingAt} />}
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
