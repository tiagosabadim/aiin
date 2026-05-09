import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Step = 1 | 2 | 3 | 4
const TONES = ['Descontraído', 'Profissional', 'Inspirador', 'Divertido', 'Luxuoso', 'Educativo']
const OBJECTIVES = ['Gerar vendas', 'Aumentar seguidores', 'Engajamento', 'Lançamento de produto', 'Reconhecimento de marca']
type PostType = 'feed_static' | 'carrossel' | 'stories' | 'reels'
interface FormatConfig {
  type: PostType; dimension: string; quantity: number
  slides?: number; sequence?: number; textLayout: 'overlay' | 'editorial' | 'image_only'
}
const POST_TYPES = [
  { id: 'feed_static' as PostType, label: 'Feed estático', icon: '▣', desc: 'Imagem única no feed',
    dimensions: ['1080×1350 (retrato — maior alcance)', '1080×1080 (quadrado)'] },
  { id: 'carrossel' as PostType, label: 'Carrossel', icon: '◫', desc: 'Múltiplos slides',
    dimensions: ['1080×1350 (retrato)', '1080×1080 (quadrado)'] },
  { id: 'stories' as PostType, label: 'Stories', icon: '▯', desc: 'Vertical 24h',
    dimensions: ['1080×1920 (stories padrão)'] },
  { id: 'reels' as PostType, label: 'Reels (capa)', icon: '▶', desc: 'Capa do vídeo',
    dimensions: ['1080×1920 (vertical)', '1080×1080 (quadrado)'] },
]
const TEXT_LAYOUTS = [
  { id: 'overlay',    label: 'Texto na imagem',   desc: 'Sobreposto com contraste' },
  { id: 'editorial',  label: 'Layout editorial',   desc: 'Imagem + área de texto' },
  { id: 'image_only', label: 'Só imagem',          desc: 'Texto só na legenda' },
]

