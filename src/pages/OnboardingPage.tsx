// aiin · OnboardingPage v5
// Split: esquerda ilustração, direita form com scroll
// Botão flutuante, validação com feedback, dados pré-carregados
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getOrCreateWorkspace, generateBrandDNA } from '../lib/api'
import { VisualContextPage } from './VisualContextPage'

type Step = 1 | 2 | 3 | 4 | 5 | 6

const TONES = ['Descontraído e próximo','Profissional e sério','Inspirador e motivacional','Divertido e jovem','Luxuoso e exclusivo','Educativo e informativo']
const OBJECTIVES = ['Atrair novos clientes','Fidelizar clientes atuais','Lançar produto/serviço','Aumentar reconhecimento','Gerar vendas diretas']
const SEGMENTS = ['Clínica de estética','Salão de beleza','Barbearia','Restaurante / Food','Loja local','Infoprodutor','Prestador de serviços','Imobiliária','Academia / Pilates','Saúde','Moda / Brechó','Outro']

const STEPS = [
  { n: 1, label: 'Sua marca',  icon: '🏷' },
  { n: 2, label: 'Público',    icon: '👥' },
  { n: 3, label: 'Visual',     icon: '🎨' },
  { n: 4, label: 'Uploads',    icon: '📸' },
  { n: 5, label: 'Brand DNA',  icon: '✦'  },
  { n: 6, label: 'Validar',    icon: '✓'  },
]

// Ilustrações e textos por step
const STEP_CONTENT = [
  { title: 'Configure sua marca', sub: 'Preencha uma vez. A IA aprende e cria com sua identidade.', tip: 'A IA da aiin usa essas informações para criar conteúdos alinhados à sua marca.' },
  { title: 'Quem é seu público?', sub: 'Defina o público e o tom de comunicação da marca.', tip: 'Com essas informações a IA fala a língua certa para as pessoas certas.' },
  { title: 'Identidade visual', sub: 'Cores, slogan e regras que definem o estilo visual.', tip: 'Quanto mais preciso, mais consistente será cada post gerado.' },
  { title: 'Logo e referências', sub: 'Envie a logo e fotos que representam sua marca.', tip: 'A IA analisa suas imagens para manter o estilo em todas as artes.' },
  { title: 'Gerando seu Brand DNA', sub: 'A IA está analisando tudo para criar a identidade completa.', tip: 'A partir de agora cada post vai seguir sua identidade visual e tom.' },
  { title: 'Validar estilo visual', sub: 'Vamos garantir que a IA entendeu sua identidade.', tip: 'Aprove ou peça ajustes antes de começar a criar conteúdo.' },
]

