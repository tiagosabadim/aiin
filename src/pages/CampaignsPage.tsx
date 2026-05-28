// ============================================================
//  aiin · CampaignsPage
//  Lista todos os cronogramas salvos. Permite retomar, editar
//  e aprovar posts de campanhas anteriores.
// ============================================================
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { createContentJob } from '../lib/api'
import type { Workspace, BrandProfile, Subscription, ContentType } from '../types/database'
import { CREDIT_COSTS } from '../types/database'
import { useAuth } from '../hooks/useAuth'

interface Props {
  workspace: Workspace
  brand: BrandProfile
  subscription: Subscription | null
  credits: number
  navigate: (r: string) => void
}

interface Campaign {
  id: string
  title: string
  period: string
  start_date: string
  end_date: string
  posts_per_week: number
  theme: string | null
  status: string
  created_at: string
  items?: CampaignItem[]
}

interface CampaignItem {
  id: string
  campaign_id: string
  position: number
  scheduled_date: string
  content_type: ContentType
  title: string
  objective: string
  extra_context: string
  hashtags: string[]
  required_credits: number
  status: 'pending' | 'approved' | 'generating' | 'done'
  job_id: string | null
}

const TYPE_LABELS: Record<string, string> = {
  post_simples: 'Post estático', post_premium: 'Post premium',
  carrossel_5: 'Carrossel 5p', carrossel_7: 'Carrossel 7p',
  story: 'Story', capa_reels: 'Capa Reels',
}

const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const PERIOD_LABELS: Record<string, string> = {
  semana: '1 semana', quinzena: '2 semanas', mes: '1 mês'
}

