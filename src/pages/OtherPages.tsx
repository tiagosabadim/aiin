import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { generateBrandDNA } from '../lib/api'
import type { BrandProfile, Workspace, ColorSwatch, Slogan } from '../types/database'

// ============================================================
//  InsightsPage
// ============================================================
export function InsightsPage() {
  const stats = [
    { label:'Alcance total',     value:'84.2k', delta:'↑ 18%',   up:true  },
    { label:'Engajamento médio', value:'6.4%',  delta:'↑ 1.2pp', up:true  },
    { label:'Novos seguidores',  value:'+1.340',delta:'↑ 32%',   up:true  },
    { label:'Score IA médio',    value:'7.8/10',delta:'↑ 0.9pts',up:true  },
  ]
  return (
    <div style={{ padding:'28px 32px' }}>
      <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Insights</h1>
      <p style={{ fontSize:14, color:'var(--text-2)', marginBottom:24 }}>Últimos 30 dias · análise automática da IA</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:5 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:500, color:'var(--text-1)', lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:11, marginTop:5, color: s.up ? 'var(--brand)' : 'var(--red)' }}>{s.delta}</div>
          </div>
        ))}
      </div>
      <div style={{ border:'1px solid rgba(61,90,62,.2)', borderRadius:'var(--radius-lg)', padding:'14px 16px', background:'var(--brand-light)' }}>
        <div style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)', marginBottom:6 }}>✦ Insights disponíveis após publicação</div>
        <div style={{ fontSize:12, color:'var(--brand-dark)', opacity:.8, lineHeight:1.6 }}>
          Conecte o Instagram e publique os primeiros posts para a IA começar a aprender quais conteúdos geram mais engajamento para sua marca.
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  DesignSystemPage — salva no Supabase
// ============================================================
export function DesignSystemPage({ brand, workspaceId, onSave }: { brand: BrandProfile; workspaceId: string; onSave: () => void }) {
  const logoRef  = useRef<HTMLInputElement>(null)
  const illusRef = useRef<HTMLInputElement>(null)

  const [colors, setColors] = useState<ColorSwatch[]>(brand.color_palette ?? [])
  const [slogans, setSlogans] = useState<Slogan[]>(brand.slogans ?? [])
  const [newSlogan, setNewSlogan] = useState('')
  const [editingSloganId, setEditingSloganId] = useState<number | null>(null)
  const [editSloganVal, setEditSloganVal] = useState('')
  const [titleFont, setTitleFont] = useState(brand.typography?.title ?? 'Georgia, serif')
  const [bodyFont,  setBodyFont]  = useState(brand.typography?.body  ?? 'DM Sans, sans-serif')
  const [designRules, setDesignRules] = useState(brand.design_rules ?? '')
  const [logoPreview, setLogoPreview] = useState<string | undefined>(brand.logo_urls?.primary)
  const [illustrations, setIllustrations] = useState<{ id:string; name:string; url:string }[]>([])
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [generatingDNA, setGeneratingDNA] = useState(false)

  const ROLES = ['Principal','Secundária','Destaque','Texto','Fundo','Outro']

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const preview = URL.createObjectURL(file)
    setLogoPreview(preview)
    const path = `${workspaceId}/logos/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('assets').getPublicUrl(path)
      await supabase.from('brand_profiles').update({ logo_urls: { ...brand.logo_urls, primary: data.publicUrl } }).eq('id', brand.id)
    }
  }

  const handleIllusUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      setIllustrations(prev => [...prev, { id: Date.now().toString() + Math.random(), name: file.name.replace(/\.[^.]+$/,''), url: URL.createObjectURL(file) }])
    })
    if (illusRef.current) illusRef.current.value = ''
  }

  const save = async () => {
    setSaving(true); setSaved(false)
    await supabase.from('brand_profiles').update({
      color_palette: colors,
      slogans,
      typography: { title: titleFont, body: bodyFont },
      design_rules: designRules,
    }).eq('id', brand.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    onSave()
  }

  const regenerateDNA = async () => {
    setGeneratingDNA(true)
    await save()
    await generateBrandDNA(brand.id)
    setGeneratingDNA(false)
    onSave()
  }

  return (
    <div style={{ padding:'28px 32px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Brand DNA</h1>
          <p style={{ fontSize:14, color:'var(--text-2)' }}>Identidade visual usada pela IA para criar posts coerentes</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={regenerateDNA} disabled={generatingDNA} style={btnOutline}>
            {generatingDNA ? '✦ Gerando DNA...' : '✦ Regenerar DNA'}
          </button>
          <button onClick={save} disabled={saving} style={{ ...btnP, ...(saved ? { background:'var(--brand-mid)' } : {}) }}>
            {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Logo */}
        <Section title="Logo" icon="★">
          <input ref={logoRef} type="file" accept="image/*,.svg" style={{ display:'none' }} onChange={handleLogoUpload} />
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div onClick={() => logoRef.current?.click()} style={{ width:100, height:80, borderRadius:'var(--radius-md)', border:`1px dashed ${logoPreview ? 'var(--brand)' : 'var(--border-md)'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden', background:'var(--surface-2)' }}>
              {logoPreview
                ? <img src={logoPreview} alt="logo" style={{ maxWidth:'90%', maxHeight:'90%', objectFit:'contain' }} />
                : <span style={{ fontSize:24, color:'var(--text-3)' }}>★</span>}
            </div>
            <div>
              <button onClick={() => logoRef.current?.click()} style={btnOutline}>↑ Subir logo</button>
              <div style={{ fontSize:11, color:'var(--text-3)', marginTop:6 }}>PNG ou SVG com fundo transparente</div>
            </div>
          </div>
        </Section>

        {/* Cores */}
        <Section title="Paleta de cores" icon="●">
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            {colors.map((c, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', background:'var(--surface-2)', borderRadius:'var(--radius-md)' }}>
                <input type="color" value={c.hex} onChange={e => setColors(prev => prev.map((x, j) => j === i ? { ...x, hex: e.target.value } : x))}
                  style={{ width:32, height:32, border:'none', borderRadius:8, cursor:'pointer', padding:0, flexShrink:0 }} />
                <input value={c.name} onChange={e => setColors(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  placeholder="Nome" style={{ ...inputSm, flex:1 }} />
                <select value={c.role} onChange={e => setColors(prev => prev.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}
                  style={{ ...inputSm, minWidth:100 }}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
                <span style={{ fontSize:11, fontFamily:'monospace', color:'var(--text-3)', minWidth:64 }}>{c.hex}</span>
                <button onClick={() => setColors(prev => prev.filter((_, j) => j !== i))} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:16 }}>×</button>
              </div>
            ))}
          </div>
          <button onClick={() => setColors(prev => [...prev, { name:'', hex:'#cccccc', role:'Outro' }])} style={btnOutline}>+ Adicionar cor</button>
        </Section>

        {/* Tipografia */}
        <Section title="Tipografia" icon="T">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Fonte de títulos</label>
              <input value={titleFont} onChange={e => setTitleFont(e.target.value)} style={inputFull} placeholder="ex: Georgia, serif" />
              <div style={{ fontFamily:titleFont, fontSize:20, marginTop:8, color:'var(--text-1)' }}>Título exemplo</div>
            </div>
            <div>
              <label style={lbl}>Fonte do corpo</label>
              <input value={bodyFont} onChange={e => setBodyFont(e.target.value)} style={inputFull} placeholder="ex: DM Sans, sans-serif" />
              <div style={{ fontFamily:bodyFont, fontSize:13, marginTop:8, color:'var(--text-2)', lineHeight:1.5 }}>Texto de exemplo para o corpo do post.</div>
            </div>
          </div>
        </Section>

        {/* Slogans */}
        <Section title="Slogans" icon="❝">
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
            {slogans.map((s, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', border:`1px solid ${s.active ? 'var(--brand)' : 'var(--border)'}`, borderRadius:'var(--radius-md)', background: s.active ? 'var(--brand-light)' : 'transparent', cursor:'pointer' }}
                onClick={() => setSlogans(prev => prev.map((x, j) => ({ ...x, active: j === i })))}>
                <div style={{ width:14, height:14, borderRadius:'50%', flexShrink:0, border:`1.5px solid ${s.active ? 'var(--brand)' : 'var(--border-md)'}`, background: s.active ? 'var(--brand)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {s.active && <div style={{ width:6, height:6, borderRadius:'50%', background:'white' }} />}
                </div>
                {editingSloganId === i ? (
                  <input value={editSloganVal} onChange={e => setEditSloganVal(e.target.value)} onClick={e => e.stopPropagation()} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { setSlogans(prev => prev.map((x, j) => j === i ? { ...x, text: editSloganVal } : x)); setEditingSloganId(null) }}}
                    style={{ ...inputSm, flex:1 }} />
                ) : (
                  <span style={{ flex:1, fontSize:13, color: s.active ? 'var(--brand-dark)' : 'var(--text-2)', fontWeight: s.active ? 500 : 400 }}>{s.text}</span>
                )}
                <button onClick={e => { e.stopPropagation(); setEditingSloganId(i); setEditSloganVal(s.text) }} style={iconBtnSm}>✎</button>
                <button onClick={e => { e.stopPropagation(); setSlogans(prev => prev.filter((_, j) => j !== i)) }} style={{ ...iconBtnSm, color:'var(--red)' }}>🗑</button>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={newSlogan} onChange={e => setNewSlogan(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newSlogan.trim()) { setSlogans(prev => [...prev, { text: newSlogan.trim(), active: false }]); setNewSlogan('') }}}
              placeholder="Novo slogan — Enter para adicionar" style={{ ...inputFull, flex:1 }} />
            <button onClick={() => { if (newSlogan.trim()) { setSlogans(prev => [...prev, { text: newSlogan.trim(), active: false }]); setNewSlogan('') }}} style={btnP}>+ Add</button>
          </div>
        </Section>

        {/* Regras de design */}
        <Section title="Regras para a IA" icon="✦">
          <label style={lbl}>Instruções de design que a IA deve seguir sempre</label>
          <textarea value={designRules} onChange={e => setDesignRules(e.target.value)} rows={4}
            style={{ ...inputFull, resize:'vertical' }}
            placeholder="ex: Artes minimalistas com muito espaço em branco. Textos pequenos e elegantes. Logo sempre no canto superior esquerdo. Evitar bordas carregadas. Usar sempre fotos reais ao invés de ilustrações." />
        </Section>

        {/* Ilustrações */}
        <Section title="Ilustrações e elementos" icon="◈" action={
          <div style={{ display:'flex', gap:6 }}>
            <input ref={illusRef} type="file" multiple accept="image/*,.svg" style={{ display:'none' }} onChange={handleIllusUpload} />
            <button onClick={() => illusRef.current?.click()} style={btnOutline}>↑ Subir SVG / PNG</button>
          </div>
        }>
          {illustrations.length === 0 ? (
            <div style={{ border:'1px dashed var(--border-md)', borderRadius:'var(--radius-lg)', padding:32, textAlign:'center', color:'var(--text-3)' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🖼</div>
              <div style={{ fontSize:13, marginBottom:4 }}>Nenhuma ilustração ainda</div>
              <div style={{ fontSize:12 }}>Adicione SVGs ou PNGs — texturas, ramos, elementos decorativos da marca</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
              {illustrations.map(ill => (
                <div key={ill.id} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
                  <div style={{ height:80, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <img src={ill.url} alt={ill.name} style={{ maxHeight:70, maxWidth:'90%', objectFit:'contain' }} />
                  </div>
                  <div style={{ padding:'6px 8px', fontSize:11, color:'var(--text-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ill.name}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}

// ============================================================
//  SettingsPage
// ============================================================
export function SettingsPage({ workspace, brand }: { workspace: Workspace; brand: BrandProfile }) {
  const [igToken,   setIgToken]   = useState(brand.instagram_access_token ?? '')
  const [igAccount, setIgAccount] = useState(brand.instagram_account_id  ?? '')
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  const save = async (key: string) => {
    if (key === 'instagram') {
      await supabase.from('brand_profiles').update({ instagram_access_token: igToken, instagram_account_id: igAccount }).eq('id', brand.id)
    }
    setSaved(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2500)
  }

  return (
    <div style={{ padding:'28px 32px', maxWidth:620 }}>
      <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Configurações</h1>
      <p style={{ fontSize:14, color:'var(--text-2)', marginBottom:28 }}>Integre o aiin com suas plataformas</p>

      {/* Instagram */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <span style={{ fontSize:20 }}>📸</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:500, color:'var(--text-1)' }}>Instagram Business</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>Conecte via Meta Graph API para publicação automática</div>
          </div>
          <span style={{ fontSize:11, padding:'3px 9px', borderRadius:99, fontWeight:500, background: igToken && igAccount ? '#EAF3DE' : 'var(--surface-2)', color: igToken && igAccount ? '#27500A' : 'var(--text-3)' }}>
            {igToken && igAccount ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div><label style={lbl}>Instagram Account ID</label><input value={igAccount} onChange={e => setIgAccount(e.target.value)} placeholder="123456789" style={inputFull} /></div>
          <div><label style={lbl}>Access Token (Meta Graph API)</label><input type="password" value={igToken} onChange={e => setIgToken(e.target.value)} placeholder="EAABs..." style={inputFull} /></div>
        </div>
        <button onClick={() => save('instagram')} style={{ ...btnP, marginTop:12, ...(saved.instagram ? { background:'var(--brand-mid)' } : {}) }}>
          {saved.instagram ? '✓ Salvo' : 'Salvar'}
        </button>
      </div>

      {/* Plano atual */}
      <div style={{ background:'var(--brand-light)', border:'1px solid rgba(61,90,62,.15)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }}>
        <div style={{ fontSize:14, fontWeight:500, color:'var(--brand-dark)', marginBottom:8 }}>✦ Plano atual — {workspace.name}</div>
        <div style={{ fontSize:12, color:'var(--brand-dark)', opacity:.8, lineHeight:1.6 }}>
          Para gerenciar assinatura, comprar créditos extras ou fazer upgrade do plano, entre em contato com o suporte.
        </div>
        <button style={{ ...btnOutline, marginTop:10, borderColor:'rgba(61,90,62,.3)', color:'var(--brand-dark)' }}>Falar com suporte →</button>
      </div>
    </div>
  )
}

// Sub-componente Section
function Section({ title, icon, action, children }: { title: string; icon: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', background:'var(--surface-2)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:14 }}>{icon}</span> {title}
        </div>
        {action}
      </div>
      <div style={{ padding:'16px' }}>{children}</div>
    </div>
  )
}

const btnP: React.CSSProperties = { background:'var(--brand)', color:'white', border:'none', borderRadius:'var(--radius-md)', padding:'8px 16px', fontSize:13, fontWeight:500, fontFamily:'var(--font-sans)', cursor:'pointer' }
const btnOutline: React.CSSProperties = { background:'transparent', color:'var(--text-2)', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', padding:'7px 14px', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }
const iconBtnSm: React.CSSProperties = { width:24, height:24, borderRadius:'var(--radius-md)', border:'1px solid var(--border-md)', background:'transparent', color:'var(--text-2)', fontSize:11, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-sans)', flexShrink:0 }
const inputSm: React.CSSProperties = { padding:'5px 8px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', fontSize:12, color:'var(--text-1)', background:'var(--surface)', fontFamily:'var(--font-sans)', outline:'none' }
const inputFull: React.CSSProperties = { width:'100%', padding:'8px 11px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--text-1)', background:'var(--surface)', fontFamily:'var(--font-sans)', outline:'none' }
const lbl: React.CSSProperties = { fontSize:11, color:'var(--text-2)', display:'block', marginBottom:4 }
