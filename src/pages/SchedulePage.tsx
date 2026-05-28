// aiin · SchedulePage v2
// • Reagendar posts com falha
// • Adicionar posts externos (não gerados pela plataforma)
// • Mobile first
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Props { workspaceId: string }

interface ScheduledPost {
  id: string
  scheduled_at: string
  status: string
  external: boolean
  external_caption?: string
  external_url?: string
  output: { id: string; caption: string; public_url: string | null; format: string } | null
}

const DAYS   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  scheduled:  { bg: 'rgba(123,44,255,.1)',  color: '#7B2CFF', label: 'Agendado'   },
  publishing: { bg: '#FAEEDA',              color: '#633806', label: 'Publicando' },
  published:  { bg: '#E1F5EE',              color: '#085041', label: 'Publicado'  },
  failed:     { bg: '#FCEBEB',              color: '#791F1F', label: 'Falhou'     },
  external:   { bg: 'rgba(24,95,165,.1)',   color: '#185FA5', label: 'Externo'    },
}

export function SchedulePage({ workspaceId }: Props) {
  const [posts, setPosts]         = useState<ScheduledPost[]>([])
  const [loading, setLoading]     = useState(true)
  const [now]                     = useState(new Date())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Modal reagendar
  const [reschedulingId, setReschedulingId] = useState<string | null>(null)
  const [reschedDate, setReschedDate]       = useState('')
  const [reschedTime, setReschedTime]       = useState('18:00')

  // Modal post externo
  const [showExternal, setShowExternal] = useState(false)
  const [extDate, setExtDate]           = useState('')
  const [extTime, setExtTime]           = useState('18:00')
  const [extCaption, setExtCaption]     = useState('')
  const [extUrl, setExtUrl]             = useState('')
  const [extFile, setExtFile]           = useState<File | null>(null)
  const [extPreview, setExtPreview]     = useState<string | null>(null)
  const [savingExt, setSavingExt]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('scheduled_posts')
      .select('id, scheduled_at, status, external, external_caption, external_url, output:creative_outputs(id, caption, public_url, format)')
      .eq('workspace_id', workspaceId)
      .order('scheduled_at', { ascending: true })
    setPosts((data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetch()
    const ch = supabase.channel(`scheduled:${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_posts', filter: `workspace_id=eq.${workspaceId}` }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspaceId])

  const cancelPost = async (id: string) => {
    await supabase.from('scheduled_posts').delete().eq('id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  const reschedule = async (id: string) => {
    if (!reschedDate) return
    const dt = new Date(`${reschedDate}T${reschedTime}:00`)
    await supabase.from('scheduled_posts').update({ scheduled_at: dt.toISOString(), status: 'scheduled' }).eq('id', id)
    setPosts(prev => prev.map(p => p.id === id ? { ...p, scheduled_at: dt.toISOString(), status: 'scheduled' } : p))
    setReschedulingId(null)
  }

  const saveExternal = async () => {
    if (!extDate) return
    setSavingExt(true)
    let imageUrl = extUrl || null
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
      external_caption: extCaption,
      external_url: imageUrl,
    })
    setShowExternal(false)
    setExtDate(''); setExtTime('18:00'); setExtCaption(''); setExtUrl(''); setExtFile(null); setExtPreview(null)
    setSavingExt(false)
    fetch()
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

  const selectedPosts = selectedDay ? (postsByDay[selectedDay] ?? []) : []
  const upcoming = posts.filter(p => new Date(p.scheduled_at) >= now && (p.status === 'scheduled' || p.status === 'external')).slice(0, 8)
  const failed   = posts.filter(p => p.status === 'failed')

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1); setSelectedDay(null) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1); setSelectedDay(null) }

  const PostRow = ({ p, showReschedule = false }: { p: ScheduledPost; showReschedule?: boolean }) => {
    const st  = STATUS[p.status] ?? STATUS.scheduled
    const dt  = new Date(p.scheduled_at)
    const img = p.external ? p.external_url : p.output?.public_url
    const txt = p.external ? p.external_caption : p.output?.caption

    return (
      <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{p.external ? '📎' : '🖼'}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
            {p.external && <span style={{ fontSize: 10, color: 'var(--text-4)' }}>externo</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txt || 'Sem legenda'}</div>

          {/* Reagendar — para falhas ou qualquer post agendado */}
          {reschedulingId === p.id ? (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} style={{ height: 32, padding: '0 8px', border: '1px solid var(--border-md)', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
              <input type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)} style={{ height: 32, padding: '0 8px', border: '1px solid var(--border-md)', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none', width: 100 }} />
              <button onClick={() => reschedule(p.id)} style={{ height: 32, padding: '0 12px', background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Confirmar</button>
              <button onClick={() => setReschedulingId(null)} style={{ height: 32, padding: '0 10px', border: '1px solid var(--border-md)', borderRadius: 7, background: 'transparent', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-3)' }}>Cancelar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => { setReschedulingId(p.id); const t = new Date(p.scheduled_at); setReschedDate(t.toISOString().split('T')[0]); setReschedTime(t.toTimeString().slice(0,5)) }} style={{ height: 26, padding: '0 10px', border: '1px solid var(--border-md)', borderRadius: 6, background: 'transparent', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-2)' }}>
                📅 Reagendar
              </button>
              {p.status !== 'published' && (
                <button onClick={() => cancelPost(p.id)} style={{ height: 26, padding: '0 10px', border: '1px solid rgba(226,75,74,.2)', borderRadius: 6, background: 'transparent', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--danger)' }}>
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page">

      {/* Modal post externo */}
      {showExternal && (
        <div className="modal-overlay" onClick={() => setShowExternal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: '24px', width: '100%', maxWidth: 440, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>📎 Agendar post externo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Data e hora *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input type="date" value={extDate} onChange={e => setExtDate(e.target.value)} className="input" />
                  <input type="time" value={extTime} onChange={e => setExtTime(e.target.value)} className="input" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Legenda</label>
                <textarea value={extCaption} onChange={e => setExtCaption(e.target.value)} className="input" rows={3} style={{ resize: 'none' }} placeholder="Legenda do post..." />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Imagem</label>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setExtFile(f); setExtPreview(URL.createObjectURL(f)) } }} />
                {extPreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={extPreview} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                    <button onClick={() => { setExtFile(null); setExtPreview(null) }} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', border: 'none', color: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} style={{ height: 40, padding: '0 16px', border: '1.5px dashed rgba(247,37,133,.3)', borderRadius: 10, background: 'rgba(247,37,133,.03)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--accent-pink)' }}>+ Adicionar imagem</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowExternal(false)} className="btn btn-ghost btn-md" style={{ flex: 1 }}>Cancelar</button>
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
          <p className="page-sub">{posts.filter(p => p.status === 'scheduled' || p.status === 'external').length} agendados · {posts.filter(p => p.status === 'published').length} publicados</p>
        </div>
        <button onClick={() => { setShowExternal(true); const t = new Date(); t.setDate(t.getDate()+1); setExtDate(t.toISOString().split('T')[0]) }} style={{ height: 40, padding: '0 16px', background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
          + Post externo
        </button>
      </div>

      {/* Banner posts com falha */}
      {failed.length > 0 && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>{failed.length} post{failed.length > 1 ? 's' : ''} com falha na publicação</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Clique em Reagendar para tentar novamente</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>

          {/* Calendário */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <button onClick={prevMonth} style={navBtn}>←</button>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{MONTHS[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} style={navBtn}>→</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 6 }}>
              {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-4)', padding: '4px 0', fontWeight: 500 }}>{d}</div>)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />
                const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear()
                const isSel   = day === selectedDay
                const evts    = postsByDay[day] ?? []
                const hasFail = evts.some(e => e.status === 'failed')
                return (
                  <div key={idx} onClick={() => setSelectedDay(day === selectedDay ? null : day)} style={{ minHeight: 52, border: `1.5px solid ${isSel ? 'var(--accent-pink)' : isToday ? 'var(--accent-purple)' : 'var(--border)'}`, borderRadius: 10, padding: '4px 5px', cursor: 'pointer', background: isSel ? 'rgba(247,37,133,.06)' : isToday ? 'rgba(123,44,255,.04)' : 'transparent', position: 'relative' }}>
                    <div style={{ fontSize: 11, color: isToday ? 'var(--accent-purple)' : 'var(--text-2)', fontWeight: isToday ? 700 : 400 }}>{day}</div>
                    {hasFail && <div style={{ position: 'absolute', top: 3, right: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)' }} />}
                    {evts.slice(0, 2).map((ev, ei) => {
                      const st = STATUS[ev.status] ?? STATUS.scheduled
                      return (
                        <div key={ei} style={{ background: st.bg, color: st.color, borderRadius: 4, fontSize: 9, padding: '1px 4px', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                          {new Date(ev.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )
                    })}
                    {evts.length > 2 && <div style={{ fontSize: 9, color: 'var(--text-4)', marginTop: 1 }}>+{evts.length - 2}</div>}
                  </div>
                )
              })}
            </div>

            {/* Detalhe do dia */}
            {selectedDay && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>{selectedDay} de {MONTHS[viewMonth]}</div>
                {selectedPosts.length === 0
                  ? <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Nenhum post neste dia.</div>
                  : selectedPosts.map(p => <PostRow key={p.id} p={p} />)
                }
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Falhas */}
            {failed.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--danger-border)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 10 }}>⚠ Falhas na publicação</div>
                {failed.map(p => <PostRow key={p.id} p={p} />)}
              </div>
            )}

            {/* Próximos */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>Próximas publicações</div>
              {upcoming.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>Nenhum post agendado.<br />Aprove um post e clique em Agendar.</div>
                : upcoming.map(p => <PostRow key={p.id} p={p} />)
              }
            </div>

            {/* Info */}
            <div style={{ background: 'var(--gradient-soft)', border: '1px solid rgba(247,37,133,.15)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>✦ Publicação automática</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>Posts agendados são publicados automaticamente no horário marcado via Instagram Graph API.</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Configure o token em Configurações.</div>
            </div>

          </div>
        </div>
      )}

      {/* Mobile: apenas lista */}
      <style>{`
        @media (max-width: 768px) {
          .agenda-grid { grid-template-columns: 1fr !important; }
          .agenda-sidebar { display: none; }
        }
      `}</style>
    </div>
  )
}

const navBtn: React.CSSProperties = { background: 'transparent', border: '1px solid var(--border-md)', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-sans)', cursor: 'pointer' }
