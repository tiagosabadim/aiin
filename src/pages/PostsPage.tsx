import { useState } from 'react'
import { usePosts } from '../hooks/usePosts'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

// No MVP usamos um brand_id fixo — depois virá do contexto da marca selecionada
const MOCK_BRAND_ID = '00000000-0000-0000-0000-000000000001'

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pendente',
  approved:  'Aprovado',
  rejected:  'Recusado',
  scheduled: 'Agendado',
  published: 'Publicado',
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  pending_approval: { bg: '#FAEEDA', color: '#633806' },
  approved:  { bg: '#EAF3DE', color: '#27500A' },
  rejected:  { bg: '#FCEBEB', color: '#791F1F' },
  scheduled: { bg: '#EEEDFE', color: '#3C3489' },
  published: { bg: '#EAF3DE', color: '#27500A' },
}

export function PostsPage() {
  const { user } = useAuth()
  const brandId = MOCK_BRAND_ID
  const { posts, loading, approvePost, rejectPost, schedulePost, updateCaption } = usePosts(brandId)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [filter, setFilter]           = useState<'all' | 'pending_approval' | 'approved' | 'scheduled'>('all')

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter)
  const pendingCount = posts.filter(p => p.status === 'pending_approval').length

  const startEdit = (id: string, caption: string) => {
    setEditingId(id)
    setEditCaption(caption ?? '')
  }

  const saveEdit = async (id: string) => {
    await updateCaption(id, editCaption)
    setEditingId(null)
  }

  return (
    <div style={{ padding: '28px 32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--text-1)', marginBottom: 4 }}>
            Aprovar posts
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
            {pendingCount > 0
              ? `${pendingCount} post${pendingCount > 1 ? 's' : ''} aguardando sua aprovação.`
              : 'Todos os posts foram revisados.'}
          </p>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={() => posts.filter(p => p.status === 'pending_approval').forEach(p => approvePost(p.id))}
            style={btnPrimary}
          >
            ✓ Aprovar todos
          </button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {([
          ['all',              'Todos',    posts.length],
          ['pending_approval', 'Pendentes', pendingCount],
          ['approved',         'Aprovados', posts.filter(p => p.status === 'approved').length],
          ['scheduled',        'Agendados', posts.filter(p => p.status === 'scheduled').length],
        ] as const).map(([val, label, count]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 99,
            border: `1px solid ${filter === val ? 'var(--brand)' : 'var(--border-md)'}`,
            background: filter === val ? 'var(--brand-light)' : 'transparent',
            color: filter === val ? 'var(--brand-dark)' : 'var(--text-2)',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            fontWeight: filter === val ? 500 : 400,
          }}>
            {label}
            {count > 0 && (
              <span style={{
                background: filter === val ? 'var(--brand)' : 'var(--surface-2)',
                color: filter === val ? 'white' : 'var(--text-3)',
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 99,
              }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid de posts */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)', fontSize: 14 }}>
          Carregando posts...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(post => {
            const st = STATUS_COLOR[post.status] ?? STATUS_COLOR.pending_approval
            const isEditing = editingId === post.id
            return (
              <div key={post.id} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
                opacity: post.status === 'rejected' ? 0.5 : 1,
              }}>
                {/* Imagem */}
                <div style={{
                  height: 160,
                  background: 'var(--surface-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}>
                  {post.image_url
                    ? <img src={post.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Imagem gerada pela IA</span>
                  }
                  <span style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    padding: '3px 9px',
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 500,
                    background: st.bg,
                    color: st.color,
                  }}>
                    {STATUS_LABEL[post.status]}
                  </span>
                  {post.ai_score && (
                    <span style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      padding: '3px 9px',
                      borderRadius: 99,
                      fontSize: 10,
                      fontWeight: 500,
                      background: 'rgba(0,0,0,0.55)',
                      color: 'white',
                    }}>
                      ✦ {post.ai_score.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '12px 14px' }}>
                  {isEditing ? (
                    <textarea
                      value={editCaption}
                      onChange={e => setEditCaption(e.target.value)}
                      style={{
                        width: '100%',
                        border: '1px solid var(--brand)',
                        borderRadius: 'var(--radius-md)',
                        padding: '7px 10px',
                        fontSize: 12,
                        fontFamily: 'var(--font-sans)',
                        resize: 'vertical',
                        minHeight: 80,
                        outline: 'none',
                        color: 'var(--text-1)',
                        background: 'var(--surface)',
                      }}
                      autoFocus
                    />
                  ) : (
                    <p style={{
                      fontSize: 12,
                      color: 'var(--text-2)',
                      lineHeight: 1.55,
                      marginBottom: 10,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }}>
                      {post.caption ?? 'Sem legenda'}
                    </p>
                  )}

                  {post.scheduled_at && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
                      📅 {new Date(post.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(post.id)} style={{ ...btnSm, background: 'var(--brand)', color: 'white', border: 'none' }}>
                          Salvar
                        </button>
                        <button onClick={() => setEditingId(null)} style={btnSm}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        {post.status === 'pending_approval' && (
                          <button onClick={() => approvePost(post.id)} style={{ ...btnSm, borderColor: 'var(--brand)', color: 'var(--brand-dark)' }}>
                            ✓ Aprovar
                          </button>
                        )}
                        {post.status === 'approved' && (
                          <button onClick={() => {
                            const d = new Date(); d.setHours(d.getHours() + 2)
                            schedulePost(post.id, d)
                          }} style={{ ...btnSm, borderColor: 'var(--brand)', color: 'var(--brand-dark)' }}>
                            📅 Agendar
                          </button>
                        )}
                        <button onClick={() => startEdit(post.id, post.caption ?? '')} style={btnSm}>
                          ✎ Editar
                        </button>
                        {post.status !== 'rejected' && (
                          <button onClick={() => rejectPost(post.id)} style={{ ...btnSm, borderColor: 'rgba(192,57,43,0.3)', color: 'var(--red)' }}>
                            ✕
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '64px 48px', color: 'var(--text-3)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>◻</div>
      <div style={{ fontSize: 14, marginBottom: 6 }}>Nenhum post encontrado</div>
      <div style={{ fontSize: 13 }}>Crie um briefing para gerar posts com IA.</div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--brand)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
}

const btnSm: React.CSSProperties = {
  padding: '5px 11px',
  border: '1px solid var(--border-md)',
  borderRadius: 'var(--radius-md)',
  background: 'transparent',
  color: 'var(--text-2)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
}
