// ============================================================
//  aiin · BriefingPage v4 — Split-screen + Design System v3
//  Desktop: Esquerda = configuração, Direita = cronograma
//  Mobile: stack vertical, FAB fixo
// ============================================================
import { useState, useRef } from 'react'
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

type Period = 'semana' | 'quinzena' | 'mes'

interface ScheduleItem {
  id: string
  position: number
  scheduled_date: string
  content_type: ContentType
  title: string
  objective: string
  extra_context: string
  hashtags: string[]
  reference_files: File[]
  status: 'pending' | 'approved' | 'generating' | 'done'
  editing: boolean
}

const TYPE_LABELS: Record<string, string> = {
  post_simples: 'Post estático',
  post_premium: 'Post premium',
  carrossel_5:  'Carrossel 5p',
  carrossel_7:  'Carrossel 7p',
  story:        'Story',
  capa_reels:   'Capa Reels',
}

const TYPE_ICONS: Record<string, string> = {
  post_simples: '▣',
  carrossel_5:  '◫',
  story:        '▯',
  capa_reels:   '▶',
}

const PERIOD_DAYS: Record<Period, number> = { semana: 7, quinzena: 14, mes: 30 }
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ---- Status config ----
const ST_CFG = {
  pending:    { label: 'Pendente',  color: 'var(--text-4)',     bg: 'var(--surface-3)' },
  approved:   { label: 'Aprovado',  color: 'var(--success)',    bg: 'var(--success-bg)' },
  generating: { label: 'Gerando…',  color: 'var(--accent-pink)', bg: 'var(--gradient-soft)' },
  done:       { label: 'Gerado ✓',  color: 'var(--success)',    bg: 'var(--success-bg)' },
}

