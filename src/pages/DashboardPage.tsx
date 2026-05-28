// aiin · DashboardPage v3 — Dashboard + Insights unificados
// Brand DNA progress com caminho para 100%
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Workspace, BrandProfile, Subscription } from '../types/database'
import type { Route } from '../App'

interface Props {
  workspace: Workspace
  brand: BrandProfile
  subscription: Subscription | null
  credits: number
  navigate: (r: Route) => void
}

interface PostInsight {
  id: string
  impressions: number; reach: number; likes: number
  comments: number; saved: number; engagement_rate: number
  output?: { caption: string; public_url: string; format: string }
}

interface Stats {
  pending: number; published: number; scheduled: number; total: number
}

// Calcula % real do Brand DNA
function calcBrandPct(brand: BrandProfile): { pct: number; steps: Step[] } {
  const steps: Step[] = [
    {
      id: 'onboarding',
      label: 'Perfil da marca',
      sub: 'Nome, segmento, público, tom de voz',
      done: !!brand.segment && !!brand.tone_of_voice && !!brand.target_audience,
      points: 25,
      route: 'design',
      cta: 'Completar perfil',
    },
    {
      id: 'dna',
      label: 'Brand DNA gerado',
      sub: 'IA analisou e criou o DNA da sua marca',
      done: !!brand.ai_brand_dna,
      points: 20,
      route: 'design',
      cta: 'Gerar Brand DNA',
    },
    {
      id: 'logo',
      label: 'Logo enviada',
      sub: 'Imagem da logo da marca',
      done: !!brand.logo_urls?.primary,
      points: 15,
      route: 'assets',
      cta: 'Enviar logo',
    },
    {
      id: 'colors',
      label: 'Paleta de cores',
      sub: 'Cores oficiais da marca definidas',
      done: (brand.color_palette?.length ?? 0) >= 2,
      points: 10,
      route: 'design',
      cta: 'Definir cores',
    },
    {
      id: 'visual',
      label: 'Estilo visual validado',
      sub: 'IA gerou arte teste e você aprovou',
      done: !!(brand as any).visual_context_approved,
      points: 15,
      route: 'design',
      cta: 'Validar estilo',
    },
    {
      id: 'instagram',
      label: 'Instagram conectado',
      sub: 'Conta conectada para publicar e obter insights',
      done: !!(brand as any).instagram_access_token,
      points: 15,
      route: 'settings',
      cta: 'Conectar Instagram',
    },
  ]
  const pct = steps.filter(s => s.done).reduce((sum, s) => sum + s.points, 0)
  return { pct, steps }
}

interface Step {
  id: string; label: string; sub: string
  done: boolean; points: number; route: Route; cta: string
}

