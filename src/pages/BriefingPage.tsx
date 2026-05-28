// aiin · BriefingPage v4 — Split-screen
// Usa .page-split / .page-split-left / .page-split-right do CSS v4
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

type Period = 'semana' | 'quinzena' | 'mes'

interface Item {
  id: string; position: number; scheduled_date: string
  content_type: ContentType; title: string; objective: string
  extra_context: string; hashtags: string[]; reference_files: File[]
  status: 'pending' | 'approved' | 'generating' | 'done'; editing: boolean
}

const TYPE_LABELS: Record<string, string> = {
  post_simples: 'Post estático', carrossel_5: 'Carrossel 5p',
  story: 'Story', capa_reels: 'Capa Reels',
  post_premium: 'Post premium', carrossel_7: 'Carrossel 7p',
}
const PERIOD_DAYS: Record<Period, number> = { semana: 7, quinzena: 14, mes: 30 }
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export function BriefingPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const { user } = useAuth()
  const [phase, setPhase]   = useState<'plan' | 'schedule'>('plan')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Fase plan
  const [period, setPeriod] = useState<Period>('semana')
  const [ppw, setPpw]       = useState(3)
  const [startDate, setStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
  })
  const [theme, setTheme]   = useState('')
  const [nPost, setNPost]   = useState(2)
  const [nCar,  setNCar]    = useState(1)
  const [nSt,   setNSt]     = useState(0)

  // Fase schedule
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [items, setItems]           = useState<Item[]>([])
  const [approvingAll, setApprovingAll] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const totalFormats = nPost + nCar + nSt
  const estCr        = nPost + nCar * 3 + nSt
  const totalCr      = items.reduce((s, i) => s + (CREDIT_COSTS[i.content_type] ?? 1), 0)
  const hasCredits   = credits >= (phase === 'plan' ? estCr : totalCr)
  const nDone        = items.filter(i => i.status === 'done' || i.status === 'generating').length

  const generate = async () => {
    if (!user || totalFormats === 0) return
    setLoading(true); setError(null)
    try {
      const start = new Date(startDate)
      const end   = new Date(start); end.setDate(end.getDate() + PERIOD_DAYS[period] - 1)
      const { data: camp, error: e } = await supabase.from('content_campaigns').insert({
        workspace_id: workspace.id, brand_id: brand.id, created_by: user.id,
        title: theme || `Campanha ${period} — ${start.toLocaleDateString('pt-BR')}`,
        period, start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0], posts_per_week: ppw, theme, status: 'draft',
      }).select().single()
      if (e) throw e
      setCampaignId(camp.id)

      const mix: ContentType[] = [
        ...Array(nPost).fill('post_simples'),
        ...Array(nCar).fill('carrossel_5'),
        ...Array(nSt).fill('story'),
      ]
      const fmix = mix.reduce((a: Record<string,number>, t) => { a[t]=(a[t]??0)+1; return a }, {})
      const mixStr = Object.entries(fmix).map(([k,v]) => `${v}× ${TYPE_LABELS[k]??k}`).join(', ')
      const prompt = `Estrategista de conteúdo Instagram Brasil.\nBRAND DNA:\n${brand.ai_brand_dna ?? ''}\nMARCA: ${brand.name} | Segmento: ${brand.segment} | Público: ${brand.target_audience} | Tom: ${brand.tone_of_voice}\nPERÍODO: ${period} (${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}) | ${ppw} posts/semana | Mix: ${mixStr}\nTEMA: ${theme || 'livre'}\nRetorne SOMENTE JSON:\n{"items":[{"date":"YYYY-MM-DD","format":"post_simples|carrossel_5|story|capa_reels","title":"tema pt-BR","objective":"objetivo","context":"contexto IA","hashtags":["#tag"]}]}`

      const res  = await fetch('/api/generate-schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar')
      const parsed = JSON.parse(data.content)
      const si: Item[] = parsed.items.map((it: any, idx: number) => ({
        id: `i-${idx}`, position: idx + 1, scheduled_date: it.date,
        content_type: it.format as ContentType, title: it.title,
        objective: it.objective ?? '', extra_context: it.context ?? '',
        hashtags: it.hashtags ?? [], reference_files: [], status: 'pending', editing: false,
      }))
      await supabase.from('campaign_items').insert(si.map(it => ({
        campaign_id: camp.id, workspace_id: workspace.id, brand_id: brand.id,
        position: it.position, scheduled_date: it.scheduled_date, content_type: it.content_type,
        title: it.title, objective: it.objective, extra_context: it.extra_context,
        hashtags: it.hashtags, required_credits: CREDIT_COSTS[it.content_type] ?? 1,
      })))
      setItems(si); setPhase('schedule')
    } catch (e: any) {
      setError(e.message ?? 'Erro')
    } finally { setLoading(false) }
  }

  const approveItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item || !campaignId || !user) return
    setItems(p => p.map(i => i.id === itemId ? { ...i, status: 'generating' } : i))
    try {
      const refUrls: string[] = []
      for (const f of item.reference_files) {
        const path = `${workspace.id}/refs/${Date.now()}_${f.name}`
        const { error } = await supabase.storage.from('assets').upload(path, f, { upsert: true })
        if (!error) { const { data: u } = supabase.storage.from('assets').getPublicUrl(path); refUrls.push(u.publicUrl) }
      }
      const { data: brief } = await supabase.from('content_briefs').insert({
        workspace_id: workspace.id, brand_id: brand.id, created_by: user.id,
        title: item.title, objective: item.objective, content_type: item.content_type,
        quantity: 1, extra_context: item.extra_context, hashtags: item.hashtags,
        required_credits: CREDIT_COSTS[item.content_type] ?? 1, status: 'confirmed',
      }).select().single()
      if (!brief) throw new Error('Briefing falhou')
      await createContentJob({
        workspaceId: workspace.id, briefId: brief.id, brandId: brand.id,
        jobType: item.content_type, quantity: 1,
        inputPayload: {
          title: item.title, objective: item.objective, tone_of_voice: brand.tone_of_voice,
          extra_context: item.extra_context, hashtags: item.hashtags, reference_urls: refUrls,
          brand_name: brand.name, segment: brand.segment, target_audience: brand.target_audience,
          products: brand.products, color_palette: brand.color_palette, slogans: brand.slogans,
          design_rules: brand.design_rules, forbidden_words: brand.forbidden_words,
          brand_dna: brand.ai_brand_dna, logo_urls: brand.logo_urls,
          quantity: 1, content_type: item.content_type,
        },
      })
      await supabase.from('campaign_items').update({ status: 'approved' })
        .eq('campaign_id', campaignId).eq('position', item.position)
      setItems(p => p.map(i => i.id === itemId ? { ...i, status: 'done' } : i))
    } catch (e: any) {
      setError(e.message); setItems(p => p.map(i => i.id === itemId ? { ...i, status: 'pending' } : i))
    }
  }

  const approveAll = async () => {
    setApprovingAll(true)
    for (const it of items.filter(i => i.status === 'pending')) await approveItem(it.id)
    setApprovingAll(false)
  }

  // ─── Controle de quantidade ───
  const Counter = ({ val, set, color }: { val: number; set: (n: number) => void; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={() => set(Math.max(0, val-1))} style={{ width: 32, height: 32, borderRadius: 'var(--r6)', border: '1px solid var(--border-md)', background: 'transparent', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>−</button>
      <span style={{ width: 20, textAlign: 'center', fontSize: 16, fontWeight: 700, color }}>{val}</span>
      <button onClick={() => set(val+1)} style={{ width: 32, height: 32, borderRadius: 'var(--r6)', border: '1px solid var(--border-md)', background: 'transparent', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>+</button>
    </div>
  )

  return (
    <div className="page-split">

      {/* ── Esquerda: configuração ── */}
      <div className="page-split-left">
        <div>
          <h1 className="page-title">Planejar conteúdo</h1>
          <p className="page-sub">
            {phase === 'plan' ? 'Configure e a IA monta o cronograma.' : `${items.length} posts · edite e aprove`}
          </p>
        </div>

        {/* Período */}
        <div className="card">
          <div className="label" style={{ marginBottom: 10 }}>Período</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {([['semana','1 semana','~5 posts'],['quinzena','2 semanas','~10'],['mes','1 mês','~20']] as const).map(([v,l,s]) => (
              <button key={v} onClick={() => setPeriod(v)} style={{
                padding: '12px 8px', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${period === v ? 'var(--pink)' : 'var(--border-md)'}`,
                borderRadius: 'var(--r10)',
                background: period === v ? 'var(--gradient-soft)' : 'var(--surface)',
                transition: 'all .12s',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: period === v ? 'var(--text-1)' : 'var(--text-2)', marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{s}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Data + frequência */}
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="label">Data de início</label>
              <input type="date" className="input" value={startDate} onChange={e => setStart(e.target.value)} />
            </div>
            <div>
              <label className="label">Posts/semana</label>
              <div style={{ display: 'flex', gap: 5 }}>
                {[2,3,4,5,7].map(n => (
                  <button key={n} onClick={() => setPpw(n)} style={{
                    flex: 1, height: 40, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1.5px solid ${ppw === n ? 'var(--pink)' : 'var(--border-md)'}`,
                    borderRadius: 'var(--r6)',
                    background: ppw === n ? 'var(--gradient-soft)' : 'transparent',
                    color: ppw === n ? 'var(--text-1)' : 'var(--text-3)',
                    fontSize: 13, fontWeight: ppw === n ? 700 : 400, transition: 'all .12s',
                  }}>{n}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mix */}
        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>Mix de formatos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Posts estáticos', sub: '1 cr. cada',  color: 'var(--purple)',  val: nPost, set: setNPost },
              { label: 'Carrosseis 5p',   sub: '3 cr. cada',  color: 'var(--pink)',    val: nCar,  set: setNCar  },
              { label: 'Stories avulsos', sub: '1 cr. cada',  color: 'var(--orange)',  val: nSt,   set: setNSt   },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{row.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{row.sub}</div>
                </div>
                <Counter val={row.val} set={row.set} color={row.color} />
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{totalFormats} posts · {estCr} créditos est.</span>
              {!hasCredits && <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 500 }}>⚠ {credits} disponíveis</span>}
            </div>
          </div>
        </div>

        {/* Tema */}
        <div>
          <label className="label">Tema <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(opcional)</span></label>
          <input className="input" value={theme} onChange={e => setTheme(e.target.value)} placeholder="ex: coleção inverno, promoção..." />
          <div className="input-hint">A IA cria títulos baseados nisso</div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--r8)', fontSize: 12, color: 'var(--danger)' }}>{error}</div>
        )}

        {/* Spacer empurra botão pro fundo */}
        <div style={{ flex: 1 }} />

        {/* CTA */}
        {phase === 'plan' ? (
          <button className="btn btn-primary btn-lg btn-full" onClick={generate} disabled={loading || totalFormats === 0}>
            {loading ? <><div className="spinner sm" style={{ borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white' }} /> Gerando…</> : '✦ Gerar cronograma'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-primary btn-lg btn-full" onClick={approveAll}
              disabled={approvingAll || !hasCredits || items.every(i => i.status !== 'pending')}>
              {approvingAll ? <><div className="spinner sm" style={{ borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white' }} /> Gerando…</> : `✦ Aprovar todos · ${totalCr} créditos`}
            </button>
            <button className="btn btn-ghost btn-md btn-full" onClick={() => setPhase('plan')}>← Rever configuração</button>
          </div>
        )}

        {nDone > 0 && (
          <div className="card-brand" style={{ textAlign: 'center', padding: '12px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
              {nDone} post{nDone > 1 ? 's' : ''} sendo gerado{nDone > 1 ? 's' : ''} ✦
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('posts')}>Ver em Aprovar →</button>
          </div>
        )}
      </div>

      {/* ── Direita: cronograma ── */}
      <div className="page-split-right">
        {phase === 'plan' ? (
          <div className="empty-state">
            <div className="empty-state-icon">✦</div>
            <div className="empty-state-title">Seu cronograma vai aparecer aqui</div>
            <div className="empty-state-sub">Configure o período e o mix ao lado, depois clique em <strong>Gerar cronograma</strong>. A IA cria os temas antes de gastar qualquer crédito.</div>
          </div>
        ) : (
          <>
            {/* Header sticky */}
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{items.length} posts planejados</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{items.filter(i => i.status === 'pending').length} pendentes · {totalCr} créditos · {credits} disponíveis</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'var(--gradient-soft)', border: '1px solid rgba(247,37,133,.2)', color: 'var(--text-1)' }}>
                {items.filter(i => i.status === 'done').length}/{items.length} gerados
              </span>
            </div>

            {/* Lista */}
            <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(item => (
                <ItemCard
                  key={item.id} item={item} credits={credits}
                  onApprove={() => approveItem(item.id)}
                  onUpdate={p => setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...p } : i))}
                  onAddRef={f => setItems(prev => prev.map(i => i.id === item.id ? { ...i, reference_files: [...i.reference_files, f] } : i))}
                  fileRef={el => { fileRefs.current[item.id] = el }}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── ItemCard ──────────────────────────────────────────────────
function ItemCard({ item, credits, onApprove, onUpdate, onAddRef, fileRef, onNavigate }: {
  item: Item; credits: number; onApprove: () => void
  onUpdate: (p: Partial<Item>) => void; onAddRef: (f: File) => void
  fileRef: (el: HTMLInputElement | null) => void; onNavigate: (r: string) => void
}) {
  const fRef = useRef<HTMLInputElement | null>(null)
  const d    = new Date(item.scheduled_date + 'T12:00:00')
  const cr   = CREDIT_COSTS[item.content_type] ?? 1
  const ST: Record<string,{label:string;color:string;bg:string}> = {
    pending:    { label:'Pendente',  color:'var(--text-4)',  bg:'var(--surface-3)' },
    approved:   { label:'Aprovado',  color:'var(--success)', bg:'var(--success-bg)' },
    generating: { label:'Gerando…',  color:'var(--pink)',    bg:'var(--gradient-soft)' },
    done:       { label:'Gerado ✓',  color:'var(--success)', bg:'var(--success-bg)' },
  }
  const st = ST[item.status]

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r12)', overflow: 'hidden',
      border: `1px solid ${item.status === 'generating' ? 'rgba(247,37,133,.3)' : 'var(--border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        {/* Data */}
        <div style={{ width: 38, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()]}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1 }}>{d.toLocaleDateString('pt-BR',{day:'2-digit'})}</div>
          <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{d.toLocaleDateString('pt-BR',{month:'short'})}</div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />
        {/* Formato */}
        <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: 'var(--gradient-soft)', border: '1px solid rgba(247,37,133,.15)', color: 'var(--text-1)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {TYPE_LABELS[item.content_type] ?? item.content_type}
        </span>
        {/* Título */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
          {item.extra_context && <div style={{ fontSize: 11, color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.extra_context}</div>}
        </div>
        {/* Ações */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 500 }}>{st.label}</span>
          <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{cr}cr</span>
          {item.status === 'pending' && <>
            <button className="btn btn-ghost btn-sm" onClick={() => onUpdate({ editing: !item.editing })}>{item.editing ? 'Fechar' : '✎'}</button>
            <button className="btn btn-success btn-sm" onClick={onApprove} disabled={credits < cr}>✓ Aprovar</button>
          </>}
          {item.status === 'generating' && <div className="spinner sm" style={{ borderTopColor: 'var(--pink)' }} />}
          {item.status === 'done' && <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('posts')}>Ver →</button>}
        </div>
      </div>

      {item.editing && (
        <div style={{ padding: '14px 16px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="label">Tema</label><input className="input" value={item.title} onChange={e => onUpdate({ title: e.target.value })} /></div>
            <div><label className="label">Data</label><input type="date" className="input" value={item.scheduled_date} onChange={e => onUpdate({ scheduled_date: e.target.value })} /></div>
          </div>
          <div><label className="label">Formato</label>
            <select className="input" value={item.content_type} onChange={e => onUpdate({ content_type: e.target.value as ContentType })}>
              {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className="label">Contexto extra</label>
            <textarea className="input" value={item.extra_context} onChange={e => onUpdate({ extra_context: e.target.value })} rows={2} style={{ resize: 'vertical' }} placeholder="ex: usar foto do produto, destacar promoção..." />
          </div>
          <div>
            <label className="label">Imagens de referência</label>
            <input ref={el => { fRef.current = el; fileRef(el) }} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => Array.from(e.target.files ?? []).forEach(f => onAddRef(f))} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => fRef.current?.click()}>+ Foto</button>
              {item.reference_files.map((f, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={URL.createObjectURL(f)} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                  <button onClick={() => onUpdate({ reference_files: item.reference_files.filter((_,j) => j !== i) })} style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: 'var(--danger)', border: 'none', color: 'white', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
