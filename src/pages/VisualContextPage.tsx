// aiin · VisualContextPage v3 — sem scroll, ajuste vai no prompt
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { BrandProfile, Workspace } from '../types/database'

interface Props {
  workspace: Workspace
  brand: BrandProfile
  onApprove: () => void
}

type Status = 'idle' | 'generating' | 'reviewing' | 'adjusting' | 'approved'

export function VisualContextPage({ workspace, brand, onApprove }: Props) {
  const [status, setStatus]     = useState<Status>('idle')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [adjustNote, setAdjustNote] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [iteration, setIteration] = useState(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  const generate = async (note?: string) => {
    setStatus('generating')
    setError(null)

    await supabase.from('brand_profiles').update({
      visual_context_status: 'pending',
      visual_context_test_url: null,
      visual_context_error: null,
    }).eq('id', brand.id)

    try {
      const res = await fetch('/api/generate-visual-context-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          brand_id: brand.id,
          adjustment_note: note || null,
        }),
      })
      if (res.status !== 202 && res.status !== 200) {
        const text = await res.text()
        throw new Error(`Erro (${res.status}): ${text.slice(0, 200)}`)
      }
      startPolling()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar geração')
      setStatus('idle')
    }
  }

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('brand_profiles')
        .select('visual_context_status, visual_context_test_url, visual_context_error')
        .eq('id', brand.id).single()
      if (!data) return
      if (data.visual_context_status === 'done' && data.visual_context_test_url) {
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        setImageUrl(data.visual_context_test_url)
        setStatus('reviewing')
        setIteration(i => i + 1)
      }
      if (data.visual_context_status === 'error') {
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        setError(data.visual_context_error ?? 'Erro ao gerar imagem')
        setStatus('idle')
      }
    }, 3000)
  }

  const approve = async () => {
    setStatus('approved')
    await supabase.from('brand_profiles').update({
      visual_context_approved: true,
      visual_context_sample: imageUrl,
    }).eq('id', brand.id)
    setTimeout(onApprove, 1000)
  }

  const submitAdjustment = () => {
    const note = adjustNote.trim()
    if (!note) return
    setAdjustNote('')
    generate(note)
  }

  const reset = async () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    await supabase.from('brand_profiles').update({
      openai_thread_id: null,
      visual_context_approved: false,
      visual_context_sample: null,
      visual_context_test_url: null,
      visual_context_status: null,
    }).eq('id', brand.id)
    setImageUrl(null)
    setStatus('idle')
    setIteration(0)
  }

  // Layout: tela inteira sem scroll — split esquerda/direita
  return (
    <div style={{
      height: '100vh', overflow: 'hidden',
      background: '#F4F5F7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 900,
        display: 'grid',
        gridTemplateColumns: status === 'reviewing' || status === 'adjusting' ? '1fr 1fr' : '1fr',
        gap: 24,
        padding: '0 24px',
        alignItems: 'center',
      }}>

        {/* ── Coluna esquerda: controles ── */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid rgba(7,13,31,.08)', padding: '28px 32px', boxShadow: '0 4px 24px rgba(7,13,31,.06)' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'white', marginBottom: 12, boxShadow: '0 6px 20px rgba(247,37,133,.3)' }}>✦</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#070D1F', letterSpacing: '-.3px', marginBottom: 5 }}>
              Validar estilo visual
            </h1>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, maxWidth: 340, margin: '0 auto' }}>
              Antes de criar conteúdo, vamos garantir que a IA entendeu a identidade visual da <strong style={{ color: '#070D1F' }}>{brand.name}</strong>.
            </p>
          </div>

          {/* IDLE */}
          {status === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Checklist da marca */}
              <div style={{ background: '#F7F8FA', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Logo',            brand.logo_urls?.primary ? '✓ enviada'       : '— não enviada'],
                  ['Cores',           (brand.color_palette?.length ?? 0) > 0 ? `✓ ${brand.color_palette.length} cores` : '— não definidas'],
                  ['Slogan',          brand.slogans?.find((s: any) => s.active)?.text || '— não definido'],
                  ['Regras de design',brand.design_rules ? '✓ definidas'          : '— não definidas'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#6B7280' }}>{k}</span>
                    <span style={{ color: (v as string).startsWith('✓') ? '#1D9E75' : '#9CA3AF', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
              {error && (
                <div style={{ padding: '10px 12px', background: '#FCEBEB', border: '1px solid rgba(226,75,74,.2)', borderRadius: 10, fontSize: 12, color: '#E24B4A' }}>{error}</div>
              )}
              <button onClick={() => generate()} style={{ width: '100%', height: 48, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 12, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(247,37,133,.3)' }}>
                ✦ Gerar arte teste
              </button>
              <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>Gera 1 imagem teste · não consome créditos</div>
            </div>
          )}

          {/* GENERATING */}
          {status === 'generating' && (
            <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(247,37,133,.2)', borderTopColor: '#F72585', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#070D1F' }}>
                {iteration === 0 ? 'Analisando identidade visual...' : 'Aplicando ajustes...'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['Lendo logo e referências', 'Aplicando cores da marca', 'Gerando arte teste'].map(s => (
                  <div key={s} style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                    <span style={{ color: '#F72585', fontSize: 10 }}>→</span> {s}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>Isso pode levar até 1 minuto…</div>
            </div>
          )}

          {/* REVIEWING */}
          {status === 'reviewing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {iteration > 1 && (
                <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>Versão {iteration}</div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStatus('adjusting')} style={{ flex: 1, height: 42, border: '1px solid rgba(7,13,31,.12)', borderRadius: 10, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#374151' }}>
                  ✎ Pedir ajuste
                </button>
                <button onClick={approve} style={{ flex: 2, height: 42, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                  ✓ Aprovei — começar
                </button>
              </div>
              <button onClick={reset} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                Resetar e começar do zero
              </button>
            </div>
          )}

          {/* ADJUSTING */}
          {status === 'adjusting' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#070D1F', marginBottom: 2 }}>O que precisa ajustar?</div>
              <textarea
                value={adjustNote}
                onChange={e => setAdjustNote(e.target.value)}
                autoFocus rows={4}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(7,13,31,.12)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', color: '#070D1F', lineHeight: 1.5 }}
                placeholder="ex: logo muito pequena, fundo deve ser escuro, texto em branco, cores mais vibrantes, menos poluído..."
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStatus('reviewing')} style={{ flex: 1, height: 42, border: '1px solid rgba(7,13,31,.12)', borderRadius: 10, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#374151' }}>
                  Cancelar
                </button>
                <button onClick={submitAdjustment} disabled={!adjustNote.trim()} style={{ flex: 2, height: 42, background: adjustNote.trim() ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : '#e5e7eb', border: 'none', borderRadius: 10, color: adjustNote.trim() ? 'white' : '#9CA3AF', cursor: adjustNote.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                  Regenerar com ajuste
                </button>
              </div>
            </div>
          )}

          {/* APPROVED */}
          {status === 'approved' && (
            <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E1F5EE', border: '1px solid rgba(29,158,117,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1D9E75' }}>Estilo aprovado!</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Entrando no painel...</div>
            </div>
          )}
        </div>

        {/* ── Coluna direita: imagem (só quando reviewing/adjusting) ── */}
        {(status === 'reviewing' || status === 'adjusting') && imageUrl && (
          <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(7,13,31,.08)', boxShadow: '0 4px 24px rgba(7,13,31,.08)', background: '#fff' }}>
            <img
              src={imageUrl} alt="Arte teste"
              style={{ width: '100%', display: 'block', maxHeight: 'calc(100vh - 80px)', objectFit: 'contain', background: '#F7F8FA' }}
            />
          </div>
        )}

      </div>
    </div>
  )
}
