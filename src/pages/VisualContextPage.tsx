// ============================================================
//  aiin · VisualContextPage v2
//  Usa Background Function + polling no Supabase.
//  Fluxo: dispara geração → aguarda polling → exibe imagem
// ============================================================
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
  const [status, setStatus]         = useState<Status>('idle')
  const [imageUrl, setImageUrl]     = useState<string | null>(null)
  const [adjustNote, setAdjustNote] = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [iteration, setIteration]   = useState(0)
  const pollingRef                  = useRef<ReturnType<typeof setInterval> | null>(null)

  // Limpa polling ao desmontar
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  // ---- Dispara geração via Background Function ----
  const generate = async (note?: string) => {
    setStatus('generating')
    setError(null)

    // Limpa status anterior no Supabase antes de começar
    await supabase
      .from('brand_profiles')
      .update({ visual_context_status: 'pending', visual_context_test_url: null, visual_context_error: null })
      .eq('id', brand.id)

    try {
      // Dispara background function (retorna 202 imediatamente)
      const res = await fetch('/api/generate-visual-context-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          brand_id: brand.id,
          adjustment_note: note ?? null,
        }),
      })

      // Background functions retornam 202 — qualquer outro status é erro de deploy
      if (res.status !== 202 && res.status !== 200) {
        const text = await res.text()
        throw new Error(`Erro ao iniciar geração (${res.status}): ${text.slice(0, 200)}`)
      }

      // Inicia polling no Supabase
      startPolling()

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar geração')
      setStatus('idle')
    }
  }

  // ---- Polling: verifica visual_context_status a cada 3s ----
  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    pollingRef.current = setInterval(async () => {
      const { data, error: fetchErr } = await supabase
        .from('brand_profiles')
        .select('visual_context_status, visual_context_test_url, visual_context_error')
        .eq('id', brand.id)
        .single()

      if (fetchErr || !data) return

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

  // ---- Aprovação ----
  const approve = async () => {
    setStatus('approved')
    await supabase.from('brand_profiles').update({
      visual_context_approved: true,
      visual_context_sample: imageUrl,
    }).eq('id', brand.id)
    setTimeout(onApprove, 1200)
  }

  const requestAdjustment = () => setStatus('adjusting')

  const submitAdjustment = () => {
    generate(adjustNote)
    setAdjustNote('')
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--gradient)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'white', marginBottom: 14, boxShadow: '0 8px 24px rgba(247,37,133,.3)' }}>✦</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-.3px', marginBottom: 6 }}>
            Validar estilo visual
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
            Antes de criar conteúdo, vamos garantir que a IA entendeu a identidade visual da <strong style={{ color: 'var(--text-1)' }}>{brand.name}</strong>.
          </p>
        </div>

        <div className="card" style={{ padding: '24px 28px' }}>

          {/* IDLE */}
          {status === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
              <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['Logo', brand.logo_urls?.primary ? '✓ enviada' : '— não enviada'],
                  ['Cores', brand.color_palette?.length > 0 ? `✓ ${brand.color_palette.length} cores` : '— não definidas'],
                  ['Slogan', brand.slogans?.find((s: any) => s.active)?.text || '— não definido'],
                  ['Regras de design', brand.design_rules ? '✓ definidas' : '— não definidas'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-3)' }}>{k}</span>
                    <span style={{ color: (v as string).startsWith('✓') ? 'var(--success)' : 'var(--text-4)', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div style={{ padding: '10px 12px', background: 'var(--red-light)', border: '1px solid rgba(226,75,74,.2)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--red)' }}>
                  {error}
                </div>
              )}

              <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} onClick={() => generate()}>
                ✦ Gerar arte teste
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-4)' }}>Gera 1 imagem teste · não consome créditos do plano</div>
            </div>
          )}

          {/* GENERATING */}
          {status === 'generating' && (
            <div style={{ textAlign: 'center', padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid var(--accent-pink)', borderTopColor: 'transparent' }} className="spin" />
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>
                {iteration === 0 ? 'Analisando identidade visual...' : 'Ajustando estilo...'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {['Lendo logo e referências', 'Aplicando cores da marca', 'Gerando arte teste'].map((s) => (
                  <div key={s} style={{ fontSize: 12, color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                    <span style={{ color: 'var(--accent-pink)', fontSize: 10 }}>→</span> {s}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-4)' }}>Isso pode levar até 1 minuto…</div>
            </div>
          )}

          {/* REVIEWING / ADJUSTING */}
          {(status === 'reviewing' || status === 'adjusting') && imageUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={imageUrl} alt="Arte teste" style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain', background: 'var(--surface-2)' }} />
              </div>

              {iteration > 1 && (
                <div style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'center' }}>Versão {iteration} · você pode pedir mais ajustes</div>
              )}

              {status === 'adjusting' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label className="label">O que precisa ajustar?</label>
                  <textarea className="input" value={adjustNote} onChange={e => setAdjustNote(e.target.value)}
                    rows={3} style={{ resize: 'vertical' }} autoFocus
                    placeholder="ex: logo muito pequena, fundo deve ser escuro, texto em branco, cores mais vibrantes..." />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStatus('reviewing')}>Cancelar</button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={submitAdjustment} disabled={!adjustNote.trim()}>
                      Regenerar com ajuste
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={requestAdjustment}>
                    ✎ Pedir ajuste
                  </button>
                  <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={approve}>
                    ✓ Aprovei o estilo — começar
                  </button>
                </div>
              )}

              <button onClick={reset} style={{ background: 'none', border: 'none', color: 'var(--text-4)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'center' }}>
                Resetar contexto e começar do zero
              </button>
            </div>
          )}

          {/* APPROVED */}
          {status === 'approved' && (
            <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--success-light)', border: '1px solid rgba(29,158,117,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>Estilo aprovado!</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Entrando no painel...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