export function OnboardingPage({ onComplete, initialStep, existingBrand, existingWorkspace }: {
  onComplete: () => void
  initialStep?: number
  existingBrand?: any
  existingWorkspace?: any
}) {
  const { user } = useAuth()
  const [step, setStep]       = useState<Step>((initialStep ?? 1) as Step)
  const [maxStep, setMaxStep] = useState<number>(initialStep ?? 1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [validationMsg, setValidationMsg] = useState<string | null>(null)

  const goTo   = (n: number) => { if (n <= maxStep) { setStep(n as Step); setError(null); setValidationMsg(null) } }
  const advance = (n: number) => { setStep(n as Step); setMaxStep(p => Math.max(p, n)); setError(null); setValidationMsg(null) }

  // Step 1
  const [workspaceName, setWorkspaceName] = useState(existingWorkspace?.name ?? '')
  const [brandName, setBrandName]         = useState(existingBrand?.name ?? '')
  const [segment, setSegment]             = useState(existingBrand?.segment ?? '')
  const [city, setCity]                   = useState(existingBrand?.city ?? '')

  // Step 2
  const [audience, setAudience]   = useState(existingBrand?.target_audience ?? '')
  const [objective, setObjective] = useState(existingBrand?.main_objective ?? OBJECTIVES[0])
  const [tone, setTone]           = useState(existingBrand?.tone_of_voice ?? TONES[0])
  const [products, setProducts]   = useState(existingBrand?.products ?? '')
  const [forbiddenWords, setForbiddenWords] = useState(existingBrand?.forbidden_words?.join(', ') ?? '')

  // Step 3
  const [colors, setColors] = useState(existingBrand?.color_palette?.length > 0 ? existingBrand.color_palette : [{ name: 'Principal', hex: '#7B2CFF' }, { name: 'Secundária', hex: '#F72585' }])
  const [slogan, setSlogan]             = useState(existingBrand?.slogans?.find((s: any) => s.active)?.text ?? '')
  const [designRules, setDesignRules]   = useState(existingBrand?.design_rules ?? '')
  const [instagramHandle, setInstagramHandle] = useState(existingBrand?.instagram_handle ?? '')

  // Step 4
  const logoRef   = useRef<HTMLInputElement>(null)
  const assetsRef = useRef<HTMLInputElement>(null)
  const [logoFile, setLogoFile]       = useState<File | null>(null)
  const [assetFiles, setAssetFiles]   = useState<File[]>([])
  const [logoPreview, setLogoPreview] = useState<string | null>(existingBrand?.logo_urls?.primary ?? null)

  // IDs
  const [workspaceId, setWorkspaceId] = useState<string | null>(existingWorkspace?.id ?? null)
  const [brandId, setBrandId]         = useState<string | null>(existingBrand?.id ?? null)
  const [brandData, setBrandData]     = useState<any>(existingBrand ?? null)

  const sc = STEP_CONTENT[(step as number) - 1]

  // Validação por step
  const validate = (): string | null => {
    if (step === 1) {
      if (!workspaceName.trim()) return 'Preencha o nome do workspace'
      if (!brandName.trim()) return 'Preencha o nome da marca'
    }
    if (step === 2) {
      if (!audience.trim()) return 'Preencha o público-alvo'
      if (!products.trim()) return 'Preencha os produtos ou serviços'
    }
    return null
  }

  const handleContinue = async () => {
    const msg = validate()
    if (msg) { setValidationMsg(msg); return }
    setValidationMsg(null)
    if (step === 1) await saveStep1()
    else if (step === 2) await saveStep2()
    else if (step === 3) await saveStep3()
    else if (step === 4) await saveStep4()
    else if (step === 5) await finishStep5()
  }

  const saveStep1 = async () => {
    if (!user) return
    setLoading(true); setError(null)
    try {
      const ws = await getOrCreateWorkspace(user.id, workspaceName)
      setWorkspaceId(ws.id)
      if (brandId) {
        await supabase.from('brand_profiles').update({ name: brandName, segment, city }).eq('id', brandId)
        setBrandData((p: any) => ({ ...p, name: brandName, segment, city }))
      } else {
        const { data: brand, error: bErr } = await supabase.from('brand_profiles')
          .insert({ workspace_id: ws.id, name: brandName, segment, city }).select().single()
        if (bErr) throw bErr
        setBrandId(brand.id); setBrandData(brand)
      }
      advance(2)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const saveStep2 = async () => {
    if (!brandId) return
    setLoading(true); setError(null)
    try {
      const upd = { target_audience: audience, main_objective: objective, tone_of_voice: tone, products, forbidden_words: forbiddenWords.split(',').map((w: string) => w.trim()).filter(Boolean) }
      await supabase.from('brand_profiles').update(upd).eq('id', brandId)
      setBrandData((p: any) => ({ ...p, ...upd })); advance(3)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const saveStep3 = async () => {
    if (!brandId) return
    setLoading(true); setError(null)
    try {
      const upd = { color_palette: colors, slogans: slogan ? [{ text: slogan, active: true }] : [], design_rules: designRules, instagram_handle: instagramHandle }
      await supabase.from('brand_profiles').update(upd).eq('id', brandId)
      setBrandData((p: any) => ({ ...p, ...upd })); advance(4)
    } catch (e: any) { setError(e.message) }
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
          await supabase.from('brand_assets').insert({ workspace_id: workspaceId, brand_id: brandId, name: 'Logo principal', storage_path: path, public_url: urlData.publicUrl, asset_type: 'logo', category: 'identidade' })
          setBrandData((p: any) => ({ ...p, logo_urls: { primary: urlData.publicUrl } }))
        }
      }
      for (const file of assetFiles) {
        const path = `${workspaceId}/assets/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
          await supabase.from('brand_assets').insert({ workspace_id: workspaceId, brand_id: brandId, name: file.name.replace(/\.[^.]+$/, ''), storage_path: path, public_url: urlData.publicUrl, asset_type: 'foto_produto', category: 'produto' })
        }
      }
      advance(5)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const finishStep5 = async () => {
    if (!brandId || !workspaceId) return
    setLoading(true); setError(null)
    try {
      await generateBrandDNA(brandId)
      await supabase.from('brand_profiles').update({ onboarding_completed: true, ai_context_pct: 75 }).eq('id', brandId)
      const { data: brand } = await supabase.from('brand_profiles').select('*').eq('id', brandId).single()
      setBrandData(brand)
      const { data: freePlan } = await supabase.from('plans').select('id').eq('name', 'Presença').single()
      if (freePlan) await supabase.from('subscriptions').insert({ workspace_id: workspaceId, plan_id: freePlan.id, status: 'trialing', monthly_credits_available: 10, extra_credits_available: 0 })
      advance(6)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  // Step 6 — VisualContext
  if (step === 6 && brandData && workspaceId) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#F4F5F7' }}>
        <OnboardingHeader step={6} maxStep={maxStep} goTo={goTo} />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <VisualContextPage workspace={{ id: workspaceId } as any} brand={brandData} onApprove={onComplete} />
        </div>
      </div>
    )
  }

  const isLast = step === 5
  const btnLabel = loading ? 'Salvando...' : isLast ? '✦ Criar meu Brand DNA' : 'Continuar →'
  const canAdvance = !validate()

  return (
    <div className="onboarding-root" style={{ height: '100vh', overflow: 'hidden', display: 'flex', background: '#fff' }}>

      {/* ESQUERDA — ilustração */}
      <div className="onboarding-left" style={{ flex: '0 0 42%', background: 'linear-gradient(145deg, #FFF0F8 0%, #F0EEFF 50%, #EEF6FF 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 36px', position: 'relative', overflow: 'hidden' }}>

        {/* Logo */}
        <div style={{ position: 'absolute', top: 24, left: 28, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white' }}>✦</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#070D1F', letterSpacing: '-.3px' }}>aiin</span>
        </div>

        {/* Ilustração central */}
        <div style={{ width: 280, height: 280, background: 'rgba(255,255,255,.6)', borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 60px rgba(123,44,255,.12)', marginBottom: 32, position: 'relative' }}>
          <div style={{ fontSize: 80 }}>
            {step === 1 ? '🏪' : step === 2 ? '👥' : step === 3 ? '🎨' : step === 4 ? '📸' : '✦'}
          </div>
          {/* Elementos flutuantes */}
          <div style={{ position: 'absolute', top: 16, right: 16, width: 48, height: 48, background: '#fff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>🎨</div>
          <div style={{ position: 'absolute', bottom: 20, left: 16, width: 42, height: 42, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>✦</div>
          <div style={{ position: 'absolute', top: 20, left: 14, width: 36, height: 36, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 4px 12px rgba(0,0,0,.06)' }}>T</div>
        </div>

        {/* Texto */}
        <div style={{ textAlign: 'center', maxWidth: 280 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#070D1F', letterSpacing: '-.3px', marginBottom: 8 }}>{sc.title}</h2>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 20 }}>{sc.sub}</p>
        </div>

        {/* Tip card */}
        <div style={{ background: 'rgba(255,255,255,.8)', borderRadius: 16, padding: '14px 18px', maxWidth: 280, backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', flexShrink: 0 }}>✦</div>
            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{sc.tip}</p>
          </div>
        </div>

        {/* Usuário logado */}
        {user && (
          <div style={{ position: 'absolute', bottom: 24, left: 28, right: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {user.email?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
            <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: '1px solid rgba(7,13,31,.15)', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              Sair
            </button>
          </div>
        )}
      </div>

      {/* DIREITA — form */}
      <div className="onboarding-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header com stepper */}
        <OnboardingHeader step={step} maxStep={maxStep} goTo={goTo} />

        {/* Form scrollável */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px 100px' }}>

          {/* STEP 1 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
              <SectionTitle icon="🏷" title="Sobre seu negócio" />
              <Field label="Seu nome ou nome do workspace *" icon="👤">
                <input className="input" value={workspaceName} onChange={e => { setWorkspaceName(e.target.value); setValidationMsg(null) }} placeholder="ex: Studio da Ana, Agência XYZ" />
              </Field>
              <Field label="Nome da marca *" icon="🏷">
                <input className="input" value={brandName} onChange={e => { setBrandName(e.target.value); setValidationMsg(null) }} placeholder="ex: Clínica Bella, Brechó Verde" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Segmento">
                  <select className="input" value={segment} onChange={e => setSegment(e.target.value)}>
                    <option value="">Selecione...</option>
                    {SEGMENTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Cidade" icon="📍">
                  <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="ex: São Paulo - SP" />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div style={{ maxWidth: 560 }}>
              <SectionTitle icon="👥" title="Público e comunicação" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label="Público-alvo *">
                    <input className="input" value={audience} onChange={e => { setAudience(e.target.value); setValidationMsg(null) }} placeholder="ex: Mulheres 25-45, moda sustentável" />
                  </Field>
                  <Field label="Objetivo principal">
                    <select className="input" value={objective} onChange={e => setObjective(e.target.value)}>
                      {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Produtos / serviços *">
                    <textarea className="input" value={products} onChange={e => { setProducts(e.target.value); setValidationMsg(null) }} rows={3} style={{ resize: 'none' }} placeholder="ex: Limpeza de pele, botox, preenchimento" />
                  </Field>
                  <Field label="Palavras proibidas">
                    <input className="input" value={forbiddenWords} onChange={e => setForbiddenWords(e.target.value)} placeholder="ex: barato, promoção genérica" />
                  </Field>
                </div>
                <Field label="Tom de voz">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {TONES.map(t => (
                      <button key={t} onClick={() => setTone(t)} style={{ padding: '10px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${tone === t ? 'rgba(247,37,133,.4)' : 'rgba(7,13,31,.1)'}`, borderRadius: 8, textAlign: 'left', background: tone === t ? 'rgba(247,37,133,.06)' : 'transparent', color: tone === t ? '#070D1F' : '#6B7280', fontWeight: tone === t ? 500 : 400 }}>{t}</button>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
              <SectionTitle icon="🎨" title="Identidade visual" />
              <Field label="Cores da marca">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colors.map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="color" value={c.hex} onChange={e => setColors((prev: any) => prev.map((x: any, j: number) => j === i ? { ...x, hex: e.target.value } : x))} style={{ width: 40, height: 40, border: 'none', borderRadius: 10, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                      <input className="input" value={c.name} onChange={e => setColors((prev: any) => prev.map((x: any, j: number) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Nome da cor" />
                      {colors.length > 1 && <button onClick={() => setColors((prev: any) => prev.filter((_: any, j: number) => j !== i))} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 18 }}>×</button>}
                    </div>
                  ))}
                  <button onClick={() => setColors((prev: any) => [...prev, { name: '', hex: '#cccccc' }])} style={{ alignSelf: 'flex-start', height: 32, padding: '0 12px', border: '1px solid rgba(7,13,31,.12)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151' }}>+ Adicionar cor</button>
                </div>
              </Field>
              <Field label="Slogan">
                <input className="input" value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="ex: Crie. Publique. Cresça." />
              </Field>
              <Field label="Regras de design para a IA">
                <textarea className="input" value={designRules} onChange={e => setDesignRules(e.target.value)} rows={3} style={{ resize: 'vertical' }} placeholder="ex: Artes minimalistas, muito respiro, textos pequenos e elegantes" />
              </Field>
              <Field label="@Instagram">
                <input className="input" value={instagramHandle} onChange={e => setInstagramHandle(e.target.value)} placeholder="@suamarca" />
              </Field>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
              <SectionTitle icon="📸" title="Logo e referências" />
              <input ref={logoRef} type="file" accept="image/*,.svg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)) } }} />
              <input ref={assetsRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => setAssetFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
              <Field label="Logo (PNG ou SVG com fundo transparente)">
                <div onClick={() => logoRef.current?.click()} style={{ border: `1.5px dashed ${logoPreview ? 'rgba(247,37,133,.4)' : 'rgba(7,13,31,.15)'}`, borderRadius: 14, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: logoPreview ? 'rgba(247,37,133,.03)' : '#F7F8FA' }}>
                  {logoPreview ? <img src={logoPreview} alt="logo" style={{ maxHeight: 80, maxWidth: '90%', objectFit: 'contain' }} /> : <span style={{ fontSize: 13, color: '#9CA3AF' }}>+ Clique para subir a logo</span>}
                </div>
              </Field>
              <Field label="Fotos, produtos e referências visuais">
                <div onClick={() => assetsRef.current?.click()} style={{ border: '1.5px dashed rgba(7,13,31,.12)', borderRadius: 14, padding: 16, cursor: 'pointer', textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F7F8FA' }}>
                  {assetFiles.length > 0 ? <span style={{ color: '#F72585', fontWeight: 500 }}>{assetFiles.length} arquivo{assetFiles.length > 1 ? 's' : ''} ✓</span> : '+ Clique para subir fotos (pode adicionar mais depois)'}
                </div>
                {assetFiles.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {assetFiles.slice(0, 6).map((f, i) => (
                      <div key={i} style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(7,13,31,.08)' }}>
                        <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </Field>
              <div style={{ padding: '10px 14px', background: 'rgba(247,37,133,.05)', border: '1px solid rgba(247,37,133,.12)', borderRadius: 10, fontSize: 12, color: '#374151' }}>
                💡 Quanto mais fotos você subir, mais a IA entende o estilo visual da sua marca.
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
              <SectionTitle icon="✦" title="Criando seu Brand DNA" />
              <div style={{ background: 'rgba(247,37,133,.04)', border: '1px solid rgba(247,37,133,.12)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#070D1F', marginBottom: 10 }}>A IA vai aprender com você</div>
                {['Tom de voz e estilo de comunicação', 'Paleta de cores e identidade visual', 'Produtos, serviços e público', 'Regras e preferências de design', 'Aprendizados a cada aprovação'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 8 }}>
                    <span style={{ color: '#F72585' }}>✓</span> {item}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Botão flutuante fixo no fundo */}
        <div className="onboarding-fab" style={{ position: 'absolute', bottom: 0, right: 0, left: '42%', background: 'linear-gradient(transparent, #fff 30%)', padding: '20px 40px 28px', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'all' }}>
            {validationMsg && (
              <div style={{ marginBottom: 10, padding: '8px 14px', background: '#FCEBEB', border: '1px solid rgba(226,75,74,.2)', borderRadius: 8, fontSize: 12, color: '#E24B4A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠</span> {validationMsg}
              </div>
            )}
            {error && (
              <div style={{ marginBottom: 10, padding: '8px 14px', background: '#FCEBEB', border: '1px solid rgba(226,75,74,.2)', borderRadius: 8, fontSize: 12, color: '#E24B4A' }}>{error}</div>
            )}
            <button
              onClick={handleContinue}
              disabled={loading}
              style={{ width: '100%', height: 52, background: loading ? '#e5e7eb' : 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 14, color: loading ? '#9CA3AF' : 'white', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: loading ? 'none' : '0 4px 20px rgba(247,37,133,.3)', transition: 'all .2s' }}
            >
              {loading && <div style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
              {btnLabel}
            </button>
            {step > 1 && (
              <button onClick={() => goTo((step - 1) as Step)} style={{ width: '100%', marginTop: 8, height: 36, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#9CA3AF' }}>
                ← Voltar
              </button>
            )}
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              🔒 Suas informações estão seguras com a aiin.
            </div>
          </div>
        </div>
      </div>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 768px) {
          .onboarding-root { flex-direction: column !important; height: auto !important; min-height: 100vh !important; overflow: auto !important; }
          .onboarding-left { flex: none !important; width: 100% !important; padding: 24px 20px 20px !important; min-height: auto !important; }
          .onboarding-left > div:nth-child(2) { display: none !important; } /* esconde ilustração grande */
          .onboarding-right { overflow: visible !important; }
          .onboarding-fab { position: fixed !important; left: 0 !important; right: 0 !important; padding: 12px 16px 24px !important; }
        }
      `}</style>
    </div>
  )
}

// ── Header com stepper ──────────────────────────────────────
function OnboardingHeader({ step, maxStep, goTo }: { step: number; maxStep: number; goTo: (n: number) => void }) {
  return (
    <div style={{ padding: '16px 40px', borderBottom: '1px solid rgba(7,13,31,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#fff' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>
        Etapa {step} de {STEPS.length}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {STEPS.map((s, i) => {
          const done = s.n < step
          const active = s.n === step
          const reachable = s.n <= maxStep
          return (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
              <div onClick={() => reachable && goTo(s.n)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: reachable ? 'pointer' : 'default', padding: '0 2px' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, transition: 'all .2s', background: done || active ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : '#EDEEF2', color: done || active ? 'white' : '#9CA3AF', boxShadow: active ? '0 0 0 4px rgba(247,37,133,.15)' : 'none', transform: active ? 'scale(1.1)' : 'scale(1)' }}>
                  {done ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 9, color: active ? '#070D1F' : done ? '#6B7280' : '#9CA3AF', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 32, height: 2, background: done ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : '#EDEEF2', borderRadius: 99, margin: '0 2px 14px', transition: 'background .3s' }} />
              )}
            </div>
          )
        })}
      </div>
      <div style={{ width: 80 }} />
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────
function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: '#070D1F', letterSpacing: '-.3px' }}>{title}</span>
    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </label>
      {children}
    </div>
  )
}
