import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { BrandAsset, AssetCategory } from '../types/database'

interface Props { workspaceId: string; brandId: string }

const CATS: { id: AssetCategory | 'todas'; label: string }[] = [
  { id:'todas',     label:'Todas'      },
  { id:'pessoa',    label:'Pessoas'    },
  { id:'produto',   label:'Produtos'   },
  { id:'empresa',   label:'Empresa'    },
  { id:'campanha',  label:'Campanhas'  },
  { id:'identidade',label:'Identidade' },
]

export function AssetsPage({ workspaceId, brandId }: Props) {
  const [assets, setAssets]       = useState<BrandAsset[]>([])
  const [cat, setCat]             = useState<AssetCategory | 'todas'>('todas')
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [renaming, setRenaming]   = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [movingId, setMovingId]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchAssets = async () => {
    setLoading(true)
    let q = supabase.from('brand_assets').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
    if (cat !== 'todas') q = q.eq('category', cat)
    const { data } = await q
    setAssets(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAssets() }, [workspaceId, cat])

  const toggleSel = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const localUrl = URL.createObjectURL(file)
      const category = cat === 'todas' ? 'produto' : cat
      const tempId = Date.now().toString() + Math.random()
      setAssets(prev => [{
        id: tempId, workspace_id: workspaceId, brand_id: brandId,
        name: file.name.replace(/\.[^.]+$/, ''), storage_path: '',
        public_url: localUrl, asset_type: 'foto_produto', category,
        tags: ['novo'], ai_analyzed: false, performance_score: 0, times_used: 0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, ...prev])
      try {
        const path = `${workspaceId}/assets/${Date.now()}_${file.name}`
        const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
        if (!error) {
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
          const { data: inserted } = await supabase.from('brand_assets').insert({
            workspace_id: workspaceId, brand_id: brandId,
            name: file.name.replace(/\.[^.]+$/, ''), storage_path: path,
            public_url: urlData.publicUrl, asset_type: 'foto_produto', category, tags: ['novo'],
          }).select().single()
          if (inserted) setAssets(prev => prev.map(a => a.id === tempId ? inserted : a))
        }
      } catch { /* mantém preview */ }
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const deleteAsset = async (id: string) => {
    const asset = assets.find(a => a.id === id)
    if (asset?.storage_path) await supabase.storage.from('assets').remove([asset.storage_path])
    await supabase.from('brand_assets').delete().eq('id', id)
    setAssets(prev => prev.filter(a => a.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    setConfirmDeleteId(null)
  }

  const saveRename = async (id: string) => {
    await supabase.from('brand_assets').update({ name: renameVal.trim() }).eq('id', id)
    setAssets(prev => prev.map(a => a.id === id ? { ...a, name: renameVal.trim() } : a))
    setRenaming(null)
  }

  const moveAsset = async (id: string, newCat: AssetCategory) => {
    await supabase.from('brand_assets').update({ category: newCat }).eq('id', id)
    setAssets(prev => prev.map(a => a.id === id ? { ...a, category: newCat } : a))
    setMovingId(null)
  }

  const filtered = cat === 'todas' ? assets : assets.filter(a => a.category === cat)
  const counts: Record<string, number> = { todas: assets.length }
  assets.forEach(a => { if (a.category) counts[a.category] = (counts[a.category] ?? 0) + 1 })

  return (
    <div className="page">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 className="page-title">Acervo visual</h1>
          <p className="page-sub">{assets.length} imagens · usadas pela IA para criar posts com identidade da marca</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input ref={fileRef} type="file" multiple accept="image/*,.svg" style={{ display:'none' }} onChange={handleUpload} />
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Enviando...' : '↑ Upload'}
          </button>
          {selected.size > 0 && (
            <button className="btn btn-primary btn-sm">✦ Usar em post ({selected.size})</button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="filter-row">
        {CATS.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} className={`filter-btn ${cat===c.id?'active':''}`}>
            {c.label}
            <span className="filter-count">{counts[c.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Barra seleção múltipla */}
      {selected.size > 0 && (
        <div style={{ background:'var(--gradient)', borderRadius:'var(--radius-md)', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <span style={{ fontSize:13, color:'white', fontWeight:500 }}>{selected.size} selecionada{selected.size>1?'s':''}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button style={{ padding:'4px 12px', borderRadius:'var(--radius-md)', border:'1px solid rgba(255,255,255,.3)', background:'transparent', color:'white', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }}>✦ Criar post</button>
            <button onClick={() => { selected.forEach(id => deleteAsset(id)); setSelected(new Set()) }}
              style={{ padding:'4px 12px', borderRadius:'var(--radius-md)', border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.15)', color:'white', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }}>🗑 Deletar</button>
            <button onClick={() => setSelected(new Set())} style={{ padding:'4px 12px', borderRadius:'var(--radius-md)', border:'1px solid rgba(255,255,255,.3)', background:'transparent', color:'white', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:12 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="shimmer" style={{ height:130, borderRadius:0 }} />
              <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
                <div className="shimmer" style={{ height:10, width:'80%' }} />
                <div className="shimmer" style={{ height:8, width:'50%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:12 }}>
          {/* Upload btn */}
          <div onClick={() => fileRef.current?.click()} style={{
            border:'1px dashed var(--border-md)', borderRadius:'var(--radius-xl)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            gap:6, minHeight:190, cursor:'pointer', color:'var(--text-4)', fontSize:13, transition:'all .15s',
          }}
            onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor='rgba(247,37,133,.4)'; d.style.color='var(--accent-pink)'; d.style.background='var(--gradient-soft)' }}
            onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor='var(--border-md)'; d.style.color='var(--text-4)'; d.style.background='transparent' }}>
            <span style={{ fontSize:28, opacity:.5 }}>+</span>
            <span>Adicionar imagem</span>
          </div>

          {filtered.map(asset => {
            const isSel = selected.has(asset.id)
            return (
              <div key={asset.id} style={{ border:`${isSel?2:1}px solid ${isSel?'rgba(247,37,133,.5)':'var(--border)'}`, borderRadius:'var(--radius-xl)', overflow:'visible', background:'var(--surface)', position:'relative', boxShadow: isSel ? '0 0 0 3px rgba(247,37,133,.1)' : 'var(--shadow-sm)', transition:'all .15s' }}>
                <div onClick={() => toggleSel(asset.id)} style={{ height:130, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', borderRadius:'var(--radius-xl) var(--radius-xl) 0 0', cursor:'pointer' }}>
                  {asset.public_url
                    ? <img src={asset.public_url} alt={asset.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <span style={{ fontSize:28, opacity:.3 }}>🖼</span>
                  }
                </div>
                {isSel && <div style={{ position:'absolute', top:8, right:8, width:22, height:22, borderRadius:'50%', background:'var(--gradient)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'white' }}>✓</div>}
                {asset.performance_score > 0 && <div className="badge badge-gradient" style={{ position:'absolute', top:8, left:8, fontSize:9 }}>✦ {asset.performance_score.toFixed(1)}</div>}

                <div style={{ padding:'9px 10px 8px' }}>
                  {renaming === asset.id ? (
                    <div style={{ display:'flex', gap:4 }}>
                      <input value={renameVal} onChange={e => setRenameVal(e.target.value)} onKeyDown={e => e.key==='Enter' && saveRename(asset.id)} autoFocus
                        className="input" style={{ flex:1, fontSize:11, padding:'4px 8px' }} />
                      <button className="icon-btn" style={{ background:'var(--gradient)', color:'white', border:'none', width:24, height:24 }} onClick={() => saveRename(asset.id)}>✓</button>
                    </div>
                  ) : (
                    <div className="truncate" style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{asset.name}</div>
                  )}
                  <div style={{ fontSize:10, color:'var(--text-4)', marginTop:2 }}>{asset.times_used > 0 ? `${asset.times_used} usos` : 'Não usado'}</div>
                  <div style={{ display:'flex', gap:3, marginTop:4, flexWrap:'wrap' }}>
                    {asset.tags?.slice(0,2).map(t => (
                      <span key={t} style={{ fontSize:9, padding:'1px 6px', borderRadius:99, background:'var(--gradient-soft)', border:'1px solid rgba(247,37,133,.12)', color:'var(--text-2)' }}>{t}</span>
                    ))}
                  </div>
                </div>

                <div style={{ display:'flex', gap:4, padding:'0 10px 10px', justifyContent:'flex-end' }}>
                  <button className="icon-btn" title="Renomear" onClick={() => { setRenaming(asset.id); setRenameVal(asset.name) }}>✎</button>
                  <div style={{ position:'relative' }}>
                    <button className="icon-btn" title="Mover" onClick={() => setMovingId(movingId===asset.id?null:asset.id)}>⇄</button>
                    {movingId === asset.id && (
                      <div style={{ position:'absolute', bottom:'100%', right:0, background:'var(--surface)', border:'1px solid var(--border-md)', borderRadius:'var(--radius-lg)', padding:'4px', zIndex:10, minWidth:140, boxShadow:'var(--shadow-lg)' }}>
                        {CATS.filter(c => c.id !== 'todas' && c.id !== asset.category).map(c => (
                          <button key={c.id} onClick={() => moveAsset(asset.id, c.id as AssetCategory)}
                            style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 10px', border:'none', background:'transparent', fontSize:12, color:'var(--text-1)', fontFamily:'var(--font-sans)', cursor:'pointer', borderRadius:'var(--radius-md)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background='var(--surface-2)'}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background='transparent'}>
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ position:'relative' }}>
                    <button className="icon-btn danger" title="Deletar" onClick={() => setConfirmDeleteId(confirmDeleteId===asset.id?null:asset.id)}>🗑</button>
                    {confirmDeleteId === asset.id && (
                      <div style={{ position:'absolute', bottom:'100%', right:0, background:'var(--surface)', border:'1px solid rgba(226,75,74,.25)', borderRadius:'var(--radius-lg)', padding:'12px', zIndex:10, minWidth:170, boxShadow:'var(--shadow-lg)' }}>
                        <div style={{ fontSize:12, color:'var(--text-1)', marginBottom:8 }}>Deletar esta imagem?</div>
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-danger btn-sm" style={{ flex:1 }} onClick={() => deleteAsset(asset.id)}>Deletar</button>
                          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                        </div>
                      </div>
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