export function BriefingPage() {
  const { user } = useAuth()
  const [step, setStep]       = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [objective, setObjective]     = useState(OBJECTIVES[0])
  const [audience, setAudience]       = useState('')
  const [formats, setFormats] = useState<FormatConfig[]>([
    { type: 'feed_static', dimension: '1080×1350 (retrato — maior alcance)', quantity: 4, textLayout: 'overlay' }
  ])
  const [tone, setTone]               = useState(TONES[0])
  const [hashtags, setHashtags]       = useState<string[]>(['#modaconsciente'])
  const [hashtagInput, setHashtagInput] = useState('')
  const [extraContext, setExtraContext] = useState('')

  const totalPosts = formats.reduce((acc, f) => acc + f.quantity, 0)

  const addFormat = () => setFormats(prev => [...prev, {
    type: 'feed_static', dimension: '1080×1350 (retrato — maior alcance)', quantity: 2, textLayout: 'overlay'
  }])

  const removeFormat = (i: number) => setFormats(prev => prev.filter((_, idx) => idx !== i))

  const updateFormat = (i: number, patch: Partial<FormatConfig>) => {
    setFormats(prev => prev.map((f, idx) => {
      if (idx !== i) return f
      const updated = { ...f, ...patch }
      if (patch.type) {
        const found = POST_TYPES.find(pt => pt.id === patch.type)
        updated.dimension = found?.dimensions[0] ?? ''
        updated.slides    = patch.type === 'carrossel' ? 6 : undefined
        updated.sequence  = patch.type === 'stories'  ? 3 : undefined
      }
      return updated
    }))
  }

  const addHashtag = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    let val = hashtagInput.trim()
    if (!val) return
    if (!val.startsWith('#')) val = '#' + val
    if (!hashtags.includes(val)) setHashtags(prev => [...prev, val])
    setHashtagInput('')
  }

  const submit = async () => {
    if (!user) return
    setLoading(true); setError(null)
    try {
      const { data: brands } = await supabase.from('brands').select('id').eq('user_id', user.id).limit(1)
      const brandId = brands?.[0]?.id
      if (!brandId) throw new Error('Configure uma marca antes de criar um briefing.')
      const { data: briefing, error: dbErr } = await supabase.from('briefings').insert({
        brand_id: brandId, user_id: user.id, name, description, objective,
        target_audience: audience, tone, post_count: totalPosts, hashtags,
        extra_context: JSON.stringify({ formats, extra: extraContext }), status: 'processing',
      }).select().single()
      if (dbErr) throw dbErr
      const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL
      if (webhookUrl) await fetch(webhookUrl, { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing_id: briefing.id, brand_id: brandId, name,
          description, objective, target_audience: audience, tone, formats, hashtags, extra_context: extraContext }) })
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar briefing.')
    } finally { setLoading(false) }
  }

  if (success) return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:48, gap:16, textAlign:'center' }}>
      <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--brand-light)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>✓</div>
      <h2 style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--text-1)' }}>Briefing enviado!</h2>
      <p style={{ fontSize:14, color:'var(--text-2)', maxWidth:340, lineHeight:1.6 }}>
        O Claude está gerando {totalPosts} posts agora. Você será notificado quando estiverem prontos.
      </p>
      <button onClick={() => { setSuccess(false); setStep(1); setName('') }} style={btnPrimary}>Criar outro briefing</button>
    </div>
  )

  return (
    <div style={{ padding:'28px 32px', maxWidth:700, margin:'0 auto', width:'100%' }}>
      <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Novo briefing</h1>
      <p style={{ fontSize:14, color:'var(--text-2)', marginBottom:28 }}>A IA usa o design system e acervo da sua marca para criar posts coerentes.</p>

      <div style={{ display:'flex', alignItems:'center', marginBottom:28 }}>
        {(['Campanha','Formatos','Estilo','Revisar'] as const).map((label, i) => {
          const n = (i + 1) as Step; const active = step === n; const done = step > n
          return (
            <div key={label} style={{ display:'flex', alignItems:'center', flex: i < 3 ? 1 : 'none' }}>
              <div onClick={() => done && setStep(n)} style={{ display:'flex', alignItems:'center', gap:8, cursor: done ? 'pointer' : 'default' }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background: done||active ? 'var(--brand)' : 'var(--surface-2)',
                  color: done||active ? 'white' : 'var(--text-3)', display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:11, fontWeight:500, flexShrink:0 }}>{done ? '✓' : n}</div>
                <span style={{ fontSize:12, whiteSpace:'nowrap', color: active ? 'var(--text-1)' : done ? 'var(--brand)' : 'var(--text-3)', fontWeight: active ? 500 : 400 }}>{label}</span>
              </div>
              {i < 3 && <div style={{ flex:1, height:1, background: done ? 'var(--brand)' : 'var(--border)', margin:'0 10px' }} />}
            </div>
          )
        })}
      </div>

      {step === 1 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Field label="Nome da campanha" required>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="ex: Coleção Inverno 2025" />
          </Field>
          <Field label="Descrição / objetivo">
            <textarea style={{ ...inputStyle, minHeight:80, resize:'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="O que você quer comunicar?" />
          </Field>
          <Field label="Objetivo principal">
            <select style={inputStyle} value={objective} onChange={e => setObjective(e.target.value)}>
              {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Público-alvo">
            <input style={inputStyle} value={audience} onChange={e => setAudience(e.target.value)} placeholder="ex: Mulheres 25-40, moda consciente" />
          </Field>
          <StepActions onNext={() => name ? setStep(2) : null} nextDisabled={!name} />
        </div>
      )}

      {step === 2 && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:'var(--brand-light)', border:'1px solid rgba(61,90,62,0.15)',
            borderRadius:'var(--radius-lg)', padding:'12px 14px', fontSize:12, color:'var(--brand-dark)', lineHeight:1.5 }}>
            ✦ Configure quantos tipos de post diferentes você quer nessa campanha. Cada formato pode ter dimensão, quantidade e layout de texto independentes.
          </div>
          {formats.map((fmt, i) => {
            const typeInfo = POST_TYPES.find(pt => pt.id === fmt.type)!
            return (
              <div key={i} style={{ border:'1px solid var(--border-md)', borderRadius:'var(--radius-lg)',
                padding:'16px', background:'var(--surface)', position:'relative' }}>
                {formats.length > 1 && (
                  <button onClick={() => removeFormat(i)} style={{ position:'absolute', top:12, right:12,
                    background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-3)', lineHeight:1 }}>×</button>
                )}
                <div style={{ fontSize:11, fontWeight:500, color:'var(--text-3)', marginBottom:12,
                  textTransform:'uppercase', letterSpacing:'.05em' }}>Formato {i + 1}</div>

                <Field label="Tipo de post">
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                    {POST_TYPES.map(pt => (
                      <button key={pt.id} onClick={() => updateFormat(i, { type: pt.id })} style={{
                        padding:'10px 8px', border:`1px solid ${fmt.type === pt.id ? 'var(--brand)' : 'var(--border-md)'}`,
                        borderRadius:'var(--radius-md)', background: fmt.type === pt.id ? 'var(--brand-light)' : 'transparent',
                        color: fmt.type === pt.id ? 'var(--brand-dark)' : 'var(--text-2)',
                        fontFamily:'var(--font-sans)', cursor:'pointer', textAlign:'center',
                      }}>
                        <div style={{ fontSize:18, marginBottom:4 }}>{pt.icon}</div>
                        <div style={{ fontSize:12, fontWeight: fmt.type === pt.id ? 500 : 400 }}>{pt.label}</div>
                        <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>{pt.desc}</div>
                      </button>
                    ))}
                  </div>
                </Field>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
                  <Field label="Dimensão">
                    <select style={inputStyle} value={fmt.dimension} onChange={e => updateFormat(i, { dimension: e.target.value })}>
                      {typeInfo.dimensions.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label={fmt.type === 'carrossel' ? 'Qtd de carrosseis' : fmt.type === 'stories' ? 'Qtd de sequências' : 'Quantidade'}>
                    <select style={inputStyle} value={fmt.quantity} onChange={e => updateFormat(i, { quantity: Number(e.target.value) })}>
                      {[1,2,3,4,5,6,8,10,12].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                </div>

                {fmt.type === 'carrossel' && (
                  <div style={{ marginTop:12 }}>
                    <Field label="Slides por carrossel">
                      <select style={inputStyle} value={fmt.slides ?? 6} onChange={e => updateFormat(i, { slides: Number(e.target.value) })}>
                        {[3,4,5,6,7,8,10].map(n => <option key={n} value={n}>{n} slides</option>)}
                      </select>
                    </Field>
                  </div>
                )}
                {fmt.type === 'stories' && (
                  <div style={{ marginTop:12 }}>
                    <Field label="Stories por sequência">
                      <select style={inputStyle} value={fmt.sequence ?? 3} onChange={e => updateFormat(i, { sequence: Number(e.target.value) })}>
                        {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} stories</option>)}
                      </select>
                    </Field>
                  </div>
                )}

                <div style={{ marginTop:12 }}>
                  <Field label="Layout do texto na arte">
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                      {TEXT_LAYOUTS.map(tl => (
                        <button key={tl.id} onClick={() => updateFormat(i, { textLayout: tl.id as FormatConfig['textLayout'] })} style={{
                          padding:'9px 10px', border:`1px solid ${fmt.textLayout === tl.id ? 'var(--brand)' : 'var(--border-md)'}`,
                          borderRadius:'var(--radius-md)', background: fmt.textLayout === tl.id ? 'var(--brand-light)' : 'transparent',
                          color: fmt.textLayout === tl.id ? 'var(--brand-dark)' : 'var(--text-2)',
                          fontFamily:'var(--font-sans)', cursor:'pointer', textAlign:'left',
                        }}>
                          <div style={{ fontSize:12, fontWeight: fmt.textLayout === tl.id ? 500 : 400, marginBottom:2 }}>{tl.label}</div>
                          <div style={{ fontSize:10, color:'var(--text-3)' }}>{tl.desc}</div>
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </div>
            )
          })}

          <button onClick={addFormat} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            padding:'10px', border:'1px dashed var(--border-md)', borderRadius:'var(--radius-lg)',
            background:'transparent', color:'var(--text-2)', fontSize:13, fontFamily:'var(--font-sans)', cursor:'pointer' }}>
            + Adicionar outro formato
          </button>

          <div style={{ background:'var(--surface-2)', borderRadius:'var(--radius-md)',
            padding:'10px 14px', fontSize:13, color:'var(--text-2)', display:'flex', gap:16 }}>
            <span>Total: <strong style={{ color:'var(--text-1)' }}>{totalPosts} posts</strong></span>
            <span>Formatos: <strong style={{ color:'var(--text-1)' }}>{formats.length}</strong></span>
          </div>

          <StepActions onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </div>
      )}

      {step === 3 && (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <Field label="Tom de voz">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {TONES.map(t => (
                <button key={t} onClick={() => setTone(t)} style={{
                  padding:'8px 10px', border:`1px solid ${tone === t ? 'var(--brand)' : 'var(--border-md)'}`,
                  borderRadius:'var(--radius-md)', background: tone === t ? 'var(--brand-light)' : 'transparent',
                  color: tone === t ? 'var(--brand-dark)' : 'var(--text-2)', fontSize:13,
                  fontWeight: tone === t ? 500 : 400, fontFamily:'var(--font-sans)', cursor:'pointer' }}>{t}</button>
              ))}
            </div>
          </Field>
          <Field label="Hashtags">
            <input style={inputStyle} value={hashtagInput} onChange={e => setHashtagInput(e.target.value)}
              onKeyDown={addHashtag} placeholder="Digite e pressione Enter" />
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
              {hashtags.map(h => (
                <span key={h} style={{ display:'inline-flex', alignItems:'center', gap:5,
                  padding:'3px 10px', background:'var(--brand-light)', color:'var(--brand-dark)', borderRadius:99, fontSize:12 }}>
                  {h}
                  <button onClick={() => setHashtags(prev => prev.filter(x => x !== h))}
                    style={{ background:'none', border:'none', color:'var(--brand)', cursor:'pointer', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                </span>
              ))}
            </div>
          </Field>
          <Field label="Instruções extras para a IA (opcional)">
            <textarea style={{ ...inputStyle, minHeight:80, resize:'vertical' }} value={extraContext}
              onChange={e => setExtraContext(e.target.value)}
              placeholder="ex: 'não mencionar preço', 'usar a nova paleta de verão'..." />
          </Field>
          <StepActions onBack={() => setStep(2)} onNext={() => setStep(4)} />
        </div>
      )}

      {step === 4 && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            {[['Campanha',name],['Objetivo',objective],['Público',audience||'—'],['Tom',tone],['Total posts',String(totalPosts)],['Hashtags',hashtags.join(', ')||'—']]
              .map(([k,v],i,arr) => (
                <div key={k} style={{ display:'flex', padding:'11px 16px', borderBottom: i < arr.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize:12, color:'var(--text-3)', minWidth:110 }}>{k}</span>
                  <span style={{ fontSize:13, color:'var(--text-1)' }}>{v}</span>
                </div>
              ))}
          </div>

          <div style={{ fontSize:12, fontWeight:500, color:'var(--text-2)', marginTop:4 }}>Formatos configurados</div>
          {formats.map((f, i) => {
            const typeInfo = POST_TYPES.find(pt => pt.id === f.type)!
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10,
                padding:'9px 14px', background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:'var(--radius-md)', fontSize:12 }}>
                <span style={{ fontSize:16 }}>{typeInfo.icon}</span>
                <span style={{ fontWeight:500, color:'var(--text-1)' }}>{typeInfo.label}</span>
                <span style={{ color:'var(--text-3)' }}>·</span>
                <span style={{ color:'var(--text-2)' }}>{f.dimension.split(' ')[0]}</span>
                <span style={{ color:'var(--text-3)' }}>·</span>
                <span style={{ color:'var(--text-2)' }}>{f.quantity}×</span>
                {f.slides && <><span style={{ color:'var(--text-3)' }}>·</span><span style={{ color:'var(--text-2)' }}>{f.slides} slides</span></>}
                {f.sequence && <><span style={{ color:'var(--text-3)' }}>·</span><span style={{ color:'var(--text-2)' }}>{f.sequence}/seq.</span></>}
                <span style={{ marginLeft:'auto', background:'var(--surface-2)', padding:'1px 8px', borderRadius:99, color:'var(--text-2)' }}>
                  {TEXT_LAYOUTS.find(tl => tl.id === f.textLayout)?.label}
                </span>
              </div>
            )
          })}

          {error && (
            <div style={{ padding:'10px 14px', background:'var(--red-light)',
              border:'1px solid rgba(192,57,43,0.2)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--red)' }}>{error}</div>
          )}

          <div style={{ display:'flex', gap:10, justifyContent:'space-between', marginTop:4 }}>
            <button onClick={() => setStep(3)} style={btnSecondary}>← Voltar</button>
            <button onClick={submit} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Enviando...' : `✦ Gerar ${totalPosts} posts com IA`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize:12, color:'var(--text-2)', display:'block', marginBottom:5 }}>
        {label}{required && <span style={{ color:'var(--red)', marginLeft:3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function StepActions({ onBack, onNext, nextDisabled }: { onBack?: () => void; onNext?: () => void; nextDisabled?: boolean }) {
  return (
    <div style={{ display:'flex', gap:10, justifyContent:'space-between', marginTop:6 }}>
      {onBack ? <button onClick={onBack} style={btnSecondary}>← Voltar</button> : <div />}
      {onNext && <button onClick={onNext} disabled={nextDisabled} style={{ ...btnPrimary, opacity: nextDisabled ? 0.5 : 1, cursor: nextDisabled ? 'not-allowed' : 'pointer' }}>Próximo →</button>}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width:'100%', padding:'9px 12px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--text-1)', background:'var(--surface)', fontFamily:'var(--font-sans)', outline:'none' }
const btnPrimary: React.CSSProperties = { background:'var(--brand)', color:'white', border:'none', borderRadius:'var(--radius-md)', padding:'9px 20px', fontSize:13, fontWeight:500, fontFamily:'var(--font-sans)', cursor:'pointer' }
const btnSecondary: React.CSSProperties = { background:'transparent', color:'var(--text-2)', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', padding:'9px 16px', fontSize:13, fontFamily:'var(--font-sans)', cursor:'pointer' }
