import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Props { workspaceId: string }

interface ScheduledPost {
  id: string
  scheduled_at: string
  status: string
  output: {
    id: string
    caption: string
    public_url: string | null
    format: string
  } | null
}

const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  scheduled:   { bg:'var(--brand)',  color:'white',          label:'Agendado'   },
  publishing:  { bg:'#FAEEDA',       color:'#633806',        label:'Publicando' },
  published:   { bg:'#EAF3DE',       color:'#27500A',        label:'Publicado'  },
  failed:      { bg:'#FCEBEB',       color:'#791F1F',        label:'Falhou'     },
}

export function SchedulePage({ workspaceId }: Props) {
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [now] = useState(new Date())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear]   = useState(now.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('scheduled_posts')
        .select(`
          id, scheduled_at, status,
          output:creative_outputs(id, caption, public_url, format)
        `)
        .eq('workspace_id', workspaceId)
        .order('scheduled_at', { ascending: true })
      setPosts((data as any) ?? [])
      setLoading(false)
    }
    fetch()

    const ch = supabase.channel(`scheduled:${workspaceId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'scheduled_posts', filter:`workspace_id=eq.${workspaceId}` }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspaceId])

  const cancelSchedule = async (id: string) => {
    await supabase.from('scheduled_posts').delete().eq('id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  // Calendário
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  // Posts por dia do mês atual
  const postsByDay: Record<number, ScheduledPost[]> = {}
  posts.forEach(p => {
    const d = new Date(p.scheduled_at)
    if (d.getMonth() === viewMonth && d.getFullYear() === viewYear) {
      const day = d.getDate()
      if (!postsByDay[day]) postsByDay[day] = []
      postsByDay[day].push(p)
    }
  })

  // Posts do dia selecionado
  const selectedPosts = selectedDay ? (postsByDay[selectedDay] ?? []) : []

  // Próximos agendados
  const upcoming = posts
    .filter(p => new Date(p.scheduled_at) >= now && p.status === 'scheduled')
    .slice(0, 6)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) }
    else setViewMonth(m => m-1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) }
    else setViewMonth(m => m+1)
    setSelectedDay(null)
  }

  const totalScheduled = posts.filter(p => p.status === 'scheduled').length
  const totalPublished  = posts.filter(p => p.status === 'published').length

  return (
    <div style={{ padding:'28px 32px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Agenda</h1>
          <p style={{ fontSize:14, color:'var(--text-2)' }}>
            {totalScheduled} agendado{totalScheduled !== 1 ? 's' : ''} · {totalPublished} publicado{totalPublished !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--text-3)', fontSize:14 }}>Carregando agenda...</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>

          {/* Calendário */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <button onClick={prevMonth} style={navBtn}>←</button>
              <span style={{ fontSize:14, fontWeight:500, color:'var(--text-1)' }}>{MONTHS[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} style={navBtn}>→</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:6 }}>
              {DAYS.map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:11, color:'var(--text-3)', padding:'4px 0', fontWeight:500 }}>{d}</div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />
                const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear()
                const isSel   = day === selectedDay
                const evts    = postsByDay[day] ?? []
                return (
                  <div key={idx} onClick={() => setSelectedDay(day === selectedDay ? null : day)} style={{
                    minHeight:52, border:`1px solid ${isSel ? 'var(--brand)' : isToday ? 'var(--brand)' : 'var(--border)'}`,
                    borderRadius:'var(--radius-md)', padding:'4px 5px', cursor:'pointer',
                    background: isSel ? 'var(--brand-light)' : isToday ? 'rgba(61,90,62,.05)' : 'transparent',
                    transition:'all .1s',
                  }}>
                    <div style={{ fontSize:11, color: isToday ? 'var(--brand-dark)' : 'var(--text-2)', fontWeight: isToday ? 600 : 400 }}>{day}</div>
                    {evts.slice(0,2).map((ev, ei) => {
                      const st = STATUS_STYLE[ev.status] ?? STATUS_STYLE.scheduled
                      return (
                        <div key={ei} style={{ background:st.bg, color:st.color, borderRadius:3, fontSize:9, padding:'1px 4px', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {new Date(ev.scheduled_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })} {ev.output?.format ?? ''}
                        </div>
                      )
                    })}
                    {evts.length > 2 && <div style={{ fontSize:9, color:'var(--text-3)', marginTop:2 }}>+{evts.length - 2}</div>}
                  </div>
                )
              })}
            </div>

            {/* Posts do dia selecionado */}
            {selectedDay && (
              <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:14 }}>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:10 }}>
                  {selectedDay} de {MONTHS[viewMonth]}
                </div>
                {selectedPosts.length === 0 ? (
                  <div style={{ fontSize:13, color:'var(--text-3)' }}>Nenhum post neste dia.</div>
                ) : selectedPosts.map(p => {
                  const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.scheduled
                  return (
                    <div key={p.id} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)', alignItems:'flex-start' }}>
                      {p.output?.public_url && (
                        <img src={p.output.public_url} alt="" style={{ width:48, height:48, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
                      )}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                          <span style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>
                            {new Date(p.scheduled_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                          </span>
                          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:st.bg, color:st.color }}>{st.label}</span>
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {p.output?.caption ?? 'Sem legenda'}
                        </div>
                      </div>
                      {p.status === 'scheduled' && (
                        <button onClick={() => cancelSchedule(p.id)} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:16, flexShrink:0 }}>×</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Próximas publicações */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:10 }}>Próximas publicações</div>
              {upcoming.length === 0 ? (
                <div style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.5 }}>
                  Nenhum post agendado.<br/>
                  <span style={{ fontSize:12 }}>Aprove um post e clique em Agendar.</span>
                </div>
              ) : upcoming.map(p => {
                const dt = new Date(p.scheduled_at)
                const isToday = dt.toDateString() === now.toDateString()
                const isTomorrow = dt.toDateString() === new Date(now.getTime() + 86400000).toDateString()
                const dayLabel = isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : dt.toLocaleDateString('pt-BR', { weekday:'short', day:'numeric', month:'short' })
                return (
                  <div key={p.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
                    {p.output?.public_url && (
                      <img src={p.output.public_url} alt="" style={{ width:36, height:36, borderRadius:6, objectFit:'cover', flexShrink:0 }} />
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:'var(--text-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {p.output?.caption?.slice(0, 40) ?? 'Post'}...
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>
                        {dayLabel} · {dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                    <button onClick={() => cancelSchedule(p.id)} title="Cancelar" style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:16, flexShrink:0 }}>×</button>
                  </div>
                )
              })}
            </div>

            {/* Aviso publicação automática */}
            <div style={{ background:'var(--brand-light)', border:'1px solid rgba(61,90,62,.15)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)', marginBottom:6 }}>✦ Publicação automática</div>
              <div style={{ fontSize:12, color:'var(--brand-dark)', opacity:.8, lineHeight:1.6 }}>
                Posts agendados serão publicados automaticamente no horário marcado via Instagram Graph API.
              </div>
              <div style={{ fontSize:11, color:'var(--brand-dark)', opacity:.6, marginTop:6 }}>
                Configure o token em Configurações.
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = { background:'transparent', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', padding:'4px 12px', fontSize:13, color:'var(--text-2)', fontFamily:'var(--font-sans)', cursor:'pointer' }
