import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Status = 'all' | 'pending_approval' | 'approved' | 'scheduled' | 'published' | 'rejected'

interface Post {
  id: string; caption: string; image_url?: string; status: string
  format: string; scheduled_at?: string; ai_score?: number
}

const MOCK_POSTS: Post[] = [
  { id:'1', caption:'Chegou a nova coleção de verão! Peças incríveis para você arrasar nas férias. Qualidade e estilo que você merece. ✨ #moda #verão', format:'Feed 1080×1350', status:'pending_approval', ai_score:8.7 },
  { id:'2', caption:'Você sabia que nossa coleção é feita com tecido sustentável? Moda que faz bem pra você e pro planeta 🌿 #modaconsciente', format:'Carrossel 6 slides', status:'pending_approval', ai_score:9.1 },
  { id:'3', caption:'Promoção relâmpago! Até 40% off na coleção selecionada. Só hoje e amanhã. Corre pro link na bio! 🔥 #promoção', format:'Stories', status:'pending_approval', ai_score:7.4 },
  { id:'4', caption:'Looks para o final de semana! Combine peças e crie um visual único. Qual é o seu estilo favorito? 💬', format:'Feed 1080×1350', status:'approved', scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(), ai_score:9.3 },
  { id:'5', caption:'Bastidores da nossa coleção — é aqui que a magia acontece 🧵', format:'Reels', status:'published', ai_score:8.5 },
]

const STATUS_LABEL: Record<string, string> = {
  pending_approval:'Pendente', approved:'Aprovado', rejected:'Recusado',
  scheduled:'Agendado', published:'Publicado',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending_approval: { bg:'#FAEEDA', color:'#633806' },
  approved:         { bg:'#EAF3DE', color:'#27500A' },
  rejected:         { bg:'#FCEBEB', color:'#791F1F' },
  scheduled:        { bg:'#EEEDFE', color:'#3C3489' },
  published:        { bg:'#EAF3DE', color:'#27500A' },
}

