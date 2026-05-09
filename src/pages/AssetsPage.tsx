import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { uploadAsset } from '../lib/supabase'

type Category = 'todas' | 'pessoa' | 'produto' | 'empresa' | 'campanha'

interface Asset {
  id: string; name: string; category: string
  public_url?: string; tags: string[]; performance_score: number; times_used: number
  bg: string; icon: string
}

const MOCK: Asset[] = [
  { id:'1', name:'Foto verão principal',   category:'produto',  tags:['produto','fundo-branco'], performance_score:9.1, times_used:7,  bg:'#E1F5EE', icon:'📦' },
  { id:'2', name:'Ana usando vestido',      category:'pessoa',   tags:['pessoa','uso-real'],       performance_score:8.8, times_used:5,  bg:'#FBEAF0', icon:'👤' },
  { id:'3', name:'Vitrine lateral',         category:'empresa',  tags:['loja','espaço'],           performance_score:6.2, times_used:2,  bg:'#EEEDFE', icon:'🏢' },
  { id:'4', name:'Coleção inverno',         category:'produto',  tags:['produto','inverno'],        performance_score:8.3, times_used:4,  bg:'#FAEEDA', icon:'📦' },
  { id:'5', name:'Equipe no ateliê',        category:'pessoa',   tags:['equipe','bastidores'],      performance_score:7.0, times_used:1,  bg:'#EAF3DE', icon:'👥' },
  { id:'6', name:'Campanha Dia das Mães',   category:'campanha', tags:['campanha','sazonal'],       performance_score:8.5, times_used:3,  bg:'#FBEAF0', icon:'🚀' },
  { id:'7', name:'Tecido sustentável',      category:'empresa',  tags:['material','bastidores'],    performance_score:7.4, times_used:2,  bg:'#E1F5EE', icon:'🏢' },
  { id:'8', name:'Look azul completo',      category:'produto',  tags:['produto','look'],           performance_score:8.9, times_used:6,  bg:'#E6F1FB', icon:'📦' },
  { id:'9', name:'Foto perfil fundadora',   category:'pessoa',   tags:['fundadora','marca'],        performance_score:9.2, times_used:4,  bg:'#FAECE7', icon:'👤' },
]

const CATS: { id: Category; label: string }[] = [
  { id:'todas',    label:'Todas'     },
  { id:'pessoa',   label:'Pessoas'   },
  { id:'produto',  label:'Produtos'  },
  { id:'empresa',  label:'Empresa'   },
  { id:'campanha', label:'Campanhas' },
]

