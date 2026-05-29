// aiin · DashboardPage v4 — Dashboard completo conforme mockup
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Workspace, BrandProfile, Subscription } from '../types/database'
import type { Route } from '../App'

interface Props {
  workspace: Workspace; brand: BrandProfile
  subscription: Subscription | null; credits: number
  navigate: (r: Route) => void
}

interface PostInsight {
  id: string; impressions: number; reach: number; likes: number
  comments: number; saved: number; shares: number; engagement_rate: number
  synced_at: string
  output?: { caption: string; public_url: string | null; format: string; published_at: string }
}

interface BrandMetric {
  total_posts: number; avg_reach: number; avg_engagement: number
  total_likes: number; total_comments: number; best_format: string
  best_day: string; ai_summary: string; followers_count?: number
  followers_delta?: number; audience_gender?: { female: number; male: number }
  audience_age?: Record<string, number>; best_hours?: { hour: string; label: string }[]
}

interface Learning { content: string; learning_type: string; positive: boolean }

export function DashboardPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const [period, setPeriod]         = useState<'7'|'30'|'90'>('30')
  const [insights, setInsights]     = useState<PostInsight[]>([])
  const [metrics, setMetrics]       = useState<BrandMetric | null>(null)
  const [learnings, setLearnings]   = useState<Learning[]>([])
  const [outputStats, setOutputStats] = useState({ total: 0, published: 0, scheduled: 0, rejected: 0, pending: 0 })
  const [loading, setLoading]       = useState(true)

  useEffect(() => { fetchAll() }, [period])

  const fetchAll = async () => {
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - parseInt(period))

    const [
      { data: outputs },
      { data: ins },
      { data: met },
      { data: learn },
    ] = await Promise.all([
      supabase.from('creative_outputs').select('status').eq('workspace_id', workspace.id),
      supabase.from('post_insights')
        .select('*, output:creative_outputs(caption,public_url,format,published_at)')
        .eq('workspace_id', workspace.id)
        .gte('synced_at', since.toISOString())
        .order('engagement_rate', { ascending: false })
        .limit(30),
      supabase.from('brand_metrics')
        .select('*').eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('brand_learnings')
        .select('*').eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false }).limit(6),
    ])

    const outs = outputs ?? []
    setOutputStats({
      total:     outs.length,
      published: outs.filter(o => o.status === 'published').length,
      scheduled: outs.filter(o => o.status === 'scheduled').length,
      rejected:  outs.filter(o => o.status === 'rejected').length,
      pending:   outs.filter(o => o.status === 'pending').length,
    })
    setInsights((ins as any) ?? [])
    setMetrics(met ?? null)
    setLearnings((learn as any) ?? [])
    setLoading(false)
  }

  const totalReach    = insights.reduce((s, i) => s + (i.reach ?? 0), 0)
  const totalLikes    = insights.reduce((s, i) => s + (i.likes ?? 0), 0)
  const totalComments = insights.reduce((s, i) => s + (i.comments ?? 0), 0)
  const avgEng        = insights.length > 0
    ? (insights.reduce((s, i) => s + (i.engagement_rate ?? 0), 0) / insights.length).toFixed(1)
    : '0'

  const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n)

  const topPosts = insights.slice(0, 3)

  // Dados do gráfico — agrupa por dia
  const chartData = (() => {
    const days = parseInt(period)
    const buckets: Record<string, { reach: number; engagement: number; label: string }> = {}
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      buckets[key] = { reach: 0, engagement: 0, label }
    }
    insights.forEach(ins => {
      const key = ins.synced_at?.split('T')[0]
      if (key && buckets[key]) {
        buckets[key].reach      += ins.reach ?? 0
        buckets[key].engagement += ins.likes + ins.comments + ins.saved
      }
    })
    return Object.values(buckets)
  })()

  const maxReach = Math.max(...chartData.map(d => d.reach), 1)

  // Horários do metrics ou defaults
  const bestHours = metrics?.best_hours ?? [
    { hour: '18h – 20h', label: 'Melhor horário' },
    { hour: '12h – 14h', label: 'Bom alcance'    },
    { hour: '09h – 11h', label: 'Alcance moderado'},
  ]

  const hourColors = ['#F72585', '#FF6A00', '#7B2CFF']

  // Audiência
  const genderF = metrics?.audience_gender?.female ?? 62
  const genderM = metrics?.audience_gender?.male   ?? 38
  const ageData = metrics?.audience_age ?? { '18–24': 18, '25–34': 46, '35–44': 24, '45+': 12 }

  // Learnings separados em positivos e negativos
  const positive = learnings.filter(l => l.positive !== false).slice(0, 3)
  const negative = learnings.filter(l => l.positive === false).slice(0, 3)

  const Stat = ({ icon, label, value, sub, color, accent }: any) => (
    <div style={{ background: '#fff', border: '1px solid rgba(7,13,31,.08)', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
        <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#070D1F', letterSpacing: '-.5px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
      <div style={{ height: 2, background: color, borderRadius: 99, marginTop: 8, opacity: .7 }} />
    </div>
  )

  return (
    <div className="page" style={{ overflowY: 'auto', paddingBottom: 40 }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#070D1F', letterSpacing: '-.4px', marginBottom: 4 }}>Olá! 👋</h1>
          <p style={{ fontSize: 14, color: '#6B7280' }}>
            Bem-vindo de volta ao <strong style={{ background: 'linear-gradient(135deg,#FF6A00,#F72585)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>aiin</strong>
          </p>
        </div>
      </div>

      {/* Linha 1: stats de posts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat icon="📋" label="Posts gerados"  value={outputStats.total}     sub={`${outputStats.pending} aguardando aprovação`} color="#7B2CFF" />
        <Stat icon="📤" label="Publicados"     value={outputStats.published} sub="total publicado"        color="#1D9E75" />
        <Stat icon="📅" label="Agendados"      value={outputStats.scheduled} sub="prontos para publicar"  color="#FF6A00" />
        <Stat icon="✕"  label="Recusados"      value={outputStats.rejected}  sub="posts recusados"        color="#E24B4A" />
      </div>

      {/* Linha 2: stats instagram */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <Stat icon="👥" label="Seguidores"        value={metrics?.followers_count ? fmt(metrics.followers_count) : '—'} sub={metrics?.followers_delta ? `+${fmt(metrics.followers_delta)} vs. últimos 30 dias ↗` : 'Conecte o Instagram'} color="#7B2CFF" />
        <Stat icon="💬" label="Comentários"       value={fmt(totalComments)} sub="vs. últimos 30 dias ↗" color="#1D9E75" />
        <Stat icon="❤️" label="Curtidas"          value={fmt(totalLikes)}    sub="vs. últimos 30 dias ↗" color="#F72585" />
        <Stat icon="📈" label="Engajamento médio" value={`${avgEng}%`}       sub="vs. últimos 30 dias ↗" color="#FF6A00" />
      </div>

      {/* Linha 3: gráfico + melhores horários + público */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px 280px', gap: 16, marginBottom: 16 }}>

        {/* Gráfico de performance */}
        <div style={{ background: '#fff', border: '1px solid rgba(7,13,31,.08)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#070D1F' }}>Performance dos posts</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['7','30','90'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{ height: 28, padding: '0 10px', border: `1px solid ${period===p?'#7B2CFF':'rgba(7,13,31,.1)'}`, borderRadius: 99, background: period===p?'#7B2CFF':'transparent', color: period===p?'white':'#9CA3AF', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{p}d</button>
              ))}
            </div>
          </div>

          {insights.length === 0 ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28, opacity: .2 }}>📊</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>Nenhum dado ainda.<br />Publique posts para ver a performance.</div>
            </div>
          ) : (
            <>
              {/* Barras */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140, marginBottom: 8 }}>
                {chartData.map((d, i) => {
                  const h = maxReach > 0 ? Math.max((d.reach / maxReach) * 130, d.reach > 0 ? 8 : 0) : 0
                  const hEng = maxReach > 0 ? Math.max((d.engagement / maxReach) * 130, d.engagement > 0 ? 6 : 0) : 0
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: 'center' }}>
                      <div style={{ width: '45%', height: h, background: 'rgba(123,44,255,.5)', borderRadius: '3px 3px 0 0', minHeight: d.reach > 0 ? 4 : 0 }} />
                      <div style={{ width: '45%', height: hEng, background: 'rgba(247,37,133,.5)', borderRadius: '3px 3px 0 0', minHeight: d.engagement > 0 ? 4 : 0 }} />
                    </div>
                  )
                })}
              </div>
              {/* Eixo X — só mostrar algumas labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}>
                {chartData.filter((_, i) => i % Math.ceil(chartData.length / 5) === 0).map((d, i) => (
                  <span key={i}>{d.label}</span>
                ))}
              </div>
              {/* Legenda */}
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                {[['rgba(123,44,255,.5)','Alcance'],['rgba(247,37,133,.5)','Engajamento']].map(([c,l]) => (
                  <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9CA3AF' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: c as string }} />
                    {l}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Melhores horários */}
        <div style={{ background: '#fff', border: '1px solid rgba(7,13,31,.08)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#070D1F', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⏰</span> Melhores horários
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bestHours.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: hourColors[i], flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#070D1F' }}>{h.hour}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i === 0 && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 99, background: 'rgba(247,37,133,.1)', color: '#F72585', fontWeight: 600, border: '1px solid rgba(247,37,133,.2)' }}>★ Melhor horário</span>}
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{h.label}</span>
                </div>
              </div>
            ))}
          </div>
          {!metrics && (
            <div style={{ marginTop: 16, fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>
              Conecte o Instagram para ver os melhores horários da sua conta.
            </div>
          )}
        </div>

        {/* Público */}
        <div style={{ background: '#fff', border: '1px solid rgba(7,13,31,.08)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#070D1F', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>👤</span> Público
          </div>
          {!metrics ? (
            <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6, padding: '16px 0' }}>
              Conecte o Instagram para ver dados do seu público.
            </div>
          ) : (
            <>
              {/* Donut simples */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="24" fill="none" stroke="#EDEEF2" strokeWidth="12"/>
                  <circle cx="32" cy="32" r="24" fill="none" stroke="#F72585" strokeWidth="12"
                    strokeDasharray={`${(genderF/100)*150.8} 150.8`}
                    strokeLinecap="round" transform="rotate(-90 32 32)"/>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[['#F72585','Mulheres',genderF],['#7B2CFF','Homens',genderM]].map(([c,l,v]) => (
                    <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c as string }} />
                      <span style={{ color: '#6B7280' }}>{l}</span>
                      <span style={{ fontWeight: 700, color: '#070D1F', marginLeft: 'auto' }}>{v}%</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Faixa etária */}
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Faixa etária</div>
              {Object.entries(ageData).map(([age, pct]) => (
                <div key={age} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#6B7280', width: 36, flexShrink: 0 }}>{age}</span>
                  <div style={{ flex: 1, height: 6, background: '#EDEEF2', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(135deg,#7B2CFF,#F72585)', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#070D1F', width: 28, textAlign: 'right' }}>{pct}%</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Linha 4: top posts + relatório IA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Top posts */}
        <div style={{ background: '#fff', border: '1px solid rgba(7,13,31,.08)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#070D1F', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏆</span> Posts que mais performaram
          </div>
          {topPosts.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>
              Nenhum post com dados ainda. Publique e aguarde a sincronização.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              {topPosts.map((post, i) => (
                <div key={post.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Thumbnail */}
                  <div style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#F7F8FA', position: 'relative' }}>
                    {post.output?.public_url
                      ? <img src={post.output.public_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, opacity: .2 }}>🖼</div>
                    }
                    <div style={{ position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: '50%', background: i === 0 ? 'linear-gradient(135deg,#FF6A00,#F72585)' : i === 1 ? '#7B2CFF' : '#1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>{i+1}</div>
                  </div>
                  {/* Caption */}
                  <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {post.output?.caption?.slice(0, 60) ?? 'Post'}
                  </div>
                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em' }}>Alcance</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#070D1F' }}>{fmt(post.reach)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em' }}>{i === 0 ? 'Engajamento' : 'Curtidas'}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#070D1F' }}>{i === 0 ? `${post.engagement_rate?.toFixed(1)}%` : fmt(post.likes)}</div>
                    </div>
                    {i === 1 && <div>
                      <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em' }}>Curtidas</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#070D1F' }}>{fmt(post.likes)}</div>
                    </div>}
                    {i === 2 && <div>
                      <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em' }}>Comentários</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#070D1F' }}>{fmt(post.comments)}</div>
                    </div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Relatório da IA */}
        <div style={{ background: '#fff', border: '1px solid rgba(7,13,31,.08)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#070D1F', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: 16 }}>✦</span> Relatório da IA
          </div>
          {learnings.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6, textAlign: 'center', padding: '16px 0' }}>
              A IA ainda não tem dados suficientes para gerar relatórios. Continue publicando!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1D9E75', marginBottom: 10 }}>O que está dando certo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(positive.length > 0 ? positive : [
                    { content: 'Continue publicando para ver análises aqui', positive: true },
                  ]).map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                      <span style={{ color: '#1D9E75', flexShrink: 0, marginTop: 1 }}>✓</span>
                      {l.content}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#E24B4A', marginBottom: 10 }}>O que precisa melhorar</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(negative.length > 0 ? negative : [
                    { content: 'A IA identificará pontos de melhoria em breve', positive: false },
                  ]).map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                      <span style={{ color: '#E24B4A', flexShrink: 0, marginTop: 1 }}>✕</span>
                      {l.content}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {learnings.length > 0 && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(247,37,133,.04)', borderRadius: 8, fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>
              ✦ Esses aprendizados alimentam o motor da <strong style={{ color: '#F72585' }}>aiin</strong> para otimização contínua dos próximos conteúdos.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
