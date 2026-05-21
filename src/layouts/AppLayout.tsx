import type { ReactNode } from 'react'
import type { Route } from '../App'
import { useAuth } from '../hooks/useAuth'

interface NavItem { id: Route; label: string; icon: string; badge?: number }

const NAV: NavItem[] = [
  { id:'dashboard', label:'Dashboard',     icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id:'briefing',  label:'Novo pedido',   icon:'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { id:'posts',     label:'Aprovar',       icon:'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id:'schedule',  label:'Agenda',        icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id:'assets',    label:'Acervo',        icon:'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id:'insights',  label:'Insights',      icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id:'design',    label:'Brand DNA',     icon:'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  { id:'settings',  label:'Configurações', icon:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

interface Props {
  route: Route; navigate: (r: Route) => void
  credits: number; pendingCount: number; children: ReactNode
}

export function AppLayout({ route, navigate, credits, pendingCount, children }: Props) {
  const { user, signOut } = useAuth()

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <aside style={{ width:210, minWidth:210, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto' }}>

        {/* Logo */}
        <div style={{ padding:'20px 18px 16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ color:'white', fontSize:16 }}>★</span>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:500, color:'var(--text-1)', lineHeight:1.2 }}>aiin</div>
              <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>Instagram · IA</div>
            </div>
          </div>
        </div>

        {/* Créditos */}
        <div style={{ margin:'12px 14px', background:'var(--brand-light)', borderRadius:10, padding:'10px 12px', border:'1px solid rgba(61,90,62,.15)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:11, color:'var(--brand-dark)' }}>Créditos disponíveis</span>
            <span style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)' }}>{credits}</span>
          </div>
          <div style={{ height:4, background:'rgba(61,90,62,.15)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${Math.min((credits/50)*100,100)}%`, background:'var(--brand)', borderRadius:99, transition:'width .4s' }} />
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding:'4px 10px', flex:1 }}>
          {NAV.map(item => {
            const active = route === item.id
            const badge = item.id === 'posts' ? pendingCount : undefined
            return (
              <button key={item.id} onClick={() => navigate(item.id)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:9, padding:'8px 10px',
                borderRadius:'var(--radius-md)', border:'none',
                background: active ? 'var(--brand-light)' : 'transparent',
                color: active ? 'var(--brand-dark)' : 'var(--text-2)',
                fontFamily:'var(--font-sans)', fontSize:13, fontWeight: active ? 500 : 400,
                cursor:'pointer', textAlign:'left', marginBottom:2, position:'relative',
              }}>
                {active && <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:3, height:20, background:'var(--brand)', borderRadius:'0 2px 2px 0' }} />}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                  <path d={item.icon} />
                </svg>
                <span style={{ flex:1 }}>{item.label}</span>
                {badge && badge > 0 && (
                  <span style={{ background:'var(--brand)', color:'white', fontSize:10, fontWeight:500, padding:'1px 6px', borderRadius:99 }}>{badge}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--brand-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, color:'var(--brand-dark)', flexShrink:0 }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:500, color:'var(--text-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.email}</div>
            <button onClick={signOut} style={{ background:'none', border:'none', padding:0, fontSize:11, color:'var(--text-3)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>Sair</button>
          </div>
        </div>
      </aside>

      <main style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflowY:'auto' }}>
        {children}
      </main>
    </div>
  )
}
