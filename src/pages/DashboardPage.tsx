import type { Workspace, BrandProfile, Subscription } from '../types/database'
import type { Route } from '../App'

interface Props {
  workspace: Workspace
  brand: BrandProfile
  subscription: Subscription | null
  credits: number
  navigate: (r: Route) => void
}

export function DashboardPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const maxCredits = 50
  const creditPct  = Math.min((credits / maxCredits) * 100, 100)

  const QUICK_ACTIONS = [
    { label:'Post estático',   sub:'1 crédito',  icon:'▣', type:'post_simples'  },
    { label:'Carrossel 5p',    sub:'3 créditos', icon:'◫', type:'carrossel_5'   },
    { label:'Story',           sub:'1 crédito',  icon:'▯', type:'story'          },
    { label:'Capa de Reels',   sub:'1 crédito',  icon:'▶', type:'capa_reels'     },
  ]

  return (
    <div className="page">

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 className="page-title">
            Olá! 👋
          </h1>
          <p className="page-sub">
            Bem-vindo de volta ao <strong style={{ color:'var(--text-1)' }}>{brand.name}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('briefing')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Novo pedido
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Créditos',         value: String(credits),          sub:`de ${maxCredits} do plano`,  color:'var(--accent-purple)', pct: creditPct },
          { label:'Pendentes',        value:'0',                       sub:'aguardando aprovação',       color:'var(--accent-pink)',   pct: null },
          { label:'Publicados',       value:'0',                       sub:'este mês',                   color:'var(--success)',       pct: null },
          { label:'Contexto da marca',value:`${brand.ai_context_pct}%`,sub:'Brand DNA completo',         color:'var(--accent-orange)', pct: brand.ai_context_pct },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'16px' }}>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6, fontWeight:500, textTransform:'uppercase', letterSpacing:'.04em' }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:700, color:s.color, lineHeight:1, letterSpacing:'-.5px' }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:6 }}>{s.sub}</div>
            {s.pct !== null && (
              <div style={{ height:2, background:'var(--border)', borderRadius:99, overflow:'hidden', marginTop:8 }}>
                <div style={{ height:'100%', width:`${s.pct}%`, background:s.color, borderRadius:99, transition:'width .4s' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: stats em 2 colunas */}
      <style>{`@media(max-width:640px){ .stats-grid{grid-template-columns:1fr 1fr!important} }`}</style>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16, alignItems:'start' }}>

        {/* Brand DNA */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ background:'var(--gradient)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>✦</span>
              Brand DNA — {brand.name}
            </div>
            <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background:'var(--gradient-soft)', color:'var(--text-1)', fontWeight:500, border:'1px solid rgba(247,37,133,.15)' }}>
              {brand.ai_context_pct}% contexto
            </span>
          </div>

          {brand.ai_brand_dna ? (
            <>
              <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.7, background:'var(--surface-2)', borderRadius:var_or('var(--radius-lg)'), padding:'12px 14px', marginBottom:14, maxHeight:160, overflowY:'auto' }}>
                {brand.ai_brand_dna}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  ['Segmento',   brand.segment         ?? '—'],
                  ['Tom de voz', brand.tone_of_voice   ?? '—'],
                  ['Público',    brand.target_audience ?? '—'],
                  ['Objetivo',   brand.main_objective  ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background:'var(--surface-2)', borderRadius:'var(--radius-md)', padding:'8px 10px' }}>
                    <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:2, fontWeight:500, textTransform:'uppercase', letterSpacing:'.04em' }}>{k}</div>
                    <div style={{ fontSize:12, color:'var(--text-1)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</div>
                  </div>
                ))}
              </div>
              {brand.color_palette?.length > 0 && (
                <div style={{ marginTop:12, display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--text-3)' }}>Cores:</span>
                  {(brand.color_palette as any[]).map((c: any) => (
                    <div key={c.hex} title={`${c.name} ${c.hex}`} style={{ width:18, height:18, borderRadius:'50%', background:c.hex, border:'1.5px solid var(--border-md)', flexShrink:0 }} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign:'center', padding:'28px 0' }}>
              <div style={{ fontSize:28, marginBottom:8, opacity:.4 }}>✦</div>
              <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:12 }}>Brand DNA não gerado ainda</div>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('design')}>Completar perfil →</button>
            </div>
          )}
        </div>

        {/* Sidebar direita */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Ações rápidas */}
          <div className="card-sm">
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:10 }}>Criar agora</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {QUICK_ACTIONS.map(a => (
                <button key={a.type} onClick={() => navigate('briefing')} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'9px 10px',
                  background:'var(--surface-2)', border:'1px solid var(--border)',
                  borderRadius:'var(--radius-md)', cursor:'pointer', fontFamily:'var(--font-sans)',
                  transition:'all .15s', textAlign:'left',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(247,37,133,.3)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--gradient-soft)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}>
                  <span style={{ fontSize:18 }}>{a.icon}</span>
                  <span style={{ flex:1, fontSize:13, color:'var(--text-1)', fontWeight:500 }}>{a.label}</span>
                  <span style={{ fontSize:11, color:'var(--text-3)' }}>{a.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Créditos */}
          <div className="card-gradient">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-1)' }}>Créditos</span>
              <span style={{ fontSize:20, fontWeight:700, color:'var(--text-1)' }}>{credits}</span>
            </div>
            <div style={{ height:4, background:'rgba(255,255,255,.2)', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', width:`${creditPct}%`, background:'var(--gradient)', borderRadius:99, transition:'width .4s' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:10 }}>
              {subscription
                ? `Plano ativo até ${new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}`
                : 'Sem plano ativo'}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('settings')} style={{ width:'100%', justifyContent:'center' }}>
              Comprar créditos →
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// helper pq TypeScript inline nao aceita var()
function var_or(v: string) { return v }
