// aiin · Avulsos (BriefingPage v7)
// Split: esquerda escolhe formato, direita mostra form do produto
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

const FORMATS = [
  {
    id: 'post_simples' as ContentType,
    label: 'Post estático',
    sub: '1 crédito',
    icon: '▣',
    color: '#7B2CFF',
    bg: 'rgba(123,44,255,.08)',
    border: 'rgba(123,44,255,.2)',
    description: 'Imagem única para o feed. Ideal para lançamentos, frases, promoções e conteúdo visual forte.',
    fields: ['objective', 'context', 'hashtags', 'refs', 'date'],
  },
  {
    id: 'carrossel_5' as ContentType,
    label: 'Carrossel 5p',
    sub: '3 créditos',
    icon: '◫',
    color: '#F72585',
    bg: 'rgba(247,37,133,.07)',
    border: 'rgba(247,37,133,.2)',
    description: 'Sequência de 2 a 5 slides. Ideal para tutoriais, listas, antes/depois e conteúdo educativo.',
    fields: ['objective', 'slides_hint', 'context', 'hashtags', 'refs', 'date'],
  },
  {
    id: 'story' as ContentType,
    label: 'Story',
    sub: '1 crédito',
    icon: '▯',
    color: '#FF6A00',
    bg: 'rgba(255,106,0,.08)',
    border: 'rgba(255,106,0,.2)',
    description: 'Formato vertical 9:16. Ideal para promoções relâmpago, enquetes, bastidores e CTAs.',
    fields: ['objective', 'context', 'cta', 'refs', 'date'],
  },
  {
    id: 'capa_reels' as ContentType,
    label: 'Capa de Reels',
    sub: '1 crédito',
    icon: '▶',
    color: '#1D9E75',
    bg: 'rgba(29,158,117,.08)',
    border: 'rgba(29,158,117,.2)',
    description: 'Thumbnail do Reels. Deve ser chamativa, com texto legível e representar o conteúdo do vídeo.',
    fields: ['video_title', 'objective', 'context', 'refs', 'date'],
  },
]