export function AssetsPage() {
  const { user } = useAuth()
  const [cat, setCat]           = useState<Category>('todas')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assets, setAssets]     = useState<Asset[]>(MOCK)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = cat === 'todas' ? assets : assets.filter(a => a.category === cat)

  const toggleSel = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !user) return
    setUploading(true)
    try {
      for (const file of files) {
        const brandId = 'demo'
        await uploadAsset(file, brandId, cat === 'todas' ? 'campanha' : cat)
        const newA: Asset = {
          id: Date.now().toString(),
          name: file.name.replace(/\.[^.]+$/, ''),
          category: cat === 'todas' ? 'campanha' : cat,
          tags: ['novo', 'para-revisar'],
          performance_score: 0,
          times_used: 0,
          bg: '#EEEDFE',
          icon: '🖼',
        }
        setAssets(prev => [newA, ...prev])
      }
    } catch {
      // Storage not configured yet — just add mock
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const counts: Record<string, number> = { todas: assets.length }
  assets.forEach(a => { counts[a.category] = (counts[a.category] ?? 0) + 1 })

  return (
    <div style={{ padding:'28px 32px' }}>
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
            <button style={btnPrimary}>✦ Criar post com {selected.size} imagem{selected.size > 1 ? 'ns' : ''}</button>
          )}
        </div>
      </div>

      {/* Contexto IA */}
      <div style={{ border:'1px solid rgba(61,90,62,0.2)', borderRadius:'var(--radius-lg)',
        padding:'14px 16px', background:'var(--brand-light)', marginBottom:20,
        display:'flex', alignItems:'flex-start', gap:12 }}>
        <span style={{ fontSize:18 }}>✦</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)', marginBottom:3 }}>
            Memória visual da IA · 73% de contexto
          </div>
          <div style={{ fontSize:12, color:'var(--brand-dark)', opacity:.8, lineHeight:1.5 }}>
            Fotos com pessoas reais geram 2.1× mais comentários. Fundo natural performa melhor que estúdio. Carrossel com jardim tem alta taxa de salvamento.
          </div>
        </div>
        <div style={{ height:4, width:120, background:'rgba(61,90,62,0.15)', borderRadius:99, overflow:'hidden', marginTop:6, flexShrink:0 }}>
          <div style={{ height:'100%', width:'73%', background:'var(--brand)', borderRadius:99 }} />
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
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

      {/* Barra de seleção */}
      {selected.size > 0 && (
        <div style={{ background:'var(--brand)', borderRadius:'var(--radius-md)', padding:'9px 14px',
          display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontSize:13, color:'white' }}>{selected.size} imagem{selected.size > 1 ? 'ns' : ''} selecionada{selected.size > 1 ? 's' : ''}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button style={{ padding:'4px 12px', borderRadius:'var(--radius-md)', border:'1px solid rgba(255,255,255,.3)',
              background:'transparent', color:'white', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }}>
              ✦ Criar post
            </button>
            <button onClick={() => setSelected(new Set())} style={{ padding:'4px 12px', borderRadius:'var(--radius-md)',
              border:'1px solid rgba(255,255,255,.3)', background:'transparent', color:'white', fontSize:12,
              fontFamily:'var(--font-sans)', cursor:'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
        {/* Botão upload */}
        <div onClick={() => fileRef.current?.click()} style={{
          border:'1px dashed var(--border-md)', borderRadius:'var(--radius-lg)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap:6, minHeight:180, cursor:'pointer', color:'var(--text-3)', fontSize:13,
          transition:'all .15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--brand)'; (e.currentTarget as HTMLDivElement).style.color = 'var(--brand)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-md)'; (e.currentTarget as HTMLDivElement).style.color = 'var(--text-3)' }}>
          <span style={{ fontSize:24 }}>+</span>
          <span>Adicionar imagem</span>
        </div>

        {filtered.map(asset => {
          const isSel = selected.has(asset.id)
          return (
            <div key={asset.id} onClick={() => toggleSel(asset.id)} style={{
              border:`${isSel ? 2 : 1}px solid ${isSel ? 'var(--brand)' : 'var(--border)'}`,
              borderRadius:'var(--radius-lg)', overflow:'hidden', cursor:'pointer',
              background:'var(--surface)', position:'relative',
              boxShadow: isSel ? '0 0 0 3px var(--brand-light)' : 'none',
            }}>
              <div style={{ height:110, background:asset.bg, display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:32 }}>
                {asset.public_url
                  ? <img src={asset.public_url} alt={asset.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : asset.icon}
              </div>
              {isSel && (
                <div style={{ position:'absolute', top:8, right:8, width:20, height:20, borderRadius:'50%',
                  background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, color:'white' }}>✓</div>
              )}
              {asset.performance_score > 0 && (
                <div style={{ position:'absolute', top:8, left:8, background:'rgba(0,0,0,.5)',
                  color:'white', fontSize:10, padding:'1px 6px', borderRadius:99 }}>
                  ✦ {asset.performance_score.toFixed(1)}
                </div>
              )}
              <div style={{ padding:'9px 10px' }}>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{asset.name}</div>
                <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>
                  {asset.times_used > 0 ? `${asset.times_used} usos` : 'Não usado ainda'}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:5 }}>
                  {asset.tags.slice(0,2).map(t => (
                    <span key={t} style={{ fontSize:9, padding:'1px 6px', borderRadius:99,
                      background:'var(--brand-light)', color:'var(--brand-dark)' }}>{t}</span>
                  ))}
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
