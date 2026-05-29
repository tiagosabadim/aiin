// aiin · CampaignsPage v3 — Split: form esquerda + lista direita
// Editar item: mostra prompt, permite editar, anexar foto, aprovar
// Excluir item: opção de gerar nova ideia
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { createContentJob } from '../lib/api'
import type { Workspace, BrandProfile, Subscription, ContentType } from '../types/database'
import { CREDIT_COSTS } from '../types/database'
import { useAuth } from '../hooks/useAuth'

interface Props {
  workspace: Workspace; brand: BrandProfile
  subscription: Subscription | null; credits: number
  navigate: (r: string) => void
}

interface Campaign {
  id: string; title: string; period: string
  start_date: string; end_date: string
  posts_per_week: number; theme: string | null
  status: string; created_at: string; items?: CampaignItem[]
}

interface CampaignItem {
  id: string; campaign_id: string; position: number
  scheduled_date: string; content_type: ContentType
  title: string; objective: string; extra_context: string
  hashtags: string[]; required_credits: number
  status: 'pending' | 'approved' | 'generating' | 'done'
  job_id: string | null
}

const TYPE_LABELS: Record<string, string> = {
  post_simples: 'Post estático', post_premium: 'Post premium',
  carrossel_5: 'Carrossel 5p', carrossel_7: 'Carrossel 7p',
  story: 'Story', capa_reels: 'Capa Reels',
}
const PERIOD_LABELS: Record<string, string> = { semana: '1 semana', quinzena: '2 semanas', mes: '1 mês' }
const MONTHS_SHORT = ['jan.','fev.','mar.','abr.','mai.','jun.','jul.','ago.','set.','out.','nov.','dez.']

