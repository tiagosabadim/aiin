import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useWorkspace } from './hooks/useWorkspace'
import { LoginPage } from './pages/LoginPage'
import { LandingPage } from './pages/LandingPage'
import { PaywallModal } from './pages/PaywallModal'
import { OnboardingPage } from './pages/OnboardingPage'
import { Loader } from './components/Loader'
import { AppLayout } from './layouts/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { BriefingPage } from './pages/BriefingPage'
import { CreateHubPage } from './pages/CreateHubPage'
import { PostsPage } from './pages/PostsPage'
import { SchedulePage } from './pages/SchedulePage'
import { InsightsPage, DesignSystemPage, SettingsPage } from './pages/OtherPages'
import { CampaignsPage } from './pages/CampaignsPage'
import { AdminPage } from './pages/AdminPage'
import './index.css'

export type Route = 'criar' | 'dashboard' | 'briefing' | 'campaigns' | 'posts' | 'schedule' | 'insights' | 'design' | 'settings'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { workspace, brand, subscription, credits, loading: wsLoading, refetch } = useWorkspace()
  const [route, setRoute] = useState<Route>('criar')
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '') as Route
    if (fromHash) setRoute(fromHash)
  }, [])

  const navigate = (to: Route) => { setRoute(to); window.location.hash = to }

  if (authLoading || wsLoading) return <Loader fullscreen />

  // Painel admin: area separada com login proprio. Acessivel via #admin
  // independente de estar logado como usuario ou nao.
  if (window.location.hash === '#admin' || route === ('admin' as any)) return <AdminPage />

  // Guarda extra contra flash de onboarding: se ha usuario mas o workspace
  // ainda nao foi resolvido (estado intermediario), segura no Loader.
  if (user && wsLoading) return <Loader fullscreen />

  if (!user) {
    // #login no hash ou clicou em entrar → login; senão landing
    const wantsLogin = showLogin || window.location.hash === '#login'
    return wantsLogin
      ? <LoginPage />
      : <LandingPage onStart={() => { setShowLogin(true); window.location.hash = 'login' }} />
  }
  if (!workspace || !brand || !brand.onboarding_completed) {
    return <OnboardingPage onComplete={refetch} existingBrand={brand} existingWorkspace={workspace} />
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

  const openOnboardingAt = (step: number) => setOnboardingStep(step)
  const ctx = { workspace, brand, subscription, credits, navigate, openOnboardingAt }

  // Paywall: acabaram os créditos e não há assinatura ativa
  const needsPaywall = credits <= 0 && (!subscription || subscription.status !== 'active')

  return (
    <>
      {needsPaywall && <PaywallModal workspaceId={workspace.id} userEmail={user.email} />}
    <AppLayout route={route} navigate={navigate} credits={credits} pendingCount={0}>
      {route === 'criar' && (
        <CreateHubPage workspace={workspace} brand={brand} subscription={subscription} credits={credits} navigate={navigate} />
      )}
      {route === 'dashboard'  && <DashboardPage {...ctx} />}
      {route === 'briefing' && (
        <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, overflow:'hidden' }}>
          <div style={{ padding:'24px 28px 0', flexShrink:0 }}><h1 className="page-title">Avulsos</h1></div>
          <BriefingPage {...ctx} />
        </div>
      )}
      {route === 'campaigns' && (
        <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, overflow:'hidden' }}>
          <div style={{ padding:'20px 28px 0', flexShrink:0 }}><h1 className="page-title">Campanhas</h1></div>
          <CampaignsPage {...ctx} />
        </div>
      )}
      {route === 'posts'      && <PostsPage      workspaceId={workspace.id} userId={user.id} />}
      {route === 'schedule'   && <SchedulePage   workspaceId={workspace.id} navigate={navigate} />}
      {route === 'insights'   && <InsightsPage workspaceId={workspace.id} brand={brand} />}
      {route === 'design' && (
        <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, overflow:'hidden' }}>
          <DesignSystemPage brand={brand} workspaceId={workspace.id} onSave={refetch} openOnboardingAt={openOnboardingAt} />
        </div>
      )}
      {route === 'settings'   && <SettingsPage   workspace={workspace} brand={brand} />}
    </AppLayout>
    </>
  )
}

