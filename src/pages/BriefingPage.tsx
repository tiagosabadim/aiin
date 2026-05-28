// ============================================================
//  aiin · BriefingPage v3
//  Fluxo: Período → Mix → IA gera cronograma em texto
//         → Usuário edita/adiciona refs → Aprova por post ou tudo
//         → Jobs gerados em background
// ============================================================
import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { createContentJob } from '../lib/api'
import type { Workspace, BrandProfile, Subscription, ContentType } from '../types/database'
import { CREDIT_COSTS } from '../types/database'
import { useAuth } from '../hooks/useAuth'

interface Props {
  workspace: Workspace; brand: BrandProfile
  subscription: Subscription | null; credits: number
  navigate: (r: string) => void
}

type Phase = 'plan' | 'schedule' | 'approve'

interface ScheduleItem {
  id: string
  position: number
  scheduled_date: string
  content_type: ContentType
  title: string
  objective: string
  extra_context: string
  hashtags: string[]
  reference_urls: string[]
  reference_files: File[]
  status: 'pending' | 'approved' | 'generating' | 'done'
  editing: boolean
}

const TYPE_LABELS: Record<string, string> = {
  post_simples: 'Post estático', post_premium: 'Post premium',
  carrossel_5: 'Carrossel 5p', carrossel_7: 'Carrossel 7p',
  story: 'Story', capa_reels: 'Capa Reels',
}

const PERIOD_DAYS: Record<string, number> = { semana: 7, quinzena: 14, mes: 30 }

