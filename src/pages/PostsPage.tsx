import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { approveOutput, rejectOutput, scheduleOutput } from '../lib/api'
import type { CreativeOutput, OutputStatus, CarouselPage } from '../types/database'

interface Props { workspaceId: string; userId: string }

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:   { label:'Pendente',  cls:'badge-pending'   },
  approved:  { label:'Aprovado',  cls:'badge-approved'  },
  rejected:  { label:'Recusado', cls:'badge-rejected'  },
  scheduled: { label:'Agendado', cls:'badge-scheduled' },
  published: { label:'Publicado',cls:'badge-published' },
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      <div style={{ height:200, background:'var(--surface-2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, position:'relative' }}>
        <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid var(--accent-pink)', borderTopColor:'transparent' }} className="spin" />
        <div style={{ fontSize:13, color:'var(--text-3)', fontWeight:500 }}>Gerando com IA...</div>
        <div style={{ position:'absolute', bottom:12, left:0, right:0, display:'flex', justifyContent:'center', gap:6 }}>
          {['Copy','Imagem','Salvando'].map(s => (
            <span key={s} style={{ fontSize:9, padding:'2px 8px', borderRadius:99, background:'rgba(247,37,133,.1)', color:'var(--accent-pink)', border:'1px solid rgba(247,37,133,.15)' }}>{s}</span>
          ))}
        </div>
      </div>
      <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
        <div className="shimmer" style={{ height:11, width:'85%' }} />
        <div className="shimmer" style={{ height:11, width:'65%' }} />
        <div style={{ display:'flex', gap:6, marginTop:4 }}>
          <div className="shimmer" style={{ height:28, width:80, borderRadius:'var(--radius-md)' }} />
          <div className="shimmer" style={{ height:28, width:64, borderRadius:'var(--radius-md)' }} />
        </div>
      </div>
    </div>
  )
}

