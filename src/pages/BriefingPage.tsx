import { useState } from 'react'
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

type Step = 1 | 2 | 3

const CONTENT_TYPES: { id: ContentType; label: string; desc: string; icon: string; credits: number }[] = [
  { id:'post_simples',    label:'Post estático',      desc:'Imagem única no feed',       icon:'▣', credits:1 },
  { id:'post_premium',   label:'Post premium',        desc:'Alta qualidade + direção',    icon:'◈', credits:2 },
  { id:'carrossel_5',    label:'Carrossel 5 slides',  desc:'Narrativa progressiva',       icon:'◫', credits:3 },
  { id:'carrossel_7',    label:'Carrossel 7 slides',  desc:'Conteúdo mais completo',      icon:'◫', credits:4 },
  { id:'story',          label:'Story avulso',        desc:'Vertical 9:16',               icon:'▯', credits:1 },
  { id:'story_sequencia',label:'Sequência stories',   desc:'3 stories conectados',        icon:'▯', credits:2 },
  { id:'capa_reels',     label:'Capa de Reels',       desc:'Thumbnail vertical',          icon:'▶', credits:1 },
  { id:'campanha',       label:'Arte promocional',    desc:'Promoção ou campanha',        icon:'🎯', credits:2 },
  { id:'kit_campanha',   label:'Kit campanha',        desc:'Pack completo de peças',      icon:'📦', credits:6 },
]

const TONES    = ['Descontraído','Profissional','Inspirador','Divertido','Luxuoso','Educativo']
const OBJECTIVES = ['Gerar vendas','Aumentar seguidores','Engajamento','Lançamento','Reconhecimento','Informar/Educar']

