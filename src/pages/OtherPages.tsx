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
export function DesignSystemPage({ brand, workspaceId, onSave, openOnboardingAt }: { brand: BrandProfile; workspaceId: string; onSave: () => void; openOnboardingAt?: (step: number) => void }) {
  const logoRef    = useRef<HTMLInputElement>(null)
  const assetsRef  = useRef<HTMLInputElement>(null)

  const [colors, setColors]   = useState<ColorSwatch[]>(brand.color_palette ?? [])
  const [slogans, setSlogans] = useState<Slogan[]>(brand.slogans ?? [])
  const [newSlogan, setNewSlogan] = useState('')
  const [titleFont, setTitleFont] = useState(brand.typography?.title ?? 'Inter, sans-serif')
  const [bodyFont,  setBodyFont]  = useState(brand.typography?.body  ?? 'Inter, sans-serif')
  const [designRules, setDesignRules] = useState(brand.design_rules ?? '')
  const [logoPreview, setLogoPreview] = useState<string | undefined>(brand.logo_urls?.primary)
  const [assets, setAssets] = useState<{ id: string; name: string; url: string; dbId?: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [genDNA, setGenDNA] = useState(false)
  const ROLES = ['Principal','Secundária','Destaque','Texto','Fundo','Outro']

  useEffect(() => {
    fetchAssets()
  }, [])

  const fetchAssets = async () => {
    const { data } = await supabase
      .from('brand_assets')
      .select('*')
      .eq('brand_id', brand.id)
      .neq('asset_type', 'logo')
      .order('created_at', { ascending: false })
    if (data) {
      setAssets(data.map(a => ({ id: a.id, name: a.name, url: a.public_url, dbId: a.id })))
    }
  }

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

  const handleAssetsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      const path = `${workspaceId}/assets/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
        const { data: asset } = await supabase.from('brand_assets').insert({
          workspace_id: workspaceId, brand_id: brand.id,
          name: file.name.replace(/\.[^.]+$/, ''),
          storage_path: path, public_url: urlData.publicUrl,
          asset_type: 'foto_produto', category: 'referencia',
        }).select().single()
        if (asset) setAssets(prev => [{ id: asset.id, name: asset.name, url: urlData.publicUrl, dbId: asset.id }, ...prev])
      }
    }
    if (assetsRef.current) assetsRef.current.value = ''
  }

  const deleteAsset = async (assetId: string) => {
    await supabase.from('brand_assets').delete().eq('id', assetId)
    setAssets(prev => prev.filter(a => a.dbId !== assetId))
  }

  const save = async () => {
    setSaving(true); setSaved(false)
    await supabase.from('brand_profiles').update({
      color_palette: colors, slogans,
      typography: { title: titleFont, body: bodyFont },
      design_rules: designRules,
    }).eq('id', brand.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    onSave()
  }

  const regenerateDNA = async () => {
    setGenDNA(true)
    await save()
    await generateBrandDNA(brand.id)
    setGenDNA(false)
    onSave()
  }

  const resetVisualContext = async () => {
    if (!confirm('Isso vai recriar a imagem conceito da marca. Continuar?')) return
    await supabase.from('brand_profiles')
      .update({ openai_thread_id: null, visual_context_approved: false, visual_context_sample: null })
      .eq('id', brand.id)
    if (openOnboardingAt) openOnboardingAt(6)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header fixo */}
      <div style={{ padding: '20px 28px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title">Brand DNA</h1>
          <p className="page-sub">Identidade visual usada pela IA para criar posts coerentes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={resetVisualContext} style={{ height: 34, padding: '0 14px', border: '1px solid rgba(226,75,74,.25)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#E24B4A' }}>
            ↺ Revalidar estilo
          </button>
          <button onClick={regenerateDNA} disabled={genDNA} style={{ height: 34, padding: '0 14px', border: '1px solid rgba(7,13,31,.12)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151', opacity: genDNA ? .5 : 1 }}>
            {genDNA ? '✦ Gerando...' : '✦ Regenerar DNA'}
          </button>
          <button onClick={save} disabled={saving} style={{ height: 34, padding: '0 16px', background: saved ? '#1D9E75' : 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Status visual aprovado */}
      {(brand as any).visual_context_approved && (brand as any).visual_context_sample && (
        <div style={{ margin: '12px 28px 0', padding: '10px 14px', background: '#E1F5EE', border: '1px solid rgba(29,158,117,.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <img src={(brand as any).visual_context_sample} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1D9E75' }}>✓ Estilo visual validado</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>A IA está gerando com sua identidade visual aprovada.</div>
          </div>
        </div>
      )}

      {/* Split desktop / stack mobile */}
      <div className="brand-dna-split" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* ESQUERDA — identidade */}
        <div style={{ flex: '0 0 50%', maxWidth: '50%', overflowY: 'auto', padding: '0 28px 32px', borderRight: '1px solid var(--border)' }}>

          {/* Logo */}
          <Section title="Logo" icon="★">
            <input ref={logoRef} type="file" accept="image/*,.svg" style={{ display: 'none' }} onChange={handleLogoUpload} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div onClick={() => logoRef.current?.click()} style={{ width: 90, height: 72, borderRadius: 12, border: `1.5px dashed ${logoPreview ? 'rgba(247,37,133,.4)' : 'rgba(7,13,31,.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: '#F7F8FA' }}>
                {logoPreview ? <img src={logoPreview} alt="logo" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} /> : <span style={{ fontSize: 22, opacity: .2 }}>★</span>}
              </div>
              <div>
                <button onClick={() => logoRef.current?.click()} style={{ height: 32, padding: '0 14px', border: '1px solid rgba(7,13,31,.12)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151' }}>↑ Subir logo</button>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>PNG ou SVG com fundo transparente</div>
              </div>
            </div>
          </Section>

          {/* Cores */}
          <Section title="Paleta de cores" icon="●">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {colors.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#F7F8FA', borderRadius: 8 }}>
                  <input type="color" value={c.hex} onChange={e => setColors(prev => prev.map((x, j) => j === i ? { ...x, hex: e.target.value } : x))} style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                  <input value={c.name} onChange={e => setColors(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ flex: 1, height: 28, padding: '0 8px', border: '1px solid rgba(7,13,31,.1)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} placeholder="Nome" />
                  <select value={(c as any).role} onChange={e => setColors(prev => prev.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} style={{ width: 100, height: 28, padding: '0 6px', border: '1px solid rgba(7,13,31,.1)', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#9CA3AF', minWidth: 52 }}>{c.hex}</span>
                  <button onClick={() => setColors(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
            <button onClick={() => setColors(prev => [...prev, { name: '', hex: '#7B2CFF' } as any])} style={{ height: 30, padding: '0 12px', border: '1px solid rgba(7,13,31,.12)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151' }}>+ Adicionar cor</button>
          </Section>

          {/* Slogans */}
          <Section title="Slogans" icon="❝">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {slogans.map((s, i) => (
                <div key={i} onClick={() => setSlogans(prev => prev.map((x, j) => ({ ...x, active: j === i })))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: `1px solid ${s.active ? 'rgba(247,37,133,.35)' : 'rgba(7,13,31,.08)'}`, borderRadius: 8, background: s.active ? 'rgba(247,37,133,.04)' : 'transparent', cursor: 'pointer' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${s.active ? '#F72585' : 'rgba(7,13,31,.2)'}`, background: s.active ? '#F72585' : 'transparent' }} />
                  <span style={{ flex: 1, fontSize: 13, color: s.active ? '#070D1F' : '#6B7280', fontWeight: s.active ? 500 : 400 }}>{s.text}</span>
                  <button onClick={e => { e.stopPropagation(); setSlogans(prev => prev.filter((_, j) => j !== i)) }} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newSlogan} onChange={e => setNewSlogan(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newSlogan.trim()) { setSlogans(prev => [...prev, { text: newSlogan.trim(), active: false }]); setNewSlogan('') }}}
                style={{ flex: 1, height: 36, padding: '0 10px', border: '1px solid rgba(7,13,31,.1)', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                placeholder="Novo slogan — Enter para adicionar" />
              <button onClick={() => { if (newSlogan.trim()) { setSlogans(prev => [...prev, { text: newSlogan.trim(), active: false }]); setNewSlogan('') }}} style={{ height: 36, padding: '0 12px', background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add</button>
            </div>
          </Section>

          {/* Tipografia */}
          <Section title="Tipografia" icon="T">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 5 }}>Fonte de títulos</label>
                <input value={titleFont} onChange={e => setTitleFont(e.target.value)} style={{ width: '100%', height: 36, padding: '0 10px', border: '1px solid rgba(7,13,31,.1)', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} placeholder="Inter, sans-serif" />
                <div style={{ fontFamily: titleFont, fontSize: 16, marginTop: 6, color: '#070D1F', fontWeight: 700 }}>Título exemplo</div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 5 }}>Fonte do corpo</label>
                <input value={bodyFont} onChange={e => setBodyFont(e.target.value)} style={{ width: '100%', height: 36, padding: '0 10px', border: '1px solid rgba(7,13,31,.1)', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} placeholder="Inter, sans-serif" />
                <div style={{ fontFamily: bodyFont, fontSize: 12, marginTop: 6, color: '#6B7280', lineHeight: 1.5 }}>Texto de exemplo.</div>
              </div>
            </div>
          </Section>

          {/* Regras */}
          <Section title="Regras para a IA" icon="✦">
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 5 }}>Instruções de design que a IA deve sempre seguir</label>
            <textarea value={designRules} onChange={e => setDesignRules(e.target.value)} rows={4}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(7,13,31,.1)', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
              placeholder="ex: Artes minimalistas com muito respiro. Logo no canto superior. Evitar elementos próximos às bordas." />
          </Section>

        </div>

        {/* DIREITA — acervo */}
        <div style={{ flex: '0 0 50%', maxWidth: '50%', overflowY: 'auto', padding: '0 28px 32px' }}>
          <Section title="Acervo visual" icon="🖼" action={
            <>
              <input ref={assetsRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleAssetsUpload} />
              <button onClick={() => assetsRef.current?.click()} style={{ height: 28, padding: '0 12px', background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 8, color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Adicionar fotos</button>
            </>
          }>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>Fotos, referências e materiais — a IA usa para criar no seu estilo</div>
            {assets.length === 0 ? (
              <div onClick={() => assetsRef.current?.click()} style={{ border: '2px dashed rgba(247,37,133,.15)', borderRadius: 12, padding: '28px 16px', textAlign: 'center', cursor: 'pointer', background: 'rgba(247,37,133,.02)' }}>
                <div style={{ fontSize: 24, opacity: .3, marginBottom: 6 }}>🖼</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>Clique para adicionar fotos e referências</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px,1fr))', gap: 8 }}>
                <div onClick={() => assetsRef.current?.click()} style={{ aspectRatio: '1', border: '2px dashed rgba(247,37,133,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(247,37,133,.02)', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 20, color: '#F72585', opacity: .5 }}>+</span>
                </div>
                {assets.map(asset => (
                  <div key={asset.id} style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#F7F8FA', border: '1px solid rgba(7,13,31,.08)' }}>
                    <img src={asset.url} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => asset.dbId && deleteAsset(asset.dbId)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(226,75,74,.9)', border: 'none', color: 'white', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </Section>

        </div>
      </div>

      {/* Mobile: stack */}
      <style>{`
        @media (max-width: 768px) {
          .brand-dna-split { flex-direction: column !important; overflow: visible !important; }
          .brand-dna-split > div { flex: none !important; max-width: 100% !important; border-right: none !important; border-bottom: 1px solid rgba(7,13,31,.07); overflow-y: visible !important; }
        }
      `}</style>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(7,13,31,.06)' }}>
        <span style={{ background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: 14, fontWeight: 700 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#070D1F' }}>{title}</span>
      </div>
      {children}
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
