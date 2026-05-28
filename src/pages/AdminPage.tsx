// ============================================================
//  aiin · AdminPage
//  ERP interno — protegido por email hardcoded
//  Acesso via: /#admin
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ⚠️ Adicione aqui os emails com acesso admin
const ADMIN_EMAILS = ['aiin.riopreto@gmail.com']

// ---- Types ----
interface WorkspaceRow {
  id: string
  name: string
  owner_id: string
  created_at: string
  owner_email?: string
  credits?: number
  posts_count?: number
  jobs_count?: number
  subscription?: { monthly_credits_available: number; extra_credits_available: number; status: string } | null
}

interface JobRow {
  id: string
  workspace_id: string
  job_type: string
  status: string
  required_credits: number
  created_at: string
  error_message?: string
  workspace_name?: string
  owner_email?: string
}

interface Metrics {
  total_workspaces: number
  total_jobs: number
  jobs_done: number
  jobs_error: number
  jobs_pending: number
  total_posts: number
  total_credits_used: number
}

type Tab = 'metrics' | 'workspaces' | 'jobs'

// ---- Componentes utilitários ----
const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{
    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
    background: color + '20', color, border: `1px solid ${color}40`,
    whiteSpace: 'nowrap',
  }}>{label}</span>
)

const statusColor: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', waiting_approval: '#8b5cf6',
  done: '#10b981', error: '#ef4444', active: '#10b981', canceled: '#ef4444',
}

