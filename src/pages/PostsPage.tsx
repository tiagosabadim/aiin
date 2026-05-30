// ============================================================
//  aiin · PostsPage v3 — Supabase real + Design System v3
//  Imagem 4:5 · Botões 44px · Modal fullscreen · Swipe carrossel
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { approveOutput, rejectOutput, scheduleOutput } from '../lib/api'
import type { CreativeOutput, OutputStatus, CarouselPage } from '../types/database'

interface Props { workspaceId: string; userId: string }

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendente',   cls: 'badge-pending'   },
  approved:  { label: 'Aprovado',   cls: 'badge-approved'  },
  rejected:  { label: 'Recusado',   cls: 'badge-rejected'  },
  scheduled: { label: 'Agendado',   cls: 'badge-scheduled' },
  published: { label: 'Publicado',  cls: 'badge-published' },
}

const FORMAT_LABEL: Record<string, string> = {
  post_simples: 'Post', post_premium: 'Premium',
  carrossel_5: 'Carrossel 5p', carrossel_7: 'Carrossel 7p',
  story: 'Story', capa_reels: 'Reels', story_sequencia: 'Story 3p',
}

// ---- Skeleton ----
function SkeletonCard() {
  return (
    <div className="post-card">
      <div style={{ width: '100%', aspectRatio: '4/5', background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div className="spinner lg" />
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Gerando com IA…</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {['Texto', 'Imagem', 'Upload'].map(s => (
            <span key={s} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'rgba(247,37,133,.1)', color: 'var(--accent-pink)', border: '1px solid rgba(247,37,133,.15)' }}>{s}</span>
          ))}
        </div>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 10, width: '80%' }} />
        <div className="skeleton" style={{ height: 10, width: '55%' }} />
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <div className="skeleton" style={{ flex: 1, height: 44, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10 }} />
      </div>
    </div>
  )
}

// ---- Modal fullscreen ----
interface ModalProps {
  output: CreativeOutput
  slides: CarouselPage[]
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}

