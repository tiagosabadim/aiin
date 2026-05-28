// aiin · OnboardingPage v3 — 6 steps com stepper clicável + validação visual integrada
import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getOrCreateWorkspace, generateBrandDNA } from '../lib/api'
import { VisualContextPage } from './VisualContextPage'

type Step = 1 | 2 | 3 | 4 | 5 | 6

const TONES = ['Descontraído e próximo','Profissional e sério','Inspirador e motivacional','Divertido e jovem','Luxuoso e exclusivo','Educativo e informativo']
const OBJECTIVES = ['Atrair novos clientes','Fidelizar clientes atuais','Lançar produto/serviço','Aumentar reconhecimento','Gerar vendas diretas']
const SEGMENTS = ['Clínica de estética','Salão de beleza','Barbearia','Restaurante / Food','Loja local','Infoprodutor','Prestador de serviços','Imobiliária','Academia / Pilates','Saúde','Moda / Brechó','Outro']

const STEPS_CONFIG = [
  { n: 1, label: 'Sua marca',  icon: '🏷' },
  { n: 2, label: 'Público',    icon: '👥' },
  { n: 3, label: 'Visual',     icon: '🎨' },
  { n: 4, label: 'Uploads',    icon: '📸' },
  { n: 5, label: 'Brand DNA',  icon: '✦'  },
  { n: 6, label: 'Validar',    icon: '✓'  },
]