export function PostsPage({ workspaceId, userId }: Props) {
  const [outputs, setOutputs]   = useState<CreativeOutput[]>([])
  const [slides, setSlides]     = useState<Record<string, CarouselPage[]>>({})
  const [loading, setLoading]   = useState(true)
  const [processingJobs, setProcessingJobs] = useState(0)
  const [filter, setFilter]     = useState<OutputStatus | 'all'>('all')
  const [modalOutput, setModalOutput] = useState<CreativeOutput | null>(null)
  const [modalSlideIdx, setModalSlideIdx] = useState(0)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
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

  const fetchProcessingJobs = useCallback(async () => {
    const { data } = await supabase.from('content_jobs').select('id')
      .eq('workspace_id', workspaceId).in('status', ['pending','processing'])
    setProcessingJobs(data?.length ?? 0)
  }, [workspaceId])

  useEffect(() => { fetchOutputs(); fetchProcessingJobs() }, [fetchOutputs, fetchProcessingJobs])

  useEffect(() => {
    const ch = supabase.channel(`outputs:${workspaceId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'creative_outputs', filter:`workspace_id=eq.${workspaceId}` }, () => { fetchOutputs() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspaceId, fetchOutputs])

  useEffect(() => {
    const ch = supabase.channel(`jobs:${workspaceId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'content_jobs', filter:`workspace_id=eq.${workspaceId}` }, () => { fetchProcessingJobs(); fetchOutputs() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspaceId, fetchProcessingJobs, fetchOutputs])

  useEffect(() => {
    if (processingJobs === 0) return
    const t = setInterval(() => { fetchProcessingJobs(); fetchOutputs() }, 5000)
    return () => clearInterval(t)
  }, [processingJobs, fetchProcessingJobs, fetchOutputs])

  const fetchSlides = async (outputId: string) => {
    if (slides[outputId]) return
    const { data } = await supabase.from('carousel_pages').select('*')
      .eq('creative_output_id', outputId).order('page_number')
    if (data?.length) setSlides(prev => ({ ...prev, [outputId]: data }))
  }

  const filtered = filter === 'all' ? outputs : outputs.filter(o => o.status === filter)
  const pendingCount = outputs.filter(o => o.status === 'pending').length

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
    setModalOutput(output); setModalSlideIdx(0)
    if (output.format?.includes('carrossel') || output.format?.includes('story_sequencia')) await fetchSlides(output.id)
  }

  const modalSlides = modalOutput ? (slides[modalOutput.id] ?? []) : []
  const currentModalImg = modalSlides.length > 0 ? (modalSlides[modalSlideIdx]?.public_url ?? modalOutput?.public_url) : modalOutput?.public_url

  const FILTER_ITEMS: [OutputStatus | 'all', string, number][] = [
    ['all','Todos',outputs.length],
    ['pending','Pendentes',pendingCount],
    ['approved','Aprovados',outputs.filter(o=>o.status==='approved').length],
    ['scheduled','Agendados',outputs.filter(o=>o.status==='scheduled').length],
    ['published','Publicados',outputs.filter(o=>o.status==='published').length],
    ['rejected','Recusados',outputs.filter(o=>o.status==='rejected').length],
  ]

  return (
    <div className="page">

      {/* Modal */}
      {modalOutput && (
        <div className="modal-overlay" onClick={() => setModalOutput(null)}>
          <div onClick={e => e.stopPropagation()} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, maxWidth:'92vw', width:'100%' }}>
            <div style={{ position:'relative', width:'100%', display:'flex', justifyContent:'center' }}>
              {currentModalImg
                ? <img src={currentModalImg} alt="" style={{ maxWidth:'min(500px, 90vw)', maxHeight:'65vh', borderRadius:16, objectFit:'contain', boxShadow:'0 20px 60px rgba(0,0,0,.5)' }} />
                : <div style={{ width:320, height:320, background:'rgba(255,255,255,.05)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.4)', fontSize:14 }}>Sem imagem</div>
              }
              <button onClick={() => setModalOutput(null)} style={{ position:'absolute', top:-8, right:-8, width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,.15)', border:'none', color:'white', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>

            {modalSlides.length > 1 && (
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={() => setModalSlideIdx(i => Math.max(0,i-1))} disabled={modalSlideIdx===0}
                  style={{ width:36, height:36, borderRadius:'50%', border:'1px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.1)', color:'white', fontSize:18, cursor:'pointer', opacity:modalSlideIdx===0?.4:1 }}>‹</button>
                {modalSlides.map((_,i) => (
                  <div key={i} onClick={() => setModalSlideIdx(i)} style={{ width:7, height:7, borderRadius:'50%', background: i===modalSlideIdx ? 'white' : 'rgba(255,255,255,.3)', cursor:'pointer', transition:'all .15s' }} />
                ))}
                <button onClick={() => setModalSlideIdx(i => Math.min(modalSlides.length-1,i+1))} disabled={modalSlideIdx===modalSlides.length-1}
                  style={{ width:36, height:36, borderRadius:'50%', border:'1px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.1)', color:'white', fontSize:18, cursor:'pointer', opacity:modalSlideIdx===modalSlides.length-1?.4:1 }}>›</button>
              </div>
            )}

            {modalOutput.caption && (
              <div style={{ background:'rgba(255,255,255,.07)', borderRadius:12, padding:'12px 18px', maxWidth:480, width:'100%', backdropFilter:'blur(4px)' }}>
                <div style={{ fontSize:12, color:'rgba(255,255,255,.8)', lineHeight:1.7 }}>{modalOutput.caption}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title">Aprovar conteúdo</h1>
          <p className="page-sub">
            {processingJobs > 0
              ? <span style={{ color:'var(--accent-pink)' }}>✦ Gerando {processingJobs} post{processingJobs>1?'s':''}...</span>
              : pendingCount > 0 ? `${pendingCount} aguardando aprovação` : 'Tudo revisado'
            }
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { fetchOutputs(); fetchProcessingJobs() }}>↺ Atualizar</button>
          {pendingCount > 0 && <button className="btn btn-primary btn-sm" onClick={handleApproveAll}>✓ Aprovar todos</button>}
        </div>
      </div>

      {/* Banner gerando */}
      {processingJobs > 0 && (
        <div className="card-gradient" style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, padding:'12px 16px' }}>
          <div style={{ width:18, height:18, borderRadius:'50%', border:'2.5px solid var(--accent-pink)', borderTopColor:'transparent', flexShrink:0 }} className="spin" />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)' }}>Gerando {processingJobs} post{processingJobs>1?'s':''} com IA</div>
            <div style={{ fontSize:11, color:'var(--text-3)' }}>GPT-4o + gpt-image-2 · pode levar até 60 segundos · atualiza automaticamente</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="filter-row">
        {FILTER_ITEMS.map(([val,label,count]) => (
          <button key={val} onClick={() => setFilter(val)} className={`filter-btn ${filter===val?'active':''}`}>
            {label}
            {count > 0 && <span className="filter-count">{count}</span>}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="posts-grid">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="posts-grid">
          {processingJobs > 0 && Array.from({ length: processingJobs }).map((_,i) => <SkeletonCard key={`sk-${i}`} />)}

          {filtered.length === 0 && processingJobs === 0 ? (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'56px 0', color:'var(--text-4)' }}>
              <div style={{ fontSize:36, marginBottom:12, opacity:.3 }}>◻</div>
              <div style={{ fontSize:14, marginBottom:4 }}>Nenhum post aqui.</div>
              <div style={{ fontSize:13 }}>Crie um pedido para gerar conteúdo com IA.</div>
            </div>
          ) : filtered.map(output => {
            const cfg = STATUS_CONFIG[output.status] ?? STATUS_CONFIG.pending
            const isCarousel  = output.format?.includes('carrossel') || output.format?.includes('story_sequencia')
            const outputSlides = slides[output.id] ?? []
            const isEditing    = editingId    === output.id
            const isScheduling = schedulingId === output.id
            const isDeleting   = confirmDeleteId === output.id

            return (
              <div key={output.id} className="card" style={{ padding:0, overflow:'hidden', opacity: output.status==='rejected'?.55:1, display:'flex', flexDirection:'column' }}>

                {/* Thumbnail */}
                <div style={{ height:200, background:'var(--surface-2)', position:'relative', overflow:'hidden', cursor: output.public_url ? 'zoom-in' : 'default', flexShrink:0 }}
                  onClick={() => output.public_url && openModal(output)}>
                  {output.public_url
                    ? <img src={output.public_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform .3s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLImageElement).style.transform='scale(1.03)'}
                        onMouseLeave={e => (e.currentTarget as HTMLImageElement).style.transform='scale(1)'} />
                    : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:8, color:'var(--text-4)' }}>
                        <div style={{ fontSize:28, opacity:.4 }}>🖼</div>
                        <div style={{ fontSize:12 }}>Sem imagem</div>
                      </div>
                  }
                  <span className={`badge ${cfg.cls}`} style={{ position:'absolute', top:10, right:10 }}>{cfg.label}</span>
                  {output.ai_score && <span className="badge badge-gradient" style={{ position:'absolute', top:10, left:10 }}>✦ {Number(output.ai_score).toFixed(1)}</span>}
                  <div style={{ position:'absolute', bottom:10, left:10, display:'flex', gap:6 }}>
                    <span className="badge" style={{ background:'rgba(5,6,13,.6)', color:'rgba(255,255,255,.9)', fontSize:9 }}>{output.format}</span>
                    {isCarousel && outputSlides.length > 0 && <span className="badge" style={{ background:'rgba(5,6,13,.6)', color:'rgba(255,255,255,.9)', fontSize:9 }}>{outputSlides.length} slides</span>}
                  </div>
                  {output.public_url && <span style={{ position:'absolute', bottom:10, right:10, fontSize:9, color:'rgba(255,255,255,.7)' }}>🔍 ampliar</span>}
                </div>

                {/* Miniaturas carrossel */}
                {isCarousel && outputSlides.length > 1 && (
                  <div style={{ display:'flex', gap:4, padding:'8px 12px 0', overflowX:'auto' }}>
                    {outputSlides.map((slide, i) => (
                      <div key={i} onClick={() => openModal(output)} style={{ width:38, height:38, flexShrink:0, borderRadius:6, overflow:'hidden', border:'1px solid var(--border)', cursor:'pointer' }}>
                        {slide.public_url
                          ? <img src={slide.public_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <div style={{ width:'100%', height:'100%', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'var(--text-4)' }}>{i+1}</div>
                        }
                      </div>
                    ))}
                  </div>
                )}

                {/* Body */}
                <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                  {isEditing ? (
                    <div>
                      <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} autoFocus
                        className="input" style={{ minHeight:80, resize:'vertical', fontSize:12 }} />
                      <div style={{ display:'flex', gap:6, marginTop:6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(output.id)}>Salvar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.6, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', flex:1 }}>
                      {output.caption || 'Sem legenda'}
                    </p>
                  )}

                  {isScheduling && (
                    <div style={{ background:'var(--surface-2)', borderRadius:'var(--radius-md)', padding:10, display:'flex', flexDirection:'column', gap:8, border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>Agendar publicação</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                        <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="input" style={{ fontSize:12 }} />
                        <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="input" style={{ fontSize:12 }} />
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => saveSchedule(output.id)}>Agendar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSchedulingId(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  {!isScheduling && output.scheduled_at && (
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>📅 {new Date(output.scheduled_at).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' })}</div>
                  )}

                  {isDeleting && (
                    <div style={{ background:'var(--red-light)', borderRadius:'var(--radius-md)', padding:10, border:'1px solid rgba(226,75,74,.2)' }}>
                      <div style={{ fontSize:12, color:'var(--red)', marginBottom:8 }}>Deletar permanentemente?</div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteOutput(output.id)}>Deletar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  {!isEditing && !isScheduling && !isDeleting && (
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:'auto' }}>
                      {output.status === 'pending' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleApprove(output.id)}>✓ Aprovar</button>
                      )}
                      {output.status === 'approved' && (
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          const t = new Date(); t.setDate(t.getDate()+1)
                          setScheduleDate(t.toISOString().split('T')[0])
                          setScheduleTime('18:00')
                          setSchedulingId(output.id)
                        }}>📅 Agendar</button>
                      )}
                      {output.status !== 'published' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(output.id); setEditCaption(output.caption ?? '') }}>✎ Editar</button>
                      )}
                      {output.status !== 'rejected' && output.status !== 'published' && (
                        <button className="btn btn-ghost btn-sm" style={{ color:'var(--red)', borderColor:'rgba(226,75,74,.25)' }} onClick={() => handleReject(output.id)}>✕ Recusar</button>
                      )}
                      <button className="icon-btn danger" style={{ marginLeft:'auto' }} onClick={() => setConfirmDeleteId(output.id)}>🗑</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