export function BriefingPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const { user } = useAuth()
  const [step, setStep]       = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [contentType, setContentType] = useState<ContentType>('post_simples')
  const [quantity, setQuantity]       = useState(1)
  const [objective, setObjective]     = useState(OBJECTIVES[0])
  const [tone, setTone]               = useState(brand.tone_of_voice ?? TONES[0])
  const [hashtags, setHashtags]       = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [title, setTitle]             = useState('')

  const selectedType  = CONTENT_TYPES.find(t => t.id === contentType)!
  const totalCredits  = (CREDIT_COSTS[contentType] ?? 1) * quantity
  const hasCredits    = credits >= totalCredits

  const addHashtag = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    let val = hashtagInput.trim()
    if (!val) return
    if (!val.startsWith('#')) val = '#' + val
    if (!hashtags.includes(val)) setHashtags(p => [...p, val])
    setHashtagInput('')
  }

  const submit = async () => {
    if (!user || !hasCredits) return
    setLoading(true); setError(null)
    try {
      const { data: brief, error: bErr } = await supabase.from('content_briefs').insert({
        workspace_id: workspace.id, brand_id: brand.id, created_by: user.id,
        title: title || `${selectedType.label} — ${new Date().toLocaleDateString('pt-BR')}`,
        objective, content_type: contentType, quantity, tone, hashtags,
        extra_context: extraContext, required_credits: totalCredits, status: 'confirmed',
      }).select().single()
      if (bErr) throw bErr

      await createContentJob({
        workspaceId: workspace.id, briefId: brief.id,
        brandId: brand.id, jobType: contentType, quantity,
        inputPayload: {
          title, objective, tone_of_voice: tone,
          hashtags, quantity, content_type: contentType, extra_context: extraContext,
          brand_name: brand.name, segment: brand.segment, city: brand.city,
          target_audience: brand.target_audience, main_objective: brand.main_objective,
          products: brand.products, color_palette: brand.color_palette,
          slogans: brand.slogans, typography: brand.typography,
          design_rules: brand.design_rules, forbidden_words: brand.forbidden_words,
          instagram_handle: brand.instagram_handle, brand_dna: brand.ai_brand_dna,
          logo_urls: brand.logo_urls,
        },
      })
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar pedido.')
    } finally { setLoading(false) }
  }

  if (success) return (
    <div className="page" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:20, textAlign:'center' }}>
      <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--gradient-soft)', border:'1px solid rgba(247,37,133,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>✦</div>
      <div>
        <h2 style={{ fontSize:22, fontWeight:600, color:'var(--text-1)', marginBottom:6 }}>Pedido enviado!</h2>
        <p style={{ fontSize:14, color:'var(--text-3)', maxWidth:380, lineHeight:1.6 }}>
          A IA já começou. Acompanhe em tempo real na página de aprovação.
        </p>
      </div>
      <div className="card-gradient" style={{ maxWidth:400, width:'100%', textAlign:'left' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid var(--accent-pink)', borderTopColor:'transparent' }} className="spin" />
          <span style={{ fontSize:13, fontWeight:500, color:'var(--text-1)' }}>Gerando agora</span>
        </div>
        {['GPT-4o criando copy e estrutura','gpt-image-2 gerando imagens','Salvando e notificando'].map(s => (
          <div key={s} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-3)', marginBottom:4 }}>
            <span style={{ color:'var(--accent-pink)' }}>→</span> {s}
          </div>
        ))}
        <div style={{ fontSize:11, color:'var(--text-4)', marginTop:8 }}>Tempo estimado: 30–60s</div>
      </div>
      <p style={{ fontSize:12, color:'var(--text-4)' }}>{totalCredits} crédito{totalCredits > 1 ? 's' : ''} debitado{totalCredits > 1 ? 's' : ''}. Restam {credits - totalCredits}.</p>
      <div style={{ display:'flex', gap:10 }}>
        <button className="btn btn-primary" onClick={() => navigate('posts')}>Ver em tempo real →</button>
        <button className="btn btn-ghost" onClick={() => { setSuccess(false); setStep(1); setTitle('') }}>Novo pedido</button>
      </div>
    </div>
  )

  return (
    <div className="page" style={{ maxWidth:660, margin:'0 auto', width:'100%' }}>
      <div style={{ marginBottom:24 }}>
        <h1 className="page-title">Novo pedido</h1>
        <p className="page-sub">A IA vai criar com a identidade da <strong style={{ color:'var(--text-1)' }}>{brand.name}</strong></p>
      </div>

      {/* Brand DNA badge */}
      <div className="card-gradient" style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24, padding:'10px 14px' }}>
        <span style={{ background:'var(--gradient)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontSize:16 }}>✦</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>Brand DNA ativo</div>
          <div style={{ fontSize:11, color:'var(--text-3)' }}>Cores, tom, slogan e regras aplicados automaticamente</div>
        </div>
        <span style={{ fontSize:11, color:'var(--text-2)', background:'var(--surface)', padding:'2px 8px', borderRadius:99, border:'1px solid var(--border-md)', whiteSpace:'nowrap' }}>
          {brand.ai_context_pct}% contexto
        </span>
      </div>

      {/* Steps */}
      <div style={{ display:'flex', alignItems:'center', marginBottom:24, gap:0 }}>
        {(['Formato','Detalhes','Revisar'] as const).map((label, i) => {
          const n = (i+1) as Step; const active = step === n; const done = step > n
          return (
            <div key={label} style={{ display:'flex', alignItems:'center', flex: i < 2 ? 1 : 'none' }}>
              <div onClick={() => done && setStep(n)} style={{ display:'flex', alignItems:'center', gap:6, cursor: done ? 'pointer' : 'default' }}>
                <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0, transition:'all .2s',
                  background: done || active ? 'var(--gradient)' : 'var(--surface-3)',
                  color: done || active ? 'white' : 'var(--text-4)',
                  boxShadow: active ? '0 0 0 3px rgba(247,37,133,.15)' : 'none',
                }}>{done ? '✓' : n}</div>
                <span style={{ fontSize:12, color: active ? 'var(--text-1)' : done ? 'var(--accent-pink)' : 'var(--text-4)', fontWeight: active ? 500 : 400, whiteSpace:'nowrap' }}>{label}</span>
              </div>
              {i < 2 && <div style={{ flex:1, height:1, background: done ? 'var(--gradient)' : 'var(--border)', margin:'0 10px', transition:'background .3s' }} />}
            </div>
          )
        })}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label className="label">Tipo de conteúdo</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {CONTENT_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setContentType(ct.id)} style={{
                  padding:'11px 10px', border:`1px solid ${contentType === ct.id ? 'rgba(247,37,133,.4)' : 'var(--border-md)'}`,
                  borderRadius:'var(--radius-lg)', background: contentType === ct.id ? 'var(--gradient-soft)' : 'var(--surface)',
                  cursor:'pointer', textAlign:'center', transition:'all .15s', fontFamily:'var(--font-sans)',
                }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{ct.icon}</div>
                  <div style={{ fontSize:12, fontWeight: contentType === ct.id ? 600 : 400, color: contentType === ct.id ? 'var(--text-1)' : 'var(--text-2)' }}>{ct.label}</div>
                  <div style={{ fontSize:10, color:'var(--text-4)', marginTop:2 }}>{ct.credits} crédito{ct.credits > 1 ? 's' : ''}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Quantidade</label>
            <div style={{ display:'flex', gap:6 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setQuantity(n)} style={{
                  width:42, height:42, borderRadius:'var(--radius-md)',
                  border:`1px solid ${quantity === n ? 'rgba(247,37,133,.4)' : 'var(--border-md)'}`,
                  background: quantity === n ? 'var(--gradient-soft)' : 'var(--surface)',
                  color: quantity === n ? 'var(--text-1)' : 'var(--text-3)',
                  fontSize:14, fontWeight: quantity === n ? 600 : 400,
                  fontFamily:'var(--font-sans)', cursor:'pointer', transition:'all .15s',
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* Resumo créditos */}
          <div style={{ padding:'10px 14px', borderRadius:'var(--radius-md)', background: hasCredits ? 'var(--surface-2)' : 'var(--red-light)', border:`1px solid ${hasCredits ? 'var(--border)' : 'rgba(226,75,74,.2)'}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color: hasCredits ? 'var(--text-2)' : 'var(--red)' }}>
              {quantity}× {selectedType.label} = <strong style={{ color: hasCredits ? 'var(--text-1)' : 'var(--red)' }}>{totalCredits} créditos</strong>
            </span>
            <span style={{ fontSize:12, color: hasCredits ? 'var(--text-4)' : 'var(--red)' }}>
              {hasCredits ? `${credits} disponíveis` : `Insuficiente (${credits})`}
            </span>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!hasCredits}>Próximo →</button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label className="label">Tema do post *</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="ex: Promoção de dia das mães, lançamento do novo produto, dicas de cuidados..." />
            <div style={{ fontSize:11, color:'var(--text-4)', marginTop:4 }}>O tema guia toda a criação — quanto mais específico, melhor o resultado.</div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label className="label">Objetivo</label>
              <select className="input" value={objective} onChange={e => setObjective(e.target.value)}>
                {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tom de voz</label>
              <select className="input" value={tone} onChange={e => setTone(e.target.value)}>
                {TONES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Hashtags extras</label>
            <input className="input" value={hashtagInput} onChange={e => setHashtagInput(e.target.value)}
              onKeyDown={addHashtag} placeholder="Digite e pressione Enter" />
            {hashtags.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                {hashtags.map(h => (
                  <span key={h} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', background:'var(--gradient-soft)', border:'1px solid rgba(247,37,133,.15)', color:'var(--text-1)', borderRadius:99, fontSize:12 }}>
                    {h}
                    <button onClick={() => setHashtags(p => p.filter(x => x !== h))} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Contexto extra para a IA</label>
            <textarea className="input" value={extraContext} onChange={e => setExtraContext(e.target.value)}
              rows={3} style={{ resize:'vertical' }}
              placeholder="ex: destacar promoção 30% off, usar tom mais emotivo, mencionar entrega grátis..." />
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'space-between' }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Voltar</button>
            <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!title.trim()}>Próximo →</button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {[
              ['Tipo',       selectedType.label],
              ['Tema',       title || '—'],
              ['Quantidade', `${quantity} post${quantity > 1 ? 's' : ''}`],
              ['Objetivo',   objective],
              ['Tom',        tone],
              ['Créditos',   `${totalCredits} créditos`],
              ['Hashtags',   hashtags.join(' ') || 'padrão da marca'],
            ].map(([k,v], i, arr) => (
              <div key={k} style={{ display:'flex', padding:'11px 16px', borderBottom: i < arr.length-1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize:12, color:'var(--text-3)', minWidth:90, fontWeight:500 }}>{k}</span>
                <span style={{ fontSize:13, color:'var(--text-1)', flex:1 }}>{v}</span>
                <button onClick={() => setStep(i < 2 ? 1 : 2)} style={{ background:'none', border:'none', color:'var(--accent-pink)', cursor:'pointer', fontSize:12, fontFamily:'var(--font-sans)' }}>editar</button>
              </div>
            ))}
          </div>

          {extraContext && (
            <div style={{ padding:'10px 14px', background:'var(--surface-2)', borderRadius:'var(--radius-md)', fontSize:12, color:'var(--text-2)', border:'1px solid var(--border)' }}>
              <strong>Contexto:</strong> {extraContext}
            </div>
          )}

          {error && (
            <div style={{ padding:'10px 14px', background:'var(--red-light)', border:'1px solid rgba(226,75,74,.2)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--red)' }}>{error}</div>
          )}

          <div style={{ display:'flex', gap:10, justifyContent:'space-between', marginTop:4 }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>← Voltar</button>
            <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ opacity: loading ? .7 : 1 }}>
              {loading
                ? <><span className="spin" style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }} /> Enviando...</>
                : `✦ Criar ${quantity} post${quantity > 1 ? 's' : ''} · ${totalCredits} créditos`
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