export function BriefingPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const { user } = useAuth()
  const [selected, setSelected] = useState<typeof FORMATS[0] | null>(null)
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Campos do form
  const [title, setTitle]             = useState('')
  const [objective, setObjective]     = useState('')
  const [context, setContext]         = useState('')
  const [slidesHint, setSlidesHint]   = useState('')
  const [slideCount, setSlideCount]   = useState(5)
  const [cta, setCta]                 = useState('')
  const [videoTitle, setVideoTitle]   = useState('')
  const [hashtags, setHashtags]       = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('18:00')
  const [refs, setRefs]               = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const selectFormat = (fmt: typeof FORMATS[0]) => {
    setSelected(fmt)
    setError(null)
    setSuccess(false)
    setSlideCount(5)
    setTitle(''); setObjective(''); setContext(''); setSlidesHint('')
    setCta(''); setVideoTitle(''); setHashtags(''); setRefs([])
    setScheduleDate(''); setScheduleTime('18:00')
  }

  const submit = async () => {
    if (!user || !selected) return
    setLoading(true); setError(null)
    try {
      // Upload de referências
      const refUrls: string[] = []
      for (const f of refs) {
        const path = `${workspace.id}/refs/${Date.now()}_${f.name}`
        const { error: upErr } = await supabase.storage.from('assets').upload(path, f, { upsert: true })
        if (!upErr) {
          const { data: u } = supabase.storage.from('assets').getPublicUrl(path)
          refUrls.push(u.publicUrl)
        }
      }

      // Montar extra_context completo
      const parts: string[] = []
      if (context)    parts.push(context)
      if (selected.id === 'carrossel_5') parts.unshift(`Número de slides: ${slideCount}`)
      if (slidesHint) parts.push(`Estrutura dos slides: ${slidesHint}`)
      if (cta)        parts.push(`CTA: ${cta}`)
      if (videoTitle) parts.push(`Título do vídeo: ${videoTitle}`)

      const brief = await supabase.from('content_briefs').insert({
        workspace_id: workspace.id, brand_id: brand.id, created_by: user.id,
        title: title || `${selected.label} — ${new Date().toLocaleDateString('pt-BR')}`,
        objective,
        content_type: selected.id, quantity: 1,
        extra_context: parts.join('\n'),
        hashtags: hashtags.split(',').map(h => h.trim()).filter(Boolean),
        required_credits: CREDIT_COSTS[selected.id] ?? 1,
        status: 'confirmed',
      }).select().single()

      if (brief.error) throw brief.error

      await createContentJob({
        workspaceId: workspace.id, briefId: brief.data.id,
        brandId: brand.id, jobType: selected.id, quantity: 1,
        inputPayload: {
          title: title || selected.label,
          objective, tone_of_voice: brand.tone_of_voice,
          slide_count: selected.id === 'carrossel_5' ? slideCount : undefined,
          extra_context: parts.join('\n'),
          hashtags: hashtags.split(',').map(h => h.trim()).filter(Boolean),
          reference_urls: refUrls,
          brand_name: brand.name, segment: brand.segment,
          target_audience: brand.target_audience, products: brand.products,
          color_palette: brand.color_palette, slogans: brand.slogans,
          design_rules: brand.design_rules, forbidden_words: brand.forbidden_words,
          brand_dna: brand.ai_brand_dna, logo_urls: brand.logo_urls,
          quantity: 1, content_type: selected.id,
          scheduled_date: scheduleDate || undefined,
        },
      })

      setSuccess(true)
      setTimeout(() => navigate('posts'), 1800)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao criar post')
    } finally {
      setLoading(false)
    }
  }

  const creditCost = selected ? (CREDIT_COSTS[selected.id] ?? 1) : 0
  const canSubmit  = !!selected && !loading && credits >= creditCost

  return (
    <div className="page-split">

      {/* ── ESQUERDA: seleção de formato ── */}
      <div className="page-split-left" style={{ gap: 0, padding: 0 }}>

        <div style={{ padding: '24px 24px 16px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#070D1F', letterSpacing: '-.3px', marginBottom: 4 }}>Avulsos</h1>
          <p style={{ fontSize: 13, color: '#6B7280' }}>Crie posts individuais: feed, carrossel, stories ou capa de Reels.</p>
        </div>

        {/* Créditos */}
        <div style={{ margin: '0 24px 20px', padding: '10px 14px', background: 'linear-gradient(135deg,rgba(255,106,0,.08),rgba(247,37,133,.08),rgba(123,44,255,.08))', borderRadius: 12, border: '1px solid rgba(247,37,133,.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6B7280' }}>Créditos disponíveis</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#070D1F' }}>{credits}</span>
        </div>

        {/* Grid de formatos */}
        <div style={{ padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {FORMATS.map(fmt => {
            const isSel = selected?.id === fmt.id
            const cost  = CREDIT_COSTS[fmt.id] ?? 1
            return (
              <button key={fmt.id} onClick={() => selectFormat(fmt)} style={{
                padding: '16px 14px',
                border: `1.5px solid ${isSel ? fmt.border : 'rgba(7,13,31,.08)'}`,
                borderRadius: 14,
                background: isSel ? fmt.bg : '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left', transition: 'all .15s',
                boxShadow: isSel ? `0 0 0 3px ${fmt.bg}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: fmt.bg, border: `1px solid ${fmt.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: fmt.color, flexShrink: 0 }}>
                    {fmt.icon}
                  </div>
                  {isSel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: fmt.color, marginLeft: 'auto' }} />}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#070D1F', marginBottom: 2 }}>{fmt.label}</div>
                <div style={{ fontSize: 11, color: cost > credits ? '#E24B4A' : '#9CA3AF', fontWeight: cost > credits ? 600 : 400 }}>{cost} crédito{cost > 1 ? 's' : ''}</div>
              </button>
            )
          })}
        </div>

        {/* Descrição do formato selecionado */}
        {selected && (
          <div style={{ margin: '16px 24px 0', padding: '12px 14px', background: selected.bg, borderRadius: 10, border: `1px solid ${selected.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: selected.color, marginBottom: 4 }}>{selected.label}</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{selected.description}</div>
          </div>
        )}
      </div>

      {/* ── DIREITA: form do produto ── */}
      <div className="page-split-right">
        {!selected ? (
          <div className="empty-state">
            <div className="empty-state-icon">✦</div>
            <div className="empty-state-title">Escolha um formato</div>
            <div className="empty-state-sub">Selecione o tipo de post ao lado para ver as opções de criação.</div>
          </div>
        ) : success ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: '#E1F5EE', border: '1px solid rgba(29,158,117,.2)', fontSize: 24 }}>✓</div>
            <div className="empty-state-title" style={{ color: '#1D9E75' }}>Post enviado para geração!</div>
            <div className="empty-state-sub">Redirecionando para Aprovar...</div>
          </div>
        ) : (
          <>
            {/* Header sticky */}
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid rgba(7,13,31,.07)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: selected.bg, border: `1px solid ${selected.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: selected.color }}>
                {selected.icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#070D1F' }}>{selected.label}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{creditCost} crédito{creditCost > 1 ? 's' : ''} · {selected.description.split('.')[0]}</div>
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: '16px 20px 120px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Título do post */}
              <F label="Título / tema do post" required>
                <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder={`ex: ${selected.id === 'capa_reels' ? 'Como fazer X em 3 passos' : selected.id === 'carrossel_5' ? '5 dicas para Y' : 'Lançamento do produto Z'}`} />
                <div className="input-hint">Vai guiar a IA na criação do conteúdo</div>
              </F>

              {/* Objetivo */}
              {selected.fields.includes('objective') && (
                <F label="Objetivo do post">
                  <select value={objective} onChange={e => setObjective(e.target.value)} className="input">
                    <option value="">Selecione...</option>
                    <option>Gerar desejo e curiosidade</option>
                    <option>Apresentar produto/serviço</option>
                    <option>Educar o público</option>
                    <option>Promover oferta ou desconto</option>
                    <option>Humanizar a marca</option>
                    <option>Gerar engajamento</option>
                    <option>Converter em venda</option>
                  </select>
                </F>
              )}

              {/* Título do vídeo (Reels) */}
              {selected.fields.includes('video_title') && (
                <F label="Título do vídeo" required>
                  <input value={videoTitle} onChange={e => setVideoTitle(e.target.value)} className="input" placeholder="ex: Como fazer X sem precisar de Y" />
                  <div className="input-hint">A capa precisa representar o que o vídeo ensina</div>
                </F>
              )}

              {/* Número de slides + estrutura (Carrossel) */}
              {selected.fields.includes('slides_hint') && (
                <>
                  <F label="Quantos slides?" required>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[2,3,4,5].map(n => (
                        <button key={n} onClick={() => setSlideCount(n)} style={{ flex:1, height:44, cursor:'pointer', fontFamily:'inherit', borderRadius:10, fontSize:15, fontWeight:slideCount===n?700:500, border:`1.5px solid ${slideCount===n?'#F72585':'rgba(7,13,31,.1)'}`, background:slideCount===n?'rgba(247,37,133,.06)':'#fff', color:slideCount===n?'#F72585':'#6B7280', transition:'all .12s' }}>{n}</button>
                      ))}
                    </div>
                    <div className="input-hint">Máximo 5 slides por carrossel</div>
                  </F>
                  <F label="Estrutura dos slides (opcional)">
                    <textarea value={slidesHint} onChange={e => setSlidesHint(e.target.value)} className="input" rows={3} style={{ resize: 'none' }} placeholder={`ex: Slide 1: título / Slides 2-${slideCount-1}: dicas / Slide ${slideCount}: CTA`} />
                    <div className="input-hint">A IA vai seguir essa estrutura para criar os slides</div>
                  </F>
                </>
              )}

              {/* CTA (Story) */}
              {selected.fields.includes('cta') && (
                <F label="Call to action">
                  <input value={cta} onChange={e => setCta(e.target.value)} className="input" placeholder="ex: Arrasta pra cima · Clica no link da bio · Manda mensagem" />
                </F>
              )}

              {/* Contexto extra */}
              {selected.fields.includes('context') && (
                <F label="Contexto e instruções para a IA">
                  <textarea value={context} onChange={e => setContext(e.target.value)} className="input" rows={4} style={{ resize: 'vertical' }} placeholder={`ex: ${selected.id === 'post_simples' ? 'Usar cores quentes, mostrar o produto em uso, fundo clean' : selected.id === 'carrossel_5' ? 'Tom educativo, linguagem simples, números em destaque' : selected.id === 'story' ? 'Urgência, contagem regressiva, oferta por 24h' : 'Fundo escuro, texto grande e legível, logo no canto'}`} />
                  <div className="input-hint">Quanto mais detalhe, melhor o resultado</div>
                </F>
              )}

              {/* Hashtags */}
              {selected.fields.includes('hashtags') && (
                <F label="Hashtags (separadas por vírgula)">
                  <input value={hashtags} onChange={e => setHashtags(e.target.value)} className="input" placeholder="ex: #moda, #novidade, #lançamento" />
                </F>
              )}

              {/* Referências */}
              {selected.fields.includes('refs') && (
                <F label="Imagens de referência (opcional)">
                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => setRefs(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => fileRef.current?.click()} style={{ height: 40, padding: '0 16px', border: `1.5px dashed ${selected.border}`, borderRadius: 10, background: selected.bg, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: selected.color, fontWeight: 500 }}>+ Adicionar foto</button>
                    {refs.map((f, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={URL.createObjectURL(f)} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(7,13,31,.08)' }} />
                        <button onClick={() => setRefs(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#E24B4A', border: 'none', color: 'white', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ))}
                  </div>
                  <div className="input-hint">Fotos que ajudam a IA a entender o estilo visual desejado</div>
                </F>
              )}

              {/* Agendar */}
              {selected.fields.includes('date') && (
                <F label="Agendar publicação (opcional)">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="input" />
                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="input" />
                  </div>
                  <div className="input-hint">Deixe vazio para não agendar automaticamente</div>
                </F>
              )}

            </div>

            {/* Botão flutuante fixo */}
            <div style={{ position: 'absolute', bottom: 0, right: 0, left: '40%', background: 'linear-gradient(transparent, #fff 35%)', padding: '20px 20px 28px', pointerEvents: 'none' }}>
              <div style={{ pointerEvents: 'all' }}>
                {error && (
                  <div style={{ marginBottom: 10, padding: '8px 14px', background: '#FCEBEB', border: '1px solid rgba(226,75,74,.2)', borderRadius: 8, fontSize: 12, color: '#E24B4A' }}>{error}</div>
                )}
                {credits < creditCost && (
                  <div style={{ marginBottom: 10, padding: '8px 14px', background: '#FAEEDA', border: '1px solid rgba(186,117,23,.2)', borderRadius: 8, fontSize: 12, color: '#633806' }}>
                    ⚠ Créditos insuficientes. Você tem {credits}, este formato custa {creditCost}.
                  </div>
                )}
                <button onClick={submit} disabled={!canSubmit} style={{ width: '100%', height: 52, background: canSubmit ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : '#e5e7eb', border: 'none', borderRadius: 14, color: canSubmit ? 'white' : '#9CA3AF', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: canSubmit ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: canSubmit ? '0 4px 20px rgba(247,37,133,.3)' : 'none', transition: 'all .2s' }}>
                  {loading
                    ? <><div style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Gerando post...</>
                    : <><span style={{ fontSize: 18 }}>✦</span> Gerar {selected.label} · {creditCost} crédito{creditCost > 1 ? 's' : ''}</>
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background:'#fff', border:'1px solid rgba(7,13,31,.08)', borderRadius:14, padding:'14px 16px' }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
        {label}{required && <span style={{ color: '#F72585', marginLeft: 3 }}>*</span>}
      </div>
      {children}
    </div>
  )
}