export function PostsPage() {
  const { user } = useAuth()
  const [posts, setPosts]         = useState<Post[]>(MOCK_POSTS)
  const [filter, setFilter]       = useState<Status>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('18:00')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter)
  const pendingCount = posts.filter(p => p.status === 'pending_approval').length

  const updateStatus = (id: string, status: string, extra?: Partial<Post>) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status, ...extra } : p))
  }

  const approvePost  = (id: string) => updateStatus(id, 'approved')
  const rejectPost   = (id: string) => updateStatus(id, 'rejected')
  const approveAll   = () => setPosts(prev => prev.map(p => p.status === 'pending_approval' ? { ...p, status:'approved' } : p))

  const startEdit = (post: Post) => { setEditingId(post.id); setEditCaption(post.caption) }
  const saveEdit  = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, caption: editCaption } : p))
    setEditingId(null)
  }

  const startSchedule = (id: string) => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    setScheduleDate(tomorrow.toISOString().split('T')[0])
    setScheduleTime('18:00')
    setSchedulingId(id)
  }
  const saveSchedule = (id: string) => {
    const dt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
    updateStatus(id, 'scheduled', { scheduled_at: dt })
    setSchedulingId(null)
  }

  const deletePost = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  return (
    <div style={{ padding:'28px 32px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Aprovar posts</h1>
          <p style={{ fontSize:14, color:'var(--text-2)' }}>
            {pendingCount > 0 ? `${pendingCount} post${pendingCount > 1 ? 's' : ''} aguardando aprovação.` : 'Todos revisados.'}
          </p>
        </div>
        {pendingCount > 0 && (
          <button onClick={approveAll} style={btnPrimary}>✓ Aprovar todos</button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        {([
          ['all',              'Todos',     posts.length],
          ['pending_approval', 'Pendentes', pendingCount],
          ['approved',         'Aprovados', posts.filter(p => p.status==='approved').length],
          ['scheduled',        'Agendados', posts.filter(p => p.status==='scheduled').length],
          ['published',        'Publicados',posts.filter(p => p.status==='published').length],
          ['rejected',         'Recusados', posts.filter(p => p.status==='rejected').length],
        ] as [Status, string, number][]).map(([val, label, count]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:99,
            border:`1px solid ${filter === val ? 'var(--brand)' : 'var(--border-md)'}`,
            background: filter === val ? 'var(--brand-light)' : 'transparent',
            color: filter === val ? 'var(--brand-dark)' : 'var(--text-2)',
            fontSize:13, fontFamily:'var(--font-sans)', cursor:'pointer', fontWeight: filter === val ? 500 : 400,
          }}>
            {label}
            {count > 0 && (
              <span style={{ background: filter === val ? 'var(--brand)' : 'var(--surface-2)',
                color: filter === val ? 'white' : 'var(--text-3)', fontSize:10, padding:'1px 6px', borderRadius:99 }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'64px 0', color:'var(--text-3)' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>◻</div>
          <div style={{ fontSize:14 }}>Nenhum post aqui.</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(290px, 1fr))', gap:14 }}>
          {filtered.map(post => {
            const st = STATUS_STYLE[post.status] ?? STATUS_STYLE.pending_approval
            const isEditing    = editingId    === post.id
            const isScheduling = schedulingId === post.id
            const isDeleting   = confirmDeleteId === post.id

            return (
              <div key={post.id} style={{ background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)',
                opacity: post.status === 'rejected' ? 0.55 : 1 }}>

                {/* Imagem */}
                <div style={{ height:160, background:'var(--surface-2)', display:'flex',
                  alignItems:'center', justifyContent:'center', position:'relative' }}>
                  {post.image_url
                    ? <img src={post.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <div style={{ textAlign:'center', color:'var(--text-3)' }}>
                        <div style={{ fontSize:28, marginBottom:4 }}>🖼</div>
                        <div style={{ fontSize:11 }}>Imagem gerada pela IA</div>
                      </div>
                  }
                  <span style={{ position:'absolute', top:8, right:8, padding:'3px 9px', borderRadius:99,
                    fontSize:10, fontWeight:500, background:st.bg, color:st.color }}>
                    {STATUS_LABEL[post.status]}
                  </span>
                  {post.ai_score && (
                    <span style={{ position:'absolute', top:8, left:8, padding:'3px 9px', borderRadius:99,
                      fontSize:10, fontWeight:500, background:'rgba(0,0,0,.55)', color:'white' }}>
                      ✦ {post.ai_score.toFixed(1)}
                    </span>
                  )}
                  <span style={{ position:'absolute', bottom:8, left:8, padding:'2px 8px', borderRadius:99,
                    fontSize:9, background:'rgba(0,0,0,.45)', color:'white' }}>{post.format}</span>
                </div>

                {/* Body */}
                <div style={{ padding:'12px 14px' }}>

                  {/* Caption / Edição */}
                  {isEditing ? (
                    <div style={{ marginBottom:10 }}>
                      <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)}
                        style={{ width:'100%', border:'1px solid var(--brand)', borderRadius:'var(--radius-md)',
                          padding:'7px 10px', fontSize:12, fontFamily:'var(--font-sans)', resize:'vertical',
                          minHeight:80, outline:'none', color:'var(--text-1)', background:'var(--surface)' }}
                        autoFocus />
                      <div style={{ display:'flex', gap:6, marginTop:6 }}>
                        <button onClick={() => saveEdit(post.id)} style={{ ...btnSm, background:'var(--brand)', color:'white', border:'none' }}>Salvar</button>
                        <button onClick={() => setEditingId(null)} style={btnSm}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.55, marginBottom:10,
                      display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {post.caption}
                    </p>
                  )}

                  {/* Agendamento */}
                  {isScheduling ? (
                    <div style={{ marginBottom:10, padding:'10px', background:'var(--surface-2)',
                      borderRadius:'var(--radius-md)', display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>Agendar publicação</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                        <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                          style={{ padding:'6px 8px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)',
                            fontSize:12, fontFamily:'var(--font-sans)', outline:'none', color:'var(--text-1)',
                            background:'var(--surface)' }} />
                        <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                          style={{ padding:'6px 8px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)',
                            fontSize:12, fontFamily:'var(--font-sans)', outline:'none', color:'var(--text-1)',
                            background:'var(--surface)' }} />
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => saveSchedule(post.id)} style={{ ...btnSm, background:'var(--brand)', color:'white', border:'none' }}>Agendar</button>
                        <button onClick={() => setSchedulingId(null)} style={btnSm}>Cancelar</button>
                      </div>
                    </div>
                  ) : post.scheduled_at ? (
                    <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8 }}>
                      📅 {new Date(post.scheduled_at).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' })}
                    </div>
                  ) : null}

                  {/* Confirmação de delete */}
                  {isDeleting && (
                    <div style={{ marginBottom:10, padding:'10px', background:'var(--red-light)',
                      border:'1px solid rgba(192,57,43,.2)', borderRadius:'var(--radius-md)' }}>
                      <div style={{ fontSize:12, color:'var(--red)', marginBottom:8 }}>Deletar este post permanentemente?</div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => deletePost(post.id)} style={{ ...btnSm, background:'var(--red)', color:'white', border:'none' }}>Deletar</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={btnSm}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  {/* Ações */}
                  {!isEditing && !isScheduling && !isDeleting && (
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {post.status === 'pending_approval' && (
                        <button onClick={() => approvePost(post.id)}
                          style={{ ...btnSm, borderColor:'var(--brand)', color:'var(--brand-dark)' }}>✓ Aprovar</button>
                      )}
                      {(post.status === 'approved') && (
                        <button onClick={() => startSchedule(post.id)}
                          style={{ ...btnSm, borderColor:'var(--brand)', color:'var(--brand-dark)' }}>📅 Agendar</button>
                      )}
                      {post.status !== 'published' && (
                        <button onClick={() => startEdit(post)} style={btnSm}>✎ Editar</button>
                      )}
                      {post.status !== 'rejected' && post.status !== 'published' && (
                        <button onClick={() => rejectPost(post.id)}
                          style={{ ...btnSm, borderColor:'rgba(192,57,43,.3)', color:'var(--red)' }}>✕ Recusar</button>
                      )}
                      <button onClick={() => setConfirmDeleteId(post.id)}
                        style={{ ...btnSm, borderColor:'rgba(192,57,43,.2)', color:'var(--red)', marginLeft:'auto' }}>🗑</button>
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

const btnPrimary: React.CSSProperties = { background:'var(--brand)', color:'white', border:'none',
  borderRadius:'var(--radius-md)', padding:'9px 18px', fontSize:13, fontWeight:500,
  fontFamily:'var(--font-sans)', cursor:'pointer' }
const btnSm: React.CSSProperties = { padding:'5px 11px', border:'1px solid var(--border-md)',
  borderRadius:'var(--radius-md)', background:'transparent', color:'var(--text-2)',
  fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }
