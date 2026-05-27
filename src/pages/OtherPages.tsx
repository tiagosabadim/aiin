import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { generateBrandDNA } from '../lib/api'
import type { BrandProfile, Workspace, ColorSwatch, Slogan } from '../types/database'

// ============================================================
//  InsightsPage — dados reais do Instagram
// ============================================================
interface PostInsight {
  id: string
  output_id: string
  instagram_post_id: string
  impressions: number
  reach: number
  likes: number
  comments: number
  saved: number
  shares: number
  engagement_rate: number
  synced_at: string
  output?: { caption: string; public_url: string; format: string; published_at: string }
}

interface BrandMetric {
  period_start: string; period_end: string
  total_posts: number; avg_reach: number; avg_engagement: number
  total_likes: number; total_comments: number; total_saved: number
  best_format: string; best_day: string; ai_summary: string
}

export function InsightsPage({ workspaceId, brand }: { workspaceId?: string; brand?: BrandProfile }) {
  const [insights, setInsights] = useState<PostInsight[]>([])
  const [metrics, setMetrics]   = useState<BrandMetric | null>(null)
  const [learnings, setLearnings] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [period, setPeriod]     = useState<'7'|'30'|'90'>('30')
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return }
    fetchData()
  }, [workspaceId, period])

  const fetchData = async () => {
    if (!workspaceId) return
    setLoading(true)

    // Verifica se tem token
    const { data: b } = await supabase
      .from('brand_profiles').select('instagram_access_token')
      .eq('workspace_id', workspaceId).single()
    setHasToken(!!b?.instagram_access_token)

    // Busca insights
    const since = new Date()
    since.setDate(since.getDate() - parseInt(period))

    const { data: ins } = await supabase
      .from('post_insights')
      .select('*, output:creative_outputs(caption, public_url, format, published_at)')
      .eq('workspace_id', workspaceId)
      .gte('synced_at', since.toISOString())
      .order('engagement_rate', { ascending: false })
      .limit(30)
    setInsights((ins as any) ?? [])

    // Busca métricas
    const { data: met } = await supabase
      .from('brand_metrics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1).single()
    setMetrics(met ?? null)

    // Busca aprendizados
    const { data: learn } = await supabase
      .from('brand_learnings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('learning_type', 'performance')
      .order('created_at', { ascending: false })
      .limit(5)
    setLearnings(learn ?? [])

    setLoading(false)
  }

  const syncNow = async () => {
    setSyncing(true)
    try {
      await fetch('/api/sync-insights', { method: 'POST' })
      await new Promise(r => setTimeout(r, 2000))
      await fetchData()
    } catch {}
    setSyncing(false)
  }

  const avgEngagement = insights.length > 0
    ? insights.reduce((s, i) => s + Number(i.engagement_rate), 0) / insights.length
    : 0
  const totalReach    = insights.reduce((s, i) => s + i.reach, 0)
  const totalLikes    = insights.reduce((s, i) => s + i.likes, 0)
  const totalSaved    = insights.reduce((s, i) => s + i.saved, 0)

  return (
    <div className="page">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="page-sub">
            {hasToken ? `Últimos ${period} dias · dados reais do Instagram` : 'Configure o token do Instagram para ver dados reais'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
            {(['7','30','90'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding:'6px 12px', border:'none', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer',
                background: period===p ? 'var(--gradient)' : 'transparent',
                color: period===p ? 'white' : 'var(--text-3)',
              }}>{p}d</button>
            ))}
          </div>
          {hasToken && (
            <button className="btn btn-ghost btn-sm" onClick={syncNow} disabled={syncing}>
              {syncing ? <><span className="spin" style={{ width:12, height:12, border:'2px solid var(--text-4)', borderTopColor:'var(--accent-pink)', borderRadius:'50%', display:'inline-block' }} /> Sincronizando...</> : '↺ Sincronizar'}
            </button>
          )}
        </div>
      </div>

      {/* Sem token */}
      {!hasToken && !loading && (
        <div className="card-gradient" style={{ textAlign:'center', padding:'32px 24px' }}>
          <div style={{ fontSize:32, marginBottom:12, opacity:.5 }}>📊</div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text-1)', marginBottom:6 }}>Conecte o Instagram para ver insights reais</div>
          <div style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6, marginBottom:16, maxWidth:380, margin:'0 auto 16px' }}>
            Configure o Access Token em Configurações para começar a coletar curtidas, alcance e engajamento de cada post.
          </div>
          <a href="#settings" className="btn btn-primary btn-sm" style={{ textDecoration:'none' }}>Ir para Configurações →</a>
        </div>
      )}

      {/* Stats */}
      {(hasToken || insights.length > 0) && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Posts analisados',  value: String(insights.length),         color:'var(--accent-purple)' },
              { label:'Alcance total',      value: totalReach > 1000 ? `${(totalReach/1000).toFixed(1)}k` : String(totalReach), color:'var(--accent-pink)'   },
              { label:'Total de curtidas',  value: totalLikes > 1000 ? `${(totalLikes/1000).toFixed(1)}k` : String(totalLikes), color:'var(--accent-orange)' },
              { label:'Engajamento médio',  value: `${avgEngagement.toFixed(2)}%`,  color:'var(--success)'       },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding:'16px' }}>
                <div style={{ fontSize:10, color:'var(--text-4)', marginBottom:6, fontWeight:500, textTransform:'uppercase', letterSpacing:'.05em' }}>{s.label}</div>
                <div style={{ fontSize:26, fontWeight:700, color: loading ? 'var(--text-4)' : s.color, lineHeight:1, letterSpacing:'-.3px' }}>
                  {loading ? '—' : s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Aprendizados da IA */}
          {learnings.length > 0 && (
            <div className="card-gradient" style={{ marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ background:'var(--gradient)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontSize:16 }}>✦</span>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text-1)' }}>Aprendizados da IA · baseado nos seus dados reais</span>
              </div>
              {learnings.slice(0,1).map(l => (
                <div key={l.id} style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7 }}>{l.content}</div>
              ))}
              {learnings.length > 1 && (
                <div style={{ marginTop:10, fontSize:11, color:'var(--text-4)' }}>{learnings.length - 1} aprendizado{learnings.length > 2 ? 's' : ''} anterior{learnings.length > 2 ? 'es' : ''} também disponível{learnings.length > 2 ? 'eis' : ''}</div>
              )}
            </div>
          )}

          {/* Top posts */}
          {insights.length > 0 && (
            <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:20 }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:600, color:'var(--text-1)' }}>
                Top posts por engajamento
              </div>
              <div>
                {insights.slice(0, 8).map((ins, idx) => (
                  <div key={ins.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: idx < 7 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background: idx < 3 ? 'var(--gradient)' : 'var(--surface-3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: idx < 3 ? 'white' : 'var(--text-3)', flexShrink:0 }}>
                      {idx + 1}
                    </div>
                    {(ins as any).output?.public_url && (
                      <img src={(ins as any).output.public_url} alt="" style={{ width:40, height:40, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {(ins as any).output?.caption?.slice(0, 60) ?? 'Sem legenda'}...
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-4)', marginTop:2 }}>
                        {(ins as any).output?.format} · {(ins as any).output?.published_at ? new Date((ins as any).output.published_at).toLocaleDateString('pt-BR') : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:12, flexShrink:0 }}>
                      {[
                        ['♥', ins.likes],
                        ['💬', ins.comments],
                        ['🔖', ins.saved],
                        ['👁', ins.reach],
                      ].map(([icon, val]) => (
                        <div key={String(icon)} style={{ textAlign:'center', minWidth:32 }}>
                          <div style={{ fontSize:10 }}>{icon}</div>
                          <div style={{ fontSize:11, fontWeight:500, color:'var(--text-1)' }}>{Number(val) > 999 ? `${(Number(val)/1000).toFixed(1)}k` : val}</div>
                        </div>
                      ))}
                      <div style={{ textAlign:'center', minWidth:44 }}>
                        <div style={{ fontSize:10, color:'var(--text-4)' }}>engaj.</div>
                        <div style={{ fontSize:12, fontWeight:700, color: Number(ins.engagement_rate) >= 5 ? 'var(--success)' : Number(ins.engagement_rate) >= 2 ? 'var(--accent-orange)' : 'var(--red)' }}>
                          {Number(ins.engagement_rate).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Engajamento por dia */}
          {insights.length > 0 && <EngagementChart insights={insights} />}

          {/* Estado vazio com token */}
          {insights.length === 0 && !loading && hasToken && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-4)' }}>
              <div style={{ fontSize:28, marginBottom:10, opacity:.3 }}>📊</div>
              <div style={{ fontSize:14, marginBottom:6 }}>Nenhum dado ainda</div>
              <div style={{ fontSize:13, marginBottom:16 }}>Publique posts pelo aiin para começar a coletar métricas.</div>
              <button className="btn btn-ghost btn-sm" onClick={syncNow} disabled={syncing}>↺ Sincronizar agora</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EngagementChart({ insights }: { insights: PostInsight[] }) {
  const byDay: Record<string, number[]> = { Dom:[], Seg:[], Ter:[], Qua:[], Qui:[], Sex:[], Sáb:[] }
  const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

  insights.forEach(ins => {
    if (!(ins as any).output?.published_at) return
    const d = new Date((ins as any).output.published_at)
    const day = DAYS[d.getDay()]
    byDay[day].push(Number(ins.engagement_rate))
  })

  const avgs = DAYS.map(d => {
    const vals = byDay[d]
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })
  const max = Math.max(...avgs, 0.1)

  return (
    <div className="card">
      <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:16 }}>Engajamento médio por dia da semana</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:100 }}>
        {DAYS.map((d, i) => {
          const pct = max > 0 ? (avgs[i] / max) * 100 : 0
          const hasData = byDay[d].length > 0
          return (
            <div key={d} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              {hasData && <div style={{ fontSize:9, color:'var(--text-4)' }}>{avgs[i].toFixed(1)}%</div>}
              <div style={{ width:'100%', borderRadius:'4px 4px 0 0', minHeight:4,
                background: pct >= 70 ? 'var(--gradient)' : pct >= 40 ? 'var(--accent-purple)' : 'var(--surface-3)',
                height:`${Math.max(pct, 4)}%`, transition:'height .4s', opacity: hasData ? 1 : .3 }} />
              <span style={{ fontSize:10, color:'var(--text-4)' }}>{d}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
//  DesignSystemPage
// ============================================================
export function DesignSystemPage({ brand, workspaceId, onSave }: { brand: BrandProfile; workspaceId: string; onSave: () => void }) {
  const logoRef  = useRef<HTMLInputElement>(null)
  const illusRef = useRef<HTMLInputElement>(null)
  const [colors, setColors]   = useState<ColorSwatch[]>(brand.color_palette ?? [])
  const [slogans, setSlogans] = useState<Slogan[]>(brand.slogans ?? [])
  const [newSlogan, setNewSlogan]   = useState('')
  const [editingSloganIdx, setEditingSloganIdx] = useState<number | null>(null)
  const [editSloganVal, setEditSloganVal] = useState('')
  const [titleFont, setTitleFont] = useState(brand.typography?.title ?? 'Inter, sans-serif')
  const [bodyFont,  setBodyFont]  = useState(brand.typography?.body  ?? 'Inter, sans-serif')
  const [designRules, setDesignRules] = useState(brand.design_rules ?? '')
  const [logoPreview, setLogoPreview] = useState<string | undefined>(brand.logo_urls?.primary)
  const [illustrations, setIllustrations] = useState<{ id:string; name:string; url:string }[]>([])
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)
  const [genDNA, setGenDNA]   = useState(false)
  const ROLES = ['Principal','Secundária','Destaque','Texto','Fundo','Outro']

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setLogoPreview(URL.createObjectURL(file))
    const path = `${workspaceId}/logos/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('assets').getPublicUrl(path)
      await supabase.from('brand_profiles').update({ logo_urls: { ...brand.logo_urls, primary: data.publicUrl } }).eq('id', brand.id)
    }
  }

  const save = async () => {
    setSaving(true); setSaved(false)
    await supabase.from('brand_profiles').update({ color_palette: colors, slogans, typography: { title: titleFont, body: bodyFont }, design_rules: designRules }).eq('id', brand.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    onSave()
  }

  const regenerateDNA = async () => {
    setGenDNA(true); await save()
    await generateBrandDNA(brand.id)
    setGenDNA(false); onSave()
  }

  const resetVisualContext = async () => {
    if (!confirm('Resetar o contexto visual vai criar uma nova conversa com a IA do zero. Os próximos posts serão gerados com um contexto limpo. Continuar?')) return
    await supabase.from('brand_profiles')
      .update({ openai_thread_id: null, visual_context_approved: false, visual_context_sample: null })
      .eq('id', brand.id)
    alert('Contexto resetado! A próxima geração criará um novo contexto visual.')
    window.location.reload()
  }

  return (
    <div className="page">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title">Brand DNA</h1>
          <p className="page-sub">Identidade visual usada pela IA para criar posts coerentes</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={resetVisualContext} style={{ color:'var(--red)', borderColor:'rgba(226,75,74,.25)' }}>
            ↺ Resetar contexto
          </button>
          <button className="btn btn-ghost btn-sm" onClick={regenerateDNA} disabled={genDNA}>
            {genDNA ? '✦ Gerando...' : '✦ Regenerar DNA'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving} style={saved ? { background:'var(--success)' } : {}}>
            {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Status do contexto visual */}
      {(brand as any).visual_context_approved && (brand as any).visual_context_sample && (
        <div style={{ display:'flex', gap:14, alignItems:'center', padding:'12px 16px', background:'var(--success-light)', border:'1px solid rgba(29,158,117,.2)', borderRadius:'var(--radius-lg)', marginBottom:16 }}>
          <img src={(brand as any).visual_context_sample} alt="contexto" style={{ width:56, height:56, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--success)' }}>✓ Contexto visual aprovado</div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>A IA está gerando com a identidade visual validada. Se a qualidade cair, use "Resetar contexto".</div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        <DSSection title="Logo" icon="★">
          <input ref={logoRef} type="file" accept="image/*,.svg" style={{ display:'none' }} onChange={handleLogoUpload} />
          <div style={{ display:'flex', gap:14, alignItems:'center' }}>
            <div onClick={() => logoRef.current?.click()} style={{ width:100, height:80, borderRadius:'var(--radius-lg)', border:`1px dashed ${logoPreview?'rgba(247,37,133,.4)':'var(--border-md)'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden', background:'var(--surface-2)' }}>
              {logoPreview ? <img src={logoPreview} alt="logo" style={{ maxWidth:'90%', maxHeight:'90%', objectFit:'contain' }} /> : <span style={{ fontSize:24, color:'var(--text-4)', opacity:.4 }}>★</span>}
            </div>
            <div>
              <button className="btn btn-ghost btn-sm" onClick={() => logoRef.current?.click()}>↑ Subir logo</button>
              <div style={{ fontSize:11, color:'var(--text-4)', marginTop:6 }}>PNG ou SVG com fundo transparente</div>
            </div>
          </div>
        </DSSection>

        <DSSection title="Paleta de cores" icon="●">
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            {colors.map((c,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'var(--surface-2)', borderRadius:'var(--radius-md)' }}>
                <input type="color" value={c.hex} onChange={e => setColors(prev => prev.map((x,j) => j===i ? { ...x, hex: e.target.value } : x))} style={{ width:32, height:32, border:'none', borderRadius:8, cursor:'pointer', padding:0, flexShrink:0 }} />
                <input value={c.name} onChange={e => setColors(prev => prev.map((x,j) => j===i ? { ...x, name: e.target.value } : x))} className="input" style={{ flex:1, fontSize:12, padding:'5px 8px' }} placeholder="Nome" />
                <select value={c.role} onChange={e => setColors(prev => prev.map((x,j) => j===i ? { ...x, role: e.target.value } : x))} className="input" style={{ width:110, fontSize:12, padding:'5px 8px' }}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
                <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-4)', minWidth:56 }}>{c.hex}</span>
                <button className="icon-btn danger" onClick={() => setColors(prev => prev.filter((_,j) => j!==i))}>×</button>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setColors(prev => [...prev, { name:'', hex:'#7B2CFF', role:'Outro' }])}>+ Adicionar cor</button>
        </DSSection>

        <DSSection title="Tipografia" icon="T">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label className="label">Fonte de títulos</label>
              <input value={titleFont} onChange={e => setTitleFont(e.target.value)} className="input" placeholder="ex: Inter, sans-serif" />
              <div style={{ fontFamily:titleFont, fontSize:20, marginTop:8, color:'var(--text-1)', fontWeight:700 }}>Título exemplo</div>
            </div>
            <div>
              <label className="label">Fonte do corpo</label>
              <input value={bodyFont} onChange={e => setBodyFont(e.target.value)} className="input" placeholder="ex: Inter, sans-serif" />
              <div style={{ fontFamily:bodyFont, fontSize:13, marginTop:8, color:'var(--text-2)', lineHeight:1.6 }}>Texto de exemplo.</div>
            </div>
          </div>
        </DSSection>

        <DSSection title="Slogans" icon="❝">
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            {slogans.map((s,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', border:`1px solid ${s.active?'rgba(247,37,133,.35)':'var(--border)'}`, borderRadius:'var(--radius-md)', background: s.active ? 'var(--gradient-soft)' : 'transparent', cursor:'pointer' }}
                onClick={() => setSlogans(prev => prev.map((x,j) => ({ ...x, active: j===i })))}>
                <div style={{ width:14, height:14, borderRadius:'50%', flexShrink:0, border:`1.5px solid ${s.active?'var(--accent-pink)':'var(--border-md)'}`, background: s.active ? 'var(--gradient)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {s.active && <div style={{ width:5, height:5, borderRadius:'50%', background:'white' }} />}
                </div>
                {editingSloganIdx === i ? (
                  <input value={editSloganVal} onChange={e => setEditSloganVal(e.target.value)} onClick={e => e.stopPropagation()} autoFocus
                    onKeyDown={e => { if (e.key==='Enter') { setSlogans(prev => prev.map((x,j) => j===i ? { ...x, text: editSloganVal } : x)); setEditingSloganIdx(null) }}}
                    className="input" style={{ flex:1, fontSize:12, padding:'4px 8px' }} />
                ) : <span style={{ flex:1, fontSize:13, color: s.active ? 'var(--text-1)' : 'var(--text-3)', fontWeight: s.active ? 500 : 400 }}>{s.text}</span>}
                <button className="icon-btn" onClick={e => { e.stopPropagation(); setEditingSloganIdx(i); setEditSloganVal(s.text) }}>✎</button>
                <button className="icon-btn danger" onClick={e => { e.stopPropagation(); setSlogans(prev => prev.filter((_,j) => j!==i)) }}>🗑</button>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={newSlogan} onChange={e => setNewSlogan(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && newSlogan.trim()) { setSlogans(prev => [...prev, { text: newSlogan.trim(), active: false }]); setNewSlogan('') }}}
              className="input" placeholder="Novo slogan — Enter para adicionar" style={{ flex:1 }} />
            <button className="btn btn-primary btn-sm" onClick={() => { if (newSlogan.trim()) { setSlogans(prev => [...prev, { text: newSlogan.trim(), active: false }]); setNewSlogan('') }}}>+ Add</button>
          </div>
        </DSSection>

        <DSSection title="Regras para a IA" icon="✦">
          <label className="label">Instruções de design que a IA deve sempre seguir</label>
          <textarea value={designRules} onChange={e => setDesignRules(e.target.value)} rows={4} className="input" style={{ resize:'vertical' }}
            placeholder="ex: Artes minimalistas com muito respiro. Logo no canto superior. Evitar elementos próximos às bordas." />
        </DSSection>

        <DSSection title="Ilustrações e elementos" icon="◈" action={
          <>
            <input ref={illusRef} type="file" multiple accept="image/*,.svg" style={{ display:'none' }}
              onChange={e => { Array.from(e.target.files ?? []).forEach(f => setIllustrations(prev => [...prev, { id: Date.now().toString()+Math.random(), name: f.name.replace(/\.[^.]+$/,''), url: URL.createObjectURL(f) }])); if (illusRef.current) illusRef.current.value='' }} />
            <button className="btn btn-ghost btn-sm" onClick={() => illusRef.current?.click()}>↑ Subir</button>
          </>
        }>
          {illustrations.length === 0 ? (
            <div style={{ border:'1px dashed var(--border-md)', borderRadius:'var(--radius-lg)', padding:28, textAlign:'center', color:'var(--text-4)' }}>
              <div style={{ fontSize:24, marginBottom:8, opacity:.3 }}>🖼</div>
              <div style={{ fontSize:13, marginBottom:4 }}>Nenhuma ilustração ainda</div>
              <div style={{ fontSize:12 }}>SVGs, texturas e elementos decorativos da marca</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px,1fr))', gap:10 }}>
              {illustrations.map(ill => (
                <div key={ill.id} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
                  <div style={{ height:80, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <img src={ill.url} alt={ill.name} style={{ maxHeight:70, maxWidth:'90%', objectFit:'contain' }} />
                  </div>
                  <div style={{ padding:'6px 8px', fontSize:10, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ill.name}</div>
                </div>
              ))}
            </div>
          )}
        </DSSection>
      </div>
    </div>
  )
}

function DSSection({ title, icon, action, children }: { title:string; icon:string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      <div style={{ padding:'12px 18px', background:'var(--surface-2)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ background:'var(--gradient)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{icon}</span>
          {title}
        </div>
        {action}
      </div>
      <div style={{ padding:'16px 18px' }}>{children}</div>
    </div>
  )
}

// ============================================================
//  SettingsPage
// ============================================================
export function SettingsPage({ workspace, brand }: { workspace: Workspace; brand: BrandProfile }) {
  const [igToken,   setIgToken]   = useState(brand.instagram_access_token ?? '')
  const [igAccount, setIgAccount] = useState(brand.instagram_account_id  ?? '')
  const [saved, setSaved] = useState<Record<string,boolean>>({})

  const save = async (key: string) => {
    if (key === 'instagram') {
      await supabase.from('brand_profiles').update({ instagram_access_token: igToken, instagram_account_id: igAccount }).eq('id', brand.id)
    }
    setSaved(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2500)
  }

  return (
    <div className="page" style={{ maxWidth:580 }}>
      <h1 className="page-title" style={{ marginBottom:4 }}>Configurações</h1>
      <p className="page-sub" style={{ marginBottom:28 }}>Integre o aiin com suas plataformas</p>

      <div className="card" style={{ marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'var(--gradient)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'white', flexShrink:0 }}>📸</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-1)' }}>Instagram Business</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>Conecte via Meta Graph API para publicação automática e insights</div>
          </div>
          <span className={`badge ${igToken && igAccount ? 'badge-approved' : 'badge-pending'}`}>{igToken && igAccount ? 'Conectado' : 'Desconectado'}</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div>
            <label className="label">Instagram Account ID</label>
            <input className="input" value={igAccount} onChange={e => setIgAccount(e.target.value)} placeholder="123456789" />
          </div>
          <div>
            <label className="label">Access Token (Meta Graph API)</label>
            <input type="password" className="input" value={igToken} onChange={e => setIgToken(e.target.value)} placeholder="EAABs..." />
          </div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginTop:14, ...(saved.instagram ? { background:'var(--success)' } : {}) }} onClick={() => save('instagram')}>
          {saved.instagram ? '✓ Salvo' : 'Salvar'}
        </button>
      </div>

      <div className="card-gradient">
        <div style={{ fontSize:14, fontWeight:600, color:'var(--text-1)', marginBottom:6 }}>
          <span style={{ background:'var(--gradient)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>✦</span> Plano atual — {workspace.name}
        </div>
        <div style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.6, marginBottom:12 }}>Para gerenciar assinatura, comprar créditos extras ou fazer upgrade, entre em contato.</div>
        <button className="btn btn-ghost btn-sm">Falar com suporte →</button>
      </div>
    </div>
  )
}
