import { useState } from 'react'
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

type Step = 1 | 2 | 3

const CONTENT_TYPES: { id: ContentType; label: string; desc: string; icon: string; credits: number }[] = [
  { id:'post_simples',    label:'Post estático',      desc:'Imagem única no feed',         icon:'▣', credits:1 },
  { id:'post_premium',   label:'Post premium',        desc:'Alta qualidade + direção',      icon:'◈', credits:2 },
  { id:'carrossel_5',    label:'Carrossel até 5p',    desc:'Até 5 slides navegáveis',       icon:'◫', credits:3 },
  { id:'carrossel_7',    label:'Carrossel até 7p',    desc:'Até 7 slides navegáveis',       icon:'◫', credits:4 },
  { id:'story',          label:'Story avulso',        desc:'Vertical, 24h',                 icon:'▯', credits:1 },
  { id:'story_sequencia',label:'Sequência de stories',desc:'3 stories conectados',          icon:'▯', credits:2 },
  { id:'capa_reels',     label:'Capa de Reels',       desc:'Capa vertical do vídeo',        icon:'▶', credits:1 },
  { id:'campanha',       label:'Arte promocional',    desc:'Promoção ou campanha',          icon:'🎯', credits:2 },
  { id:'kit_campanha',   label:'Kit campanha',        desc:'Pack completo de peças',        icon:'📦', credits:6 },
]

const TONES = ['Descontraído', 'Profissional', 'Inspirador', 'Divertido', 'Luxuoso', 'Educativo']
const OBJECTIVES = ['Gerar vendas', 'Aumentar seguidores', 'Engajamento', 'Lançamento de produto', 'Reconhecimento de marca', 'Informar/Educar']