// ============================================================
export function BriefingPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const { user } = useAuth()

  // Fase: 'plan' = configurando, 'schedule' = cronograma gerado
  const [phase, setPhase]     = useState<'plan' | 'schedule'>('plan')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // ── Fase 1: configuração ──
  const [period, setPeriod]         = useState<Period>('semana')
  const [postsPerWeek, setPPW]      = useState(3)
  const [startDate, setStartDate]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [theme, setTheme]           = useState('')
  const [staticCt,   setStaticCt]   = useState(2)
  const [carouselCt, setCarouselCt] = useState(1)
  const [storyCt,    setStoryCt]    = useState(0)

  // ── Fase 2: cronograma ──
  const [campaignId, setCampaignId]     = useState<string | null>(null)
  const [items, setItems]               = useState<ScheduleItem[]>([])
  const [approvingAll, setApprovingAll] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const totalItems   = staticCt + carouselCt + storyCt
  const estCredits   = staticCt * 1 + carouselCt * 3 + storyCt * 1
  const totalCredits = items.reduce((s, i) => s + (CREDIT_COSTS[i.content_type] ?? 1), 0)
  const hasCredits   = credits >= (phase === 'plan' ? estCredits : totalCredits)
  const totalDone    = items.filter(i => i.status === 'done' || i.status === 'generating').length

  // ── Gerar cronograma ──
  const generateSchedule = async () => {
    if (!user || totalItems === 0) return
    setLoading(true); setError(null)
    try {
      const start = new Date(startDate)
      const end   = new Date(start)
      end.setDate(end.getDate() + PERIOD_DAYS[period] - 1)

      const { data: campaign, error: cErr } = await supabase
        .from('content_campaigns')
        .insert({
          workspace_id: workspace.id, brand_id: brand.id, created_by: user.id,
          title: theme || `Campanha ${period} — ${start.toLocaleDateString('pt-BR')}`,
          period, start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          posts_per_week: postsPerWeek, theme, status: 'draft',
        }).select().single()
      if (cErr) throw cErr
      setCampaignId(campaign.id)

      const mix: ContentType[] = []
      for (let i = 0; i < staticCt;   i++) mix.push('post_simples')
      for (let i = 0; i < carouselCt; i++) mix.push('carrossel_5')
      for (let i = 0; i < storyCt;    i++) mix.push('story')

      const prompt = buildPrompt(brand, period, postsPerWeek, mix, theme, start, end)
      const res = await fetch('/api/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar cronograma')

      const parsed = JSON.parse(data.content)
      const scheduleItems: ScheduleItem[] = parsed.items.map((item: any, idx: number) => ({
        id: `item-${idx}`, position: idx + 1,
        scheduled_date: item.date,
        content_type: item.format as ContentType,
        title: item.title, objective: item.objective ?? '',
        extra_context: item.context ?? '', hashtags: item.hashtags ?? [],
        reference_files: [], status: 'pending', editing: false,
      }))

      await supabase.from('campaign_items').insert(
        scheduleItems.map(it => ({
          campaign_id: campaign.id, workspace_id: workspace.id, brand_id: brand.id,
          position: it.position, scheduled_date: it.scheduled_date,
          content_type: it.content_type, title: it.title, objective: it.objective,
          extra_context: it.extra_context, hashtags: it.hashtags,
          required_credits: CREDIT_COSTS[it.content_type] ?? 1,
        }))
      )

      setItems(scheduleItems)
      setPhase('schedule')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar cronograma')
    } finally { setLoading(false) }
  }

  // ── Aprovar item ──
  const approveItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item || !campaignId || !user) return
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'generating' } : i))
    try {
      const refUrls: string[] = []
      for (const file of item.reference_files) {
        const path = `${workspace.id}/refs/${Date.now()}_${file.name}`
        const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
        if (!error) {
          const { data: u } = supabase.storage.from('assets').getPublicUrl(path)
          refUrls.push(u.publicUrl)
        }
      }
      const { data: brief } = await supabase.from('content_briefs').insert({
        workspace_id: workspace.id, brand_id: brand.id, created_by: user.id,
        title: item.title, objective: item.objective,
        content_type: item.content_type, quantity: 1,
        extra_context: item.extra_context, hashtags: item.hashtags,
        required_credits: CREDIT_COSTS[item.content_type] ?? 1, status: 'confirmed',
      }).select().single()
      if (!brief) throw new Error('Falha ao criar briefing')

      await createContentJob({
        workspaceId: workspace.id, briefId: brief.id,
        brandId: brand.id, jobType: item.content_type, quantity: 1,
        inputPayload: {
          title: item.title, objective: item.objective,
          tone_of_voice: brand.tone_of_voice, extra_context: item.extra_context,
          hashtags: item.hashtags, reference_urls: refUrls,
          brand_name: brand.name, segment: brand.segment,
          target_audience: brand.target_audience, products: brand.products,
          color_palette: brand.color_palette, slogans: brand.slogans,
          design_rules: brand.design_rules, forbidden_words: brand.forbidden_words,
          brand_dna: brand.ai_brand_dna, logo_urls: brand.logo_urls,
          quantity: 1, content_type: item.content_type,
        },
      })
      await supabase.from('campaign_items')
        .update({ status: 'approved' })
        .eq('campaign_id', campaignId).eq('position', item.position)
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'done' } : i))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao aprovar')
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'pending' } : i))
    }
  }

  const approveAll = async () => {
    setApprovingAll(true)
    for (const item of items.filter(i => i.status === 'pending')) {
      await approveItem(item.id)
    }
    setApprovingAll(false)
  }

  // ============================================================
  //  RENDER — split-screen
  // ============================================================
  return (
    <div style={{ display: 'flex', minHeight: '100%' }}>

      {/* ── ESQUERDA: configuração ── */}
      <div style={{
        width: '100%', maxWidth: 400, flexShrink: 0,
        background: 'var(--surface-2)',
        borderRight: '1px solid var(--border)',
        padding: '28px 24px',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}
        className="briefing-left"
      >
        {/* Header */}
        <div>
          <h1 className="page-title">Planejar conteúdo</h1>
          <p className="page-sub">
            {phase === 'plan'
              ? 'Configure o período e o mix. A IA monta o cronograma.'
              : `${items.length} posts gerados · edite e aprove`}
          </p>
        </div>

        {/* Período */}
        <div className="card" style={{ padding: '16px 18px' }}>
          <div className="label" style={{ marginBottom: 10 }}>Período</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {([['semana', '1 semana', '~5 posts'], ['quinzena', '2 semanas', '~10 posts'], ['mes', '1 mês', '~20 posts']] as const).map(([val, label, sub]) => (
              <button key={val} onClick={() => setPeriod(val)} style={{
                padding: '12px 8px', textAlign: 'center',
                border: `1.5px solid ${period === val ? 'var(--accent-pink)' : 'var(--border-md)'}`,
                borderRadius: 'var(--r10)',
                background: period === val ? 'var(--gradient-soft)' : 'var(--surface)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all .15s',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: period === val ? 'var(--text-1)' : 'var(--text-2)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Data + frequência */}
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="input-group">
              <label className="label">Data de início</label>
              <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="label">Posts por semana</label>
              <div style={{ display: 'flex', gap: 5 }}>
                {[2, 3, 4, 5, 7].map(n => (
                  <button key={n} onClick={() => setPPW(n)} style={{
                    flex: 1, height: 40,
                    border: `1.5px solid ${postsPerWeek === n ? 'var(--accent-pink)' : 'var(--border-md)'}`,
                    borderRadius: 'var(--r6)',
                    background: postsPerWeek === n ? 'var(--gradient-soft)' : 'transparent',
                    color: postsPerWeek === n ? 'var(--text-1)' : 'var(--text-3)',
                    fontSize: 13, fontWeight: postsPerWeek === n ? 700 : 400,
                    fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all .12s',
                  }}>{n}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mix de formatos */}
        <div className="card" style={{ padding: '16px 18px' }}>
          <div className="label" style={{ marginBottom: 12 }}>Mix de formatos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Posts estáticos', sub: '1 crédito cada', color: 'var(--accent-purple)', icon: '▣', val: staticCt,   set: setStaticCt },
              { label: 'Carrosseis 5p',   sub: '3 créditos cada', color: 'var(--accent-pink)',   icon: '◫', val: carouselCt, set: setCarouselCt },
              { label: 'Stories avulsos', sub: '1 crédito cada', color: 'var(--accent-orange)', icon: '▯', val: storyCt,    set: setStoryCt },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, color: row.color, flexShrink: 0 }}>{row.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-1)' }}>{row.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{row.sub}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => row.set(Math.max(0, row.val - 1))}
                    style={{ width: 28, height: 28, borderRadius: 'var(--r6)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ width: 24, textAlign: 'center', fontSize: 15, fontWeight: 700, color: row.color }}>{row.val}</span>
                  <button onClick={() => row.set(row.val + 1)}
                    style={{ width: 28, height: 28, borderRadius: 'var(--r6)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            ))}

            {/* Resumo */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{totalItems} posts · {estCredits} créditos estimados</span>
              {!hasCredits && <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 500 }}>⚠ {credits} disponíveis</span>}
            </div>
          </div>
        </div>

        {/* Tema */}
        <div className="input-group">
          <label className="label">Tema geral <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(opcional)</span></label>
          <input className="input" value={theme} onChange={e => setTheme(e.target.value)}
            placeholder="ex: coleção inverno, promoção de aniversário..." />
          <div className="input-hint">A IA vai criar títulos baseados nisso</div>
        </div>

        {/* Erro */}
        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--r8)', fontSize: 12, color: 'var(--danger)' }}>{error}</div>
        )}

        {/* CTA */}
        {phase === 'plan' ? (
          <button
            className="btn btn-primary btn-lg btn-full"
            onClick={generateSchedule}
            disabled={loading || totalItems === 0}
          >
            {loading
              ? <><div className="spinner sm" style={{ borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white' }} /> Gerando cronograma…</>
              : '✦ Gerar cronograma'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-primary btn-lg btn-full" onClick={approveAll}
              disabled={approvingAll || !hasCredits || items.every(i => i.status !== 'pending')}>
              {approvingAll
                ? <><div className="spinner sm" style={{ borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white' }} /> Gerando tudo…</>
                : `✦ Aprovar todos · ${totalCredits} créditos`}
            </button>
            <button className="btn btn-ghost btn-md btn-full" onClick={() => setPhase('plan')}>
              ← Rever configuração
            </button>
          </div>
        )}

        {/* Banner posts gerando */}
        {totalDone > 0 && (
          <div className="card-brand" style={{ textAlign: 'center', padding: '12px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
              {totalDone} post{totalDone > 1 ? 's' : ''} sendo gerado{totalDone > 1 ? 's' : ''} ✦
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('posts')}>
              Ver em Aprovar →
            </button>
          </div>
        )}
      </div>

      {/* ── DIREITA: cronograma / empty state ── */}
      <div style={{
        flex: 1, minWidth: 0,
        background: 'var(--surface)',
        padding: phase === 'plan' ? 0 : '28px 28px',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Empty state — fase de planejamento */}
        {phase === 'plan' && (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="empty-state-icon" style={{ fontSize: 28 }}>✦</div>
            <div className="empty-state-title">Seu cronograma vai aparecer aqui</div>
            <div className="empty-state-sub">
              Configure o período e o mix ao lado, depois clique em <strong>Gerar cronograma</strong>.
              A IA cria os temas antes de gastar qualquer crédito.
            </div>
          </div>
        )}

        {/* Cronograma gerado */}
        {phase === 'schedule' && items.length > 0 && (
          <>
            {/* Sticky header */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 10,
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              padding: '14px 28px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
                  {items.length} posts planejados
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {items.filter(i => i.status === 'pending').length} pendentes · {totalCredits} créditos · {credits} disponíveis
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="badge" style={{
                  background: 'var(--gradient-soft)',
                  border: '1px solid rgba(247,37,133,.2)',
                  color: 'var(--text-1)', fontSize: 11,
                }}>
                  {items.filter(i => i.status === 'done').length}/{items.length} gerados
                </span>
              </div>
            </div>

            {/* Lista de itens */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 0 32px' }}>
              {items.map((item) => (
                <ScheduleItemCard
                  key={item.id}
                  item={item}
                  credits={credits}
                  onApprove={() => approveItem(item.id)}
                  onUpdate={patch => setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i))}
                  onAddRef={file => setItems(prev => prev.map(i => i.id === item.id ? { ...i, reference_files: [...i.reference_files, file] } : i))}
                  fileRef={el => { fileRefs.current[item.id] = el }}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* CSS mobile */}
      <style>{`
        @media (max-width: 768px) {
          .briefing-left {
            max-width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid var(--border) !important;
          }
        }
      `}</style>
    </div>
  )
}

// ============================================================
//  Card individual do cronograma
// ============================================================
interface ItemCardProps {
  item: ScheduleItem
  credits: number
  onApprove: () => void
  onUpdate: (patch: Partial<ScheduleItem>) => void
  onAddRef: (file: File) => void
  fileRef: (el: HTMLInputElement | null) => void
  onNavigate: (r: string) => void
}

function ScheduleItemCard({ item, credits, onApprove, onUpdate, onAddRef, fileRef, onNavigate }: ItemCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const date    = new Date(item.scheduled_date + 'T12:00:00')
  const weekday = WEEKDAYS[date.getDay()]
  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const itemCr  = CREDIT_COSTS[item.content_type] ?? 1
  const st      = ST_CFG[item.status]
  const canApprove = item.status === 'pending' && credits >= itemCr

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${item.status === 'generating' ? 'rgba(247,37,133,.3)' : 'var(--border)'}`,
      borderRadius: 'var(--r12)',
      overflow: 'hidden',
      transition: 'all .2s',
      boxShadow: item.status === 'generating' ? '0 0 0 3px rgba(247,37,133,.08)' : 'var(--shadow-xs)',
    }}>

      {/* Row principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>

        {/* Data */}
        <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{weekday}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1 }}>{dateStr.split(' ')[0]}</div>
          <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{dateStr.split(' ')[1]}</div>
        </div>

        <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />

        {/* Formato */}
        <div style={{
          padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
          background: 'var(--gradient-soft)', border: '1px solid rgba(247,37,133,.15)',
          color: 'var(--text-1)', flexShrink: 0, whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span>{TYPE_ICONS[item.content_type] ?? '▣'}</span>
          {TYPE_LABELS[item.content_type] ?? item.content_type}
        </div>

        {/* Título + contexto */}
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

        {/* Status + ações */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {st.label}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{itemCr} cr.</span>

          {item.status === 'pending' && (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onUpdate({ editing: !item.editing })}
              >
                {item.editing ? 'Fechar' : '✎'}
              </button>
              <button
                className="btn btn-success btn-sm"
                onClick={onApprove}
                disabled={!canApprove}
                title={!canApprove ? 'Créditos insuficientes' : undefined}
              >
                ✓ Aprovar
              </button>
            </>
          )}

          {item.status === 'generating' && (
            <div className="spinner sm" style={{ borderTopColor: 'var(--accent-pink)' }} />
          )}

          {item.status === 'done' && (
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('posts')}>
              Ver →
            </button>
          )}
        </div>
      </div>

      {/* Painel de edição */}
      {item.editing && (
        <div style={{ padding: '14px 16px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label className="label">Tema do post</label>
              <input className="input" value={item.title} onChange={e => onUpdate({ title: e.target.value })} />
            </div>
            <div className="input-group">
              <label className="label">Data</label>
              <input type="date" className="input" value={item.scheduled_date} onChange={e => onUpdate({ scheduled_date: e.target.value })} />
            </div>
          </div>

          <div className="input-group">
            <label className="label">Formato</label>
            <select className="input" value={item.content_type} onChange={e => onUpdate({ content_type: e.target.value as ContentType })}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label className="label">Contexto extra para a IA</label>
            <textarea className="input" value={item.extra_context}
              onChange={e => onUpdate({ extra_context: e.target.value })}
              rows={2} style={{ resize: 'vertical' }}
              placeholder="ex: usar foto do produto novo, destacar promoção..." />
          </div>

          {/* Upload de referência */}
          <div>
            <label className="label">Imagens de referência</label>
            <input
              ref={el => { fileInputRef.current = el; fileRef(el) }}
              type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => Array.from(e.target.files ?? []).forEach(f => onAddRef(f))}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>
                + Adicionar foto
              </button>
              {item.reference_files.map((f, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={URL.createObjectURL(f)} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                  <button
                    onClick={() => onUpdate({ reference_files: item.reference_files.filter((_, j) => j !== i) })}
                    style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: 'var(--danger)', border: 'none', color: 'white', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
//  Prompt
// ============================================================
function buildPrompt(brand: BrandProfile, period: string, ppw: number, mix: ContentType[], theme: string, start: Date, end: Date): string {
  const fmix = mix.reduce((acc: Record<string, number>, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc }, {})
  const mixStr = Object.entries(fmix).map(([k, v]) => `${v}× ${TYPE_LABELS[k] ?? k}`).join(', ')
  return `Você é um estrategista de conteúdo para Instagram no Brasil.

BRAND DNA:
${brand.ai_brand_dna ?? ''}

MARCA: ${brand.name} | Segmento: ${brand.segment} | Público: ${brand.target_audience}
Tom de voz: ${brand.tone_of_voice} | Produtos: ${brand.products}

PLANEJAMENTO:
- Período: ${period} (${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')})
- ${ppw} posts por semana | Mix: ${mixStr}
- Tema: ${theme || 'livre — use criatividade baseada na marca'}

Crie cronograma estratégico e variado. Distribua bem ao longo do período.

Retorne SOMENTE JSON válido:
{
  "items": [
    {
      "date": "YYYY-MM-DD",
      "format": "post_simples|carrossel_5|story|capa_reels",
      "title": "tema criativo em português",
      "objective": "objetivo do post",
      "context": "contexto adicional para a IA criar a arte",
      "hashtags": ["#tag1", "#tag2", "#tag3"]
    }
  ]
}`
}