export function DashboardPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const [stats, setStats]       = useState<Stats>({ pending:0, published:0, scheduled:0, total:0 })
  const [insights, setInsights] = useState<PostInsight[]>([])
  const [loadingIns, setLoadingIns] = useState(true)
  const [period, setPeriod]     = useState<'7'|'30'>('30')

  const { pct, steps } = calcBrandPct(brand)
  const nextStep = steps.find(s => !s.done)
  const maxCredits = 50
  const creditPct  = Math.min((credits / maxCredits) * 100, 100)

  useEffect(() => {
    fetchStats()
    fetchInsights()
  }, [period])

  const fetchStats = async () => {
    const { data } = await supabase
      .from('creative_outputs')
      .select('status')
      .eq('workspace_id', workspace.id)
    if (!data) return
    setStats({
      pending:   data.filter(d => d.status === 'pending').length,
      published: data.filter(d => d.status === 'published').length,
      scheduled: data.filter(d => d.status === 'scheduled').length,
      total:     data.length,
    })
  }

  const fetchInsights = async () => {
    setLoadingIns(true)
    const since = new Date()
    since.setDate(since.getDate() - parseInt(period))
    const { data } = await supabase
      .from('post_insights')
      .select('*, output:creative_outputs(caption,public_url,format)')
      .eq('workspace_id', workspace.id)
      .gte('synced_at', since.toISOString())
      .order('engagement_rate', { ascending: false })
      .limit(6)
    setInsights(data ?? [])
    setLoadingIns(false)
  }

  const totalReach = insights.reduce((s, i) => s + (i.reach ?? 0), 0)
  const totalLikes = insights.reduce((s, i) => s + (i.likes ?? 0), 0)
  const avgEngagement = insights.length > 0
    ? (insights.reduce((s, i) => s + (i.engagement_rate ?? 0), 0) / insights.length).toFixed(1)
    : '0'

  return (
    <div className="page" style={{ maxWidth: 1100, padding: '28px 32px' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#070D1F', letterSpacing:'-.4px', marginBottom:4 }}>
            Olá! 👋
          </h1>
          <p style={{ fontSize:13, color:'#6B7280' }}>
            Bem-vindo de volta ao <strong style={{ color:'#070D1F' }}>{brand.name}</strong>
          </p>
        </div>
        <button onClick={() => navigate('briefing')} style={{ height:42, padding:'0 20px', background:'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border:'none', borderRadius:10, color:'white', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 12px rgba(247,37,133,.3)', fontFamily:'inherit' }}>
          <span style={{ fontSize:16 }}>✦</span> Novo pedido
        </button>
      </div>

      {/* ── Stats rápidos ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Créditos',    value:credits,           sub:`de ${maxCredits} do plano`,   color:'#7B2CFF', pct:creditPct },
          { label:'Pendentes',   value:stats.pending,     sub:'aguardando aprovação',        color:'#F72585', pct:null },
          { label:'Agendados',   value:stats.scheduled,   sub:'prontos para publicar',       color:'#185FA5', pct:null },
          { label:'Publicados',  value:stats.published,   sub:'este mês',                   color:'#1D9E75', pct:null },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid rgba(7,13,31,.08)', borderRadius:14, padding:'14px 16px' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:700, color:s.color, lineHeight:1, letterSpacing:'-.5px' }}>{s.value}</div>
            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:6 }}>{s.sub}</div>
            {s.pct !== null && (
              <div style={{ height:3, background:'rgba(7,13,31,.07)', borderRadius:99, overflow:'hidden', marginTop:10 }}>
                <div style={{ height:'100%', width:`${s.pct}%`, background:s.color, borderRadius:99, transition:'width .4s' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Grid principal ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16, alignItems:'start' }}>

        {/* ── Coluna esquerda: Insights ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Métricas Instagram */}
          <div style={{ background:'#fff', border:'1px solid rgba(7,13,31,.08)', borderRadius:14, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#070D1F' }}>
                📊 Insights Instagram
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {(['7','30'] as const).map(p => (
                  <button key={p} onClick={() => setPeriod(p)} style={{ height:28, padding:'0 10px', border:`1px solid ${period===p?'#F72585':'rgba(7,13,31,.1)'}`, borderRadius:99, background:period===p?'rgba(247,37,133,.08)':'transparent', color:period===p?'#F72585':'#9CA3AF', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                    {p}d
                  </button>
                ))}
              </div>
            </div>

            {!(brand as any).instagram_access_token ? (
              <div style={{ textAlign:'center', padding:'28px 0' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📱</div>
                <div style={{ fontSize:13, color:'#6B7280', marginBottom:12 }}>Conecte o Instagram para ver seus insights</div>
                <button onClick={() => navigate('settings')} style={{ height:36, padding:'0 16px', background:'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border:'none', borderRadius:8, color:'white', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Conectar Instagram →
                </button>
              </div>
            ) : loadingIns ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:64, borderRadius:10 }} />)}
              </div>
            ) : insights.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'#9CA3AF', fontSize:13 }}>
                Nenhum dado ainda. Publique posts para ver insights.
              </div>
            ) : (
              <>
                {/* Métricas resumidas */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
                  {[
                    { label:'Alcance total',    value: totalReach > 1000 ? `${(totalReach/1000).toFixed(1)}k` : String(totalReach), color:'#F72585' },
                    { label:'Curtidas',         value: totalLikes > 1000 ? `${(totalLikes/1000).toFixed(1)}k` : String(totalLikes), color:'#7B2CFF' },
                    { label:'Eng. médio',       value: `${avgEngagement}%`,                                                          color:'#1D9E75' },
                  ].map(m => (
                    <div key={m.label} style={{ background:'#F7F8FA', borderRadius:10, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{m.label}</div>
                      <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Top posts */}
                <div style={{ fontSize:11, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Top posts</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {insights.slice(0, 4).map(ins => (
                    <div key={ins.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 10px', background:'#F7F8FA', borderRadius:10 }}>
                      {ins.output?.public_url ? (
                        <img src={ins.output.public_url} alt="" style={{ width:40, height:40, objectFit:'cover', borderRadius:6, flexShrink:0 }} />
                      ) : (
                        <div style={{ width:40, height:40, background:'#EDEEF2', borderRadius:6, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🖼</div>
                      )}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, color:'#070D1F', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {ins.output?.caption?.slice(0, 50) ?? 'Post sem legenda'}
                        </div>
                        <div style={{ fontSize:10, color:'#9CA3AF', marginTop:2 }}>
                          {ins.likes} ❤️ · {ins.reach} alcance · {Number(ins.engagement_rate).toFixed(1)}% eng
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Ações rápidas */}
          <div style={{ background:'#fff', border:'1px solid rgba(7,13,31,.08)', borderRadius:14, padding:'16px 18px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#070D1F', marginBottom:12 }}>Criar agora</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {[
                { label:'Post estático',  sub:'1 crédito',  icon:'▣', color:'#7B2CFF', bg:'rgba(123,44,255,.08)' },
                { label:'Carrossel 5p',   sub:'3 créditos', icon:'◫', color:'#F72585', bg:'rgba(247,37,133,.08)' },
                { label:'Story',          sub:'1 crédito',  icon:'▯', color:'#FF6A00', bg:'rgba(255,106,0,.08)'  },
                { label:'Capa de Reels',  sub:'1 crédito',  icon:'▶', color:'#1D9E75', bg:'rgba(29,158,117,.08)' },
              ].map(a => (
                <button key={a.label} onClick={() => navigate('briefing')} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:a.bg, border:`1px solid ${a.color}25`, borderRadius:10, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                  <span style={{ fontSize:18, color:a.color }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#070D1F' }}>{a.label}</div>
                    <div style={{ fontSize:10, color:'#9CA3AF' }}>{a.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Coluna direita: Brand DNA Progress ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Score */}
          <div style={{ background:'#fff', border:'1px solid rgba(7,13,31,.08)', borderRadius:14, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#070D1F' }}>Brand DNA</div>
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99, background: pct === 100 ? '#E1F5EE' : 'linear-gradient(135deg,rgba(255,106,0,.1),rgba(247,37,133,.1),rgba(123,44,255,.1))', color: pct === 100 ? '#1D9E75' : '#F72585', border:`1px solid ${pct===100?'rgba(29,158,117,.2)':'rgba(247,37,133,.2)'}` }}>
                {pct}%
              </span>
            </div>

            {/* Barra de progresso */}
            <div style={{ height:6, background:'rgba(7,13,31,.07)', borderRadius:99, overflow:'hidden', marginBottom:14 }}>
              <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', borderRadius:99, transition:'width .5s' }} />
            </div>

            {/* Próximo passo destaque */}
            {nextStep && (
              <div style={{ background:'linear-gradient(135deg,rgba(255,106,0,.06),rgba(247,37,133,.06),rgba(123,44,255,.06))', border:'1px solid rgba(247,37,133,.15)', borderRadius:10, padding:'10px 12px', marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:600, color:'#F72585', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Próximo passo · +{nextStep.points}%</div>
                <div style={{ fontSize:12, fontWeight:600, color:'#070D1F', marginBottom:4 }}>{nextStep.label}</div>
                <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:8 }}>{nextStep.sub}</div>
                <button onClick={() => navigate(nextStep.route)} style={{ height:30, padding:'0 12px', background:'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border:'none', borderRadius:8, color:'white', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  {nextStep.cta} →
                </button>
              </div>
            )}

            {/* Checklist completo */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {steps.map(step => (
                <div key={step.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8, background: step.done ? 'transparent' : 'transparent' }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', background: step.done ? '#1D9E75' : 'rgba(7,13,31,.07)', border: step.done ? 'none' : '1.5px solid rgba(7,13,31,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:9, color:'white', fontWeight:700 }}>
                    {step.done ? '✓' : ''}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:step.done?400:500, color: step.done ? '#9CA3AF' : '#070D1F', textDecoration: step.done ? 'line-through' : 'none' }}>
                      {step.label}
                    </div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:600, color: step.done ? '#1D9E75' : '#9CA3AF' }}>
                    +{step.points}%
                  </span>
                  {!step.done && (
                    <button onClick={() => navigate(step.route)} style={{ fontSize:10, color:'#F72585', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:500, padding:0, whiteSpace:'nowrap' }}>
                      Ir →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Créditos */}
          <div style={{ background:'linear-gradient(135deg,rgba(255,106,0,.08),rgba(247,37,133,.08),rgba(123,44,255,.08))', border:'1px solid rgba(247,37,133,.15)', borderRadius:14, padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#070D1F' }}>Créditos</span>
              <span style={{ fontSize:22, fontWeight:700, color:'#070D1F' }}>{credits}</span>
            </div>
            <div style={{ height:4, background:'rgba(7,13,31,.1)', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', width:`${creditPct}%`, background:'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', borderRadius:99 }} />
            </div>
            <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:10 }}>
              {subscription
                ? `Plano ativo até ${new Date((subscription as any).current_period_end).toLocaleDateString('pt-BR')}`
                : 'Sem plano ativo'}
            </div>
            <button onClick={() => navigate('settings')} style={{ width:'100%', height:34, background:'rgba(255,255,255,.6)', border:'1px solid rgba(7,13,31,.1)', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', color:'#374151' }}>
              Comprar créditos →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