export function CampaignsPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const { user } = useAuth()
  const [campaigns, setCampaigns]     = useState<Campaign[]>([])
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [approvingItem, setApprovingItem] = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)

  // Edição de item
  const [editingItem, setEditingItem] = useState<CampaignItem | null>(null)
  const [editTitle, setEditTitle]     = useState('')
  const [editObjective, setEditObjective] = useState('')
  const [editContext, setEditContext] = useState('')
  const [editHashtags, setEditHashtags] = useState('')
  const [editRefs, setEditRefs]       = useState<File[]>([])
  const [savingEdit, setSavingEdit]   = useState(false)
  const editFileRef = useRef<HTMLInputElement>(null)

  // Deletar com opção de regenerar
  const [deletingItem, setDeletingItem] = useState<{item: CampaignItem; campaignId: string} | null>(null)

  useEffect(() => { fetchCampaigns() }, [])

  const fetchCampaigns = async () => {
    setLoading(true)
    const { data } = await supabase.from('content_campaigns').select('*')
      .eq('workspace_id', workspace.id).order('created_at', { ascending: false })
    setCampaigns(data ?? [])
    setLoading(false)
  }

  const loadItems = async (campaignId: string) => {
    const { data } = await supabase.from('campaign_items').select('*')
      .eq('campaign_id', campaignId).order('position', { ascending: true })
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, items: data ?? [] } : c))
  }

  const toggleExpand = async (campaign: Campaign) => {
    if (expanded === campaign.id) { setExpanded(null); return }
    setExpanded(campaign.id)
    if (!campaign.items) await loadItems(campaign.id)
  }

  const approveItem = async (campaignId: string, item: CampaignItem, refUrls: string[] = []) => {
    if (!user) return
    setApprovingItem(item.id)
    setError(null)
    setCampaigns(prev => prev.map(c => c.id === campaignId
      ? { ...c, items: c.items?.map(i => i.id === item.id ? { ...i, status: 'generating' as const } : i) } : c))
    try {
      const { data: brief } = await supabase.from('content_briefs').insert({
        workspace_id: workspace.id, brand_id: brand.id, created_by: user.id,
        title: item.title, objective: item.objective,
        content_type: item.content_type, quantity: 1,
        extra_context: item.extra_context, hashtags: item.hashtags,
        required_credits: item.required_credits, status: 'confirmed',
      }).select().single()
      if (!brief) throw new Error('Falha ao criar briefing')
      const job = await createContentJob({
        workspaceId: workspace.id, briefId: brief.id,
        brandId: brand.id, jobType: item.content_type, quantity: 1,
        inputPayload: {
          title: item.title, objective: item.objective,
          tone_of_voice: brand.tone_of_voice, extra_context: item.extra_context,
          hashtags: item.hashtags, reference_urls: refUrls,
          brand_name: brand.name, segment: brand.segment,
          target_audience: brand.target_audience, products: brand.products,
          color_palette: brand.color_palette, slogans: brand.slogans,
          design_rules: brand.design_rules, forbidden_words: brand.forbidden_words,
          brand_dna: brand.ai_brand_dna, logo_urls: brand.logo_urls,
          quantity: 1, content_type: item.content_type,
        },
      })
      await supabase.from('campaign_items').update({ status: 'approved', job_id: job.id }).eq('id', item.id)
      setCampaigns(prev => prev.map(c => c.id === campaignId
        ? { ...c, items: c.items?.map(i => i.id === item.id ? { ...i, status: 'done' as const, job_id: job.id } : i) } : c))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao aprovar')
      setCampaigns(prev => prev.map(c => c.id === campaignId
        ? { ...c, items: c.items?.map(i => i.id === item.id ? { ...i, status: 'pending' as const } : i) } : c))
    } finally { setApprovingItem(null) }
  }

  const saveAndApprove = async () => {
    if (!editingItem) return
    setSavingEdit(true)
    // Upload refs
    const refUrls: string[] = []
    for (const f of editRefs) {
      const path = `${workspace.id}/refs/${Date.now()}_${f.name}`
      const { error } = await supabase.storage.from('assets').upload(path, f, { upsert: true })
      if (!error) { const { data: u } = supabase.storage.from('assets').getPublicUrl(path); refUrls.push(u.publicUrl) }
    }
    // Salvar edições
    const updated = { title: editTitle, objective: editObjective, extra_context: editContext, hashtags: editHashtags.split(',').map(h => h.trim()).filter(Boolean) }
    await supabase.from('campaign_items').update(updated).eq('id', editingItem.id)
    const updatedItem = { ...editingItem, ...updated }
    setCampaigns(prev => prev.map(c => c.id === editingItem.campaign_id
      ? { ...c, items: c.items?.map(i => i.id === editingItem.id ? updatedItem : i) } : c))
    setSavingEdit(false)
    setEditingItem(null)
    await approveItem(editingItem.campaign_id, updatedItem, refUrls)
  }

  const deleteItem = async (campaignId: string, itemId: string) => {
    await supabase.from('campaign_items').delete().eq('id', itemId)
    setCampaigns(prev => prev.map(c => c.id === campaignId
      ? { ...c, items: c.items?.filter(i => i.id !== itemId) } : c))
    setDeletingItem(null)
  }

  const regenerateItem = async (campaignId: string, item: CampaignItem) => {
    if (!user) return
    setDeletingItem(null)
    // Gera nova ideia via GPT e substitui
    const prompt = `Gere uma nova ideia de post para Instagram para a marca ${brand.name}.\nSegmento: ${brand.segment}\nPúblico: ${brand.target_audience}\nFormato: ${TYPE_LABELS[item.content_type]}\nData sugerida: ${item.scheduled_date}\nRetorne SOMENTE JSON: {"title":"título criativo","objective":"objetivo","context":"contexto para IA"}`
    const res = await fetch('/api/generate-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
    const data = await res.json()
    try {
      const parsed = JSON.parse(data.content)
      const upd = { title: parsed.title, objective: parsed.objective, extra_context: parsed.context, status: 'pending' as const }
      await supabase.from('campaign_items').update(upd).eq('id', item.id)
      setCampaigns(prev => prev.map(c => c.id === campaignId
        ? { ...c, items: c.items?.map(i => i.id === item.id ? { ...i, ...upd } : i) } : c))
    } catch { setError('Erro ao gerar nova ideia') }
  }

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Deletar este cronograma?')) return
    await supabase.from('content_campaigns').delete().eq('id', campaignId)
    setCampaigns(prev => prev.filter(c => c.id !== campaignId))
    if (expanded === campaignId) setExpanded(null)
  }

  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00')
    return `${String(dt.getDate()).padStart(2,'0')} ${MONTHS_SHORT[dt.getMonth()]}`
  }

  return (
    <div className="page-split">

      {/* Modal edição de item */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, border: '1px solid rgba(7,13,31,.08)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#070D1F', marginBottom: 4 }}>✎ Editar briefing da IA</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 18 }}>Esse é o prompt que a IA vai receber. Edite, complemente e aprove.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Tema / título do post</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="input" placeholder="ex: Lançamento do produto X" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Objetivo</label>
                <input value={editObjective} onChange={e => setEditObjective(e.target.value)} className="input" placeholder="ex: Gerar desejo e curiosidade" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Contexto para a IA <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(complementa o prompt)</span></label>
                <textarea value={editContext} onChange={e => setEditContext(e.target.value)} className="input" rows={4} style={{ resize: 'vertical' }} placeholder="ex: Usar a foto do produto novo, destacar a promoção de 20%, mostrar o antes/depois..." />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Hashtags</label>
                <input value={editHashtags} onChange={e => setEditHashtags(e.target.value)} className="input" placeholder="ex: #moda, #novidade, #lançamento" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Imagens de referência</label>
                <input ref={editFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => setEditRefs(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => editFileRef.current?.click()} style={{ height: 36, padding: '0 14px', border: '1.5px dashed rgba(247,37,133,.3)', borderRadius: 8, background: 'rgba(247,37,133,.03)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#F72585' }}>+ Adicionar foto</button>
                  {editRefs.map((f, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={URL.createObjectURL(f)} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(7,13,31,.08)' }} />
                      <button onClick={() => setEditRefs(prev => prev.filter((_,j) => j !== i))} style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#E24B4A', border: 'none', color: 'white', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setEditingItem(null)} className="btn btn-ghost btn-md" style={{ flex: 1 }}>Cancelar</button>
                <button onClick={saveAndApprove} disabled={savingEdit} className="btn btn-primary btn-md" style={{ flex: 2 }}>
                  {savingEdit ? '⏳ Gerando...' : '✦ Salvar e gerar post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal deletar com regenerar */}
      {deletingItem && (
        <div className="modal-overlay" onClick={() => setDeletingItem(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, border: '1px solid rgba(7,13,31,.08)', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🗑</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#070D1F', marginBottom: 6 }}>Remover este post?</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 1.6 }}>Você pode excluir ou pedir para a IA gerar uma nova ideia no lugar.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => regenerateItem(deletingItem.campaignId, deletingItem.item)} style={{ height: 44, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✦ Gerar nova ideia no lugar
              </button>
              <button onClick={() => deleteItem(deletingItem.campaignId, deletingItem.item.id)} style={{ height: 44, background: 'transparent', border: '1px solid rgba(226,75,74,.2)', borderRadius: 10, color: '#E24B4A', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Excluir sem substituir
              </button>
              <button onClick={() => setDeletingItem(null)} style={{ height: 36, background: 'transparent', border: 'none', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ESQUERDA: form novo cronograma ── */}
      <div className="page-split-left">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: '#F72585', fontSize: 18 }}>✦</span>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#070D1F', letterSpacing: '-.2px' }}>Planejar nova campanha</h2>
          </div>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>Configure a IA e monte o cronograma perfeito para você.</p>
        </div>

        {/* Form embutido — redireciona para BriefingPage com o form */}
        <PlannerForm workspace={workspace} brand={brand} credits={credits} onGenerated={() => fetchCampaigns()} navigate={navigate} />
      </div>

      {/* ── DIREITA: lista de cronogramas ── */}
      <div className="page-split-right">

        {/* Header dentro do card */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid rgba(7,13,31,.07)', flexShrink: 0 }}>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>Planeje, acompanhe e aprove suas campanhas em um só lugar.</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 32px' }}>
          {error && <div style={{ padding: '10px 14px', background: '#FCEBEB', border: '1px solid rgba(226,75,74,.2)', borderRadius: 10, fontSize: 12, color: '#E24B4A', marginBottom: 12 }}>{error}</div>}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 12 }} />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#070D1F', marginBottom: 6 }}>Nenhum cronograma ainda</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Configure o período ao lado e clique em Gerar cronograma.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {campaigns.map(campaign => {
                const isOpen = expanded === campaign.id
                const done    = campaign.items?.filter(i => i.status === 'done').length ?? 0
                const total   = campaign.items?.length ?? 0

                return (
                  <div key={campaign.id} style={{ background: '#fff', border: `1px solid ${isOpen ? 'rgba(247,37,133,.2)' : 'rgba(7,13,31,.08)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .15s' }}>

                    {/* Header campanha */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,rgba(255,106,0,.1),rgba(247,37,133,.1),rgba(123,44,255,.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📅</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#070D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.title}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{PERIOD_LABELS[campaign.period] ?? campaign.period} · {fmtDate(campaign.start_date)} — {fmtDate(campaign.end_date)}</span>
                          {campaign.items && (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: done === total && total > 0 ? '#E1F5EE' : 'rgba(247,37,133,.08)', color: done === total && total > 0 ? '#085041' : '#F72585', fontWeight: 600 }}>
                              {done}/{total} gerados
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => toggleExpand(campaign)} style={{ height: 32, padding: '0 12px', border: '1px solid rgba(7,13,31,.1)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151' }}>Ver</button>
                        <button onClick={() => toggleExpand(campaign)} style={{ height: 32, padding: '0 12px', border: '1px solid rgba(7,13,31,.1)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Editar
                        </button>
                        <button onClick={() => deleteCampaign(campaign.id)} style={{ height: 32, padding: '0 12px', border: '1px solid rgba(226,75,74,.2)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#E24B4A', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Excluir
                        </button>
                        <button onClick={() => toggleExpand(campaign)} style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </div>

                    {/* Items expandidos */}
                    {isOpen && campaign.items && (
                      <div style={{ borderTop: '1px solid rgba(7,13,31,.07)' }}>
                        {campaign.items.map(item => {
                          const dt = new Date(item.scheduled_date + 'T12:00:00')
                          const dayName = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dt.getDay()]
                          const ST: Record<string,{label:string;bg:string;color:string}> = {
                            pending:    { label:'Pendente',   bg:'#F3F4F6',              color:'#6B7280' },
                            approved:   { label:'Aprovado',   bg:'#E1F5EE',              color:'#085041' },
                            generating: { label:'Gerando…',   bg:'rgba(247,37,133,.08)', color:'#F72585' },
                            done:       { label:'Gerado ✓',   bg:'#E1F5EE',              color:'#085041' },
                          }
                          const st = ST[item.status] ?? ST.pending

                          return (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(7,13,31,.05)' }}>
                              {/* Data */}
                              <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 36 }}>
                                <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em' }}>{dayName}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#070D1F', lineHeight: 1.1 }}>{String(dt.getDate()).padStart(2,'0')}</div>
                                <div style={{ fontSize: 9, color: '#9CA3AF' }}>{MONTHS_SHORT[dt.getMonth()]}</div>
                              </div>
                              <div style={{ width: 1, height: 28, background: 'rgba(7,13,31,.07)', flexShrink: 0 }} />
                              {/* Formato */}
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'rgba(247,37,133,.08)', color: '#F72585', flexShrink: 0, whiteSpace: 'nowrap' }}>{TYPE_LABELS[item.content_type] ?? item.content_type}</span>
                              {/* Título */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#070D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                                {item.extra_context && <div style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.extra_context}</div>}
                              </div>
                              {/* Status + créditos + ações */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{item.required_credits} cr.</span>
                                {item.status === 'pending' && <>
                                  <button
                                    onClick={() => { setEditingItem(item); setEditTitle(item.title); setEditObjective(item.objective); setEditContext(item.extra_context); setEditHashtags(item.hashtags?.join(', ')??''); setEditRefs([]) }}
                                    style={{ height: 30, padding: '0 10px', border: '1px solid rgba(7,13,31,.1)', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: '#374151' }}>Editar</button>
                                  <button
                                    onClick={() => approveItem(campaign.id, item)}
                                    disabled={approvingItem === item.id || credits < item.required_credits}
                                    style={{ height: 30, padding: '0 12px', border: 'none', borderRadius: 7, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', opacity: credits < item.required_credits ? .4 : 1 }}>
                                    {approvingItem === item.id ? '⏳' : '+ Aprovar'}
                                  </button>
                                  <button
                                    onClick={() => setDeletingItem({ item, campaignId: campaign.id })}
                                    style={{ height: 30, padding: '0 10px', border: '1px solid rgba(226,75,74,.15)', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: '#E24B4A' }}>Excluir</button>
                                </>}
                                {item.status === 'generating' && <div className="spinner sm" style={{ borderTopColor: '#F72585' }} />}
                                {item.status === 'done' && (
                                  <button onClick={() => navigate('posts')} style={{ height: 30, padding: '0 10px', border: '1px solid rgba(7,13,31,.1)', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: '#374151' }}>Ver →</button>
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {/* Footer */}
                        <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {campaign.items.filter(i=>i.status==='pending').length} pendente{campaign.items.filter(i=>i.status==='pending').length!==1?'s':''} · {campaign.items.filter(i=>i.status==='approved'||i.status==='done').length} aprovado{campaign.items.filter(i=>i.status==='approved'||i.status==='done').length!==1?'s':''} · {credits} crédito{credits!==1?'s':''} disponível{credits!==1?'is':''}
                          </span>
                          {campaign.items.some(i => i.status === 'pending') && (
                            <button
                              disabled={approvingItem !== null}
                              onClick={async () => { for (const it of campaign.items!.filter(i=>i.status==='pending')) await approveItem(campaign.id, it) }}
                              style={{ height: 30, padding: '0 12px', background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 7, color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                              ✦ Aprovar todos
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PlannerForm embutido na esquerda ──────────────────────────
import { generateBrandDNA } from '../lib/api'

type Period = 'semana' | 'quinzena' | 'mes'
const PERIOD_DAYS: Record<Period,number> = { semana:7, quinzena:14, mes:30 }

function PlannerForm({ workspace, brand, credits, onGenerated, navigate }: { workspace: Workspace; brand: BrandProfile; credits: number; onGenerated: () => void; navigate: (r: string) => void }) {
  const { user } = useAuth()
  const [period, setPeriod] = useState<Period>('semana')
  const [ppw, setPpw]       = useState(3)
  const [startDate, setStart] = useState(() => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })
  const [theme, setTheme]   = useState('')
  const [nPost, setNPost]   = useState(2)
  const [nCar,  setNCar]    = useState(1)
  const [nSt,   setNSt]     = useState(0)
  const [touched, setTouched] = useState(false)  // usuário mexeu manualmente no mix?
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string|null>(null)

  // Total de posts no período = posts/semana × número de semanas
  const weeks = period==='semana' ? 1 : period==='quinzena' ? 2 : 4
  const targetTotal = ppw * weeks

  // Recalcula o mix sugerido sempre que período ou ppw mudam (a não ser que o usuário tenha mexido)
  useEffect(() => {
    if (touched) return
    // Distribuição sugerida: 50% posts, 30% carrossel, 20% story
    const car  = Math.max(1, Math.round(targetTotal * 0.3))
    const st   = Math.round(targetTotal * 0.2)
    const post = Math.max(0, targetTotal - car - st)
    setNPost(post); setNCar(car); setNSt(st)
  }, [period, ppw, targetTotal, touched])

  // Helper: marca como tocado ao mexer manualmente
  const setMix = (setter: (n:number)=>void) => (n:number) => { setTouched(true); setter(n) }

  const total  = nPost + nCar + nSt
  const estCr  = nPost + nCar*3 + nSt
  const card: React.CSSProperties = { background:'#fff', border:'1px solid rgba(7,13,31,.08)', borderRadius:14, padding:'14px 16px' }

  const generate = async () => {
    if (!user || total===0) return
    setLoading(true); setError(null)
    try {
      const start=new Date(startDate), end=new Date(start)
      end.setDate(end.getDate()+PERIOD_DAYS[period]-1)
      const { data: camp, error: e } = await supabase.from('content_campaigns').insert({
        workspace_id:workspace.id, brand_id:brand.id, created_by:user.id,
        title: theme || `Cronograma ${period} — ${start.toLocaleDateString('pt-BR')}`,
        period, start_date:start.toISOString().split('T')[0],
        end_date:end.toISOString().split('T')[0], posts_per_week:ppw, theme, status:'draft',
      }).select().single()
      if (e) throw e
      const mix = [...Array(nPost).fill('post_simples'),...Array(nCar).fill('carrossel_5'),...Array(nSt).fill('story')]
      const fmix = mix.reduce((a:Record<string,number>,t)=>{a[t]=(a[t]??0)+1;return a},{})
      const mixStr = Object.entries(fmix).map(([k,v])=>`${v}× ${TYPE_LABELS[k]??k}`).join(', ')
      const prompt = `Estrategista de conteúdo Instagram Brasil.\nBRAND DNA:\n${brand.ai_brand_dna??''}\nMARCA: ${brand.name} | Segmento: ${brand.segment} | Tom: ${brand.tone_of_voice}\nPERÍODO: ${period} (${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}) | ${ppw} posts/sem | Mix: ${mixStr}\nTEMA: ${theme||'livre'}\nRetorne SOMENTE JSON:\n{"items":[{"date":"YYYY-MM-DD","format":"post_simples|carrossel_5|story|capa_reels","title":"tema pt-BR","objective":"objetivo","context":"contexto IA","hashtags":["#tag"]}]}`
      const res = await fetch('/api/generate-schedule', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt}) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error??'Erro')
      const parsed = JSON.parse(data.content)
      await supabase.from('campaign_items').insert(parsed.items.map((it:any,idx:number)=>({
        campaign_id:camp.id, workspace_id:workspace.id, brand_id:brand.id,
        position:idx+1, scheduled_date:it.date, content_type:it.format,
        title:it.title, objective:it.objective??'', extra_context:it.context??'',
        hashtags:it.hashtags??[], required_credits:CREDIT_COSTS[it.format as ContentType]??1,
      })))
      onGenerated()
    } catch(e:any) { setError(e.message??'Erro') }
    finally { setLoading(false) }
  }

  const C = ({ val, set, color }: { val: number; set:(n:number)=>void; color:string }) => (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <button onClick={()=>set(Math.max(0,val-1))} style={{ width:30,height:30,borderRadius:7,border:'1px solid rgba(7,13,31,.12)',background:'transparent',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',color:'#374151',fontFamily:'inherit' }}>−</button>
      <span style={{ width:18,textAlign:'center',fontSize:15,fontWeight:700,color }}>{val}</span>
      <button onClick={()=>set(val+1)} style={{ width:30,height:30,borderRadius:7,border:'1px solid rgba(7,13,31,.12)',background:'transparent',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',color:'#374151',fontFamily:'inherit' }}>+</button>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, flex:1 }}>
      {/* Período — compacto, sem label */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8 }}>
        {([['semana','1 semana'],['quinzena','2 semanas'],['mes','1 mês']] as const).map(([v,l])=>{
          const w = v==='semana'?1:v==='quinzena'?2:4
          return (
            <button key={v} onClick={()=>{setPeriod(v);setTouched(false)}} style={{ padding:'10px 6px',textAlign:'center',cursor:'pointer',fontFamily:'inherit',border:`1.5px solid ${period===v?'#F72585':'rgba(7,13,31,.1)'}`,borderRadius:10,background:period===v?'rgba(247,37,133,.06)':'#fff',transition:'all .12s',display:'flex',flexDirection:'column',alignItems:'center',gap:3,position:'relative' }}>
              {period===v&&<span style={{ position:'absolute',top:5,right:6,width:14,height:14,borderRadius:'50%',background:'#F72585',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'white' }}>✓</span>}
              <div style={{ fontSize:13,fontWeight:600,color:period===v?'#070D1F':'#374151' }}>{l}</div>
              <div style={{ fontSize:10,color:'#9CA3AF' }}>~{ppw*w} posts</div>
            </button>
          )
        })}
      </div>

      {/* Tema */}
      <div>
        <div style={{ fontSize:11,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6 }}>Tema <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0,color:'#C4C7CE' }}>(opcional)</span></div>
        <input value={theme} onChange={e=>setTheme(e.target.value)} style={{ width:'100%',height:40,padding:'0 12px',border:'1px solid rgba(7,13,31,.1)',borderRadius:10,fontSize:12,fontFamily:'inherit',outline:'none',background:'#fff',color:'#070D1F' }} placeholder="ex: coleção inverno, promoção, lançamento, dicas..." />
        <div style={{ fontSize:11,color:'#9CA3AF',marginTop:4 }}>A IA cria títulos baseados nisso para deixar tudo alinhado.</div>
      </div>

      {/* Data + PPW */}
      <div style={card}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
          <div>
            <div style={{ fontSize:11,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6 }}>Data de início</div>
            <input type="date" value={startDate} onChange={e=>setStart(e.target.value)} style={{ width:'100%',height:38,padding:'0 10px',border:'1px solid rgba(7,13,31,.1)',borderRadius:8,fontSize:12,fontFamily:'inherit',outline:'none',background:'#F7F8FA' }} />
          </div>
          <div>
            <div style={{ fontSize:11,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6 }}>Posts/semana</div>
            <div style={{ display:'flex',gap:4 }}>
              {[2,3,4,5,7].map(n=>(
                <button key={n} onClick={()=>{setPpw(n);setTouched(false)}} style={{ flex:1,height:38,cursor:'pointer',fontFamily:'inherit',borderRadius:7,fontSize:13,fontWeight:ppw===n?700:400,border:`1.5px solid ${ppw===n?'#F72585':'rgba(7,13,31,.1)'}`,background:ppw===n?'rgba(247,37,133,.06)':'#fff',color:ppw===n?'#F72585':'#6B7280',transition:'all .12s' }}>{n}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mix */}
      <div style={card}>
        <div style={{ fontSize:11,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10 }}>Mix de formatos <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0,color:'#C4C7CE' }}>· ajuste se quiser</span></div>
        {[
          {label:'Posts estáticos',sub:'1 cr.',color:'#7B2CFF',bg:'rgba(123,44,255,.1)',val:nPost,set:setMix(setNPost)},
          {label:'Carrosséis 5p',  sub:'3 cr.',color:'#F72585',bg:'rgba(247,37,133,.1)',val:nCar, set:setMix(setNCar) },
          {label:'Stories avulsos',sub:'1 cr.',color:'#FF6A00',bg:'rgba(255,106,0,.1)', val:nSt,  set:setMix(setNSt)  },
        ].map(row=>(
          <div key={row.label} style={{ display:'flex',alignItems:'center',marginBottom:10 }}>
            <div style={{ width:30,height:30,borderRadius:8,background:row.bg,display:'flex',alignItems:'center',justifyContent:'center',color:row.color,marginRight:10,flexShrink:0,fontSize:14 }}>▣</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12,fontWeight:500,color:'#070D1F' }}>{row.label}</div>
              <div style={{ fontSize:10,color:'#9CA3AF' }}>{row.sub} cada</div>
            </div>
            <C val={row.val} set={row.set} color={row.color} />
          </div>
        ))}
        <div style={{ borderTop:'1px solid rgba(7,13,31,.07)',paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <span style={{ fontSize:11,color:'#9CA3AF' }}>{total} posts · {estCr} créditos est.</span>
          {credits<estCr&&<span style={{ fontSize:11,color:'#E24B4A',fontWeight:600 }}>⚠ {credits} disponíveis</span>}
        </div>
      </div>

      {error&&<div style={{ padding:'8px 12px',background:'#FCEBEB',border:'1px solid rgba(226,75,74,.2)',borderRadius:8,fontSize:12,color:'#E24B4A' }}>{error}</div>}

      <div style={{ flex:1, minHeight:8 }} />

      <button onClick={generate} disabled={loading||total===0} style={{ width:'100%',height:48,background:loading||total===0?'#e5e7eb':'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)',border:'none',borderRadius:12,color:loading||total===0?'#9CA3AF':'white',fontSize:14,fontWeight:700,fontFamily:'inherit',cursor:loading||total===0?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:loading||total===0?'none':'0 4px 16px rgba(247,37,133,.3)' }}>
        {loading?<><div style={{ width:16,height:16,border:'2.5px solid rgba(255,255,255,.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 1s linear infinite' }} /> Gerando cronograma…</>:<><span style={{ fontSize:16 }}>✦</span> Gerar cronograma</>}
      </button>
    </div>
  )
}