function PostModal({ output, slides, onClose, onApprove, onReject }: ModalProps) {
  const [idx, setIdx] = useState(0)
  const [captionOpen, setCaptionOpen] = useState(false)
  const touchStartX = useRef(0)
  const images = slides.length > 0 ? slides.map(s => s.public_url) : [output.public_url]
  const current = images[idx]
  const cfg = STATUS_CFG[output.status] ?? STATUS_CFG.pending

  const prev = () => setIdx(i => Math.max(0, i - 1))
  const next = () => setIdx(i => Math.min(images.length - 1, i + 1))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 440, maxHeight: '92vh', background: 'var(--surface)', borderRadius: 'var(--r20)', overflow: 'hidden', border: '1px solid var(--border)' }}
      >
        {/* Imagem */}
        <div
          style={{ position: 'relative', width: '100%', aspectRatio: '4/5', background: '#000', overflow: 'hidden', flexShrink: 0 }}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            const diff = touchStartX.current - e.changedTouches[0].clientX
            if (Math.abs(diff) > 40) diff > 0 ? next() : prev()
          }}
        >
          {current
            ? <img src={current} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.3)', fontSize: 14 }}>Sem imagem</div>
          }
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,.5)', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          <span className={`badge ${cfg.cls}`} style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,.5)', color: 'white', backdropFilter: 'blur(4px)' }}>{cfg.label}</span>
          {output.ai_score && (
            <span className="badge badge-brand" style={{ position: 'absolute', bottom: 12, left: 12 }}>✦ {Number(output.ai_score).toFixed(1)}</span>
          )}
          {images.length > 1 && (
            <>
              <button onClick={prev} disabled={idx === 0} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,.5)', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? .3 : 1 }}>‹</button>
              <button onClick={next} disabled={idx === images.length - 1} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,.5)', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === images.length - 1 ? .3 : 1 }}>›</button>
              <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 5 }}>
                {images.map((_, i) => (
                  <div key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 99, background: i === idx ? 'white' : 'rgba(255,255,255,.4)', cursor: 'pointer', transition: 'all .2s' }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Caption */}
        {output.caption && (
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => setCaptionOpen(o => !o)} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-3)' }}>
              <span>Ver legenda</span>
              <span style={{ display: 'inline-block', transform: captionOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
            </button>
            {captionOpen && (
              <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>{output.caption}</div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
          {output.status === 'pending' && (
            <button className="btn btn-success btn-md" style={{ flex: 1 }} onClick={() => { onApprove(); onClose() }}>✓ Aprovar post</button>
          )}
          {output.status !== 'rejected' && output.status !== 'published' && (
            <button className="btn btn-danger btn-md" onClick={() => { onReject(); onClose() }}>✕ Recusar</button>
          )}
          <button className="btn-icon lg" onClick={onClose} style={{ marginLeft: 'auto' }}>×</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  PostsPage principal
// ============================================================
export function PostsPage({ workspaceId, userId }: Props) {
  const [outputs, setOutputs]     = useState<CreativeOutput[]>([])
  const [slides, setSlides]       = useState<Record<string, CarouselPage[]>>({})
  const [loading, setLoading]     = useState(true)
  const [processing, setProcessing] = useState(0)
  const [filter, setFilter]       = useState<OutputStatus | 'all'>('all')
  const [modalOutput, setModalOutput] = useState<CreativeOutput | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [editImageId, setEditImageId] = useState<string | null>(null)
  const [editInstruction, setEditInstruction] = useState('')
  const [editingImage, setEditingImage] = useState(false)
  const [editImageErr, setEditImageErr] = useState<string | null>(null)
  const [editingImageIds, setEditingImageIds] = useState<Set<string>>(new Set())
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('18:00')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchOutputs = useCallback(async () => {
    let q = supabase.from('creative_outputs').select('*')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setOutputs(data ?? [])
    setLoading(false)
  }, [workspaceId, filter])

  const fetchProcessing = useCallback(async () => {
    const { data } = await supabase.from('content_jobs').select('id')
      .eq('workspace_id', workspaceId).in('status', ['pending', 'processing'])
    setProcessing(data?.length ?? 0)
  }, [workspaceId])

  useEffect(() => { fetchOutputs(); fetchProcessing() }, [fetchOutputs, fetchProcessing])

  useEffect(() => {
    const ch = supabase.channel(`outputs:${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creative_outputs', filter: `workspace_id=eq.${workspaceId}` }, () => fetchOutputs())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspaceId, fetchOutputs])

  useEffect(() => {
    const ch = supabase.channel(`jobs:${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_jobs', filter: `workspace_id=eq.${workspaceId}` }, () => { fetchProcessing(); fetchOutputs() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspaceId, fetchProcessing, fetchOutputs])

  useEffect(() => {
    if (processing === 0) return
    const t = setInterval(() => { fetchProcessing(); fetchOutputs() }, 5000)
    return () => clearInterval(t)
  }, [processing, fetchProcessing, fetchOutputs])

  const fetchSlides = async (outputId: string) => {
    if (slides[outputId]) return
    const { data } = await supabase.from('carousel_pages').select('*')
      .eq('creative_output_id', outputId).order('page_number')
    if (data?.length) setSlides(prev => ({ ...prev, [outputId]: data }))
  }

  const submitImageEdit = async () => {
    if (!editImageId || !editInstruction.trim()) return
    setEditingImage(true); setEditImageErr(null)
    const targetId = editImageId
    const prevUrl = outputs.find(o => o.id === targetId)?.public_url
    try {
      // Background function: dispara e retorna 202 imediato
      await fetch('/api/edit-image-background', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output_id: targetId, instruction: editInstruction, workspace_id: workspaceId }),
      })

      // Fecha o modal e marca o post como "editando" visualmente
      setEditImageId(null); setEditInstruction('')
      setEditingImageIds(prev => new Set(prev).add(targetId))

      // Polling: verifica a cada 3s se a imagem mudou (até 90s)
      let tries = 0
      const poll = setInterval(async () => {
        tries++
        const { data } = await supabase.from('creative_outputs').select('public_url, edit_count').eq('id', targetId).single()
        if (data && data.public_url !== prevUrl) {
          setOutputs(prev => prev.map(o => o.id === targetId ? { ...o, public_url: data.public_url, edit_count: data.edit_count } : o))
          setEditingImageIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
          clearInterval(poll)
        } else if (tries >= 30) {
          setEditingImageIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
          clearInterval(poll)
        }
      }, 3000)
    } catch (e: any) {
      setEditImageErr(e.message ?? 'Erro ao editar imagem')
    } finally {
      setEditingImage(false)
    }
  }

  const handleApprove = async (id: string) => {
    await approveOutput(id, userId)
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: 'approved' as OutputStatus } : o))
  }
  const handleReject = async (id: string) => {
    await rejectOutput(id, userId)
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: 'rejected' as OutputStatus } : o))
  }
  const handleApproveAll = () => outputs.filter(o => o.status === 'pending').forEach(o => handleApprove(o.id))

  const saveEdit = async (id: string) => {
    await supabase.from('creative_outputs').update({ caption: editCaption }).eq('id', id)
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, caption: editCaption } : o))
    setEditingId(null)
  }

  const saveSchedule = async (id: string) => {
    const dt = new Date(`${scheduleDate}T${scheduleTime}:00`)
    await scheduleOutput(id, userId, dt)
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: 'scheduled' as OutputStatus, scheduled_at: dt.toISOString() } : o))
    setSchedulingId(null)
  }

  const deleteOutput = async (id: string) => {
    await supabase.from('creative_outputs').delete().eq('id', id)
    setOutputs(prev => prev.filter(o => o.id !== id))
    setConfirmDeleteId(null)
  }

  const openModal = async (output: CreativeOutput) => {
    setModalOutput(output)
    if (output.format?.includes('carrossel') || output.format?.includes('story_sequencia')) {
      await fetchSlides(output.id)
    }
  }

  const filtered  = filter === 'all' ? outputs : outputs.filter(o => o.status === filter)
  const pendingCt = outputs.filter(o => o.status === 'pending').length

  const FILTERS: [OutputStatus | 'all', string, number][] = [
    ['all',       `Todos`,      outputs.length],
    ['pending',   `Pendentes`,  pendingCt],
    ['approved',  `Aprovados`,  outputs.filter(o => o.status === 'approved').length],
    ['scheduled', `Agendados`,  outputs.filter(o => o.status === 'scheduled').length],
    ['published', `Publicados`, outputs.filter(o => o.status === 'published').length],
    ['rejected',  `Recusados`,  outputs.filter(o => o.status === 'rejected').length],
  ]

  return (
    <div className="page">

      {modalOutput && (
        <PostModal
          output={modalOutput}
          slides={slides[modalOutput.id] ?? []}
          onClose={() => setModalOutput(null)}
          onApprove={() => handleApprove(modalOutput.id)}
          onReject={() => handleReject(modalOutput.id)}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Aprovar conteúdo</h1>
          <p className="page-sub">
            {processing > 0
              ? <span style={{ color: 'var(--accent-pink)' }}>✦ Gerando {processing} post{processing > 1 ? 's' : ''}…</span>
              : pendingCt > 0 ? `${pendingCt} aguardando aprovação` : 'Tudo revisado ✓'
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-md" style={{ border:'1px solid rgba(7,13,31,.12)', background:'transparent', color:'#374151' }} onClick={() => { fetchOutputs(); fetchProcessing() }}>↺ Atualizar</button>
          {pendingCt > 0 && (
            <button className="btn btn-primary btn-md" onClick={handleApproveAll}>✓ Aprovar todos</button>
          )}
        </div>
      </div>

      {/* Banner gerando */}
      {processing > 0 && (
        <div className="generating-banner">
          <div className="spinner" />
          <div>
            <div className="generating-banner-text">Gerando {processing} post{processing > 1 ? 's' : ''} com IA</div>
            <div className="generating-banner-sub">DALL-E 3 + GPT-4o · até 60 segundos · atualiza automaticamente</div>
          </div>
        </div>
      )}

      {/* Card branco: filtros + grid */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r16)', padding:'16px 20px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* Filtros */}
        <div className="filter-row" style={{ marginBottom:0 }}>
          {FILTERS.map(([val, label, count]) => (
            <button key={val} onClick={() => setFilter(val)} className={`filter-btn ${filter === val ? 'active' : ''}`}>
              {label}
              {count > 0 && <span className="filter-count">{count}</span>}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="posts-grid">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="posts-grid">
          {processing > 0 && Array.from({ length: processing }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)}

          {filtered.length === 0 && processing === 0 && (
            <div style={{ gridColumn: '1/-1' }}>
              <div className="empty-state">
                <div className="empty-state-icon">🖼</div>
                <div className="empty-state-title">Nenhum post aqui</div>
                <div className="empty-state-sub">Crie um pedido para gerar conteúdo com IA.</div>
              </div>
            </div>
          )}

          {filtered.map(output => {
            const cfg       = STATUS_CFG[output.status] ?? STATUS_CFG.pending
            const isCarousel = output.format?.includes('carrossel') || output.format?.includes('story_sequencia')
            const outSlides  = slides[output.id] ?? []
            const isEditing  = editingId === output.id
            const isSched    = schedulingId === output.id
            const isDel      = confirmDeleteId === output.id

            return (
              <div key={output.id} className="post-card fade-in" style={{ opacity: output.status === 'rejected' ? .5 : 1 }}>

                {/* Imagem 4:5 real */}
                <div className="post-card-image" onClick={() => output.public_url && !editingImageIds.has(output.id) && openModal(output)} style={{ position: 'relative' }}>
                  {editingImageIds.has(output.id) && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(7,13,31,.7)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>🎨 Editando imagem...</span>
                    </div>
                  )}
                  {output.public_url
                    ? <img src={output.public_url} alt="Arte gerada" loading="lazy" />
                    : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-4)' }}>
                        <span style={{ fontSize: 32, opacity: .3 }}>🖼</span>
                        <span style={{ fontSize: 12 }}>Imagem gerada pela IA</span>
                      </div>
                    )
                  }
                  <div className="post-card-badges">
                    <span className={`badge ${cfg.cls}`} style={{ background: 'rgba(0,0,0,.5)', color: 'white', backdropFilter: 'blur(4px)' }}>{cfg.label}</span>
                    {output.ai_score && <span className="badge badge-brand">✦ {Number(output.ai_score).toFixed(1)}</span>}
                  </div>
                  <div className="post-card-format">
                    <span className="badge" style={{ background: 'rgba(0,0,0,.5)', color: 'white', backdropFilter: 'blur(4px)', fontSize: 9 }}>
                      {FORMAT_LABEL[output.format ?? ''] ?? output.format}
                    </span>
                  </div>
                  {output.public_url && (
                    <span style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 9, color: 'rgba(255,255,255,.6)' }}>🔍 ampliar</span>
                  )}
                </div>

                {/* Miniaturas carrossel */}
                {isCarousel && outSlides.length > 1 && (
                  <div style={{ display: 'flex', gap: 4, padding: '8px 12px 0', overflowX: 'auto' }}>
                    {outSlides.map((slide, i) => (
                      <div key={i} onClick={() => openModal(output)} style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }}>
                        {slide.public_url
                          ? <img src={slide.public_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--text-4)' }}>{i + 1}</div>
                        }
                      </div>
                    ))}
                  </div>
                )}

                {/* Corpo */}
                <div className="post-card-body">
                  {isEditing ? (
                    <div>
                      <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} autoFocus
                        className="input" style={{ minHeight: 80, resize: 'vertical', fontSize: 12 }} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn btn-success btn-sm" onClick={() => saveEdit(output.id)}>Salvar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <p className="post-card-caption">{output.caption || 'Sem legenda'}</p>
                  )}

                  {isSched && (
                    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r10)', padding: 12, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>Agendar publicação</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="input" style={{ fontSize: 12 }} />
                        <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="input" style={{ fontSize: 12 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => saveSchedule(output.id)}>📅 Agendar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSchedulingId(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  {!isSched && output.scheduled_at && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      📅 {new Date(output.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  )}

                  {isDel && (
                    <div style={{ background: 'var(--danger-bg)', borderRadius: 'var(--r10)', padding: 10, border: '1px solid var(--danger-border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>Deletar permanentemente?</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteOutput(output.id)}>Deletar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action bar — sempre visível */}
                {!isEditing && !isSched && !isDel && (
                  <div className="post-card-actions" style={{ display:'flex', gap:6, padding:'12px 14px', borderTop:'1px solid rgba(7,13,31,.06)' }}>
                    {output.status === 'pending' && (
                      <button className="btn btn-primary btn-md" style={{ flex:1 }} onClick={() => handleApprove(output.id)}>✓ Aprovar</button>
                    )}
                    {output.status === 'approved' && (
                      <button className="btn btn-md" style={{ flex:1, border:'1px solid rgba(7,13,31,.12)', background:'transparent', color:'#374151' }} onClick={() => { const t=new Date(); t.setDate(t.getDate()+1); setScheduleDate(t.toISOString().split('T')[0]); setScheduleTime('18:00'); setSchedulingId(output.id) }}>📅 Agendar</button>
                    )}
                    {output.status !== 'published' && (
                      <>
                        <button className="btn btn-sm" style={{ border:'1px solid rgba(123,44,255,.2)', background:'transparent', color:'#7B2CFF' }} onClick={() => { setEditImageId(output.id); setEditInstruction(''); setEditImageErr(null) }} title="Editar imagem">🎨</button>
                        <button className="btn btn-sm" style={{ border:'1px solid rgba(7,13,31,.1)', background:'transparent', color:'#374151' }} onClick={() => { setEditingId(output.id); setEditCaption(output.caption ?? '') }} title="Editar legenda">✎</button>
                      </>
                    )}
                    {output.status !== 'rejected' && output.status !== 'published' && (
                      <button className="btn btn-sm" style={{ border:'1px solid rgba(226,75,74,.2)', background:'transparent', color:'#E24B4A' }} onClick={() => handleReject(output.id)}>✕</button>
                    )}
                    <button className="btn btn-sm" style={{ border:'1px solid rgba(7,13,31,.1)', background:'transparent', color:'#9CA3AF', marginLeft:'auto' }} onClick={() => setConfirmDeleteId(output.id)}>🗑</button>
                  </div>
                )}
              </div>
            )
          })}
          </div>
        )}
      </div>

      {/* Modal editar imagem */}
      {editImageId && (() => {
        const target = outputs.find(o => o.id === editImageId)
        const isFirstFree = (target?.edit_count ?? 0) < 1
        return (
          <div onClick={() => !editingImage && setEditImageId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(7,13,31,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>🎨</span>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#070D1F' }}>Editar imagem</h3>
              </div>
              <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>Descreva o ajuste que você quer na imagem. A IA aplica mantendo o resto.</p>

              {target?.public_url && (
                <img src={target.public_url} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 12, marginBottom: 16, background: '#F7F8FA' }} />
              )}

              <textarea
                value={editInstruction}
                onChange={e => setEditInstruction(e.target.value)}
                autoFocus
                placeholder="ex: escurece um pouco a foto · coloca um degradê atrás da frase · deixa o texto maior · troca o fundo por algo mais clean"
                style={{ width: '100%', minHeight: 90, padding: '12px 14px', border: '1.5px solid rgba(7,13,31,.12)', borderRadius: 12, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />

              {!isFirstFree && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#FAEEDA', border: '1px solid rgba(186,117,23,.2)', borderRadius: 8, fontSize: 12, color: '#633806' }}>
                  Esta edição vai custar <strong>1 crédito</strong>.
                </div>
              )}

              {editImageErr && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#FCEBEB', border: '1px solid rgba(226,75,74,.2)', borderRadius: 8, fontSize: 12, color: '#E24B4A' }}>{editImageErr}</div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button onClick={() => setEditImageId(null)} disabled={editingImage} className="btn btn-md" style={{ flex: 1, border: '1px solid rgba(7,13,31,.12)', background: 'transparent', color: '#374151' }}>Cancelar</button>
                <button onClick={submitImageEdit} disabled={editingImage || !editInstruction.trim()} className="btn btn-primary btn-md" style={{ flex: 2, opacity: editingImage || !editInstruction.trim() ? .5 : 1 }}>
                  {editingImage
                    ? <><div style={{ width: 15, height: 15, border: '2.5px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Editando...</>
                    : <>✦ Aplicar ajuste</>
                  }
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
