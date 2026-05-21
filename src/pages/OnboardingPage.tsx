import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getOrCreateWorkspace, generateBrandDNA } from '../lib/api'

type Step = 1 | 2 | 3 | 4 | 5

const TONES = ['Descontraído e próximo', 'Profissional e sério', 'Inspirador e motivacional', 'Divertido e jovem', 'Luxuoso e exclusivo', 'Educativo e informativo']
const OBJECTIVES = ['Atrair novos clientes', 'Fidelizar clientes atuais', 'Lançar produto/serviço', 'Aumentar reconhecimento da marca', 'Gerar vendas diretas']
const SEGMENTS = ['Clínica de estética', 'Salão de beleza', 'Barbearia', 'Restaurante / Food', 'Loja local', 'Infoprodutor', 'Prestador de serviços', 'Imobiliária', 'Academia / Pilates', 'Saúde (nutricionista, psicólogo, dentista)', 'Outro']

export function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 — Workspace + marca
  const [workspaceName, setWorkspaceName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [segment, setSegment] = useState('')
  const [city, setCity] = useState('')

  // Step 2 — Público e voz
  const [audience, setAudience] = useState('')
  const [objective, setObjective] = useState(OBJECTIVES[0])
  const [tone, setTone] = useState(TONES[0])
  const [products, setProducts] = useState('')
  const [forbiddenWords, setForbiddenWords] = useState('')

  // Step 3 — Identidade visual
  const [colors, setColors] = useState([
    { name: 'Principal', hex: '#000000' },
    { name: 'Secundária', hex: '#ffffff' },
  ])
  const [slogan, setSlogan] = useState('')
  const [designRules, setDesignRules] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')

  // Step 4 — Upload de assets
  const logoRef = useRef<HTMLInputElement>(null)
  const assetsRef = useRef<HTMLInputElement>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [assetFiles, setAssetFiles] = useState<File[]>([])
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // IDs criados
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleAssetsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setAssetFiles(prev => [...prev, ...files])
  }

  // STEP 1 → 2: cria workspace e brand_profile
  const saveStep1 = async () => {
    if (!user || !brandName || !workspaceName) return
    setLoading(true); setError(null)
    try {
      const ws = await getOrCreateWorkspace(user.id, workspaceName)
      setWorkspaceId(ws.id)

      // Cria brand_profile
      const { data: brand, error: bErr } = await supabase
        .from('brand_profiles')
        .insert({ workspace_id: ws.id, name: brandName, segment, city })
        .select().single()
      if (bErr) throw bErr
      setBrandId(brand.id)
      setStep(2)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally { setLoading(false) }
  }

  // STEP 2 → 3: salva público e voz
  const saveStep2 = async () => {
    if (!brandId) return
    setLoading(true); setError(null)
    try {
      await supabase.from('brand_profiles').update({
        target_audience: audience,
        main_objective: objective,
        tone_of_voice: tone,
        products,
        forbidden_words: forbiddenWords.split(',').map(w => w.trim()).filter(Boolean),
      }).eq('id', brandId)
      setStep(3)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally { setLoading(false) }
  }

  // STEP 3 → 4: salva identidade visual
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally { setLoading(false) }
  }

  // STEP 4 → 5: upload de assets
  const saveStep4 = async () => {
    if (!brandId || !workspaceId) return
    setLoading(true); setError(null)
    try {
      // Upload da logo
      if (logoFile) {
        const path = `${workspaceId}/logos/${Date.now()}_${logoFile.name}`
        const { error: upErr } = await supabase.storage.from('assets').upload(path, logoFile, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
          await supabase.from('brand_profiles').update({ logo_urls: { primary: urlData.publicUrl } }).eq('id', brandId)
          await supabase.from('brand_assets').insert({
            workspace_id: workspaceId, brand_id: brandId,
            name: 'Logo principal', storage_path: path,
            public_url: urlData.publicUrl, asset_type: 'logo', category: 'identidade',
          })
        }
      }

      // Upload dos outros assets
      for (const file of assetFiles) {
        const path = `${workspaceId}/assets/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
          await supabase.from('brand_assets').insert({
            workspace_id: workspaceId, brand_id: brandId,
            name: file.name.replace(/\.[^.]+$/, ''),
            storage_path: path, public_url: urlData.publicUrl,
            asset_type: 'foto_produto', category: 'produto',
          })
        }
      }
      setStep(5)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally { setLoading(false) }
  }

  // STEP 5: gera Brand DNA e finaliza
  const finishOnboarding = async () => {
    if (!brandId || !workspaceId) return
    setLoading(true); setError(null)
    try {
      await generateBrandDNA(brandId)
      await supabase.from('brand_profiles').update({ onboarding_completed: true, ai_context_pct: 75 }).eq('id', brandId)

      // Cria subscription de teste (free trial)
      const { data: freePlan } = await supabase.from('plans').select('id').eq('name', 'Presença').single()
      if (freePlan) {
        await supabase.from('subscriptions').insert({
          workspace_id: workspaceId,
          plan_id: freePlan.id,
          status: 'trialing',
          monthly_credits_available: 10,
          extra_credits_available: 0,
        })
      }
      onComplete()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally { setLoading(false) }
  }

  const steps = ['Sua marca', 'Público e voz', 'Identidade visual', 'Uploads', 'Brand DNA']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: 'white', fontSize: 20 }}>★</span>
          </div>
          <div style={{ fontSize: 22, fontFamily: 'var(--font-serif)', color: 'var(--text-1)' }}>Configurando sua marca</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>Preencha uma vez. A IA vai aprender tudo sobre você.</div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, gap: 0 }}>
          {steps.map((label, i) => {
            const n = i + 1; const active = step === n; const done = step > n
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500,
                    background: done || active ? 'var(--brand)' : 'var(--surface-2)',
                    color: done || active ? 'white' : 'var(--text-3)' }}>
                    {done ? '✓' : n}
                  </div>
                  <span style={{ fontSize: 10, color: active ? 'var(--text-1)' : 'var(--text-3)', whiteSpace: 'nowrap', fontWeight: active ? 500 : 400 }}>{label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: done ? 'var(--brand)' : 'var(--border)', margin: '0 6px', marginBottom: 16 }} />
                )}
              </div>
            )
          })}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '28px 32px' }}>

          {/* STEP 1 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>Sobre seu negócio</div>
              <Field label="Nome do workspace (seu nome ou agência)">
                <input style={inp} value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="ex: Studio da Ana" />
              </Field>
              <Field label="Nome da marca *">
                <input style={inp} value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="ex: Clínica Bella" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Segmento">
                  <select style={inp} value={segment} onChange={e => setSegment(e.target.value)}>
                    <option value="">Selecione...</option>
                    {SEGMENTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Cidade">
                  <input style={inp} value={city} onChange={e => setCity(e.target.value)} placeholder="ex: São Paulo - SP" />
                </Field>
              </div>
              {error && <ErrBox msg={error} />}
              <button onClick={saveStep1} disabled={!brandName || !workspaceName || loading} style={{ ...btnP, opacity: (!brandName || !workspaceName) ? .5 : 1 }}>
                {loading ? 'Salvando...' : 'Continuar →'}
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>Público e comunicação</div>
              <Field label="Público-alvo">
                <input style={inp} value={audience} onChange={e => setAudience(e.target.value)} placeholder="ex: Mulheres 25-45 anos, interessadas em estética" />
              </Field>
              <Field label="Objetivo principal">
                <select style={inp} value={objective} onChange={e => setObjective(e.target.value)}>
                  {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Tom de voz">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TONES.map(t => (
                    <button key={t} onClick={() => setTone(t)} style={{
                      padding: '8px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      border: `1px solid ${tone === t ? 'var(--brand)' : 'var(--border-md)'}`,
                      borderRadius: 'var(--radius-md)', textAlign: 'left',
                      background: tone === t ? 'var(--brand-light)' : 'transparent',
                      color: tone === t ? 'var(--brand-dark)' : 'var(--text-2)',
                      fontWeight: tone === t ? 500 : 400,
                    }}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Produtos / serviços principais">
                <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={products} onChange={e => setProducts(e.target.value)} placeholder="ex: Limpeza de pele, botox, preenchimento labial" />
              </Field>
              <Field label="Palavras proibidas (separadas por vírgula)">
                <input style={inp} value={forbiddenWords} onChange={e => setForbiddenWords(e.target.value)} placeholder="ex: barato, promoção genérica, urgente" />
              </Field>
              {error && <ErrBox msg={error} />}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(1)} style={btnS}>← Voltar</button>
                <button onClick={saveStep2} disabled={loading} style={btnP}>{loading ? 'Salvando...' : 'Continuar →'}</button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>Identidade visual</div>
              <Field label="Cores da marca">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colors.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="color" value={c.hex} onChange={e => setColors(prev => prev.map((x, j) => j === i ? { ...x, hex: e.target.value } : x))}
                        style={{ width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }} />
                      <input style={{ ...inp, flex: 1 }} value={c.name} onChange={e => setColors(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Nome da cor" />
                      {colors.length > 1 && (
                        <button onClick={() => setColors(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setColors(prev => [...prev, { name: '', hex: '#cccccc' }])} style={{ ...btnS, alignSelf: 'flex-start' }}>+ Adicionar cor</button>
                </div>
              </Field>
              <Field label="Slogan da marca">
                <input style={inp} value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="ex: Beleza que transforma" />
              </Field>
              <Field label="Regras de design (instrução para a IA)">
                <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={designRules} onChange={e => setDesignRules(e.target.value)}
                  placeholder="ex: Artes minimalistas, muito espaço em branco, textos pequenos e elegantes, evitar bordas carregadas" />
              </Field>
              <Field label="@Instagram da marca">
                <input style={inp} value={instagramHandle} onChange={e => setInstagramHandle(e.target.value)} placeholder="@suamarca" />
              </Field>
              {error && <ErrBox msg={error} />}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(2)} style={btnS}>← Voltar</button>
                <button onClick={saveStep3} disabled={loading} style={btnP}>{loading ? 'Salvando...' : 'Continuar →'}</button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>Uploads da marca</div>

              {/* Logo */}
              <Field label="Logo (PNG ou SVG com fundo transparente)">
                <input ref={logoRef} type="file" accept="image/*,.svg" style={{ display: 'none' }} onChange={handleLogoSelect} />
                <div onClick={() => logoRef.current?.click()} style={{
                  border: `1px dashed ${logoPreview ? 'var(--brand)' : 'var(--border-md)'}`,
                  borderRadius: 'var(--radius-lg)', height: 100, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', overflow: 'hidden',
                  background: logoPreview ? 'var(--brand-light)' : 'transparent',
                }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="logo" style={{ maxHeight: 80, maxWidth: '90%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: 13, color: 'var(--text-3)' }}>+ Clique para subir a logo</span>
                  }
                </div>
              </Field>

              {/* Fotos e referências */}
              <Field label="Fotos de produtos, equipe e referências visuais">
                <input ref={assetsRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleAssetsSelect} />
                <div onClick={() => assetsRef.current?.click()} style={{
                  border: '1px dashed var(--border-md)', borderRadius: 'var(--radius-lg)',
                  padding: 16, cursor: 'pointer', textAlign: 'center', color: 'var(--text-3)', fontSize: 13,
                }}>
                  {assetFiles.length > 0
                    ? <span style={{ color: 'var(--brand-dark)', fontWeight: 500 }}>{assetFiles.length} arquivo{assetFiles.length > 1 ? 's' : ''} selecionado{assetFiles.length > 1 ? 's' : ''} ✓</span>
                    : <span>+ Clique para subir fotos (você pode adicionar mais depois)</span>
                  }
                </div>
                {assetFiles.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {assetFiles.slice(0, 6).map((f, i) => (
                      <div key={i} style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                    {assetFiles.length > 6 && <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-3)' }}>+{assetFiles.length - 6}</div>}
                  </div>
                )}
              </Field>

              <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                💡 Quanto mais fotos você subir, mais a IA vai entender o estilo visual da sua marca.
              </div>

              {error && <ErrBox msg={error} />}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(3)} style={btnS}>← Voltar</button>
                <button onClick={saveStep4} disabled={loading} style={btnP}>{loading ? 'Enviando...' : 'Continuar →'}</button>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 4 }}>✦</div>
              <div style={{ fontSize: 18, fontFamily: 'var(--font-serif)', color: 'var(--text-1)' }}>Gerando seu Brand DNA</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
                A IA está analisando tudo que você informou para criar o DNA da sua marca. A partir de agora, cada post gerado vai seguir sua identidade visual e comunicação.
              </div>
              <div style={{ background: 'var(--brand-light)', border: '1px solid rgba(61,90,62,.2)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--brand-dark)', marginBottom: 8 }}>O aiin vai aprender com você</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['Tom de voz e estilo de comunicação', 'Paleta de cores e identidade visual', 'Produtos, serviços e público', 'Regras e preferências de design', 'Aprendizados a cada aprovação'].map(item => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--brand-dark)' }}>
                      <span>✓</span><span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              {error && <ErrBox msg={error} />}
              <button onClick={finishOnboarding} disabled={loading} style={btnP}>
                {loading ? 'Criando Brand DNA...' : '✦ Criar meu Brand DNA e começar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '9px 12px', background: 'var(--red-light)', border: '1px solid rgba(192,57,43,.2)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--red)' }}>{msg}</div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-1)', background: 'var(--surface)', fontFamily: 'var(--font-sans)', outline: 'none' }
const btnP: React.CSSProperties = { flex: 1, background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 20px', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer' }
const btnS: React.CSSProperties = { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)', padding: '10px 16px', fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer' }
