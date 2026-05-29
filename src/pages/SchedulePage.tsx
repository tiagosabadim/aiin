// aiin · SchedulePage v3 — UI conforme mockup aprovado
// Desktop: calendário largo + painel direito fixo
// Mobile: calendário + bottom sheet ao selecionar
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Props { workspaceId: string; navigate: (r: string) => void }

interface ScheduledPost {
  id: string
  scheduled_at: string
  status: string
  external: boolean
  external_caption?: string | null
  external_url?: string | null
  output: { id: string; caption: string; public_url: string | null; format: string } | null
}

const DAYS   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const STATUS: Record<string, { dot: string; label: string; bg: string; color: string }> = {
  scheduled:  { dot: '#7B2CFF', label: 'Agendado',   bg: 'rgba(123,44,255,.1)',  color: '#7B2CFF' },
  publishing: { dot: '#BA7517', label: 'Publicando',  bg: '#FAEEDA',             color: '#633806' },
  published:  { dot: '#1D9E75', label: 'Publicado',   bg: '#E1F5EE',             color: '#085041' },
  failed:     { dot: '#E24B4A', label: 'Falha na publicação', bg: '#FCEBEB',     color: '#791F1F' },
  external:   { dot: '#185FA5', label: 'Externo',     bg: 'rgba(24,95,165,.1)',  color: '#185FA5' },
}