// ============================================================
//  AdminPage
// ============================================================
export function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('metrics')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creditModal, setCreditModal] = useState<{ ws: WorkspaceRow; mode: 'add' | 'remove' | 'refund' } | null>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditNote, setCreditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [jobFilter, setJobFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const isAdmin = user && ADMIN_EMAILS.includes(user.email ?? '')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      // Workspaces + subscriptions
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('*, subscriptions(*)')
        .order('created_at', { ascending: false })

      // Jobs
      const { data: jobsData } = await supabase
        .from('content_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      // Creative outputs count
      const { count: postsCount } = await supabase
        .from('creative_outputs')
        .select('*', { count: 'exact', head: true })

      // Credit ledger total usage
      const { data: ledger } = await supabase
        .from('credit_ledger')
        .select('amount')
        .eq('type', 'usage')

      const totalCreditsUsed = ledger?.reduce((sum, r) => sum + Math.abs(r.amount), 0) ?? 0

      // Monta workspaces enriquecidos
      const wsRows: WorkspaceRow[] = (wsData ?? []).map(ws => {
        const sub = Array.isArray(ws.subscriptions) ? ws.subscriptions[0] : ws.subscriptions
        const credits = (sub?.monthly_credits_available ?? 0) + (sub?.extra_credits_available ?? 0)
        const wsJobs = jobsData?.filter(j => j.workspace_id === ws.id) ?? []
        return {
          id: ws.id, name: ws.name, owner_id: ws.owner_id,
          created_at: ws.created_at, credits,
          jobs_count: wsJobs.length,
          subscription: sub ?? null,
        }
      })

      // Monta jobs enriquecidos
      const jobRows: JobRow[] = (jobsData ?? []).map(j => {
        const ws = wsRows.find(w => w.id === j.workspace_id)
        return {
          id: j.id, workspace_id: j.workspace_id,
          job_type: j.job_type, status: j.status,
          required_credits: j.required_credits,
          created_at: j.created_at, error_message: j.error_message,
          workspace_name: ws?.name ?? j.workspace_id.slice(0, 8),
        }
      })

      const done  = jobRows.filter(j => j.status === 'waiting_approval' || j.status === 'done').length
      const error = jobRows.filter(j => j.status === 'error').length
      const pend  = jobRows.filter(j => j.status === 'pending' || j.status === 'processing').length

      setWorkspaces(wsRows)
      setJobs(jobRows)
      setMetrics({
        total_workspaces: wsRows.length,
        total_jobs: jobRows.length,
        jobs_done: done, jobs_error: error, jobs_pending: pend,
        total_posts: postsCount ?? 0,
        total_credits_used: totalCreditsUsed,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (isAdmin) loadAll() }, [isAdmin, loadAll])

  // ---- Gestão de créditos ----
  const applyCredits = async () => {
    if (!creditModal || !creditAmount) return
    const amount = parseInt(creditAmount)
    if (isNaN(amount) || amount <= 0) return
    setSaving(true)

    try {
      const ws = creditModal.ws
      const sub = ws.subscription
      if (!sub) throw new Error('Workspace sem subscription ativa')

      const { error } = await supabase.rpc('debit_credits' as any, {
        p_workspace_id: ws.id,
        p_job_id: null,
        p_amount: creditModal.mode === 'remove' ? amount : -amount,
        p_description: creditNote || `Admin: ${creditModal.mode} ${amount} créditos`,
      })

      // Fallback direto na tabela
      if (creditModal.mode === 'add' || creditModal.mode === 'refund') {
        await supabase.from('subscriptions')
          .update({ monthly_credits_available: (sub.monthly_credits_available ?? 0) + amount })
          .eq('workspace_id', ws.id).eq('status', 'active')
        await supabase.from('credit_ledger').insert({
          workspace_id: ws.id, type: creditModal.mode === 'refund' ? 'refund' : 'adjustment',
          amount, balance_after: (sub.monthly_credits_available ?? 0) + amount,
          description: creditNote || `Admin: ${creditModal.mode} ${amount} créditos`,
        })
      } else {
        await supabase.from('subscriptions')
          .update({ monthly_credits_available: Math.max(0, (sub.monthly_credits_available ?? 0) - amount) })
          .eq('workspace_id', ws.id).eq('status', 'active')
        await supabase.from('credit_ledger').insert({
          workspace_id: ws.id, type: 'adjustment',
          amount: -amount, balance_after: Math.max(0, (sub.monthly_credits_available ?? 0) - amount),
          description: creditNote || `Admin: remover ${amount} créditos`,
        })
      }

      showToast(`✓ ${amount} créditos ${creditModal.mode === 'remove' ? 'removidos' : 'adicionados'} para ${ws.name}`)
      setCreditModal(null); setCreditAmount(''); setCreditNote('')
      loadAll()
    } catch (e: any) {
      showToast('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ---- Guards ----
  if (!user) return <AdminCenter><p style={{ color: 'var(--text-3)' }}>Faça login primeiro.</p></AdminCenter>
  if (!isAdmin) return (
    <AdminCenter>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Acesso restrito. Seu email não tem permissão admin.</p>
      <p style={{ color: 'var(--text-4)', fontSize: 12 }}>{user.email}</p>
    </AdminCenter>
  )

  const filteredJobs = jobs.filter(j => {
    const matchStatus = jobFilter === 'all' || j.status === jobFilter
    const matchSearch = !search || j.workspace_name?.toLowerCase().includes(search.toLowerCase()) || j.job_type.includes(search)
    return matchStatus && matchSearch
  })

  const filteredWs = workspaces.filter(ws =>
    !search || ws.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#10b981', color: 'white', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: '1px solid #1e1e2e', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #f72585, #7209b7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white' }}>✦</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>aiin · Admin</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Painel interno de gestão</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar workspace..."
            style={{ background: '#1e1e2e', border: '1px solid #2d2d3d', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#e2e8f0', outline: 'none', width: 200 }}
          />
          <button onClick={loadAll} style={{ background: '#1e1e2e', border: '1px solid #2d2d3d', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #1e1e2e', padding: '0 32px', display: 'flex', gap: 4 }}>
        {(['metrics', 'workspaces', 'jobs'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', padding: '12px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            color: tab === t ? '#f72585' : '#64748b',
            borderBottom: tab === t ? '2px solid #f72585' : '2px solid transparent',
            fontFamily: 'inherit', transition: 'color .15s',
          }}>
            {t === 'metrics' ? '📊 Métricas' : t === 'workspaces' ? '🏢 Workspaces' : '⚙️ Jobs'}
            {t === 'jobs' && metrics && metrics.jobs_error > 0 && (
              <span style={{ marginLeft: 6, background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99 }}>{metrics.jobs_error}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px' }}>

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height: 90, borderRadius: 12, background: '#1e1e2e', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        )}

        {/* ── MÉTRICAS ── */}
        {!loading && tab === 'metrics' && metrics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              {[
                { label: 'Workspaces', value: metrics.total_workspaces, icon: '🏢', color: '#7209b7' },
                { label: 'Jobs total', value: metrics.total_jobs, icon: '⚙️', color: '#3b82f6' },
                { label: 'Gerados OK', value: metrics.jobs_done, icon: '✓', color: '#10b981' },
                { label: 'Com erro', value: metrics.jobs_error, icon: '✗', color: '#ef4444' },
                { label: 'Em fila', value: metrics.jobs_pending, icon: '⏳', color: '#f59e0b' },
                { label: 'Posts criados', value: metrics.total_posts, icon: '🖼', color: '#f72585' },
                { label: 'Créditos usados', value: metrics.total_credits_used, icon: '💳', color: '#8b5cf6' },
              ].map(card => (
                <div key={card.label} style={{ background: '#1e1e2e', border: '1px solid #2d2d3d', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{card.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Taxa de sucesso */}
            {metrics.total_jobs > 0 && (
              <div style={{ background: '#1e1e2e', border: '1px solid #2d2d3d', borderRadius: 12, padding: '20px 24px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 14 }}>Taxa de sucesso dos jobs</div>
                <div style={{ height: 10, background: '#0a0a0f', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${(metrics.jobs_done / metrics.total_jobs) * 100}%`, background: '#10b981', transition: 'width .5s' }} />
                  <div style={{ width: `${(metrics.jobs_pending / metrics.total_jobs) * 100}%`, background: '#f59e0b' }} />
                  <div style={{ width: `${(metrics.jobs_error / metrics.total_jobs) * 100}%`, background: '#ef4444' }} />
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 12, color: '#64748b' }}>
                  <span style={{ color: '#10b981' }}>✓ {Math.round((metrics.jobs_done / metrics.total_jobs) * 100)}% OK</span>
                  <span style={{ color: '#f59e0b' }}>⏳ {Math.round((metrics.jobs_pending / metrics.total_jobs) * 100)}% pendente</span>
                  <span style={{ color: '#ef4444' }}>✗ {Math.round((metrics.jobs_error / metrics.total_jobs) * 100)}% erro</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WORKSPACES ── */}
        {!loading && tab === 'workspaces' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{filteredWs.length} workspaces</div>
            {filteredWs.map(ws => (
              <div key={ws.id} style={{ background: '#1e1e2e', border: '1px solid #2d2d3d', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>

                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f72585, #7209b7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 700, flexShrink: 0 }}>
                  {ws.name[0]?.toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{ws.name}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    ID: {ws.id.slice(0, 8)}... · Criado {new Date(ws.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f72585' }}>{ws.credits ?? 0}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>créditos</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#94a3b8' }}>{ws.jobs_count ?? 0}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>jobs</div>
                  </div>
                  {ws.subscription && (
                    <Badge label={ws.subscription.status} color={statusColor[ws.subscription.status] ?? '#64748b'} />
                  )}
                </div>

                {/* Ações de crédito */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setCreditModal({ ws, mode: 'add' }); setCreditAmount(''); setCreditNote('') }}
                    style={{ background: '#10b98120', border: '1px solid #10b98140', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: '#10b981', cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Dar
                  </button>
                  <button onClick={() => { setCreditModal({ ws, mode: 'refund' }); setCreditAmount(''); setCreditNote('') }}
                    style={{ background: '#8b5cf620', border: '1px solid #8b5cf640', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: '#8b5cf6', cursor: 'pointer', fontFamily: 'inherit' }}>
                    ↩ Reimb.
                  </button>
                  <button onClick={() => { setCreditModal({ ws, mode: 'remove' }); setCreditAmount(''); setCreditNote('') }}
                    style={{ background: '#ef444420', border: '1px solid #ef444440', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }}>
                    − Tirar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── JOBS ── */}
        {!loading && tab === 'jobs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Filtros de status */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              {['all', 'pending', 'processing', 'waiting_approval', 'error'].map(s => (
                <button key={s} onClick={() => setJobFilter(s)} style={{
                  background: jobFilter === s ? '#f7258520' : '#1e1e2e',
                  border: `1px solid ${jobFilter === s ? '#f72585' : '#2d2d3d'}`,
                  borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 500,
                  color: jobFilter === s ? '#f72585' : '#64748b',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {s === 'all' ? `Todos (${jobs.length})` : s === 'waiting_approval' ? `Aprovação (${jobs.filter(j => j.status === s).length})` : `${s} (${jobs.filter(j => j.status === s).length})`}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{filteredJobs.length} jobs</div>

            {filteredJobs.map(job => (
              <div key={job.id} style={{
                background: job.status === 'error' ? '#ef444408' : '#1e1e2e',
                border: `1px solid ${job.status === 'error' ? '#ef444430' : '#2d2d3d'}`,
                borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>{job.workspace_name}</span>
                    <span style={{ fontSize: 10, color: '#475569', background: '#0f0f1a', padding: '1px 6px', borderRadius: 4 }}>{job.job_type}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#475569' }}>
                    {new Date(job.created_at).toLocaleString('pt-BR')} · {job.required_credits} créditos
                  </div>
                  {job.error_message && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ✗ {job.error_message}
                    </div>
                  )}
                </div>
                <Badge label={job.status} color={statusColor[job.status] ?? '#64748b'} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal de créditos ── */}
      {creditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: '#1e1e2e', border: '1px solid #2d2d3d', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
              {creditModal.mode === 'add' ? '+ Dar créditos' : creditModal.mode === 'refund' ? '↩ Reembolsar créditos' : '− Remover créditos'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
              Workspace: <strong style={{ color: '#94a3b8' }}>{creditModal.ws.name}</strong> · Saldo atual: <strong style={{ color: '#f72585' }}>{creditModal.ws.credits}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>Quantidade de créditos</label>
                <input
                  type="number" min="1" value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                  autoFocus placeholder="ex: 10"
                  style={{ width: '100%', background: '#0a0a0f', border: '1px solid #2d2d3d', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>Motivo (opcional)</label>
                <input
                  value={creditNote} onChange={e => setCreditNote(e.target.value)}
                  placeholder="ex: reembolso por falha técnica"
                  style={{ width: '100%', background: '#0a0a0f', border: '1px solid #2d2d3d', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setCreditModal(null)} style={{ flex: 1, background: '#0a0a0f', border: '1px solid #2d2d3d', borderRadius: 8, padding: '10px', fontSize: 13, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button onClick={applyCredits} disabled={saving || !creditAmount}
                  style={{ flex: 2, background: creditModal.mode === 'remove' ? '#ef4444' : '#f72585', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !creditAmount ? 0.5 : 1 }}>
                  {saving ? 'Salvando...' : `Confirmar ${creditModal.mode === 'add' ? 'adição' : creditModal.mode === 'refund' ? 'reembolso' : 'remoção'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminCenter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
      {children}
    </div>
  )
}
