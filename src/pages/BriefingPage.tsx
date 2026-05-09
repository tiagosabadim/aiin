import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Step = 1 | 2 | 3 | 4

const TONES    = ['Descontraído', 'Profissional', 'Inspirador', 'Divertido', 'Luxuoso', 'Educativo']
const FORMATS  = ['Carrossel', 'Foto única', 'Reels', 'Misto', 'IA decide']
const OBJECTIVES = ['Gerar vendas', 'Aumentar seguidores', 'Engajamento', 'Lançamento de produto', 'Reconhecimento de marca']

export function BriefingPage() {
  const { user } = useAuth()
  const [step, setStep]               = useState<Step>(1)
  const [loading, setLoading]         = useState(false)
  const [success, setSuccess]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // form state
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [objective, setObjective]     = useState(OBJECTIVES[0])
  const [audience, setAudience]       = useState('')
  const [postCount, setPostCount]     = useState(4)
  const [tone, setTone]               = useState(TONES[0])
  const [format, setFormat]           = useState(FORMATS[0])
  const [hashtags, setHashtags]       = useState<string[]>(['#modaconsciente', '#veraobrasil'])
  const [hashtagInput, setHashtagInput] = useState('')
  const [extraContext, setExtraContext] = useState('')

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
    setLoading(true)
    setError(null)

    try {
      // 1. Busca brand do usuário (primeira encontrada no MVP)
      const { data: brands } = await supabase
        .from('brands')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)

      const brandId = brands?.[0]?.id
      if (!brandId) throw new Error('Configure uma marca antes de criar um briefing.')

      // 2. Salva briefing no Supabase
      const { data: briefing, error: dbErr } = await supabase
        .from('briefings')
        .insert({
          brand_id: brandId,
          user_id: user.id,
          name,
          description,
          objective,
          target_audience: audience,
          tone,
          post_count: postCount,
          hashtags,
          extra_context: extraContext,
          status: 'processing',
        })
        .select()
        .single()

      if (dbErr) throw dbErr

      // 3. Dispara webhook n8n para iniciar geração
      const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            briefing_id: briefing.id,
            brand_id: brandId,
            name,
            description,
            objective,
            target_audience: audience,
            tone,
            format,
            post_count: postCount,
            hashtags,
            extra_context: extraContext,
          }),
        })
      }

      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar briefing.')
    } finally {
      setLoading(false)
    }
  }

  if (success) return <SuccessScreen onNew={() => { setSuccess(false); setStep(1); setName(''); setDescription('') }} />

  return (
    <div style={{ padding: '28px 32px', maxWidth: 680, margin: '0 auto', width: '100%' }}>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--text-1)', marginBottom: 4 }}>
        Novo briefing
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 28 }}>
        A IA usa o design system e acervo da sua marca para criar posts coerentes.
      </p>

      {/* Steps indicator */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        {(['Campanha', 'Estilo', 'Contexto', 'Revisar'] as const).map((label, i) => {
          const n = (i + 1) as Step
          const active = step === n
          const done   = step > n
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
              <div
                onClick={() => done && setStep(n)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: done ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: done ? 'var(--brand)' : active ? 'var(--brand)' : 'var(--surface-2)',
                  color: done || active ? 'white' : 'var(--text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 500,
                  flexShrink: 0,
                }}>
                  {done ? '✓' : n}
                </div>
                <span style={{
                  fontSize: 12,
                  color: active ? 'var(--text-1)' : done ? 'var(--brand)' : 'var(--text-3)',
                  fontWeight: active ? 500 : 400,
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              </div>
              {i < 3 && (
                <div style={{
                  flex: 1,
                  height: 1,
                  background: done ? 'var(--brand)' : 'var(--border)',
                  margin: '0 10px',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1 — Campanha */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Nome da campanha" required>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)}
              placeholder="ex: Coleção Inverno 2025" />
          </Field>
          <Field label="Descrição / objetivo da campanha">
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="O que você quer comunicar?" />
          </Field>
          <Field label="Objetivo principal">
            <select style={inputStyle} value={objective} onChange={e => setObjective(e.target.value)}>
              {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Público-alvo">
              <input style={inputStyle} value={audience} onChange={e => setAudience(e.target.value)}
                placeholder="ex: Mulheres 25-40, moda" />
            </Field>
            <Field label="Número de posts">
              <select style={inputStyle} value={postCount} onChange={e => setPostCount(Number(e.target.value))}>
                {[2, 4, 6, 8, 12].map(n => <option key={n} value={n}>{n} posts</option>)}
              </select>
            </Field>
          </div>
          <StepActions onNext={() => name ? setStep(2) : null} nextDisabled={!name} />
        </div>
      )}

      {/* Step 2 — Estilo */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="Tom de voz">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {TONES.map(t => (
                <button key={t} onClick={() => setTone(t)} style={{
                  padding: '8px 10px',
                  border: `1px solid ${tone === t ? 'var(--brand)' : 'var(--border-md)'}`,
                  borderRadius: 'var(--radius-md)',
                  background: tone === t ? 'var(--brand-light)' : 'transparent',
                  color: tone === t ? 'var(--brand-dark)' : 'var(--text-2)',
                  fontSize: 13,
                  fontWeight: tone === t ? 500 : 400,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Formato dos posts">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {FORMATS.map(f => (
                <button key={f} onClick={() => setFormat(f)} style={{
                  padding: '8px 10px',
                  border: `1px solid ${format === f ? 'var(--brand)' : 'var(--border-md)'}`,
                  borderRadius: 'var(--radius-md)',
                  background: format === f ? 'var(--brand-light)' : 'transparent',
                  color: format === f ? 'var(--brand-dark)' : 'var(--text-2)',
                  fontSize: 13,
                  fontWeight: format === f ? 500 : 400,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}>
                  {f}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Hashtags">
            <input style={inputStyle} value={hashtagInput}
              onChange={e => setHashtagInput(e.target.value)}
              onKeyDown={addHashtag}
              placeholder="Digite e pressione Enter" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {hashtags.map(h => (
                <span key={h} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  background: 'var(--brand-light)',
                  color: 'var(--brand-dark)',
                  borderRadius: 99,
                  fontSize: 12,
                }}>
                  {h}
                  <button onClick={() => setHashtags(prev => prev.filter(x => x !== h))}
                    style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </Field>
          <StepActions onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </div>
      )}

      {/* Step 3 — Contexto extra */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            background: 'var(--brand-light)',
            border: '1px solid rgba(61,90,62,0.15)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px',
            display: 'flex',
            gap: 10,
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 15 }}>✦</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-dark)', marginBottom: 3 }}>
                IA com contexto ativo
              </div>
              <div style={{ fontSize: 12, color: 'var(--brand-dark)', opacity: 0.75, lineHeight: 1.5 }}>
                Usando design system, 39 imagens do acervo e 12 padrões aprendidos dos seus posts anteriores.
              </div>
            </div>
          </div>
          <Field label="Instruções extras para a IA (opcional)">
            <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              value={extraContext} onChange={e => setExtraContext(e.target.value)}
              placeholder="ex: 'não mencionar preço', 'incluir CTA pro link da bio', 'usar a nova paleta de verão'..." />
          </Field>
          <StepActions onBack={() => setStep(2)} onNext={() => setStep(4)} />
        </div>
      )}

      {/* Step 4 — Revisar e enviar */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {[
              ['Campanha',    name],
              ['Objetivo',    objective],
              ['Público',     audience || '—'],
              ['Tom',         tone],
              ['Formato',     format],
              ['Posts',       `${postCount} posts`],
              ['Hashtags',    hashtags.join(', ') || '—'],
            ].map(([k, v], i, arr) => (
              <div key={k} style={{
                display: 'flex',
                padding: '11px 16px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 100 }}>{k}</span>
                <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 400 }}>{v}</span>
              </div>
            ))}
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--red-light)',
              border: '1px solid rgba(192,57,43,0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 4 }}>
            <button onClick={() => setStep(3)} style={btnSecondary}>← Voltar</button>
            <button onClick={submit} disabled={loading} style={{
              ...btnPrimary,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Enviando para a IA...' : '✦ Gerar posts com IA'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

// ---- Sub-componentes ----

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function StepActions({ onBack, onNext, nextDisabled }: { onBack?: () => void; onNext?: () => void; nextDisabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 6 }}>
      {onBack
        ? <button onClick={onBack} style={btnSecondary}>← Voltar</button>
        : <div />
      }
      {onNext && (
        <button onClick={onNext} disabled={nextDisabled} style={{
          ...btnPrimary,
          opacity: nextDisabled ? 0.5 : 1,
          cursor: nextDisabled ? 'not-allowed' : 'pointer',
        }}>
          Próximo →
        </button>
      )}
    </div>
  )
}

function SuccessScreen({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      gap: 16,
      textAlign: 'center',
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--brand-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
      }}>✓</div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--text-1)' }}>
        Briefing enviado!
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 340, lineHeight: 1.6 }}>
        O Claude está gerando seus posts agora. Você receberá uma notificação quando estiverem prontos para aprovação.
      </p>
      <button onClick={onNew} style={btnPrimary}>Criar outro briefing</button>
    </div>
  )
}

// ---- Styles ----
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border-md)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--text-1)',
  background: 'var(--surface)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--brand)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: '9px 20px',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-2)',
  border: '1px solid var(--border-md)',
  borderRadius: 'var(--radius-md)',
  padding: '9px 16px',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
}
