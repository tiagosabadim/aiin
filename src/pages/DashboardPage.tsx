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
  const totalCredits = (subscription?.monthly_credits_available ?? 0) + (subscription?.extra_credits_available ?? 0)
  const maxCredits = 50 // estimado do plano

  return (
    <div style={{ padding:'28px 32px', flex:1 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>
            Olá! 👋
          </h1>
          <p style={{ fontSize:14, color:'var(--text-2)' }}>
            Bem-vindo de volta ao <strong>{brand.name}</strong>.
          </p>
        </div>
        <button onClick={() => navigate('briefing')} style={btnP}>+ Novo pedido</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Créditos disponíveis', value: String(credits),     sub: `de ${maxCredits} do plano`,      color:'var(--brand)'  },
          { label:'Posts pendentes',      value:'0',                   sub:'aguardando aprovação',            color:'var(--amber)'  },
          { label:'Posts publicados',     value:'0',                   sub:'este mês',                        color:'var(--text-2)' },
          { label:'Contexto da marca',    value:`${brand.ai_context_pct}%`, sub:'Brand DNA completo',         color:'var(--brand)'  },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:500, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:5 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>

        {/* Brand DNA Card */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'18px 20px' }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:14 }}>✦ Brand DNA — {brand.name}</div>

          {brand.ai_brand_dna ? (
            <div>
              <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.7, background:'var(--surface-2)', borderRadius:'var(--radius-md)', padding:'12px 14px', marginBottom:12, maxHeight:180, overflowY:'auto' }}>
                {brand.ai_brand_dna}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'Segmento',   value: brand.segment        ?? '—' },
                  { label:'Tom de voz', value: brand.tone_of_voice  ?? '—' },
                  { label:'Público',    value: brand.target_audience ?? '—' },
                  { label:'Objetivo',   value: brand.main_objective  ?? '—' },
                ].map(item => (
                  <div key={item.label} style={{ background:'var(--surface-2)', borderRadius:'var(--radius-md)', padding:'8px 10px' }}>
                    <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:2 }}>{item.label}</div>
                    <div style={{ fontSize:12, color:'var(--text-1)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-3)' }}>
              <div style={{ fontSize:24, marginBottom:8 }}>✦</div>
              <div style={{ fontSize:13 }}>Brand DNA ainda não gerado</div>
              <button onClick={() => navigate('design')} style={{ ...btnS, marginTop:10 }}>Completar perfil →</button>
            </div>
          )}

          {/* Cores */}
          {brand.color_palette?.length > 0 && (
            <div style={{ marginTop:14, display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:11, color:'var(--text-3)' }}>Cores:</span>
              {brand.color_palette.map((c: { hex: string; name: string }) => (
                <div key={c.hex} title={c.name} style={{ width:20, height:20, borderRadius:'50%', background:c.hex, border:'1px solid var(--border)', flexShrink:0 }} />
              ))}
            </div>
          )}
        </div>

        {/* Ações rápidas */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:10 }}>Criar conteúdo</div>
            {[
              { label:'Post estático (1 crédito)',       route:'briefing' as Route, highlight:true  },
              { label:'Carrossel até 5p (3 créditos)',   route:'briefing' as Route, highlight:false },
              { label:'Story avulso (1 crédito)',        route:'briefing' as Route, highlight:false },
              { label:'Capa de Reels (1 crédito)',       route:'briefing' as Route, highlight:false },
            ].map(item => (
              <button key={item.label} onClick={() => navigate(item.route)} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                width:'100%', padding:'8px 10px', marginBottom:4,
                background: item.highlight ? 'var(--brand-light)' : 'var(--surface-2)',
                border:'none', borderRadius:'var(--radius-md)',
                color: item.highlight ? 'var(--brand-dark)' : 'var(--text-2)',
                fontSize:12, fontWeight: item.highlight ? 500 : 400,
                fontFamily:'var(--font-sans)', cursor:'pointer', textAlign:'left',
              }}>
                {item.label} <span>→</span>
              </button>
            ))}
          </div>

          {/* Créditos */}
          <div style={{ background:'var(--brand-light)', border:'1px solid rgba(61,90,62,.15)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)' }}>Créditos</span>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)' }}>{credits}</span>
            </div>
            <div style={{ height:5, background:'rgba(61,90,62,.15)', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', width:`${Math.min((credits/maxCredits)*100,100)}%`, background:'var(--brand)', borderRadius:99 }} />
            </div>
            <div style={{ fontSize:11, color:'var(--brand-dark)', opacity:.75 }}>
              {subscription ? `Plano ativo até ${new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}` : 'Sem plano ativo'}
            </div>
            <button onClick={() => navigate('settings')} style={{ marginTop:8, background:'none', border:'1px solid rgba(61,90,62,.3)', borderRadius:'var(--radius-md)', padding:'5px 12px', fontSize:12, color:'var(--brand-dark)', fontFamily:'var(--font-sans)', cursor:'pointer' }}>
              Comprar créditos →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const btnP: React.CSSProperties = { background:'var(--brand)', color:'white', border:'none', borderRadius:'var(--radius-md)', padding:'9px 18px', fontSize:13, fontWeight:500, fontFamily:'var(--font-sans)', cursor:'pointer' }
const btnS: React.CSSProperties = { background:'transparent', color:'var(--text-2)', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', padding:'7px 14px', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }
