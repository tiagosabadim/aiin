import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { BrandAsset, AssetCategory } from '../types/database'

interface Props { workspaceId: string; brandId: string }

const CATS: { id: AssetCategory | 'todas'; label: string }[] = [
  { id:'todas',     label:'Todas'     },
  { id:'pessoa',    label:'Pessoas'   },
  { id:'produto',   label:'Produtos'  },
  { id:'empresa',   label:'Empresa'   },
  { id:'campanha',  label:'Campanhas' },
  { id:'identidade',label:'Identidade'},
]

const CAT_BG: Record<string, string> = {
  pessoa:'#FBEAF0', produto:'#E1F5EE', empresa:'#EEEDFE', campanha:'#FAEEDA', identidade:'#E6F1FB'
}

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
      const tempAsset: BrandAsset = {
        id: tempId, workspace_id: workspaceId, brand_id: brandId,
        name: file.name.replace(/\.[^.]+$/, ''), storage_path: '',
        public_url: localUrl, asset_type: 'foto_produto', category,
        tags: ['novo'], ai_analyzed: false, performance_score: 0, times_used: 0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      setAssets(prev => [tempAsset, ...prev])
      try {
        const path = `${workspaceId}/assets/${Date.now()}_${file.name}`
        const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
        if (!error) {
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
          const { data: inserted } = await supabase.from('brand_assets').insert({
            workspace_id: workspaceId, brand_id: brandId,
            name: file.name.replace(/\.[^.]+$/, ''), storage_path: path,
            public_url: urlData.publicUrl, asset_type: 'foto_produto', category,
            tags: ['novo'],
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
    if (asset?.storage_path) {
      await supabase.storage.from('assets').remove([asset.storage_path])
    }
    await supabase.from('brand_assets').delete().eq('id', id)
    setAssets(prev => prev.filter(a => a.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    setConfirmDeleteId(null)
  }

  const deleteSelected = async () => {
    for (const id of selected) await deleteAsset(id)
    setSelected(new Set())
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
    <div style={{ padding:'28px 32px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Acervo visual</h1>
          <p style={{ fontSize:14, color:'var(--text-2)' }}>{assets.length} imagens · usadas pela IA para criar posts com identidade da marca</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input ref={fileRef} type="file" multiple accept="image/*,.svg" style={{ display:'none' }} onChange={handleUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={btnS}>{uploading ? 'Enviando...' : '↑ Upload'}</button>
          {selected.size > 0 && <button style={btnP}>✦ Usar em post ({selected.size})</button>}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {CATS.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={{
            display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:99,
            border:`1px solid ${cat === c.id ? 'var(--brand)' : 'var(--border-md)'}`,
            background: cat === c.id ? 'var(--brand-light)' : 'transparent',
            color: cat === c.id ? 'var(--brand-dark)' : 'var(--text-2)',
            fontSize:13, fontFamily:'var(--font-sans)', cursor:'pointer', fontWeight: cat === c.id ? 500 : 400,
          }}>
            {c.label}
            <span style={{ background: cat === c.id ? 'var(--brand)' : 'var(--surface-2)', color: cat === c.id ? 'white' : 'var(--text-3)', fontSize:10, padding:'1px 6px', borderRadius:99 }}>
              {counts[c.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Barra seleção */}
      {selected.size > 0 && (
        <div style={{ background:'var(--brand)', borderRadius:'var(--radius-md)', padding:'9px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontSize:13, color:'white' }}>{selected.size} selecionada{selected.size > 1 ? 's' : ''}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button style={selBtn}>✦ Criar post</button>
            <button onClick={deleteSelected} style={{ ...selBtn, background:'rgba(220,50,50,.25)', borderColor:'rgba(255,100,100,.4)' }}>🗑 Deletar</button>
            <button onClick={() => setSelected(new Set())} style={selBtn}>✕</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--text-3)', fontSize:14 }}>Carregando acervo...</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:12 }}>
          {/* Upload button */}
          <div onClick={() => fileRef.current?.click()} style={{
            border:'1px dashed var(--border-md)', borderRadius:'var(--radius-lg)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            gap:6, minHeight:190, cursor:'pointer', color:'var(--text-3)', fontSize:13, transition:'all .15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor='var(--brand)'; (e.currentTarget as HTMLDivElement).style.color='var(--brand)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor='var(--border-md)'; (e.currentTarget as HTMLDivElement).style.color='var(--text-3)' }}>
            <span style={{ fontSize:28 }}>+</span>
            <span>Adicionar imagem</span>
          </div>

          {filtered.map(asset => {
            const isSel = selected.has(asset.id)
            return (
              <div key={asset.id} style={{ border:`${isSel ? 2 : 1}px solid ${isSel ? 'var(--brand)' : 'var(--border)'}`, borderRadius:'var(--radius-lg)', overflow:'visible', background:'var(--surface)', position:'relative', boxShadow: isSel ? '0 0 0 3px var(--brand-light)' : 'var(--shadow-sm)' }}>
                <div onClick={() => toggleSel(asset.id)} style={{ height:130, background: CAT_BG[asset.category ?? 'produto'] ?? 'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, overflow:'hidden', borderRadius:'var(--radius-lg) var(--radius-lg) 0 0', cursor:'pointer' }}>
                  {asset.public_url
                    ? <img src={asset.public_url} alt={asset.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                    : '🖼'}
                </div>
                {isSel && <div style={{ position:'absolute', top:8, right:8, width:20, height:20, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'white', pointerEvents:'none' }}>✓</div>}
                {asset.performance_score > 0 && <div style={{ position:'absolute', top:8, left:8, background:'rgba(0,0,0,.55)', color:'white', fontSize:10, padding:'1px 6px', borderRadius:99 }}>✦ {asset.performance_score.toFixed(1)}</div>}

                <div style={{ padding:'9px 10px 6px' }}>
                  {renaming === asset.id ? (
                    <div style={{ display:'flex', gap:4 }}>
                      <input value={renameVal} onChange={e => setRenameVal(e.target.value)} onKeyDown={e => e.key==='Enter' && saveRename(asset.id)} autoFocus
                        style={{ flex:1, padding:'3px 7px', border:'1px solid var(--brand)', borderRadius:'var(--radius-md)', fontSize:12, fontFamily:'var(--font-sans)', outline:'none' }} />
                      <button onClick={() => saveRename(asset.id)} style={{ ...iconBtn, background:'var(--brand)', color:'white', border:'none' }}>✓</button>
                      <button onClick={() => setRenaming(null)} style={iconBtn}>✕</button>
                    </div>
                  ) : (
                    <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{asset.name}</div>
                  )}
                  <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>{asset.times_used > 0 ? `${asset.times_used} usos` : 'Não usado'}</div>
                  <div style={{ display:'flex', gap:3, marginTop:4, flexWrap:'wrap' }}>
                    {asset.tags?.slice(0,2).map(t => (
                      <span key={t} style={{ fontSize:9, padding:'1px 6px', borderRadius:99, background:'var(--brand-light)', color:'var(--brand-dark)' }}>{t}</span>
                    ))}
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display:'flex', gap:4, padding:'0 10px 10px', justifyContent:'flex-end' }}>
                  <button title="Renomear" onClick={() => { setRenaming(asset.id); setRenameVal(asset.name) }} style={iconBtn}>✎</button>
                  <div style={{ position:'relative' }}>
                    <button title="Mover" onClick={() => setMovingId(movingId === asset.id ? null : asset.id)} style={iconBtn}>⇄</button>
                    {movingId === asset.id && (
                      <div style={{ position:'absolute', bottom:'100%', right:0, background:'var(--surface)', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', padding:'4px', zIndex:10, minWidth:130, boxShadow:'var(--shadow-md)' }}>
                        {CATS.filter(c => c.id !== 'todas' && c.id !== asset.category).map(c => (
                          <button key={c.id} onClick={() => moveAsset(asset.id, c.id as AssetCategory)} style={{ display:'block', width:'100%', textAlign:'left', padding:'6px 10px', border:'none', background:'transparent', fontSize:12, color:'var(--text-1)', fontFamily:'var(--font-sans)', cursor:'pointer', borderRadius:'var(--radius-md)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background='var(--surface-2)'}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background='transparent'}>
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ position:'relative' }}>
                    <button title="Deletar" onClick={() => setConfirmDeleteId(confirmDeleteId === asset.id ? null : asset.id)} style={{ ...iconBtn, color:'var(--red)' }}>🗑</button>
                    {confirmDeleteId === asset.id && (
                      <div style={{ position:'absolute', bottom:'100%', right:0, background:'var(--surface)', border:'1px solid rgba(192,57,43,.3)', borderRadius:'var(--radius-md)', padding:'10px 12px', zIndex:10, minWidth:160, boxShadow:'var(--shadow-md)' }}>
                        <div style={{ fontSize:12, color:'var(--text-1)', marginBottom:8 }}>Deletar esta imagem?</div>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => deleteAsset(asset.id)} style={{ flex:1, padding:'5px', background:'var(--red)', color:'white', border:'none', borderRadius:'var(--radius-md)', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }}>Deletar</button>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ flex:1, padding:'5px', background:'transparent', color:'var(--text-2)', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }}>Cancelar</button>
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

const btnP: React.CSSProperties = { background:'var(--brand)', color:'white', border:'none', borderRadius:'var(--radius-md)', padding:'9px 18px', fontSize:13, fontWeight:500, fontFamily:'var(--font-sans)', cursor:'pointer' }
const btnS: React.CSSProperties = { background:'transparent', color:'var(--text-2)', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', padding:'9px 16px', fontSize:13, fontFamily:'var(--font-sans)', cursor:'pointer' }
const selBtn: React.CSSProperties = { padding:'4px 12px', borderRadius:'var(--radius-md)', border:'1px solid rgba(255,255,255,.3)', background:'transparent', color:'white', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }
const iconBtn: React.CSSProperties = { width:26, height:26, borderRadius:'var(--radius-md)', border:'1px solid var(--border-md)', background:'transparent', color:'var(--text-2)', fontSize:11, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-sans)', flexShrink:0 }
