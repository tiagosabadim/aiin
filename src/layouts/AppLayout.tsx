// ============================================================
//  aiin · AppLayout v3
//  Desktop: sidebar 228px + conteúdo
//  Mobile: topbar + bottom nav 5 itens + sem sidebar
// ============================================================
import { useState, type ReactNode } from 'react'
import type { Route } from '../App'
import { useAuth } from '../hooks/useAuth'

interface NavItem { id: Route; label: string; icon: string; badge?: number; mobileIcon?: string }

const NAV: NavItem[] = [
  {
    id: 'dashboard', label: 'Dashboard', mobileIcon: '⊞',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    id: 'briefing', label: 'Novo pedido', mobileIcon: '✦',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  },
  {
    id: 'campaigns', label: 'Cronogramas', mobileIcon: '📅',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  },
  {
    id: 'posts', label: 'Aprovar', mobileIcon: '✓',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'schedule', label: 'Agenda', mobileIcon: '⊘',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'assets', label: 'Acervo',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  },
  {
    id: 'insights', label: 'Insights',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    id: 'design', label: 'Brand DNA',
    icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
  },
  {
    id: 'settings', label: 'Configurações',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
]

// Itens que aparecem no bottom nav mobile (5 max)
const BOTTOM_NAV_IDS: Route[] = ['dashboard', 'campaigns', 'briefing', 'posts', 'settings']

interface Props {
  route: Route
  navigate: (r: string) => void
  credits: number
  pendingCount: number
  children: ReactNode
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={path} />
    </svg>
  )
}

export function AppLayout({ route, navigate, credits, pendingCount, children }: Props) {
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const initial = user?.email?.[0]?.toUpperCase() ?? 'U'
  const maxCredits = 50
  const creditPct = Math.min((credits / maxCredits) * 100, 100)

  const closeSidebar = () => setSidebarOpen(false)

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">✦</div>
        <div>
          <div className="sidebar-logo-text">aiin</div>
          <div className="sidebar-logo-sub">Instagram · IA</div>
        </div>
      </div>

      {/* Créditos */}
      <div className="credits-pill">
        <div className="credits-pill-row">
          <span className="credits-pill-label">Créditos</span>
          <span className="credits-pill-value">{credits}</span>
        </div>
        <div className="credits-bar">
          <div className="credits-bar-fill" style={{ width: `${creditPct}%` }} />
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(item => {
          const active = route === item.id
          const badge = item.id === 'posts' ? pendingCount : undefined
          return (
            <button
              key={item.id}
              onClick={() => { navigate(item.id); closeSidebar() }}
              className={`nav-item ${active ? 'active' : ''}`}
            >
              <NavIcon path={item.icon} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {badge && badge > 0 && <span className="nav-badge">{badge}</span>}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="avatar">{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <button
            onClick={signOut}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            Sair
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Overlay mobile */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={closeSidebar} />

      {/* Sidebar desktop */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <main className="main">

        {/* Topbar mobile */}
        <div className="topbar">
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>

          {/* Logo mobile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white' }}>✦</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-.3px' }}>aiin</span>
          </div>

          {/* Créditos mobile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--accent-pink)', background: 'rgba(247,37,133,.08)', padding: '4px 10px', borderRadius: 99, border: '1px solid rgba(247,37,133,.15)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gradient)', display: 'inline-block' }} />
            {credits}
          </div>
        </div>

        {/* Conteúdo da página */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {children}
        </div>

        {/* Bottom Nav mobile */}
        <nav className="bottom-nav">
          <div className="bottom-nav-items">
            {BOTTOM_NAV_IDS.map(id => {
              const item = NAV.find(n => n.id === id)
              if (!item) return null
              const active = route === id
              const badge = id === 'posts' ? pendingCount : undefined

              // CTA central (briefing)
              if (id === 'briefing') {
                return (
                  <button
                    key={id}
                    className="bottom-nav-cta"
                    onClick={() => navigate(id)}
                    aria-label="Novo pedido"
                  >
                    ✦
                  </button>
                )
              }

              return (
                <button
                  key={id}
                  className={`bottom-nav-item ${active ? 'active' : ''}`}
                  onClick={() => navigate(id)}
                >
                  <div className="bottom-nav-icon" style={{ position: 'relative' }}>
                    {item.mobileIcon ?? item.label[0]}
                    {badge && badge > 0 && (
                      <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: 'var(--accent-pink)', color: 'white', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </div>
                  <span className="bottom-nav-label">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </main>
    </div>
  )
}