const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export function BriefingPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const { user } = useAuth()
  const [phase, setPhase] = useState<Phase>('plan')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // ---- FASE 1: Planejamento ----
  const [period, setPeriod]         = useState<'semana'|'quinzena'|'mes'>('semana')
  const [postsPerWeek, setPostsPerWeek] = useState(3)
  const [startDate, setStartDate]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [theme, setTheme]           = useState('')
  const [staticCount, setStaticCount]   = useState(2)
  const [carouselCount, setCarouselCount] = useState(1)
  const [storyCount, setStoryCount]     = useState(0)

  // ---- FASE 2: Cronograma ----
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [items, setItems]           = useState<ScheduleItem[]>([])
  const [approvingAll, setApprovingAll] = useState(false)
  const [approvedCount, setApprovedCount] = useState(0)

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const totalPostsPlanned = Math.ceil(PERIOD_DAYS[period] / 7 * postsPerWeek)
  const totalCredits = items.reduce((sum, i) => sum + (CREDIT_COSTS[i.content_type] ?? 1), 0)
  const hasCredits = credits >= totalCredits

  // Gera cronograma via GPT-4o
  const generateSchedule = async () => {
    if (!user) return
    setLoading(true); setError(null)
    try {
      const start = new Date(startDate)
      const end   = new Date(start)
      end.setDate(end.getDate() + PERIOD_DAYS[period] - 1)

      // Cria campanha no banco
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

      // Monta mix de formatos
      const mix: ContentType[] = []
      for (let i = 0; i < staticCount;  i++) mix.push('post_simples')
      for (let i = 0; i < carouselCount; i++) mix.push('carrossel_5')
      for (let i = 0; i < storyCount;    i++) mix.push('story')

      // Chama GPT-4o via Netlify Function (key segura no servidor)
      const prompt = buildSchedulePrompt(brand, period, postsPerWeek, mix, theme, start, end)
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
        title: item.title,
        objective: item.objective ?? '',
        extra_context: item.context ?? '',
        hashtags: item.hashtags ?? [],
        reference_urls: [], reference_files: [],
        status: 'pending', editing: false,
      }))

      // Salva itens no banco
      await supabase.from('campaign_items').insert(
        scheduleItems.map(it => ({
          campaign_id: campaign.id, workspace_id: workspace.id,
          brand_id: brand.id, position: it.position,
          scheduled_date: it.scheduled_date, content_type: it.content_type,
          title: it.title, objective: it.objective,
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

  // Aprova um item e dispara geração
  const approveItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item || !campaignId || !user) return

    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'generating' } : i))

    try {
      // Upload das referências do item
      const refUrls: string[] = [...item.reference_urls]
      for (const file of item.reference_files) {
        const path = `${workspace.id}/refs/${Date.now()}_${file.name}`
        const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
        if (!error) {
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
          refUrls.push(urlData.publicUrl)
        }
      }

      // Cria brief
      const { data: brief } = await supabase.from('content_briefs').insert({
        workspace_id: workspace.id, brand_id: brand.id, created_by: user.id,
        title: item.title, objective: item.objective,
        content_type: item.content_type, quantity: 1,
        extra_context: item.extra_context, hashtags: item.hashtags,
        required_credits: CREDIT_COSTS[item.content_type] ?? 1, status: 'confirmed',
      }).select().single()

      if (!brief) throw new Error('Falha ao criar briefing')

      // Dispara geração
      const job = await createContentJob({
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

      // Atualiza item no banco
      await supabase.from('campaign_items')
        .update({ status: 'approved', job_id: job.id })
        .eq('campaign_id', campaignId).eq('position', item.position)

      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'done' } : i))
      setApprovedCount(c => c + 1)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro')
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'pending' } : i))
    }
  }

  // Aprova tudo de uma vez
  const approveAll = async () => {
    setApprovingAll(true)
    const pending = items.filter(i => i.status === 'pending')
    for (const item of pending) {
      await approveItem(item.id)
    }
    setApprovingAll(false)
  }

  // Adiciona referência de imagem a um item
  const addReference = async (itemId: string, file: File) => {
    setItems(prev => prev.map(i => i.id === itemId
      ? { ...i, reference_files: [...i.reference_files, file] }
      : i
    ))
  }

  const totalDone = items.filter(i => i.status === 'done' || i.status === 'generating').length

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Planejar conteúdo</h1>
        <p className="page-sub">
          {phase === 'plan' && 'Defina o período e o mix de conteúdo. A IA gera o cronograma antes de gastar qualquer crédito.'}
          {phase === 'schedule' && `${items.length} posts planejados · ${totalCredits} créditos total · Edite, adicione referências e aprove.`}
        </p>
      </div>

      {/* ── FASE 1: Planejamento ── */}
      {phase === 'plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Período */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 14 }}>Qual período?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {([
                ['semana',   '1 semana',   '3–5 posts'],
                ['quinzena', '2 semanas',  '6–10 posts'],
                ['mes',      '1 mês',      '12–20 posts'],
              ] as const).map(([val, label, sub]) => (
                <button key={val} onClick={() => setPeriod(val)} style={{
                  padding: '14px 12px', border: `1.5px solid ${period === val ? 'var(--accent-pink)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)', background: period === val ? 'var(--gradient-soft)' : 'var(--surface)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all .15s', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: period === val ? 'var(--text-1)' : 'var(--text-2)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Data de início + frequência */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 14 }}>Quando começa?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="label">Data de início</label>
                <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Posts por semana</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[2,3,4,5,7].map(n => (
                    <button key={n} onClick={() => setPostsPerWeek(n)} style={{
                      flex: 1, height: 40, border: `1.5px solid ${postsPerWeek === n ? 'var(--accent-pink)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)', background: postsPerWeek === n ? 'var(--gradient-soft)' : 'transparent',
                      color: postsPerWeek === n ? 'var(--text-1)' : 'var(--text-3)',
                      fontSize: 13, fontWeight: postsPerWeek === n ? 700 : 400,
                      fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mix de formatos */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 14 }}>Mix de formatos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Posts estáticos', sub: '1 crédito cada', color: 'var(--accent-purple)', val: staticCount, set: setStaticCount },
                { label: 'Carrosseis 5p',   sub: '3 créditos cada', color: 'var(--accent-pink)',   val: carouselCount, set: setCarouselCount },
                { label: 'Stories avulsos', sub: '1 crédito cada', color: 'var(--accent-orange)', val: storyCount, set: setStoryCount },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{row.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{row.sub}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => row.set(Math.max(0, row.val - 1))} style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontSize: 16, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <div style={{ width: 28, textAlign: 'center', fontSize: 15, fontWeight: 700, color: row.color }}>{row.val}</div>
                    <button onClick={() => row.set(row.val + 1)} style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontSize: 16, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                </div>
              ))}

              {/* Resumo */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{staticCount + carouselCount + storyCount} posts por ciclo · {(staticCount + storyCount) + carouselCount * 3} créditos estimados</span>
                {!hasCredits && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 500 }}>⚠ Créditos insuficientes ({credits} disponíveis)</span>}
              </div>
            </div>
          </div>

          {/* Tema geral */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>Tema geral (opcional)</div>
            <input className="input" value={theme} onChange={e => setTheme(e.target.value)}
              placeholder="ex: coleção inverno, promoção de aniversário, conteúdo educativo..." />
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 5 }}>A IA vai criar títulos e temas para cada post baseado nisso.</div>
          </div>

          {error && <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid rgba(226,75,74,.2)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--red)' }}>{error}</div>}

          <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} onClick={generateSchedule} disabled={loading || staticCount + carouselCount + storyCount === 0}>
            {loading
              ? <><span className="spin" style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} /> Gerando cronograma...</>
              : '✦ Gerar cronograma'}
          </button>
        </div>
      )}

      {/* ── FASE 2: Cronograma ── */}
      {phase === 'schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Barra de ação */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', position: 'sticky', top: 0, zIndex: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                {totalDone > 0 ? `${totalDone} de ${items.length} gerando...` : `${items.length} posts prontos para revisão`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{totalCredits} créditos · {credits} disponíveis</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPhase('plan')}>← Rever plano</button>
              <button className="btn btn-primary" onClick={approveAll} disabled={approvingAll || !hasCredits || items.every(i => i.status !== 'pending')}>
                {approvingAll
                  ? <><span className="spin" style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} /> Gerando tudo...</>
                  : `✦ Aprovar tudo · ${totalCredits} créditos`}
              </button>
            </div>
          </div>

          {/* Lista de itens */}
          {items.map((item, idx) => (
            <ScheduleItemCard
              key={item.id}
              item={item}
              idx={idx}
              onApprove={() => approveItem(item.id)}
              onUpdate={(patch) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i))}
              onAddRef={(file) => addReference(item.id, file)}
              fileRef={(el) => { fileRefs.current[item.id] = el }}
            />
          ))}

          {totalDone > 0 && (
            <div className="card-gradient" style={{ textAlign: 'center', padding: '14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
                {totalDone} post{totalDone > 1 ? 's' : ''} sendo gerado{totalDone > 1 ? 's' : ''} ✦
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('posts')}>Ver em tempo real →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Card de item do cronograma ----
interface ItemCardProps {
  item: ScheduleItem; idx: number
  onApprove: () => void
  onUpdate: (patch: Partial<ScheduleItem>) => void
  onAddRef: (file: File) => void
  fileRef: (el: HTMLInputElement | null) => void
}

function ScheduleItemCard({ item, idx, onApprove, onUpdate, onAddRef, fileRef }: ItemCardProps) {
  const date = new Date(item.scheduled_date + 'T12:00:00')
  const weekday = WEEKDAYS[date.getDay()]
  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const credits = CREDIT_COSTS[item.content_type] ?? 1
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const statusConfig = {
    pending:    { label: 'Aguardando', color: 'var(--text-4)',    bg: 'var(--surface-3)' },
    approved:   { label: 'Aprovado',   color: 'var(--success)',   bg: 'var(--success-light)' },
    generating: { label: 'Gerando...', color: 'var(--accent-pink)', bg: 'var(--gradient-soft)' },
    done:       { label: 'Gerado ✓',   color: 'var(--success)',   bg: 'var(--success-light)' },
  }
  const st = statusConfig[item.status]

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${item.status === 'generating' ? 'rgba(247,37,133,.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-xl)', overflow: 'hidden', transition: 'all .2s' }}>

      {/* Header do card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: item.editing ? '1px solid var(--border)' : 'none' }}>

        {/* Data */}
        <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{weekday}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2 }}>{dateStr.split(' ')[0]}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{dateStr.split(' ')[1]}</div>
        </div>

        <div style={{ width: 1, height: 36, background: 'var(--border)', flexShrink: 0 }} />

        {/* Formato badge */}
        <div style={{ padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: 'var(--gradient-soft)', border: '1px solid rgba(247,37,133,.15)', color: 'var(--text-1)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {TYPE_LABELS[item.content_type] ?? item.content_type}
        </div>

        {/* Título */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
          {item.extra_context && <div style={{ fontSize: 11, color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.extra_context}</div>}
        </div>

        {/* Status + ações */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 500, whiteSpace: 'nowrap' }}>{st.label}</span>
          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{credits} cr.</span>

          {item.status === 'pending' && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => onUpdate({ editing: !item.editing })}>
                {item.editing ? 'Fechar' : '✎ Editar'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={onApprove}>
                ✓ Aprovar
              </button>
            </>
          )}
          {item.status === 'generating' && (
            <span className="spin" style={{ width: 14, height: 14, border: '2px solid rgba(247,37,133,.3)', borderTopColor: 'var(--accent-pink)', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
          )}
          {item.status === 'done' && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('posts')}>Ver →</button>
          )}
        </div>
      </div>

      {/* Painel de edição expandível */}
      {item.editing && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Tema do post</label>
              <input className="input" value={item.title} onChange={e => onUpdate({ title: e.target.value })} />
            </div>
            <div>
              <label className="label">Data</label>
              <input type="date" className="input" value={item.scheduled_date} onChange={e => onUpdate({ scheduled_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Formato</label>
            <select className="input" value={item.content_type} onChange={e => onUpdate({ content_type: e.target.value as ContentType })}>
              {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Contexto extra para a IA</label>
            <textarea className="input" value={item.extra_context} onChange={e => onUpdate({ extra_context: e.target.value })}
              rows={2} style={{ resize: 'vertical' }} placeholder="ex: usar foto do produto novo, destacar promoção, tom mais emotivo..." />
          </div>

          {/* Upload de referência */}
          <div>
            <label className="label">Imagem de referência para este post</label>
            <input ref={el => { fileInputRef.current = el; fileRef(el) }} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => Array.from(e.target.files ?? []).forEach(f => onAddRef(f))} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>
                + Adicionar foto
              </button>
              {item.reference_files.map((f, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={URL.createObjectURL(f)} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  <button onClick={() => onUpdate({ reference_files: item.reference_files.filter((_,j) => j !== i) })}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--red)', border: 'none', color: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Prompt para geração do cronograma ----
function buildSchedulePrompt(
  brand: BrandProfile, period: string, postsPerWeek: number,
  mix: ContentType[], theme: string, start: Date, end: Date
): string {
  const formatMix = mix.reduce((acc: Record<string,number>, t) => { acc[t] = (acc[t]??0)+1; return acc }, {})
  const mixStr = Object.entries(formatMix).map(([k,v]) => `${v}× ${TYPE_LABELS[k]??k}`).join(', ')

  return `Você é um estrategista de conteúdo para Instagram no Brasil.

BRAND DNA:
${brand.ai_brand_dna ?? ''}

MARCA: ${brand.name}
Segmento: ${brand.segment}
Público: ${brand.target_audience}
Tom de voz: ${brand.tone_of_voice}
Produtos/Serviços: ${brand.products}

PLANEJAMENTO SOLICITADO:
- Período: ${period} (${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')})
- ${postsPerWeek} posts por semana
- Mix de formatos: ${mixStr}
- Tema geral: ${theme || 'nenhum — use criatividade baseada na marca'}

Crie um cronograma de posts estratégico e variado, com temas relevantes para a marca.
Distribua os posts de forma inteligente ao longo do período (evite fins de semana para posts promocionais).
Cada post deve ter um tema claro, objetivo e hashtags específicas.

Retorne SOMENTE este JSON válido:
{
  "items": [
    {
      "date": "YYYY-MM-DD",
      "format": "post_simples|carrossel_5|story|capa_reels",
      "title": "tema criativo e específico do post em português",
      "objective": "objetivo do post (engajamento, vendas, etc)",
      "context": "contexto adicional para a IA na hora de criar a arte",
      "hashtags": ["#tag1", "#tag2", "#tag3"]
    }
  ]
}`
}

// ---- Importações que faltam ----
function navigate(to: string) { window.location.hash = to }