export function BriefingPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // Form
  const [contentType, setContentType] = useState<ContentType>('post_simples')
  const [quantity, setQuantity] = useState(1)
  const [objective, setObjective] = useState(OBJECTIVES[0])
  const [tone, setTone] = useState(brand.tone_of_voice ?? TONES[0])
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [title, setTitle] = useState('')

  const selectedType = CONTENT_TYPES.find(t => t.id === contentType)!
  const totalCredits = selectedType.credits * quantity
  const hasCredits = credits >= totalCredits

  const addHashtag = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    let val = hashtagInput.trim()
    if (!val) return
    if (!val.startsWith('#')) val = '#' + val
    if (!hashtags.includes(val)) setHashtags(prev => [...prev, val])
    setHashtagInput('')
  }

  const submit = async () => {
    if (!user || !hasCredits) return
    setLoading(true); setError(null); setShowConfirm(false)
    try {
      // 1. Cria brief no banco
      const { data: brief, error: bErr } = await supabase
        .from('content_briefs')
        .insert({
          workspace_id: workspace.id,
          brand_id: brand.id,
          created_by: user.id,
          title: title || `${selectedType.label} — ${new Date().toLocaleDateString('pt-BR')}`,
          objective,
          content_type: contentType,
          quantity,
          tone,
          hashtags,
          extra_context: extraContext,
          required_credits: totalCredits,
          status: 'confirmed',
        })
        .select().single()

      if (bErr) throw bErr

      // 2. Cria job (valida créditos + chama n8n)
      await createContentJob({
        workspaceId: workspace.id,
        briefId: brief.id,
        brandId: brand.id,
        jobType: contentType,
        inputPayload: {
          // Tema do post
          title,
          // Briefing
          objective,
          tone_of_voice: tone,
          hashtags,
          quantity,
          content_type: contentType,
          extra_context: extraContext,
          // Identidade completa da marca
          brand_name: brand.name,
          segment: brand.segment,
          city: brand.city,
          target_audience: brand.target_audience,
          main_objective: brand.main_objective,
          products: brand.products,
          color_palette: brand.color_palette,
          slogans: brand.slogans,
          typography: brand.typography,
          design_rules: brand.design_rules,
          forbidden_words: brand.forbidden_words,
          instagram_handle: brand.instagram_handle,
          brand_dna: brand.ai_brand_dna,
          logo_urls: brand.logo_urls,
        },
      })

      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar pedido.')
    } finally { setLoading(false) }
  }

  if (success) return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:48, gap:16, textAlign:'center' }}>
      <div style={{ width:60, height:60, borderRadius:'50%', background:'var(--brand-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>✦</div>
      <h2 style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--text-1)' }}>Pedido enviado!</h2>
      <p style={{ fontSize:14, color:'var(--text-2)', maxWidth:380, lineHeight:1.6 }}>
        A IA já começou a criar seu conteúdo. Acompanhe o progresso na página de aprovação — o post aparece automaticamente quando estiver pronto.
      </p>
      <div style={{ background:'var(--brand-light)', border:'1px solid rgba(61,90,62,.2)', borderRadius:'var(--radius-lg)', padding:'12px 16px', maxWidth:380, width:'100%' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
          <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid var(--brand)', borderTopColor:'transparent', animation:'spin 1s linear infinite', flexShrink:0 }} />
          <span style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)' }}>Gerando agora</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {['GPT-4o criando copy e estrutura', 'gpt-image-2 gerando imagens', 'Salvando e notificando'].map((step, i) => (
            <div key={step} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--brand-dark)', opacity:.8 }}>
              <span style={{ fontSize:10 }}>→</span> {step}
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:'var(--brand-dark)', opacity:.6, marginTop:8 }}>Tempo estimado: 30–60 segundos</div>
      </div>
      <p style={{ fontSize:12, color:'var(--text-3)' }}>{totalCredits} crédito{totalCredits > 1 ? 's' : ''} debitado{totalCredits > 1 ? 's' : ''}. Restam {credits - totalCredits} créditos.</p>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={() => navigate('posts')} style={btnP}>Ver posts em tempo real →</button>
        <button onClick={() => { setSuccess(false); setStep(1); setTitle('') }} style={btnS}>Novo pedido</button>
      </div>
    </div>
  )

  return (
    <div style={{ padding:'28px 32px', maxWidth:680, margin:'0 auto', width:'100%' }}>
      <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Novo pedido</h1>
      <p style={{ fontSize:14, color:'var(--text-2)', marginBottom:24 }}>
        A IA vai criar com a identidade visual e comunicação da <strong>{brand.name}</strong>.
      </p>

      {/* Brand DNA badge */}
      <div style={{ background:'var(--brand-light)', border:'1px solid rgba(61,90,62,.15)', borderRadius:'var(--radius-lg)', padding:'10px 14px', display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <span style={{ fontSize:14 }}>✦</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:500, color:'var(--brand-dark)' }}>Brand DNA ativo — {brand.name}</div>
          <div style={{ fontSize:11, color:'var(--brand-dark)', opacity:.75 }}>Cores, tom, slogan e regras visuais serão aplicados automaticamente.</div>
        </div>
        <div style={{ fontSize:12, fontWeight:500, color:'var(--brand-dark)', background:'rgba(61,90,62,.12)', padding:'3px 10px', borderRadius:99 }}>{brand.ai_context_pct}% contexto</div>
      </div>

      {/* Steps */}
      <div style={{ display:'flex', alignItems:'center', marginBottom:24 }}>
        {(['Formato', 'Detalhes', 'Revisar'] as const).map((label, i) => {
          const n = (i+1) as Step; const active = step === n; const done = step > n
          return (
            <div key={label} style={{ display:'flex', alignItems:'center', flex: i < 2 ? 1 : 'none' }}>
              <div onClick={() => done && setStep(n)} style={{ display:'flex', alignItems:'center', gap:7, cursor: done ? 'pointer' : 'default' }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background: done||active ? 'var(--brand)' : 'var(--surface-2)', color: done||active ? 'white' : 'var(--text-3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, flexShrink:0 }}>
                  {done ? '✓' : n}
                </div>
                <span style={{ fontSize:12, color: active ? 'var(--text-1)' : done ? 'var(--brand)' : 'var(--text-3)', fontWeight: active ? 500 : 400, whiteSpace:'nowrap' }}>{label}</span>
              </div>
              {i < 2 && <div style={{ flex:1, height:1, background: done ? 'var(--brand)' : 'var(--border)', margin:'0 10px' }} />}
            </div>
          )
        })}
      </div>

      {/* STEP 1 — Formato */}
      {step === 1 && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={lbl}>Tipo de conteúdo</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {CONTENT_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setContentType(ct.id)} style={{
                  padding:'11px 10px', border:`1px solid ${contentType === ct.id ? 'var(--brand)' : 'var(--border-md)'}`,
                  borderRadius:'var(--radius-md)', background: contentType === ct.id ? 'var(--brand-light)' : 'transparent',
                  color: contentType === ct.id ? 'var(--brand-dark)' : 'var(--text-2)',
                  fontFamily:'var(--font-sans)', cursor:'pointer', textAlign:'center',
                }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{ct.icon}</div>
                  <div style={{ fontSize:12, fontWeight: contentType === ct.id ? 500 : 400 }}>{ct.label}</div>
                  <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>{ct.credits} crédito{ct.credits > 1 ? 's' : ''}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={lbl}>Quantidade</label>
            <div style={{ display:'flex', gap:8 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setQuantity(n)} style={{
                  width:40, height:40, borderRadius:'var(--radius-md)', border:`1px solid ${quantity === n ? 'var(--brand)' : 'var(--border-md)'}`,
                  background: quantity === n ? 'var(--brand-light)' : 'transparent',
                  color: quantity === n ? 'var(--brand-dark)' : 'var(--text-2)',
                  fontSize:13, fontWeight: quantity === n ? 500 : 400, fontFamily:'var(--font-sans)', cursor:'pointer',
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* Resumo de créditos */}
          <div style={{ background: hasCredits ? 'var(--surface-2)' : 'var(--red-light)', borderRadius:'var(--radius-md)', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:13, color: hasCredits ? 'var(--text-2)' : 'var(--red)' }}>
              {quantity}× {selectedType.label} = <strong>{totalCredits} créditos</strong>
            </span>
            <span style={{ fontSize:12, color: hasCredits ? 'var(--text-3)' : 'var(--red)' }}>
              {hasCredits ? `Você tem ${credits} créditos` : `Créditos insuficientes (${credits} disponíveis)`}
            </span>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={() => setStep(2)} disabled={!hasCredits} style={{ ...btnP, opacity: hasCredits ? 1 : .5 }}>Próximo →</button>
          </div>
        </div>
      )}

      {/* STEP 2 — Detalhes */}
      {step === 2 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={lbl}>Título do pedido (opcional)</label>
            <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder={`ex: Post verão — ${new Date().toLocaleDateString('pt-BR')}`} />
          </div>
          <div>
            <label style={lbl}>Objetivo</label>
            <select style={inp} value={objective} onChange={e => setObjective(e.target.value)}>
              {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Tom de voz</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {TONES.map(t => (
                <button key={t} onClick={() => setTone(t)} style={{
                  padding:'8px 10px', border:`1px solid ${tone === t ? 'var(--brand)' : 'var(--border-md)'}`,
                  borderRadius:'var(--radius-md)', background: tone === t ? 'var(--brand-light)' : 'transparent',
                  color: tone === t ? 'var(--brand-dark)' : 'var(--text-2)',
                  fontSize:12, fontWeight: tone === t ? 500 : 400, fontFamily:'var(--font-sans)', cursor:'pointer',
                }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Hashtags extras</label>
            <input style={inp} value={hashtagInput} onChange={e => setHashtagInput(e.target.value)} onKeyDown={addHashtag} placeholder="Digite e pressione Enter" />
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
              {hashtags.map(h => (
                <span key={h} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', background:'var(--brand-light)', color:'var(--brand-dark)', borderRadius:99, fontSize:12 }}>
                  {h}
                  <button onClick={() => setHashtags(p => p.filter(x => x !== h))} style={{ background:'none', border:'none', color:'var(--brand)', cursor:'pointer', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Contexto extra para a IA (opcional)</label>
            <textarea style={{ ...inp, minHeight:72, resize:'vertical' }} value={extraContext} onChange={e => setExtraContext(e.target.value)}
              placeholder="ex: 'Campanha de dia das mães', 'destacar promoção 30% off', 'usar tom mais emotivo'" />
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'space-between' }}>
            <button onClick={() => setStep(1)} style={btnS}>← Voltar</button>
            <button onClick={() => setStep(3)} style={btnP}>Próximo →</button>
          </div>
        </div>
      )}

      {/* STEP 3 — Revisar */}
      {step === 3 && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            {[
              ['Tipo', selectedType.label],
              ['Quantidade', `${quantity} post${quantity > 1 ? 's' : ''}`],
              ['Objetivo', objective],
              ['Tom', tone],
              ['Créditos', `${totalCredits} créditos`],
              ['Hashtags', hashtags.join(', ') || 'padrão da marca'],
            ].map(([k, v], i, arr) => (
              <div key={k} style={{ display:'flex', padding:'10px 16px', borderBottom: i < arr.length-1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize:12, color:'var(--text-3)', minWidth:100 }}>{k}</span>
                <span style={{ fontSize:13, color:'var(--text-1)' }}>{v}</span>
              </div>
            ))}
          </div>

          {extraContext && (
            <div style={{ background:'var(--surface-2)', borderRadius:'var(--radius-md)', padding:'10px 14px', fontSize:12, color:'var(--text-2)' }}>
              <strong>Contexto extra:</strong> {extraContext}
            </div>
          )}

          {error && (
            <div style={{ padding:'10px 14px', background:'var(--red-light)', border:'1px solid rgba(192,57,43,.2)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--red)' }}>{error}</div>
          )}

          <div style={{ display:'flex', gap:10, justifyContent:'space-between' }}>
            <button onClick={() => setStep(2)} style={btnS}>← Voltar</button>
            <button onClick={submit} disabled={loading} style={{ ...btnP, opacity: loading ? .7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Enviando...' : `✦ Criar ${quantity} post${quantity > 1 ? 's' : ''} · ${totalCredits} créditos`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = { width:'100%', padding:'9px 12px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--text-1)', background:'var(--surface)', fontFamily:'var(--font-sans)', outline:'none' }
const btnP: React.CSSProperties = { background:'var(--brand)', color:'white', border:'none', borderRadius:'var(--radius-md)', padding:'9px 20px', fontSize:13, fontWeight:500, fontFamily:'var(--font-sans)', cursor:'pointer' }
const btnS: React.CSSProperties = { background:'transparent', color:'var(--text-2)', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', padding:'9px 16px', fontSize:13, fontFamily:'var(--font-sans)', cursor:'pointer' }
const lbl: React.CSSProperties = { fontSize:12, color:'var(--text-2)', display:'block', marginBottom:6 }