export function CampaignsPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loadingItems, setLoadingItems] = useState<string | null>(null)
  const [approvingItem, setApprovingItem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchCampaigns() }, [])

  const fetchCampaigns = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('content_campaigns')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
    setCampaigns(data ?? [])
    setLoading(false)
  }

  const toggleExpand = async (campaign: Campaign) => {
    if (expanded === campaign.id) { setExpanded(null); return }
    setExpanded(campaign.id)

    // Já tem items carregados
    if (campaign.items) return

    setLoadingItems(campaign.id)
    const { data } = await supabase
      .from('campaign_items')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('position', { ascending: true })

    setCampaigns(prev => prev.map(c =>
      c.id === campaign.id ? { ...c, items: data ?? [] } : c
    ))
    setLoadingItems(null)
  }

  const approveItem = async (campaignId: string, item: CampaignItem) => {
    if (!user) return
    setApprovingItem(item.id)
    setError(null)

    // Atualiza estado local para 'generating'
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId
        ? { ...c, items: c.items?.map(i => i.id === item.id ? { ...i, status: 'generating' as const } : i) }
        : c
    ))

    try {
      const { data: brief } = await supabase.from('content_briefs').insert({
        workspace_id: workspace.id, brand_id: brand.id, created_by: user.id,
        title: item.title, objective: item.objective,
        content_type: item.content_type, quantity: 1,
        extra_context: item.extra_context, hashtags: item.hashtags,
        required_credits: item.required_credits, status: 'confirmed',
      }).select().single()

      if (!brief) throw new Error('Falha ao criar briefing')

      const job = await createContentJob({
        workspaceId: workspace.id, briefId: brief.id,
        brandId: brand.id, jobType: item.content_type, quantity: 1,
        inputPayload: {
          title: item.title, objective: item.objective,
          tone_of_voice: brand.tone_of_voice, extra_context: item.extra_context,
          hashtags: item.hashtags, brand_name: brand.name,
          segment: brand.segment, target_audience: brand.target_audience,
          products: brand.products, color_palette: brand.color_palette,
          slogans: brand.slogans, design_rules: brand.design_rules,
          forbidden_words: brand.forbidden_words, brand_dna: brand.ai_brand_dna,
          logo_urls: brand.logo_urls, quantity: 1, content_type: item.content_type,
        },
      })

      await supabase.from('campaign_items')
        .update({ status: 'approved', job_id: job.id })
        .eq('id', item.id)

      setCampaigns(prev => prev.map(c =>
        c.id === campaignId
          ? { ...c, items: c.items?.map(i => i.id === item.id ? { ...i, status: 'done' as const, job_id: job.id } : i) }
          : c
      ))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao aprovar')
      setCampaigns(prev => prev.map(c =>
        c.id === campaignId
          ? { ...c, items: c.items?.map(i => i.id === item.id ? { ...i, status: 'pending' as const } : i) }
          : c
      ))
    } finally {
      setApprovingItem(null)
    }
  }

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Deletar este cronograma? Os posts já gerados não serão afetados.')) return
    await supabase.from('content_campaigns').delete().eq('id', campaignId)
    setCampaigns(prev => prev.filter(c => c.id !== campaignId))
    if (expanded === campaignId) setExpanded(null)
  }

  const statusSummary = (items?: CampaignItem[]) => {
    if (!items) return null
    const done    = items.filter(i => i.status === 'done').length
    const pending = items.filter(i => i.status === 'pending').length
    return { done, pending, total: items.length }
  }

  if (loading) return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Cronogramas</h1>
      </div>
      {[1,2,3].map(i => (
        <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-xl)', marginBottom: 12 }} />
      ))}
    </div>
  )

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Cronogramas</h1>
          <p className="page-sub">
            {campaigns.length === 0
              ? 'Nenhum cronograma ainda — crie um em Novo pedido.'
              : `${campaigns.length} cronograma${campaigns.length > 1 ? 's' : ''} · Retome onde parou`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('briefing')}>
          + Novo cronograma
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid rgba(226,75,74,.2)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {campaigns.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>Nenhum cronograma ainda</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Planeje sua semana, quinzena ou mês de posts de uma vez.</div>
          <button className="btn btn-primary" onClick={() => navigate('briefing')}>✦ Criar primeiro cronograma</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {campaigns.map(campaign => {
          const isOpen = expanded === campaign.id
          const summary = statusSummary(campaign.items)
          const allDone = summary && summary.done === summary.total
          const hasPending = summary && summary.pending > 0

          return (
            <div key={campaign.id} style={{
              background: 'var(--surface)',
              border: `1px solid ${isOpen ? 'rgba(247,37,133,.25)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              transition: 'border-color .2s',
            }}>

              {/* Header da campanha */}
              <div
                onClick={() => toggleExpand(campaign)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
              >
                {/* Ícone período */}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--gradient-soft)', border: '1px solid rgba(247,37,133,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  📅
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {campaign.title}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      {PERIOD_LABELS[campaign.period] ?? campaign.period} · {new Date(campaign.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })} → {new Date(campaign.end_date + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
                    </span>
                    {summary && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: allDone ? 'var(--success-light)' : hasPending ? 'var(--gradient-soft)' : 'var(--surface-3)', color: allDone ? 'var(--success)' : hasPending ? 'var(--accent-pink)' : 'var(--text-4)', fontWeight: 500 }}>
                        {allDone ? `✓ ${summary.total} gerados` : `${summary.done}/${summary.total} gerados`}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={e => { e.stopPropagation(); deleteCampaign(campaign.id) }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 6 }}
                    title="Deletar cronograma"
                  >
                    ×
                  </button>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-4)', transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Items expandidos */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>

                  {loadingItems === campaign.id && (
                    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--radius-lg)' }} />)}
                    </div>
                  )}

                  {campaign.items && campaign.items.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--text-4)' }}>
                      Nenhum item encontrado neste cronograma.
                    </div>
                  )}

                  {campaign.items && campaign.items.map(item => {
                    const date = new Date(item.scheduled_date + 'T12:00:00')
                    const weekday = WEEKDAYS[date.getDay()]
                    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                    const isApproving = approvingItem === item.id

                    const statusConfig = {
                      pending:    { label: 'Pendente',   color: 'var(--text-4)',     bg: 'var(--surface-3)' },
                      approved:   { label: 'Aprovado',   color: 'var(--success)',    bg: 'var(--success-light)' },
                      generating: { label: 'Gerando...', color: 'var(--accent-pink)',bg: 'var(--gradient-soft)' },
                      done:       { label: 'Gerado ✓',   color: 'var(--success)',    bg: 'var(--success-light)' },
                    }
                    const st = statusConfig[item.status]

                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 18px',
                        borderBottom: '1px solid var(--border)',
                        background: item.status === 'generating' ? 'rgba(247,37,133,.03)' : 'transparent',
                      }}>

                        {/* Data */}
                        <div style={{ width: 38, textAlign: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{weekday}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2 }}>{dateStr.split(' ')[0]}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{dateStr.split(' ')[1]}</div>
                        </div>

                        <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />

                        {/* Formato */}
                        <div style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: 'var(--gradient-soft)', border: '1px solid rgba(247,37,133,.15)', color: 'var(--text-1)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {TYPE_LABELS[item.content_type] ?? item.content_type}
                        </div>

                        {/* Título */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </div>
                          {item.extra_context && (
                            <div style={{ fontSize: 11, color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.extra_context}
                            </div>
                          )}
                        </div>

                        {/* Status + ação */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {st.label}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{item.required_credits} cr.</span>

                          {item.status === 'pending' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => approveItem(campaign.id, item)}
                              disabled={isApproving || credits < item.required_credits}
                            >
                              {isApproving ? (
                                <span className="spin" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                              ) : '✓ Aprovar'}
                            </button>
                          )}

                          {item.status === 'generating' && (
                            <span className="spin" style={{ width: 13, height: 13, border: '2px solid rgba(247,37,133,.3)', borderTopColor: 'var(--accent-pink)', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
                          )}

                          {item.status === 'done' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate('posts')}>
                              Ver →
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Footer da campanha */}
                  {campaign.items && campaign.items.length > 0 && (
                    <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
                        {campaign.items.filter(i => i.status === 'pending').length} pendentes · {credits} créditos disponíveis
                      </span>
                      {campaign.items.some(i => i.status === 'pending') && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={approvingItem !== null}
                          onClick={async () => {
                            const pending = campaign.items!.filter(i => i.status === 'pending')
                            for (const item of pending) {
                              await approveItem(campaign.id, item)
                            }
                          }}
                        >
                          ✦ Aprovar todos pendentes
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
