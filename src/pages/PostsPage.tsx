import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { approveOutput, rejectOutput, scheduleOutput } from '../lib/api'
import type { CreativeOutput, OutputStatus } from '../types/database'
import { useAuth } from '../hooks/useAuth'

interface Props { workspaceId: string; userId: string }

const STATUS_LABEL: Record<string, string> = {
  pending:'Pendente', approved:'Aprovado', rejected:'Recusado', scheduled:'Agendado', published:'Publicado',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:   { bg:'#FAEEDA', color:'#633806' },
  approved:  { bg:'#EAF3DE', color:'#27500A' },
  rejected:  { bg:'#FCEBEB', color:'#791F1F' },
  scheduled: { bg:'#EEEDFE', color:'#3C3489' },
  published: { bg:'#EAF3DE', color:'#27500A' },
}

export function PostsPage({ workspaceId, userId }: Props) {
  const { user } = useAuth()
  const [outputs, setOutputs]   = useState<CreativeOutput[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<OutputStatus | 'all'>('all')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('18:00')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [modalImg, setModalImg] = useState<string | null>(null)

  const fetchOutputs = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('creative_outputs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setOutputs(data ?? [])
    setLoading(false)
  }, [workspaceId, filter])

  useEffect(() => { fetchOutputs() }, [fetchOutputs])

  useEffect(() => {
    const ch = supabase.channel(`outputs:${workspaceId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'creative_outputs', filter:`workspace_id=eq.${workspaceId}` }, fetchOutputs)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspaceId, fetchOutputs])

  const filtered = filter === 'all' ? outputs : outputs.filter(o => o.status === filter)
  const pendingCount = outputs.filter(o => o.status === 'pending').length

  const handleApprove = async (id: string) => {
    await approveOutput(id, userId)
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: 'approved' } : o))
  }

  const handleReject = async (id: string) => {
    await rejectOutput(id, userId)
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: 'rejected' } : o))
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
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: 'scheduled', scheduled_at: dt.toISOString() } : o))
    setSchedulingId(null)
  }

  const deleteOutput = async (id: string) => {
    await supabase.from('creative_outputs').delete().eq('id', id)
    setOutputs(prev => prev.filter(o => o.id !== id))
    setConfirmDeleteId(null)
  }

  return (
    <div style={{ padding:'28px 32px' }}>

      {/* Modal imagem */}
      {modalImg && (
        <div onClick={() => setModalImg(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, cursor:'zoom-out' }}>
          <img src={modalImg} alt="preview" style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:12, objectFit:'contain' }} />
          <button onClick={() => setModalImg(null)} style={{ position:'absolute', top:20, right:24, background:'rgba(255,255,255,.15)', border:'none', color:'white', fontSize:24, cursor:'pointer', borderRadius:'50%', width:40, height:40 }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Aprovar conteúdo</h1>
          <p style={{ fontSize:14, color:'var(--text-2)' }}>
            {pendingCount > 0 ? `${pendingCount} post${pendingCount > 1 ? 's' : ''} aguardando aprovação.` : 'Todos os posts foram revisados.'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={fetchOutputs} style={btnS}>↺ Atualizar</button>
          {pendingCount > 0 && <button onClick={handleApproveAll} style={btnP}>✓ Aprovar todos</button>}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {([
          ['all',       'Todos',      outputs.length],
          ['pending',   'Pendentes',  pendingCount],
          ['approved',  'Aprovados',  outputs.filter(o => o.status==='approved').length],
          ['scheduled', 'Agendados',  outputs.filter(o => o.status==='scheduled').length],
          ['published', 'Publicados', outputs.filter(o => o.status==='published').length],
          ['rejected',  'Recusados',  outputs.filter(o => o.status==='rejected').length],
        ] as [OutputStatus | 'all', string, number][]).map(([val, label, count]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:99,
            border:`1px solid ${filter === val ? 'var(--brand)' : 'var(--border-md)'}`,
            background: filter === val ? 'var(--brand-light)' : 'transparent',
            color: filter === val ? 'var(--brand-dark)' : 'var(--text-2)',
            fontSize:13, fontFamily:'var(--font-sans)', cursor:'pointer', fontWeight: filter === val ? 500 : 400,
          }}>
            {label}
            {count > 0 && <span style={{ background: filter === val ? 'var(--brand)' : 'var(--surface-2)', color: filter === val ? 'white' : 'var(--text-3)', fontSize:10, padding:'1px 6px', borderRadius:99 }}>{count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--text-3)', fontSize:14 }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'64px 0', color:'var(--text-3)' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>◻</div>
          <div style={{ fontSize:14, marginBottom:6 }}>Nenhum post aqui.</div>
          <div style={{ fontSize:13 }}>Faça um pedido para gerar conteúdo com a IA.</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(290px, 1fr))', gap:14 }}>
          {filtered.map(output => {
            const st = STATUS_STYLE[output.status] ?? STATUS_STYLE.pending
            const isEditing    = editingId    === output.id
            const isScheduling = schedulingId === output.id
            const isDeleting   = confirmDeleteId === output.id

            return (
              <div key={output.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)', opacity: output.status === 'rejected' ? .55 : 1 }}>

                {/* Imagem */}
                <div style={{ height:190, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', cursor: output.public_url ? 'zoom-in' : 'default' }}
                  onClick={() => output.public_url && setModalImg(output.public_url)}>
                  {output.public_url
                    ? <img src={output.public_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <div style={{ textAlign:'center', color:'var(--text-3)' }}><div style={{ fontSize:28, marginBottom:4 }}>🖼</div><div style={{ fontSize:11 }}>Gerando imagem...</div></div>
                  }
                  <span style={{ position:'absolute', top:8, right:8, padding:'3px 9px', borderRadius:99, fontSize:10, fontWeight:500, background:st.bg, color:st.color }}>{STATUS_LABEL[output.status]}</span>
                  {output.ai_score && <span style={{ position:'absolute', top:8, left:8, padding:'3px 9px', borderRadius:99, fontSize:10, fontWeight:500, background:'rgba(0,0,0,.55)', color:'white' }}>✦ {Number(output.ai_score).toFixed(1)}</span>}
                  {output.format && <span style={{ position:'absolute', bottom:8, left:8, padding:'2px 8px', borderRadius:99, fontSize:9, background:'rgba(0,0,0,.45)', color:'white' }}>{output.format}</span>}
                  {output.public_url && <span style={{ position:'absolute', bottom:8, right:8, padding:'2px 8px', borderRadius:99, fontSize:9, background:'rgba(0,0,0,.45)', color:'white' }}>🔍 ampliar</span>}
                </div>

                {/* Body */}
                <div style={{ padding:'12px 14px' }}>
                  {isEditing ? (
                    <div style={{ marginBottom:10 }}>
                      <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} autoFocus
                        style={{ width:'100%', border:'1px solid var(--brand)', borderRadius:'var(--radius-md)', padding:'7px 10px', fontSize:12, fontFamily:'var(--font-sans)', resize:'vertical', minHeight:80, outline:'none', color:'var(--text-1)', background:'var(--surface)' }} />
                      <div style={{ display:'flex', gap:6, marginTop:6 }}>
                        <button onClick={() => saveEdit(output.id)} style={{ ...btnSm, background:'var(--brand)', color:'white', border:'none' }}>Salvar</button>
                        <button onClick={() => setEditingId(null)} style={btnSm}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.55, marginBottom:10, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {output.caption || 'Sem legenda'}
                    </p>
                  )}

                  {isScheduling ? (
                    <div style={{ marginBottom:10, padding:'10px', background:'var(--surface-2)', borderRadius:'var(--radius-md)', display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>Agendar publicação</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                        <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                          style={{ padding:'6px 8px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', fontSize:12, fontFamily:'var(--font-sans)', outline:'none', color:'var(--text-1)', background:'var(--surface)' }} />
                        <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                          style={{ padding:'6px 8px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', fontSize:12, fontFamily:'var(--font-sans)', outline:'none', color:'var(--text-1)', background:'var(--surface)' }} />
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => saveSchedule(output.id)} style={{ ...btnSm, background:'var(--brand)', color:'white', border:'none' }}>Agendar</button>
                        <button onClick={() => setSchedulingId(null)} style={btnSm}>Cancelar</button>
                      </div>
                    </div>
                  ) : output.scheduled_at ? (
                    <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8 }}>📅 {new Date(output.scheduled_at).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' })}</div>
                  ) : null}

                  {isDeleting && (
                    <div style={{ marginBottom:10, padding:'10px', background:'var(--red-light)', border:'1px solid rgba(192,57,43,.2)', borderRadius:'var(--radius-md)' }}>
                      <div style={{ fontSize:12, color:'var(--red)', marginBottom:8 }}>Deletar permanentemente?</div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => deleteOutput(output.id)} style={{ ...btnSm, background:'var(--red)', color:'white', border:'none' }}>Deletar</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={btnSm}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  {!isEditing && !isScheduling && !isDeleting && (
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {output.status === 'pending' && (
                        <button onClick={() => handleApprove(output.id)} style={{ ...btnSm, borderColor:'var(--brand)', color:'var(--brand-dark)' }}>✓ Aprovar</button>
                      )}
                      {output.status === 'approved' && (
                        <button onClick={() => { const t = new Date(); t.setDate(t.getDate()+1); setScheduleDate(t.toISOString().split('T')[0]); setScheduleTime('18:00'); setSchedulingId(output.id) }}
                          style={{ ...btnSm, borderColor:'var(--brand)', color:'var(--brand-dark)' }}>📅 Agendar</button>
                      )}
                      {output.status !== 'published' && (
                        <button onClick={() => { setEditingId(output.id); setEditCaption(output.caption ?? '') }} style={btnSm}>✎ Editar</button>
                      )}
                      {output.status !== 'rejected' && output.status !== 'published' && (
                        <button onClick={() => handleReject(output.id)} style={{ ...btnSm, borderColor:'rgba(192,57,43,.3)', color:'var(--red)' }}>✕ Recusar</button>
                      )}
                      <button onClick={() => setConfirmDeleteId(output.id)} style={{ ...btnSm, borderColor:'rgba(192,57,43,.2)', color:'var(--red)', marginLeft:'auto' }}>🗑</button>
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

const btnP: React.CSSProperties = { background:'var(--brand)', color:'white', border:'none', borderRadius:'var(--radius-md)', padding:'9px 18px', fontSize:13, fontWeight:500, fontFamily:'var(--font-sans)', cursor:'pointer' }
const btnS: React.CSSProperties = { background:'transparent', color:'var(--text-2)', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', padding:'9px 16px', fontSize:13, fontFamily:'var(--font-sans)', cursor:'pointer' }
const btnSm: React.CSSProperties = { padding:'5px 11px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', background:'transparent', color:'var(--text-2)', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }
