// aiin · AppLayout v4 — limpo e funcional
import { useState, type ReactNode } from 'react'
import type { Route } from '../App'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { id: 'dashboard' as Route, label: 'Dashboard',     icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'briefing'  as Route, label: 'Avulsos',        icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { id: 'campaigns' as Route, label: 'Campanhas',      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { id: 'posts'     as Route, label: 'Aprovar',        icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'schedule'  as Route, label: 'Agenda',         icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'design'    as Route, label: 'Brand DNA',      icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  { id: 'settings'  as Route, label: 'Configurações',  icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const BOTTOM_NAV: Route[] = ['dashboard', 'briefing', 'campaigns', 'posts', 'settings']

interface Props {
  route: Route; navigate: (r: string) => void
  credits: number; pendingCount: number; children: ReactNode
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )
}

export function AppLayout({ route, navigate, credits, pendingCount, children }: Props) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const initial = user?.email?.[0]?.toUpperCase() ?? 'U'
  const pct = Math.min((credits / 50) * 100, 100)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Overlay mobile */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,14,.6)', zIndex: 199, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon" style={{ background: 'none', padding: 0, overflow: 'hidden' }}>
            <img src="/logo.png" alt="aiin" style={{ width: 32, height: 32, objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).parentElement!.style.background='linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)'; (e.target as HTMLImageElement).parentElement!.textContent='✦' }} />
          </div>
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
            <div className="credits-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map(item => {
            const badge = item.id === 'posts' ? pendingCount : 0
            return (
              <button
                key={item.id}
                onClick={() => { navigate(item.id); setOpen(false) }}
                className={`nav-item ${route === item.id ? 'active' : ''}`}
              >
                <Icon d={item.icon} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge > 0 && <span className="nav-badge">{badge}</span>}
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
            <button onClick={signOut} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">

        {/* Topbar mobile */}
        <div className="topbar">
          <button className="topbar-menu-btn" onClick={() => setOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white' }}>✦</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>aiin</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pink)', background: 'rgba(247,37,133,.08)', padding: '4px 10px', borderRadius: 99, border: '1px solid rgba(247,37,133,.15)' }}>
            {credits} cr.
          </div>
        </div>

        {/* Conteúdo — flex:1, sem overflow aqui, cada página controla o próprio scroll */}
        <div className="page-content">
          {children}
        </div>

        {/* Bottom nav mobile */}
        <nav className="bottom-nav">
          <div className="bottom-nav-items">
            {BOTTOM_NAV.map(id => {
              const item = NAV.find(n => n.id === id)!
              if (id === 'briefing') return (
                <button key={id} className="bottom-nav-cta" onClick={() => navigate(id)}>✦</button>
              )
              const badge = id === 'posts' ? pendingCount : 0
              return (
                <button key={id} className={`bottom-nav-item ${route === id ? 'active' : ''}`} onClick={() => navigate(id)}>
                  <div className="bottom-nav-icon" style={{ position: 'relative' }}>
                    {id === 'dashboard' ? '⊞' : id === 'campaigns' ? '📅' : id === 'posts' ? '✓' : '⚙'}
                    {badge > 0 && (
                      <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: 'var(--pink)', color: 'white', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
