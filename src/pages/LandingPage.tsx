// aiin · LandingPage — pública, mobile first
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface PlanCard {
  name: string
  price: number
  credits: number
  features: string[]
  highlight: boolean
}

export function LandingPage({ onStart }: { onStart: () => void }) {
  const [plans, setPlans] = useState<PlanCard[]>([])

  useEffect(() => {
    supabase.from('plans').select('*').eq('active', true).order('display_order')
      .then(({ data }) => {
        if (data) setPlans(data.map((p: any) => ({
          name: p.name, price: p.monthly_price, credits: p.monthly_credits,
          features: Array.isArray(p.features) ? p.features : [],
          highlight: p.highlight,
        })))
      })
  }, [])

  // Fallback caso o banco ainda não tenha planos
  const displayPlans = plans.length > 0 ? plans : [
    { name: 'Starter', price: 127, credits: 40, highlight: false, features: ['40 créditos por mês','Brand DNA inteligente','Posts, carrosséis e stories','Agendamento automático','Calendário de marketing BR','Suporte por email'] },
    { name: 'Premium', price: 197, credits: 80, highlight: true,  features: ['80 créditos por mês','Tudo do Starter','Insights completos','Melhores horários','Aprendizado contínuo da IA','Suporte prioritário'] },
    { name: 'Master',  price: 397, credits: 200, highlight: false, features: ['200 créditos por mês','Tudo do Premium','Volume para agências','Prioridade na geração','Suporte dedicado','Consultoria de estratégia'] },
  ]

  return (
    <>
      <style>{`
        .lp-root { background:#08060F; color:#fff; min-height:100vh; overflow-x:hidden; }
        .lp-container { max-width:1100px; margin:0 auto; padding:0 24px; }
        .lp-nav { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; max-width:1100px; margin:0 auto; }
        .lp-hero { text-align:center; padding:60px 0 40px; position:relative; }
        .lp-hero h1 { font-size:40px; font-weight:800; letter-spacing:-1.5px; line-height:1.1; margin-bottom:18px; }
        .lp-hero p { font-size:17px; color:rgba(255,255,255,.6); line-height:1.6; max-width:560px; margin:0 auto 32px; }
        .lp-btn-primary { height:54px; padding:0 32px; background:linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF); border:none; border-radius:14px; color:#fff; font-size:16px; font-weight:700; cursor:pointer; font-family:inherit; box-shadow:0 8px 32px rgba(247,37,133,.4); display:inline-flex; align-items:center; gap:8px; }
        .lp-features-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; padding:40px 0; }
        .lp-feature { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:24px 20px; text-align:center; }
        .lp-feature-icon { font-size:28px; margin-bottom:12px; }
        .lp-feature h3 { font-size:15px; font-weight:600; margin-bottom:6px; }
        .lp-feature p { font-size:13px; color:rgba(255,255,255,.5); line-height:1.5; }
        .lp-section-title { text-align:center; font-size:30px; font-weight:800; letter-spacing:-1px; margin-bottom:8px; }
        .lp-section-sub { text-align:center; font-size:15px; color:rgba(255,255,255,.5); margin-bottom:40px; }
        .lp-plans { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; padding-bottom:60px; align-items:start; }
        .lp-plan { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:20px; padding:32px 28px; position:relative; }
        .lp-plan.hl { border-color:#F72585; background:rgba(247,37,133,.06); box-shadow:0 12px 48px rgba(247,37,133,.2); }
        .lp-plan-badge { position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:linear-gradient(135deg,#FF6A00,#F72585); font-size:11px; font-weight:700; padding:5px 14px; border-radius:99px; white-space:nowrap; }
        .lp-plan h3 { font-size:20px; font-weight:700; margin-bottom:4px; }
        .lp-plan-price { font-size:40px; font-weight:800; letter-spacing:-1px; margin:12px 0 2px; }
        .lp-plan-price span { font-size:15px; font-weight:400; color:rgba(255,255,255,.5); }
        .lp-plan-credits { font-size:13px; color:#F72585; font-weight:600; margin-bottom:20px; }
        .lp-plan ul { list-style:none; padding:0; margin:0 0 24px; display:flex; flex-direction:column; gap:10px; }
        .lp-plan li { font-size:13px; color:rgba(255,255,255,.7); display:flex; gap:8px; line-height:1.4; }
        .lp-plan li::before { content:'✓'; color:#1D9E75; font-weight:700; flex-shrink:0; }
        .lp-plan-btn { width:100%; height:48px; border-radius:12px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; transition:all .15s; }
        .lp-cta-final { text-align:center; padding:60px 0 80px; }

        /* MOBILE FIRST */
        @media (max-width:768px) {
          .lp-hero { padding:40px 0 32px; }
          .lp-hero h1 { font-size:30px; }
          .lp-hero p { font-size:15px; }
          .lp-features-grid { grid-template-columns:1fr 1fr; gap:12px; padding:28px 0; }
          .lp-feature { padding:18px 14px; }
          .lp-plans { grid-template-columns:1fr; gap:32px; padding-bottom:40px; }
          .lp-plan.hl { order:-1; }
          .lp-section-title { font-size:24px; }
        }
      `}</style>

      <div className="lp-root">

        {/* Glows */}
        <div style={{ position:'fixed', top:'-10%', right:'-5%', width:500, height:500, background:'radial-gradient(circle, rgba(123,44,255,.18) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }} />
        <div style={{ position:'fixed', bottom:'-10%', left:'-5%', width:500, height:500, background:'radial-gradient(circle, rgba(247,37,133,.12) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }} />

        <div style={{ position:'relative', zIndex:1 }}>

          {/* Nav */}
          <nav className="lp-nav">
            <img src="/logo.png" alt="aiin" style={{ height:36 }}
              onError={e => { const el=e.target as HTMLImageElement; el.style.display='none'; const s=document.createElement('span'); s.textContent='aiin'; Object.assign(s.style,{fontSize:'28px',fontWeight:'800',background:'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}); el.parentElement?.appendChild(s) }} />
            <button onClick={onStart} style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:10, color:'#fff', padding:'9px 18px', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Entrar</button>
          </nav>

          {/* Hero */}
          <div className="lp-container">
            <div className="lp-hero">
              <h1>Crie. Publique.{' '}
                <span style={{ background:'linear-gradient(135deg,#FF6A00,#F72585)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Cresça.</span>
              </h1>
              <p>Sua marca no Instagram no piloto automático. Do briefing ao post pronto, com inteligência artificial que aprende o seu estilo.</p>
              <button className="lp-btn-primary" onClick={onStart}>✦ Começar com 1 post grátis</button>
              <p style={{ fontSize:13, marginTop:16, color:'rgba(255,255,255,.4)' }}>Sem cartão de crédito para testar.</p>
            </div>

            {/* Features */}
            <div className="lp-features-grid">
              {[
                { icon:'🧬', title:'Brand DNA', desc:'A IA aprende a identidade da sua marca' },
                { icon:'🎨', title:'Posts com IA', desc:'Feed, carrossel e stories prontos' },
                { icon:'📅', title:'Agendamento', desc:'Publica sozinho no melhor horário' },
                { icon:'📊', title:'Insights', desc:'Relatórios que melhoram seus posts' },
              ].map(f => (
                <div key={f.title} className="lp-feature">
                  <div className="lp-feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Planos */}
            <div style={{ paddingTop:40 }}>
              <h2 className="lp-section-title">Escolha seu plano</h2>
              <p className="lp-section-sub">Comece grátis. Assine quando quiser publicar de verdade.</p>

              <div className="lp-plans">
                {displayPlans.map(plan => (
                  <div key={plan.name} className={`lp-plan ${plan.highlight ? 'hl' : ''}`}>
                    {plan.highlight && <div className="lp-plan-badge">⭐ MAIS POPULAR</div>}
                    <h3>{plan.name}</h3>
                    <div className="lp-plan-price">R$ {plan.price}<span>/mês</span></div>
                    <div className="lp-plan-credits">{plan.credits} créditos por mês</div>
                    <ul>
                      {plan.features.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                    <button className="lp-plan-btn" onClick={onStart} style={{
                      background: plan.highlight ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : 'transparent',
                      border: plan.highlight ? 'none' : '1.5px solid rgba(255,255,255,.2)',
                      color:'#fff',
                    }}>
                      {plan.highlight ? 'Começar agora' : 'Escolher'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA final */}
            <div className="lp-cta-final">
              <h2 className="lp-section-title">Pronto pra começar?</h2>
              <p className="lp-section-sub">Crie sua conta e faça seu primeiro post grátis agora.</p>
              <button className="lp-btn-primary" onClick={onStart}>✦ Criar minha conta</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
