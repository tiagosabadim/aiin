import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { uploadAsset, supabase } from '../lib/supabase'

type Category = 'todas' | 'pessoa' | 'produto' | 'empresa' | 'campanha'

interface Asset {
  id: string; name: string; category: string
  public_url?: string; storage_path?: string
  tags: string[]; performance_score: number; times_used: number
  bg: string; icon: string
}

const MOCK: Asset[] = [
  { id:'1', name:'Foto verão principal',  category:'produto',  tags:['produto','fundo-branco'], performance_score:9.1, times_used:7,  bg:'#E1F5EE', icon:'📦' },
  { id:'2', name:'Ana usando vestido',    category:'pessoa',   tags:['pessoa','uso-real'],       performance_score:8.8, times_used:5,  bg:'#FBEAF0', icon:'👤' },
  { id:'3', name:'Vitrine lateral',       category:'empresa',  tags:['loja','espaço'],           performance_score:6.2, times_used:2,  bg:'#EEEDFE', icon:'🏢' },
  { id:'4', name:'Coleção inverno',       category:'produto',  tags:['produto','inverno'],        performance_score:8.3, times_used:4,  bg:'#FAEEDA', icon:'📦' },
  { id:'5', name:'Equipe no ateliê',      category:'pessoa',   tags:['equipe','bastidores'],      performance_score:7.0, times_used:1,  bg:'#EAF3DE', icon:'👥' },
  { id:'6', name:'Campanha Dia das Mães', category:'campanha', tags:['campanha','sazonal'],       performance_score:8.5, times_used:3,  bg:'#FBEAF0', icon:'🚀' },
  { id:'7', name:'Tecido sustentável',    category:'empresa',  tags:['material','bastidores'],    performance_score:7.4, times_used:2,  bg:'#E1F5EE', icon:'🏢' },
  { id:'8', name:'Look azul completo',    category:'produto',  tags:['produto','look'],           performance_score:8.9, times_used:6,  bg:'#E6F1FB', icon:'📦' },
  { id:'9', name:'Foto perfil fundadora', category:'pessoa',   tags:['fundadora','marca'],        performance_score:9.2, times_used:4,  bg:'#FAECE7', icon:'👤' },
]

const CATS: { id: Category; label: string }[] = [
  { id:'todas',    label:'Todas'     },
  { id:'pessoa',   label:'Pessoas'   },
  { id:'produto',  label:'Produtos'  },
  { id:'empresa',  label:'Empresa'   },
  { id:'campanha', label:'Campanhas' },
]

const CAT_COLORS: Record<string, string> = {
  pessoa: '#FBEAF0', produto: '#E1F5EE', empresa: '#EEEDFE', campanha: '#FAEEDA'
}

