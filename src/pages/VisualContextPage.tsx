// aiin · VisualContextPage v4 — com upload de referência no ajuste
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
  const [refFiles, setRefFiles]     = useState<File[]>([])
  const [error, setError]           = useState<string | null>(null)
  const [iteration, setIteration]   = useState(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileRef    = useRef<HTMLInputElement | null>(null)

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  const generate = async (note?: string, files?: File[]) => {
    setStatus('generating')
    setError(null)

    await supabase.from('brand_profiles').update({
      visual_context_status: 'pending',
      visual_context_test_url: null,
      visual_context_error: null,
    }).eq('id', brand.id)

    try {
      // Upload de referências se houver
      const refUrls: string[] = []
      for (const f of (files ?? [])) {
        const path = `${workspace.id}/visual-refs/${Date.now()}_${f.name}`
        const { error: upErr } = await supabase.storage.from('assets').upload(path, f, { upsert: true })
        if (!upErr) {
          const { data: u } = supabase.storage.from('assets').getPublicUrl(path)
          refUrls.push(u.publicUrl)
        }
      }

      const res = await fetch('/api/generate-visual-context-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          brand_id: brand.id,
          adjustment_note: note || null,
          reference_urls: refUrls,
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
    const note  = adjustNote.trim()
    const files = [...refFiles]
    setAdjustNote('')
    setRefFiles([])
    generate(note || undefined, files.length > 0 ? files : undefined)
  }

  const reset = async () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    await supabase.from('brand_profiles').update({
      openai_thread_id: null, visual_context_approved: false,
      visual_context_sample: null, visual_context_test_url: null, visual_context_status: null,
    }).eq('id', brand.id)
    setImageUrl(null); setStatus('idle'); setIteration(0)
  }

  const showImage = (status === 'reviewing' || status === 'adjusting') && imageUrl

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: '100%', maxWidth: showImage ? 960 : 480,
        display: 'grid',
        gridTemplateColumns: showImage ? '420px 1fr' : '1fr',
        gap: 20, padding: '0 24px', alignItems: 'center',
        transition: 'all .3s',
      }}>

        {/* ── Card de controles ── */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid rgba(7,13,31,.08)', padding: '28px 28px', boxShadow: '0 4px 24px rgba(7,13,31,.06)' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'white', marginBottom: 10, boxShadow: '0 6px 20px rgba(247,37,133,.3)' }}>✦</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#070D1F', letterSpacing: '-.3px', marginBottom: 5 }}>Validar estilo visual</h1>
            <p style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.5 }}>
              Antes de criar conteúdo, vamos garantir que a IA entendeu a identidade visual da <strong style={{ color: '#070D1F' }}>{brand.name}</strong>.
            </p>
          </div>

          {/* IDLE */}
          {status === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: '#F7F8FA', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['Logo',            brand.logo_urls?.primary ? '✓ enviada' : '— não enviada'],
                  ['Cores',           (brand.color_palette?.length ?? 0) > 0 ? `✓ ${brand.color_palette.length} cores` : '— não definidas'],
                  ['Slogan',          brand.slogans?.find((s: any) => s.active)?.text || '— não definido'],
                  ['Regras de design',brand.design_rules ? '✓ definidas' : '— não definidas'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#6B7280' }}>{k}</span>
                    <span style={{ color: (v as string).startsWith('✓') ? '#1D9E75' : '#9CA3AF', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
              {error && <div style={{ padding: '8px 12px', background: '#FCEBEB', border: '1px solid rgba(226,75,74,.2)', borderRadius: 8, fontSize: 12, color: '#E24B4A' }}>{error}</div>}
              <button onClick={() => generate()} style={{ width: '100%', height: 46, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 12, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(247,37,133,.3)' }}>
                ✦ Gerar arte teste
              </button>
              <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>Gera 1 imagem teste · não consome créditos</div>
            </div>
          )}

          {/* GENERATING */}
          {status === 'generating' && (
            <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(247,37,133,.2)', borderTopColor: '#F72585', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#070D1F' }}>
                {iteration === 0 ? 'Analisando identidade visual...' : 'Aplicando ajustes...'}
              </div>
              {['Lendo logo e referências', 'Aplicando cores da marca', 'Gerando arte teste'].map(s => (
                <div key={s} style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#F72585', fontSize: 9 }}>→</span> {s}
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>Isso pode levar até 1 minuto…</div>
            </div>
          )}

          {/* REVIEWING */}
          {status === 'reviewing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {iteration > 0 && <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>Versão {iteration} · você pode pedir mais ajustes</div>}
              <div style={{ display: 'flex', gap: 8 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#070D1F' }}>O que precisa ajustar?</div>
              <textarea
                value={adjustNote} onChange={e => setAdjustNote(e.target.value)}
                autoFocus rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(7,13,31,.12)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', color: '#070D1F', lineHeight: 1.5 }}
                placeholder="ex: fundo escuro, logo maior, texto em branco, menos elementos, mais minimalista..."
              />

              {/* Upload referência */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                  Imagem de referência <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => setRefFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => fileRef.current?.click()} style={{ height: 36, padding: '0 12px', border: '1.5px dashed rgba(247,37,133,.3)', borderRadius: 8, background: 'rgba(247,37,133,.04)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#F72585', fontWeight: 500 }}>
                    + Adicionar imagem
                  </button>
                  {refFiles.map((f, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={URL.createObjectURL(f)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(7,13,31,.1)' }} />
                      <button onClick={() => setRefFiles(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#E24B4A', border: 'none', color: 'white', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setStatus('reviewing'); setRefFiles([]) }} style={{ flex: 1, height: 42, border: '1px solid rgba(7,13,31,.12)', borderRadius: 10, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#374151' }}>
                  Cancelar
                </button>
                <button onClick={submitAdjustment} disabled={!adjustNote.trim() && refFiles.length === 0} style={{
                  flex: 2, height: 42, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'white',
                  background: (adjustNote.trim() || refFiles.length > 0) ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : '#e5e7eb',
                  opacity: (!adjustNote.trim() && refFiles.length === 0) ? 0.5 : 1,
                }}>
                  Regenerar com ajuste
                </button>
              </div>
            </div>
          )}

          {/* APPROVED */}
          {status === 'approved' && (
            <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#E1F5EE', border: '1px solid rgba(29,158,117,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1D9E75' }}>Estilo aprovado!</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Entrando no painel...</div>
            </div>
          )}
        </div>

        {/* ── Imagem gerada ── */}
        {showImage && (
          <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(7,13,31,.08)', boxShadow: '0 4px 24px rgba(7,13,31,.08)' }}>
            <img src={imageUrl!} alt="Arte teste" style={{ width: '100%', display: 'block', maxHeight: 'calc(100vh - 80px)', objectFit: 'contain', background: '#1a1a2e' }} />
          </div>
        )}

      </div>
    </div>
  )
}