export function SchedulePage({ workspaceId, navigate }: Props) {
  const [posts, setPosts]           = useState<ScheduledPost[]>([])
  const [loading, setLoading]       = useState(true)
  const [now]                       = useState(new Date())
  const [viewMonth, setViewMonth]   = useState(now.getMonth())
  const [viewYear,  setViewYear]    = useState(now.getFullYear())
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)

  // Reagendar
  const [reschedDate, setReschedDate] = useState('')
  const [reschedTime, setReschedTime] = useState('18:00')
  const [editingTime, setEditingTime] = useState(false)
  const [saving, setSaving]           = useState(false)

  // Post externo
  const [showExtModal, setShowExtModal] = useState(false)
  const [extDate, setExtDate]           = useState('')
  const [extTime, setExtTime]           = useState('18:00')
  const [extCaption, setExtCaption]     = useState('')
  const [extFile, setExtFile]           = useState<File | null>(null)
  const [extPreview, setExtPreview]     = useState<string | null>(null)
  const [savingExt, setSavingExt]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchPosts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('scheduled_posts')
      .select('id, scheduled_at, status, external, external_caption, external_url, output:creative_outputs(id, caption, public_url, format)')
      .eq('workspace_id', workspaceId)
      .order('scheduled_at', { ascending: true })
    const mapped = (data ?? []).map((p: any) => ({
      ...p,
      external: p.external ?? false,
      external_caption: p.external_caption ?? null,
      external_url: p.external_url ?? null,
    }))
    setPosts(mapped as any)
    setLoading(false)
  }

  useEffect(() => {
    fetchPosts()
    const ch = supabase.channel(`sched:${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_posts', filter: `workspace_id=eq.${workspaceId}` }, fetchPosts)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspaceId])

  const doReschedule = async () => {
    if (!selectedPost || !reschedDate) return
    setSaving(true)
    const dt = new Date(`${reschedDate}T${reschedTime}:00`)
    await supabase.from('scheduled_posts').update({ scheduled_at: dt.toISOString(), status: 'scheduled' }).eq('id', selectedPost.id)
    const updated = { ...selectedPost, scheduled_at: dt.toISOString(), status: 'scheduled' }
    setPosts(prev => prev.map(p => p.id === selectedPost.id ? updated : p))
    setSelectedPost(updated)
    setEditingTime(false)
    setSaving(false)
  }

  const saveExternal = async () => {
    if (!extDate) return
    setSavingExt(true)
    let imageUrl: string | null = null
    if (extFile) {
      const path = `${workspaceId}/external/${Date.now()}_${extFile.name}`
      const { error } = await supabase.storage.from('assets').upload(path, extFile, { upsert: true })
      if (!error) {
        const { data: u } = supabase.storage.from('assets').getPublicUrl(path)
        imageUrl = u.publicUrl
      }
    }
    const dt = new Date(`${extDate}T${extTime}:00`)
    await supabase.from('scheduled_posts').insert({
      workspace_id: workspaceId,
      scheduled_at: dt.toISOString(),
      status: 'external',
      external: true,
      external_caption: extCaption || null,
      external_url: imageUrl,
    })
    setShowExtModal(false)
    setExtDate(''); setExtTime('18:00'); setExtCaption(''); setExtFile(null); setExtPreview(null)
    setSavingExt(false)
    fetchPosts()
  }

  // Calendário
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const postsByDay: Record<number, ScheduledPost[]> = {}
  posts.forEach(p => {
    const d = new Date(p.scheduled_at)
    if (d.getMonth() === viewMonth && d.getFullYear() === viewYear) {
      const day = d.getDate()
      postsByDay[day] = [...(postsByDay[day] ?? []), p]
    }
  })

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1) }

  const nScheduled = posts.filter(p => p.status === 'scheduled' || p.status === 'external').length
  const nPublished = posts.filter(p => p.status === 'published').length

  const selectedImg = selectedPost?.external ? selectedPost.external_url : selectedPost?.output?.public_url
  const selectedTxt = selectedPost?.external ? selectedPost.external_caption : selectedPost?.output?.caption
  const selectedSt  = selectedPost ? STATUS[selectedPost.status] ?? STATUS.scheduled : null
  const selectedDt  = selectedPost ? new Date(selectedPost.scheduled_at) : null

  return (
    <div className="page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Modal post externo */}
      {showExtModal && (
        <div className="modal-overlay" onClick={() => setShowExtModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, border: '1px solid rgba(7,13,31,.08)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#070D1F', marginBottom: 18 }}>+ Novo agendamento externo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Data e hora *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input type="date" value={extDate} onChange={e => setExtDate(e.target.value)} className="input" />
                  <input type="time" value={extTime} onChange={e => setExtTime(e.target.value)} className="input" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Legenda</label>
                <textarea value={extCaption} onChange={e => setExtCaption(e.target.value)} className="input" rows={3} style={{ resize: 'none' }} placeholder="Escreva a legenda do post..." />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Imagem</label>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setExtFile(f); setExtPreview(URL.createObjectURL(f)) } }} />
                {extPreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={extPreview} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(7,13,31,.08)' }} />
                    <button onClick={() => { setExtFile(null); setExtPreview(null) }} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#E24B4A', border: 'none', color: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} style={{ height: 40, padding: '0 16px', border: '1.5px dashed rgba(247,37,133,.3)', borderRadius: 10, background: 'rgba(247,37,133,.03)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#F72585' }}>+ Adicionar imagem</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowExtModal(false)} className="btn btn-ghost btn-md" style={{ flex: 1 }}>Cancelar</button>
                <button onClick={saveExternal} disabled={!extDate || savingExt} className="btn btn-primary btn-md" style={{ flex: 2 }}>
                  {savingExt ? 'Salvando...' : '📅 Agendar post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-sub">{nScheduled} agendado{nScheduled !== 1 ? 's' : ''} · {nPublished} publicado{nPublished !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setShowExtModal(true); const t = new Date(); t.setDate(t.getDate()+1); setExtDate(t.toISOString().split('T')[0]) }} style={{ height: 44, padding: '0 20px', background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 12, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(247,37,133,.25)' }}>
          + Novo agendamento
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>Carregando agenda...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, flex: 1, minHeight: 0 }}>

          {/* Calendário */}
          <div style={{ background: '#fff', border: '1px solid rgba(7,13,31,.08)', borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>

            {/* Nav do mês */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <button onClick={prevMonth} style={{ width: 36, height: 36, border: '1px solid rgba(7,13,31,.12)', borderRadius: 10, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#374151' }}>←</button>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#070D1F', letterSpacing: '-.2px' }}>{MONTHS[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} style={{ width: 36, height: 36, border: '1px solid rgba(7,13,31,.12)', borderRadius: 10, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#374151' }}>→</button>
            </div>

            {/* Cabeçalho dias */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6 }}>
              {DAYS.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', fontWeight: 600, padding: '4px 0', textTransform: 'uppercase', letterSpacing: '.04em' }}>{d}</div>
              ))}
            </div>

            {/* Grid de dias */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', flex: 1, gap: 3 }}>
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />
                const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear()
                const evts = postsByDay[day] ?? []
                const isSel = evts.some(e => e.id === selectedPost?.id)

                return (
                  <div key={idx}
                    onClick={() => evts.length > 0 && setSelectedPost(evts[0])}
                    style={{
                      minHeight: 72, borderRadius: 10, padding: '6px 8px', cursor: evts.length > 0 ? 'pointer' : 'default', transition: 'all .12s',
                      border: `1.5px solid ${isSel ? '#F72585' : isToday ? '#7B2CFF' : 'rgba(7,13,31,.07)'}`,
                      background: isSel ? 'rgba(247,37,133,.04)' : isToday ? 'rgba(123,44,255,.03)' : 'transparent',
                    }}
                  >
                    <div style={{ fontSize: 13, color: isToday ? '#7B2CFF' : '#374151', fontWeight: isToday ? 700 : 400, marginBottom: 4 }}>{day}</div>
                    {evts.slice(0, 2).map((ev, ei) => {
                      const st = STATUS[ev.status] ?? STATUS.scheduled
                      return (
                        <div key={ei} onClick={e => { e.stopPropagation(); setSelectedPost(ev) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, cursor: 'pointer' }}>
                          <div style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>{new Date(ev.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                          <div style={{ fontSize: 10, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{ev.output?.format ?? 'post'}</div>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                        </div>
                      )
                    })}
                    {evts.length > 2 && <div style={{ fontSize: 10, color: '#9CA3AF' }}>+{evts.length - 2}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Painel direito */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {selectedPost && selectedSt && selectedDt ? (
              <div style={{ background: '#fff', border: '1px solid rgba(7,13,31,.08)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Imagem */}
                <div style={{ borderRadius: 12, overflow: 'hidden', background: '#F7F8FA', aspectRatio: '16/9' }}>
                  {selectedImg
                    ? <img src={selectedImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, opacity: .2 }}>🖼</div>
                  }
                </div>

                {/* Legenda */}
                {selectedTxt && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Legenda</div>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{selectedTxt}</div>
                  </div>
                )}

                {/* Status */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Status</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 99, background: selectedSt.bg, color: selectedSt.color, fontSize: 12, fontWeight: 600 }}>
                    {selectedPost.status === 'failed' && <span>⚠</span>}
                    {selectedPost.status === 'published' && <span>✓</span>}
                    {selectedSt.label}
                  </div>
                </div>

                {/* Data/hora agendada */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Agendado para</div>
                  {editingTime ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} className="input" />
                        <input type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)} className="input" />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditingTime(false)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Cancelar</button>
                        <button onClick={doReschedule} disabled={saving || !reschedDate} className="btn btn-primary btn-sm" style={{ flex: 2 }}>{saving ? 'Salvando...' : 'Confirmar'}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#F7F8FA', borderRadius: 8, fontSize: 13, color: '#374151' }}>
                        <span>📅</span> {selectedDt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#F7F8FA', borderRadius: 8, fontSize: 13, color: '#374151' }}>
                        <span>🕐</span> {selectedDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Ações */}
                {!editingTime && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Publicado: só Ver post */}
                    {selectedPost.status === 'published' ? (
                      <button onClick={() => navigate('posts')} style={{ height: 44, width: '100%', background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        ↗ Ver post
                      </button>
                    ) : (
                      <>
                        <button onClick={() => { const t = new Date(selectedPost.scheduled_at); setReschedDate(t.toISOString().split('T')[0]); setReschedTime(t.toTimeString().slice(0,5)); setEditingTime(true) }}
                          style={{ height: 44, width: '100%', background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          🔄 Reagendar
                        </button>
                        <button onClick={() => { const t = new Date(selectedPost.scheduled_at); setReschedDate(t.toISOString().split('T')[0]); setReschedTime(t.toTimeString().slice(0,5)); setEditingTime(true) }}
                          style={{ height: 44, width: '100%', background: 'transparent', border: '1px solid rgba(7,13,31,.12)', borderRadius: 10, color: '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          ✏️ Editar horário
                        </button>
                        {selectedPost.output?.id && (
                          <button onClick={() => navigate('posts')} style={{ height: 44, width: '100%', background: 'transparent', border: '1px solid rgba(7,13,31,.12)', borderRadius: 10, color: '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            ↗ Ver post
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid rgba(7,13,31,.08)', borderRadius: 16, padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 36, opacity: .2 }}>📅</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Selecione um post</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6 }}>Clique em qualquer dia com posts agendados para ver detalhes</div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Mobile CSS — desktop e mobile separados */}
      <style>{`
        @media (max-width: 768px) {
          .schedule-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
