import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getOrCreateWorkspace, generateBrandDNA } from '../lib/api'

type Step = 1 | 2 | 3 | 4 | 5

const TONES = ['Descontraído e próximo','Profissional e sério','Inspirador e motivacional','Divertido e jovem','Luxuoso e exclusivo','Educativo e informativo']
const OBJECTIVES = ['Atrair novos clientes','Fidelizar clientes atuais','Lançar produto/serviço','Aumentar reconhecimento','Gerar vendas diretas']
const SEGMENTS = ['Clínica de estética','Salão de beleza','Barbearia','Restaurante / Food','Loja local','Infoprodutor','Prestador de serviços','Imobiliária','Academia / Pilates','Saúde','Moda / Brechó','Outro']

export function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth()
  const [step, setStep]     = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [workspaceName, setWorkspaceName] = useState('')
  const [brandName, setBrandName]         = useState('')
  const [segment, setSegment]             = useState('')
  const [city, setCity]                   = useState('')
  const [audience, setAudience]           = useState('')
  const [objective, setObjective]         = useState(OBJECTIVES[0])
  const [tone, setTone]                   = useState(TONES[0])
  const [products, setProducts]           = useState('')
  const [forbiddenWords, setForbiddenWords] = useState('')
  const [colors, setColors] = useState([{ name:'Principal', hex:'#7B2CFF' }, { name:'Secundária', hex:'#F72585' }])
  const [slogan, setSlogan]               = useState('')
  const [designRules, setDesignRules]     = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')

  const logoRef   = useRef<HTMLInputElement>(null)
  const assetsRef = useRef<HTMLInputElement>(null)
  const [logoFile, setLogoFile]     = useState<File | null>(null)
  const [assetFiles, setAssetFiles] = useState<File[]>([])
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [brandId, setBrandId]         = useState<string | null>(null)

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const saveStep1 = async () => {
    if (!user || !brandName || !workspaceName) return
    setLoading(true); setError(null)
    try {
      const ws = await getOrCreateWorkspace(user.id, workspaceName)
      setWorkspaceId(ws.id)
      const { data: brand, error: bErr } = await supabase.from('brand_profiles')
        .insert({ workspace_id: ws.id, name: brandName, segment, city })
        .select().single()
      if (bErr) throw bErr
      setBrandId(brand.id)
      setStep(2)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  const saveStep2 = async () => {
    if (!brandId) return
    setLoading(true); setError(null)
    try {
      await supabase.from('brand_profiles').update({
        target_audience: audience, main_objective: objective, tone_of_voice: tone,
        products, forbidden_words: forbiddenWords.split(',').map(w => w.trim()).filter(Boolean),
      }).eq('id', brandId)
      setStep(3)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  const saveStep3 = async () => {
    if (!brandId) return
    setLoading(true); setError(null)
    try {
      await supabase.from('brand_profiles').update({
        color_palette: colors,
        slogans: slogan ? [{ text: slogan, active: true }] : [],
        design_rules: designRules,
        instagram_handle: instagramHandle,
      }).eq('id', brandId)
      setStep(4)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  const saveStep4 = async () => {
    if (!brandId || !workspaceId) return
    setLoading(true); setError(null)
    try {
      if (logoFile) {
        const path = `${workspaceId}/logos/${Date.now()}_${logoFile.name}`
        const { error: upErr } = await supabase.storage.from('assets').upload(path, logoFile, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
          await supabase.from('brand_profiles').update({ logo_urls: { primary: urlData.publicUrl } }).eq('id', brandId)
          await supabase.from('brand_assets').insert({ workspace_id: workspaceId, brand_id: brandId, name:'Logo principal', storage_path: path, public_url: urlData.publicUrl, asset_type:'logo', category:'identidade' })
        }
      }
      for (const file of assetFiles) {
        const path = `${workspaceId}/assets/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
          await supabase.from('brand_assets').insert({ workspace_id: workspaceId, brand_id: brandId, name: file.name.replace(/\.[^.]+$/, ''), storage_path: path, public_url: urlData.publicUrl, asset_type:'foto_produto', category:'produto' })
        }
      }
      setStep(5)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  const finishOnboarding = async () => {
    if (!brandId || !workspaceId) return
    setLoading(true); setError(null)
    try {
      await generateBrandDNA(brandId)
      await supabase.from('brand_profiles').update({ onboarding_completed: true, ai_context_pct: 75 }).eq('id', brandId)
      const { data: freePlan } = await supabase.from('plans').select('id').eq('name', 'Presença').single()
      if (freePlan) {
        await supabase.from('subscriptions').insert({ workspace_id: workspaceId, plan_id: freePlan.id, status:'trialing', monthly_credits_available: 10, extra_credits_available: 0 })
      }
      onComplete()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  const STEPS = ['Sua marca','Público','Visual','Uploads','Brand DNA']

  return (
    <div style={{ height:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ width:'100%', maxWidth:680 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'var(--gradient)', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:10, fontSize:18, color:'white', boxShadow:'0 6px 16px rgba(247,37,133,.3)' }}>✦</div>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--text-1)', letterSpacing:'-.3px', marginBottom:4 }}>
            Configurar <span style={{ background:'var(--gradient)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>sua marca</span>
          </div>
          <div style={{ fontSize:12, color:'var(--text-3)' }}>Preencha uma vez. A IA aprende e cria com sua identidade.</div>
        </div>

        {/* Steps */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:28 }}>
          {STEPS.map((label, i) => {
            const n = i+1; const active = step === n; const done = step > n
            return (
              <div key={label} style={{ display:'flex', alignItems:'center', flex: i < STEPS.length-1 ? 1 : 'none' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, transition:'all .2s',
                    background: done||active ? 'var(--gradient)' : 'var(--surface-3)',
                    color: done||active ? 'white' : 'var(--text-4)',
                    boxShadow: active ? '0 0 0 4px rgba(247,37,133,.15)' : 'none',
                  }}>{done ? '✓' : n}</div>
                  <span style={{ fontSize:9, color: active ? 'var(--text-1)' : 'var(--text-4)', whiteSpace:'nowrap', fontWeight: active ? 600 : 400, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</span>
                </div>
                {i < STEPS.length-1 && (
                  <div style={{ flex:1, height:1, margin:'0 6px 14px', background: done ? 'var(--gradient)' : 'var(--border)', transition:'background .3s' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="card" style={{ padding:'28px 32px' }}>

          {/* STEP 1 */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:16, fontWeight:600, color:'var(--text-1)', marginBottom:4 }}>Sobre seu negócio</div>
              <div>
                <label className="label">Seu nome ou nome do workspace *</label>
                <input className="input" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="ex: Studio da Ana, Agência XYZ" />
              </div>
              <div>
                <label className="label">Nome da marca *</label>
                <input className="input" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="ex: Clínica Bella, Brechó Verde" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="label">Segmento</label>
                  <select className="input" value={segment} onChange={e => setSegment(e.target.value)}>
                    <option value="">Selecione...</option>
                    {SEGMENTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Cidade</label>
                  <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="ex: São Paulo - SP" />
                </div>
              </div>
              {error && <div style={{ padding:'10px 12px', background:'var(--red-light)', border:'1px solid rgba(226,75,74,.2)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--red)' }}>{error}</div>}
              <button className="btn btn-primary" style={{ marginTop:4 }} onClick={saveStep1} disabled={!brandName || !workspaceName || loading}>
                {loading ? 'Salvando...' : 'Continuar →'}
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <div style={{ fontSize:16, fontWeight:600, color:'var(--text-1)', marginBottom:16 }}>Público e comunicação</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <label className="label">Público-alvo</label>
                    <input className="input" value={audience} onChange={e => setAudience(e.target.value)} placeholder="ex: Mulheres 25-45, interessadas em moda sustentável" />
                  </div>
                  <div>
                    <label className="label">Objetivo principal</label>
                    <select className="input" value={objective} onChange={e => setObjective(e.target.value)}>
                      {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Produtos / serviços principais</label>
                    <textarea className="input" value={products} onChange={e => setProducts(e.target.value)} rows={3} style={{ resize:'none' }} placeholder="ex: Limpeza de pele, botox, preenchimento labial" />
                  </div>
                  <div>
                    <label className="label">Palavras proibidas (separadas por vírgula)</label>
                    <input className="input" value={forbiddenWords} onChange={e => setForbiddenWords(e.target.value)} placeholder="ex: barato, promoção genérica" />
                  </div>
                </div>
                <div>
                  <label className="label">Tom de voz</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {TONES.map(t => (
                      <button key={t} onClick={() => setTone(t)} style={{ padding:'10px 12px', fontSize:12.5, cursor:'pointer', fontFamily:'var(--font-sans)', border:`1px solid ${tone===t ? 'rgba(247,37,133,.4)' : 'var(--border-md)'}`, borderRadius:'var(--radius-md)', textAlign:'left', background: tone===t ? 'var(--gradient-soft)' : 'transparent', color: tone===t ? 'var(--text-1)' : 'var(--text-3)', fontWeight: tone===t ? 500 : 400, transition:'all .15s' }}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
              {error && <div style={{ marginTop:12, padding:'10px 12px', background:'var(--red-light)', border:'1px solid rgba(226,75,74,.2)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--red)' }}>{error}</div>}
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button className="btn btn-ghost" onClick={() => setStep(1)}>← Voltar</button>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={saveStep2} disabled={loading}>{loading ? 'Salvando...' : 'Continuar →'}</button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:16, fontWeight:600, color:'var(--text-1)', marginBottom:4 }}>Identidade visual</div>
              <div>
                <label className="label">Cores da marca</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {colors.map((c, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="color" value={c.hex} onChange={e => setColors(prev => prev.map((x,j) => j===i ? { ...x, hex: e.target.value } : x))}
                        style={{ width:40, height:40, border:'none', borderRadius:10, cursor:'pointer', padding:0, flexShrink:0 }} />
                      <input className="input" value={c.name} onChange={e => setColors(prev => prev.map((x,j) => j===i ? { ...x, name: e.target.value } : x))} placeholder="Nome da cor" />
                      {colors.length > 1 && <button onClick={() => setColors(prev => prev.filter((_,j) => j!==i))} style={{ background:'none', border:'none', color:'var(--text-4)', cursor:'pointer', fontSize:18 }}>×</button>}
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ alignSelf:'flex-start' }} onClick={() => setColors(prev => [...prev, { name:'', hex:'#cccccc' }])}>+ Adicionar cor</button>
                </div>
              </div>
              <div>
                <label className="label">Slogan</label>
                <input className="input" value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="ex: Crie. Publique. Cresça." />
              </div>
              <div>
                <label className="label">Regras de design para a IA</label>
                <textarea className="input" value={designRules} onChange={e => setDesignRules(e.target.value)} rows={3} style={{ resize:'vertical' }}
                  placeholder="ex: Artes minimalistas, muito respiro, textos pequenos e elegantes, evitar bordas carregadas" />
              </div>
              <div>
                <label className="label">@Instagram</label>
                <input className="input" value={instagramHandle} onChange={e => setInstagramHandle(e.target.value)} placeholder="@suamarca" />
              </div>
              {error && <div style={{ padding:'10px 12px', background:'var(--red-light)', border:'1px solid rgba(226,75,74,.2)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--red)' }}>{error}</div>}
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-ghost" onClick={() => setStep(2)}>← Voltar</button>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={saveStep3} disabled={loading}>{loading ? 'Salvando...' : 'Continuar →'}</button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ fontSize:16, fontWeight:600, color:'var(--text-1)', marginBottom:4 }}>Uploads da marca</div>
              <input ref={logoRef} type="file" accept="image/*,.svg" style={{ display:'none' }} onChange={handleLogoSelect} />
              <input ref={assetsRef} type="file" multiple accept="image/*" style={{ display:'none' }} onChange={e => setAssetFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])} />

              <div>
                <label className="label">Logo (PNG ou SVG com fundo transparente)</label>
                <div onClick={() => logoRef.current?.click()} style={{ border:`1px dashed ${logoPreview ? 'rgba(247,37,133,.4)' : 'var(--border-md)'}`, borderRadius:'var(--radius-lg)', height:100, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden', background: logoPreview ? 'var(--gradient-soft)' : 'transparent', transition:'all .15s' }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="logo" style={{ maxHeight:80, maxWidth:'90%', objectFit:'contain' }} />
                    : <span style={{ fontSize:13, color:'var(--text-4)' }}>+ Clique para subir a logo</span>
                  }
                </div>
              </div>

              <div>
                <label className="label">Fotos, produtos e referências visuais</label>
                <div onClick={() => assetsRef.current?.click()} style={{ border:'1px dashed var(--border-md)', borderRadius:'var(--radius-lg)', padding:16, cursor:'pointer', textAlign:'center', color:'var(--text-4)', fontSize:13, transition:'all .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor='rgba(247,37,133,.3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor='var(--border-md)'}>
                  {assetFiles.length > 0
                    ? <span style={{ color:'var(--accent-pink)', fontWeight:500 }}>{assetFiles.length} arquivo{assetFiles.length>1?'s':''} selecionado{assetFiles.length>1?'s':''} ✓</span>
                    : '+ Clique para subir fotos (pode adicionar mais depois)'}
                </div>
                {assetFiles.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                    {assetFiles.slice(0,6).map((f,i) => (
                      <div key={i} style={{ width:52, height:52, borderRadius:8, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <img src={URL.createObjectURL(f)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      </div>
                    ))}
                    {assetFiles.length > 6 && <div style={{ width:52, height:52, borderRadius:8, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'var(--text-3)', border:'1px solid var(--border)' }}>+{assetFiles.length-6}</div>}
                  </div>
                )}
              </div>

              <div style={{ padding:'10px 12px', background:'var(--gradient-soft)', border:'1px solid rgba(247,37,133,.12)', borderRadius:'var(--radius-md)', fontSize:12, color:'var(--text-2)' }}>
                💡 Quanto mais fotos você subir, mais a IA entende o estilo visual da sua marca.
              </div>

              {error && <div style={{ padding:'10px 12px', background:'var(--red-light)', border:'1px solid rgba(226,75,74,.2)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--red)' }}>{error}</div>}
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-ghost" onClick={() => setStep(3)}>← Voltar</button>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={saveStep4} disabled={loading}>{loading ? 'Enviando...' : 'Continuar →'}</button>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16, textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:4 }}>
                <span style={{ background:'var(--gradient)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>✦</span>
              </div>
              <div style={{ fontSize:18, fontWeight:700, color:'var(--text-1)', letterSpacing:'-.2px' }}>Gerando seu Brand DNA</div>
              <div style={{ fontSize:14, color:'var(--text-3)', lineHeight:1.6 }}>
                A IA está analisando tudo para criar o DNA da sua marca. A partir de agora, cada post vai seguir sua identidade visual e tom de comunicação.
              </div>
              <div className="card-gradient" style={{ textAlign:'left' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-1)', marginBottom:10 }}>A IA vai aprender com você</div>
                {['Tom de voz e estilo de comunicação','Paleta de cores e identidade visual','Produtos, serviços e público','Regras e preferências de design','Aprendizados a cada aprovação'].map(item => (
                  <div key={item} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-2)', marginBottom:6 }}>
                    <span style={{ color:'var(--accent-pink)' }}>✓</span> {item}
                  </div>
                ))}
              </div>
              {error && <div style={{ padding:'10px 12px', background:'var(--red-light)', border:'1px solid rgba(226,75,74,.2)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--red)' }}>{error}</div>}
              <button className="btn btn-primary btn-lg" onClick={finishOnboarding} disabled={loading} style={{ marginTop:4 }}>
                {loading
                  ? <><span className="spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }} /> Criando Brand DNA...</>
                  : '✦ Criar meu Brand DNA e começar'
                }
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