export function AssetsPage() {
  const { user } = useAuth()
  const [cat, setCat]             = useState<Category>('todas')
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [assets, setAssets]       = useState<Asset[]>(MOCK)
  const [uploading, setUploading] = useState(false)
  const [renaming, setRenaming]   = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [movingId, setMovingId]   = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = cat === 'todas' ? assets : assets.filter(a => a.category === cat)
  const counts: Record<string, number> = { todas: assets.length }
  assets.forEach(a => { counts[a.category] = (counts[a.category] ?? 0) + 1 })

  const toggleSel = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !user) return
    setUploading(true)
    try {
      for (const file of files) {
        const category = cat === 'todas' ? 'campanha' : cat
        const localUrl = URL.createObjectURL(file)
        const tempId = Date.now().toString() + Math.random()
        const newA: Asset = {
          id: tempId, name: file.name.replace(/\.[^.]+$/, ''), category,
          tags: ['novo','para-revisar'], performance_score:0, times_used:0,
          bg: CAT_COLORS[category] ?? '#EEEDFE', icon:'🖼', public_url: localUrl,
        }
        setAssets(prev => [newA, ...prev])
        try {
          const { url, path } = await uploadAsset(file, 'demo', category)
          setAssets(prev => prev.map(a => a.id === tempId ? { ...a, public_url: url, storage_path: path } : a))
        } catch { /* mantém preview local */ }
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const deleteAsset = async (id: string) => {
    const asset = assets.find(a => a.id === id)
    if (!asset) return
    // Remove do Storage se tiver path
    if (asset.storage_path) {
      try { await supabase.storage.from('assets').remove([asset.storage_path]) } catch { /* ignora */ }
    }
    setAssets(prev => prev.filter(a => a.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    setConfirmDelete(null)
  }

  const deleteSelected = async () => {
    for (const id of selected) await deleteAsset(id)
    setSelected(new Set())
  }

  const renameAsset = (id: string) => {
    const asset = assets.find(a => a.id === id)
    if (!asset) return
    setRenaming(id)
    setRenameVal(asset.name)
  }

  const saveRename = (id: string) => {
    if (!renameVal.trim()) return
    setAssets(prev => prev.map(a => a.id === id ? { ...a, name: renameVal.trim() } : a))
    setRenaming(null)
  }

  const moveAsset = (id: string, newCat: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, category: newCat, bg: CAT_COLORS[newCat] ?? '#EEEDFE' } : a))
    setMovingId(null)
  }

  return (
    <div style={{ padding:'28px 32px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Acervo visual</h1>
          <p style={{ fontSize:14, color:'var(--text-2)' }}>{assets.length} imagens · A IA usa essas imagens para criar posts com a identidade da marca</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input ref={fileRef} type="file" multiple accept="image/*,.svg" style={{ display:'none' }} onChange={handleUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={btnSecondary}>
            {uploading ? 'Enviando...' : '↑ Upload'}
          </button>
          {selected.size > 0 && (
            <button style={btnPrimary}>✦ Criar post ({selected.size})</button>
          )}
        </div>
      </div>

      {/* Contexto IA */}
      <div style={{ border:'1px solid rgba(61,90,62,0.2)', borderRadius:'var(--radius-lg)',
        padding:'14px 16px', background:'var(--brand-light)', marginBottom:20,
        display:'flex', alignItems:'flex-start', gap:12 }}>
        <span style={{ fontSize:18 }}>✦</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)', marginBottom:3 }}>Memória visual da IA · 73% de contexto</div>
          <div style={{ fontSize:12, color:'var(--brand-dark)', opacity:.8, lineHeight:1.5 }}>
            Fotos com pessoas reais geram 2.1× mais comentários. Fundo natural performa melhor que estúdio.
          </div>
        </div>
        <div style={{ height:4, width:100, background:'rgba(61,90,62,0.15)', borderRadius:99, overflow:'hidden', marginTop:8, flexShrink:0 }}>
          <div style={{ height:'100%', width:'73%', background:'var(--brand)', borderRadius:99 }} />
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {CATS.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={{
            display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:99,
            border:`1px solid ${cat === c.id ? 'var(--brand)' : 'var(--border-md)'}`,
            background: cat === c.id ? 'var(--brand-light)' : 'transparent',
            color: cat === c.id ? 'var(--brand-dark)' : 'var(--text-2)',
            fontSize:13, fontFamily:'var(--font-sans)', cursor:'pointer', fontWeight: cat === c.id ? 500 : 400,
          }}>
            {c.label}
            <span style={{ background: cat === c.id ? 'var(--brand)' : 'var(--surface-2)',
              color: cat === c.id ? 'white' : 'var(--text-3)', fontSize:10, padding:'1px 6px', borderRadius:99 }}>
              {counts[c.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Barra de seleção múltipla */}
      {selected.size > 0 && (
        <div style={{ background:'var(--brand)', borderRadius:'var(--radius-md)', padding:'9px 14px',
          display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontSize:13, color:'white' }}>{selected.size} selecionada{selected.size > 1 ? 's' : ''}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button style={selBtn}>✦ Criar post</button>
            <button onClick={deleteSelected} style={{ ...selBtn, background:'rgba(220,50,50,.25)', borderColor:'rgba(255,100,100,.4)' }}>
              🗑 Deletar
            </button>
            <button onClick={() => setSelected(new Set())} style={selBtn}>✕ Limpar</button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:12 }}>

        {/* Botão de upload */}
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
            <div key={asset.id} style={{
              border:`${isSel ? 2 : 1}px solid ${isSel ? 'var(--brand)' : 'var(--border)'}`,
              borderRadius:'var(--radius-lg)', overflow:'visible', background:'var(--surface)',
              position:'relative', boxShadow: isSel ? '0 0 0 3px var(--brand-light)' : 'var(--shadow-sm)',
            }}>

              {/* Thumbnail */}
              <div onClick={() => toggleSel(asset.id)} style={{ height:130, background:asset.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:32, overflow:'hidden', borderRadius:'var(--radius-lg) var(--radius-lg) 0 0', cursor:'pointer' }}>
                {asset.public_url
                  ? <img src={asset.public_url} alt={asset.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                  : asset.icon}
              </div>

              {/* Check seleção */}
              {isSel && (
                <div style={{ position:'absolute', top:8, right:8, width:20, height:20, borderRadius:'50%',
                  background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, color:'white', pointerEvents:'none' }}>✓</div>
              )}

              {/* Score */}
              {asset.performance_score > 0 && (
                <div style={{ position:'absolute', top:8, left:8, background:'rgba(0,0,0,.55)',
                  color:'white', fontSize:10, padding:'1px 6px', borderRadius:99 }}>
                  ✦ {asset.performance_score.toFixed(1)}
                </div>
              )}

              {/* Info */}
              <div style={{ padding:'9px 10px 6px' }}>
                {renaming === asset.id ? (
                  <div style={{ display:'flex', gap:4 }}>
                    <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveRename(asset.id)}
                      style={{ flex:1, padding:'3px 7px', border:'1px solid var(--brand)',
                        borderRadius:'var(--radius-md)', fontSize:12, fontFamily:'var(--font-sans)', outline:'none' }}
                      autoFocus />
                    <button onClick={() => saveRename(asset.id)} style={{ ...iconBtn, background:'var(--brand)', color:'white', border:'none' }}>✓</button>
                    <button onClick={() => setRenaming(null)} style={iconBtn}>✕</button>
                  </div>
                ) : (
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{asset.name}</div>
                )}
                <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>
                  {asset.times_used > 0 ? `${asset.times_used} usos` : 'Não usado ainda'}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:4 }}>
                  {asset.tags.slice(0,2).map(t => (
                    <span key={t} style={{ fontSize:9, padding:'1px 6px', borderRadius:99,
                      background:'var(--brand-light)', color:'var(--brand-dark)' }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div style={{ display:'flex', gap:4, padding:'0 10px 10px', justifyContent:'flex-end' }}>
                <button title="Renomear" onClick={() => renameAsset(asset.id)} style={iconBtn}>✎</button>

                {/* Mover categoria */}
                <div style={{ position:'relative' }}>
                  <button title="Mover para categoria" onClick={() => setMovingId(movingId === asset.id ? null : asset.id)} style={iconBtn}>⇄</button>
                  {movingId === asset.id && (
                    <div style={{ position:'absolute', bottom:'100%', right:0, background:'var(--surface)',
                      border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', padding:'4px',
                      zIndex:10, minWidth:130, boxShadow:'var(--shadow-md)' }}>
                      {CATS.filter(c => c.id !== 'todas' && c.id !== asset.category).map(c => (
                        <button key={c.id} onClick={() => moveAsset(asset.id, c.id)} style={{
                          display:'block', width:'100%', textAlign:'left', padding:'6px 10px',
                          border:'none', background:'transparent', fontSize:12, color:'var(--text-1)',
                          fontFamily:'var(--font-sans)', cursor:'pointer', borderRadius:'var(--radius-md)',
                        }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background='var(--surface-2)'}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background='transparent'}>
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delete com confirmação */}
                <div style={{ position:'relative' }}>
                  <button title="Deletar" onClick={() => setConfirmDelete(confirmDelete === asset.id ? null : asset.id)}
                    style={{ ...iconBtn, color:'var(--red)' }}>🗑</button>
                  {confirmDelete === asset.id && (
                    <div style={{ position:'absolute', bottom:'100%', right:0, background:'var(--surface)',
                      border:'1px solid rgba(192,57,43,.3)', borderRadius:'var(--radius-md)', padding:'10px 12px',
                      zIndex:10, minWidth:160, boxShadow:'var(--shadow-md)' }}>
                      <div style={{ fontSize:12, color:'var(--text-1)', marginBottom:8 }}>Deletar esta imagem?</div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => deleteAsset(asset.id)} style={{ flex:1, padding:'5px',
                          background:'var(--red)', color:'white', border:'none', borderRadius:'var(--radius-md)',
                          fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }}>Deletar</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ flex:1, padding:'5px',
                          background:'transparent', color:'var(--text-2)', border:'1px solid var(--border-md)',
                          borderRadius:'var(--radius-md)', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = { background:'var(--brand)', color:'white', border:'none',
  borderRadius:'var(--radius-md)', padding:'9px 18px', fontSize:13, fontWeight:500,
  fontFamily:'var(--font-sans)', cursor:'pointer' }
const btnSecondary: React.CSSProperties = { background:'transparent', color:'var(--text-2)',
  border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', padding:'9px 16px',
  fontSize:13, fontFamily:'var(--font-sans)', cursor:'pointer' }
const selBtn: React.CSSProperties = { padding:'4px 12px', borderRadius:'var(--radius-md)',
  border:'1px solid rgba(255,255,255,.3)', background:'transparent', color:'white',
  fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }
const iconBtn: React.CSSProperties = { width:26, height:26, borderRadius:'var(--radius-md)',
  border:'1px solid var(--border-md)', background:'transparent', color:'var(--text-2)',
  fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
  fontFamily:'var(--font-sans)' }