export function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth()
  const [step, setStep]       = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Step 1
  const [workspaceName, setWorkspaceName] = useState('')
  const [brandName, setBrandName]         = useState('')
  const [segment, setSegment]             = useState('')
  const [city, setCity]                   = useState('')

  // Step 2
  const [audience, setAudience]   = useState('')
  const [objective, setObjective] = useState(OBJECTIVES[0])
  const [tone, setTone]           = useState(TONES[0])
  const [products, setProducts]   = useState('')
  const [forbiddenWords, setForbiddenWords] = useState('')

  // Step 3
  const [colors, setColors]       = useState([{ name:'Principal', hex:'#7B2CFF' }, { name:'Secundária', hex:'#F72585' }])
  const [slogan, setSlogan]       = useState('')
  const [designRules, setDesignRules] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')

  // Step 4
  const logoRef   = useRef<HTMLInputElement>(null)
  const assetsRef = useRef<HTMLInputElement>(null)
  const [logoFile, setLogoFile]         = useState<File | null>(null)
  const [assetFiles, setAssetFiles]     = useState<File[]>([])
  const [logoPreview, setLogoPreview]   = useState<string | null>(null)

  // IDs
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [brandId, setBrandId]         = useState<string | null>(null)
  const [brandData, setBrandData]     = useState<any | null>(null)

  const go = (n: Step) => {
    // Só permite voltar para steps já completados
    if (n < step) setStep(n)
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
      setBrandData(brand)
      setStep(2)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  const saveStep2 = async () => {
    if (!brandId) return
    setLoading(true); setError(null)
    try {
      const updated = { target_audience: audience, main_objective: objective, tone_of_voice: tone, products, forbidden_words: forbiddenWords.split(',').map(w => w.trim()).filter(Boolean) }
      await supabase.from('brand_profiles').update(updated).eq('id', brandId)
      setBrandData((p: any) => ({ ...p, ...updated }))
      setStep(3)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  const saveStep3 = async () => {
    if (!brandId) return
    setLoading(true); setError(null)
    try {
      const updated = { color_palette: colors, slogans: slogan ? [{ text: slogan, active: true }] : [], design_rules: designRules, instagram_handle: instagramHandle }
      await supabase.from('brand_profiles').update(updated).eq('id', brandId)
      setBrandData((p: any) => ({ ...p, ...updated }))
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
      setStep(5)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
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
      if (freePlan) {
        await supabase.from('subscriptions').insert({ workspace_id: workspaceId, plan_id: freePlan.id, status: 'trialing', monthly_credits_available: 10, extra_credits_available: 0 })
      }
      setStep(6)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  // Step 6 = VisualContext integrado no mesmo fluxo
  if (step === 6 && brandData && workspaceId) {
    const fakeWorkspace = { id: workspaceId } as any
    return (
      <div style={{ minHeight: '100vh', background: '#F4F5F7' }}>
        {/* Stepper no topo */}
        <div style={{ background: '#fff', borderBottom: '1px solid rgba(7,13,31,.08)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'white', fontWeight: 700 }}>✦</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#070D1F', letterSpacing: '-.3px' }}>aiin</span>
          </div>
          <StepperBar step={step} onGoTo={go} />
          <div style={{ width: 80 }} />
        </div>
        <VisualContextPage workspace={fakeWorkspace} brand={brandData} onApprove={onComplete} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 20, color: 'white', boxShadow: '0 6px 20px rgba(247,37,133,.3)' }}>✦</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#070D1F', letterSpacing: '-.4px', marginBottom: 5 }}>
          Configurar <span style={{ background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>sua marca</span>
        </div>
        <div style={{ fontSize: 13, color: '#6B7280' }}>Preencha uma vez. A IA aprende e cria com sua identidade.</div>
      </div>

      {/* Stepper clicável */}
      <div style={{ width: '100%', maxWidth: 560, marginBottom: 20 }}>
        <StepperBar step={step} onGoTo={go} />
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 560, background: '#fff', border: '1px solid rgba(7,13,31,.08)', borderRadius: 20, padding: '28px 32px', boxShadow: '0 4px 24px rgba(7,13,31,.06)' }}>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#070D1F', marginBottom: 4 }}>Sobre seu negócio</div>
            <div>
              <label className="label">Seu nome ou nome do workspace *</label>
              <input className="input" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="ex: Studio da Ana, Agência XYZ" />
            </div>
            <div>
              <label className="label">Nome da marca *</label>
              <input className="input" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="ex: Clínica Bella, Brechó Verde" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            {error && <ErrorBox msg={error} />}
            <button onClick={saveStep1} disabled={!brandName || !workspaceName || loading} style={btnPrimary(loading || !brandName || !workspaceName)}>
              {loading ? 'Salvando...' : 'Continuar →'}
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#070D1F', marginBottom: 4 }}>Público e comunicação</div>
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
              <label className="label">Tom de voz</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {TONES.map(t => (
                  <button key={t} onClick={() => setTone(t)} style={{ padding: '9px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${tone === t ? 'rgba(247,37,133,.4)' : 'rgba(7,13,31,.1)'}`, borderRadius: 8, textAlign: 'left', background: tone === t ? 'rgba(247,37,133,.06)' : 'transparent', color: tone === t ? '#070D1F' : '#6B7280', fontWeight: tone === t ? 500 : 400, transition: 'all .12s' }}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Produtos / serviços principais</label>
              <textarea className="input" value={products} onChange={e => setProducts(e.target.value)} rows={2} style={{ resize: 'vertical' }} placeholder="ex: Limpeza de pele, botox, preenchimento labial" />
            </div>
            <div>
              <label className="label">Palavras proibidas (separadas por vírgula)</label>
              <input className="input" value={forbiddenWords} onChange={e => setForbiddenWords(e.target.value)} placeholder="ex: barato, promoção genérica" />
            </div>
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={btnGhost}>← Voltar</button>
              <button onClick={saveStep2} disabled={loading} style={{ ...btnPrimary(loading), flex: 1 }}>{loading ? 'Salvando...' : 'Continuar →'}</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#070D1F', marginBottom: 4 }}>Identidade visual</div>
            <div>
              <label className="label">Cores da marca</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colors.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="color" value={c.hex} onChange={e => setColors(prev => prev.map((x, j) => j === i ? { ...x, hex: e.target.value } : x))} style={{ width: 40, height: 40, border: 'none', borderRadius: 10, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                    <input className="input" value={c.name} onChange={e => setColors(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Nome da cor" />
                    {colors.length > 1 && <button onClick={() => setColors(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 18 }}>×</button>}
                  </div>
                ))}
                <button onClick={() => setColors(prev => [...prev, { name: '', hex: '#cccccc' }])} style={{ alignSelf: 'flex-start', height: 32, padding: '0 12px', border: '1px solid rgba(7,13,31,.12)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151' }}>+ Adicionar cor</button>
              </div>
            </div>
            <div>
              <label className="label">Slogan</label>
              <input className="input" value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="ex: Crie. Publique. Cresça." />
            </div>
            <div>
              <label className="label">Regras de design para a IA</label>
              <textarea className="input" value={designRules} onChange={e => setDesignRules(e.target.value)} rows={3} style={{ resize: 'vertical' }} placeholder="ex: Artes minimalistas, muito respiro, textos pequenos e elegantes" />
            </div>
            <div>
              <label className="label">@Instagram</label>
              <input className="input" value={instagramHandle} onChange={e => setInstagramHandle(e.target.value)} placeholder="@suamarca" />
            </div>
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={btnGhost}>← Voltar</button>
              <button onClick={saveStep3} disabled={loading} style={{ ...btnPrimary(loading), flex: 1 }}>{loading ? 'Salvando...' : 'Continuar →'}</button>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#070D1F', marginBottom: 4 }}>Uploads da marca</div>
            <input ref={logoRef} type="file" accept="image/*,.svg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)) } }} />
            <input ref={assetsRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => setAssetFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
            <div>
              <label className="label">Logo (PNG ou SVG com fundo transparente)</label>
              <div onClick={() => logoRef.current?.click()} style={{ border: `1.5px dashed ${logoPreview ? 'rgba(247,37,133,.4)' : 'rgba(7,13,31,.15)'}`, borderRadius: 14, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: logoPreview ? 'rgba(247,37,133,.04)' : '#F7F8FA' }}>
                {logoPreview
                  ? <img src={logoPreview} alt="logo" style={{ maxHeight: 70, maxWidth: '90%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 13, color: '#9CA3AF' }}>+ Clique para subir a logo</span>}
              </div>
            </div>
            <div>
              <label className="label">Fotos, produtos e referências visuais</label>
              <div onClick={() => assetsRef.current?.click()} style={{ border: '1.5px dashed rgba(7,13,31,.12)', borderRadius: 14, padding: 14, cursor: 'pointer', textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F7F8FA' }}>
                {assetFiles.length > 0
                  ? <span style={{ color: '#F72585', fontWeight: 500 }}>{assetFiles.length} arquivo{assetFiles.length > 1 ? 's' : ''} ✓</span>
                  : '+ Clique para subir fotos (pode adicionar mais depois)'}
              </div>
              {assetFiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {assetFiles.slice(0, 6).map((f, i) => (
                    <div key={i} style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(7,13,31,.08)' }}>
                      <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                  {assetFiles.length > 6 && <div style={{ width: 48, height: 48, borderRadius: 8, background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9CA3AF', border: '1px solid rgba(7,13,31,.08)' }}>+{assetFiles.length - 6}</div>}
                </div>
              )}
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(247,37,133,.06)', border: '1px solid rgba(247,37,133,.12)', borderRadius: 10, fontSize: 12, color: '#374151' }}>
              💡 Quanto mais fotos você subir, mais a IA entende o estilo visual da sua marca.
            </div>
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(3)} style={btnGhost}>← Voltar</button>
              <button onClick={saveStep4} disabled={loading} style={{ ...btnPrimary(loading), flex: 1 }}>{loading ? 'Enviando...' : 'Continuar →'}</button>
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 32, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>✦</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#070D1F', letterSpacing: '-.2px' }}>Gerando seu Brand DNA</div>
            <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
              A IA está analisando tudo para criar o DNA da sua marca. A partir de agora, cada post vai seguir sua identidade visual e tom de comunicação.
            </div>
            <div style={{ background: 'rgba(247,37,133,.06)', border: '1px solid rgba(247,37,133,.12)', borderRadius: 14, padding: '14px 16px', textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#070D1F', marginBottom: 10 }}>A IA vai aprender com você</div>
              {['Tom de voz e estilo de comunicação','Paleta de cores e identidade visual','Produtos, serviços e público','Regras e preferências de design','Aprendizados a cada aprovação'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', marginBottom: 6 }}>
                  <span style={{ color: '#F72585' }}>✓</span> {item}
                </div>
              ))}
            </div>
            {error && <ErrorBox msg={error} />}
            <button onClick={finishStep5} disabled={loading} style={btnPrimary(loading)}>
              {loading
                ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} /> Criando Brand DNA...</>
                : '✦ Criar meu Brand DNA e continuar'
              }
            </button>
            <button onClick={() => setStep(4)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>← Voltar</button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Stepper bar ──────────────────────────────────────────────
function StepperBar({ step, onGoTo }: { step: Step; onGoTo: (n: Step) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STEPS_CONFIG.map((s, i) => {
        const active = step === s.n
        const done   = step > s.n
        const canClick = done

        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              onClick={() => canClick && onGoTo(s.n as Step)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: canClick ? 'pointer' : 'default', padding: '0 4px' }}
              title={canClick ? `Voltar para ${s.label}` : undefined}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, transition: 'all .2s',
                background: done ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : active ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : '#EDEEF2',
                color: done || active ? 'white' : '#9CA3AF',
                boxShadow: active ? '0 0 0 4px rgba(247,37,133,.15)' : done ? '0 2px 8px rgba(247,37,133,.2)' : 'none',
                transform: active ? 'scale(1.1)' : 'scale(1)',
              }}>
                {done ? '✓' : s.n}
              </div>
              <span style={{ fontSize: 9, color: active ? '#070D1F' : done ? '#6B7280' : '#9CA3AF', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400, textTransform: 'uppercase', letterSpacing: '.04em', textDecoration: canClick ? 'underline' : 'none', textDecorationColor: 'rgba(7,13,31,.2)' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS_CONFIG.length - 1 && (
              <div style={{ width: 28, height: 2, background: done ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : '#EDEEF2', borderRadius: 99, margin: '0 0 14px', transition: 'background .3s', flexShrink: 0 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────
function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ padding: '10px 12px', background: '#FCEBEB', border: '1px solid rgba(226,75,74,.2)', borderRadius: 10, fontSize: 12, color: '#E24B4A' }}>{msg}</div>
}

const btnGhost: React.CSSProperties = {
  height: 44, padding: '0 16px', border: '1px solid rgba(7,13,31,.12)', borderRadius: 10,
  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#374151',
}

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  width: '100%', height: 46, background: disabled ? '#e5e7eb' : 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)',
  border: 'none', borderRadius: 12, color: disabled ? '#9CA3AF' : 'white',
  fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  boxShadow: disabled ? 'none' : '0 4px 16px rgba(247,37,133,.3)',
})
