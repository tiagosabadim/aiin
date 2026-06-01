// aiin · LandingPage v2 — landing de lançamento profissional
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Plan {
  id: string; name: string; monthly_price: number; monthly_credits: number
  features: string[]; highlight: boolean
}

export function LandingPage({ onStart }: { onStart: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  useEffect(() => {
    supabase.from('plans').select('*').eq('active', true).order('display_order')
      .then(({ data }) => {
        if (data) {
          // Dedup por nome (caso o banco tenha planos duplicados)
          const seen = new Set<string>()
          const unique = data.filter((p: any) => {
            if (seen.has(p.name)) return false
            seen.add(p.name); return true
          }).slice(0, 3)
          setPlans(unique.map((p: any) => ({
            id: p.id, name: p.name, monthly_price: p.monthly_price,
            monthly_credits: p.monthly_credits,
            features: Array.isArray(p.features) ? p.features : [],
            highlight: p.highlight,
          })))
        }
      })
  }, [])

  const displayPlans = plans.length > 0 ? plans : [
    { id:'1', name:'Starter', monthly_price:127, monthly_credits:40, highlight:false, features:['40 créditos por mês','Brand DNA inteligente','Posts, carrosséis e stories','Agendamento automático','Calendário de marketing BR','Suporte por email'] },
    { id:'2', name:'Premium', monthly_price:197, monthly_credits:80, highlight:true,  features:['80 créditos por mês','Tudo do Starter','Insights e relatórios completos','Melhores horários para postar','Aprendizado contínuo da IA','Suporte prioritário'] },
    { id:'3', name:'Master',  monthly_price:397, monthly_credits:200, highlight:false, features:['200 créditos por mês','Tudo do Premium','Volume para agências','Prioridade na geração','Suporte dedicado','Consultoria de estratégia'] },
  ]

  const FAQ = [
    { q: 'Preciso saber design ou marketing para usar?', a: 'Não. A aiin foi feita justamente para quem não tem tempo ou conhecimento técnico. Você responde algumas perguntas sobre a sua marca uma única vez, e a IA cria tudo: arte, legenda, hashtags e até agenda a publicação.' },
    { q: 'A IA entende a identidade da minha marca?', a: 'Sim. No onboarding você define seu Brand DNA — cores, tom de voz, público, estilo. A partir daí todo conteúdo sai com a cara da sua marca. E quanto mais você usa, mais a IA aprende e melhora.' },
    { q: 'Posso testar antes de pagar?', a: 'Pode. Você cria sua conta, configura sua marca e ganha 1 post completo grátis para ver a mágica acontecer. Só assina se gostar.' },
    { q: 'O que é um crédito?', a: 'Cada peça de conteúdo consome créditos: um post simples custa 1 crédito, um carrossel de 5 slides custa 3. Você escolhe o plano com a quantidade de créditos que faz sentido para o seu volume.' },
    { q: 'Consigo baixar as imagens para postar manualmente?', a: 'Sim. Além do agendamento automático, você pode baixar todas as artes geradas e postar do seu jeito — com música, no melhor momento, como preferir.' },
    { q: 'Posso cancelar quando quiser?', a: 'Sim, sem multa e sem burocracia. O pagamento é mensal e você cancela direto pelo painel a qualquer momento.' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap');
        .lp * { box-sizing:border-box; }
        .lp { background:#08060F; color:#fff; height:100vh; overflow-y:auto; overflow-x:hidden; font-family:'Inter',sans-serif; scroll-behavior:smooth; }
        .lp h1,.lp h2,.lp h3 { font-family:'Sora',sans-serif; }
        .lp-wrap { max-width:1120px; margin:0 auto; padding:0 24px; position:relative; }

        /* NAV */
        .lp-nav { position:sticky; top:0; z-index:50; backdrop-filter:blur(12px); background:rgba(8,6,15,.7); border-bottom:1px solid rgba(255,255,255,.06); }
        .lp-nav-in { max-width:1120px; margin:0 auto; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; }
        .lp-nav-links { display:flex; gap:28px; align-items:center; }
        .lp-nav-links a { color:rgba(255,255,255,.6); text-decoration:none; font-size:14px; transition:color .15s; }
        .lp-nav-links a:hover { color:#fff; }
        .lp-btn { border:none; border-radius:12px; font-weight:600; cursor:pointer; font-family:'Sora',sans-serif; transition:transform .15s, box-shadow .15s; }
        .lp-btn:hover { transform:translateY(-2px); }
        .lp-btn-grad { background:linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF); color:#fff; box-shadow:0 8px 30px rgba(247,37,133,.35); }
        .lp-btn-ghost { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.15); color:#fff; }

        /* HERO */
        .lp-hero { padding:90px 0 70px; text-align:center; position:relative; }
        .lp-eyebrow { display:inline-flex; align-items:center; gap:8px; background:rgba(247,37,133,.1); border:1px solid rgba(247,37,133,.25); color:#FF8FC7; font-size:13px; font-weight:600; padding:7px 16px; border-radius:99px; margin-bottom:28px; }
        .lp-hero h1 { font-size:60px; font-weight:800; line-height:1.05; letter-spacing:-2px; margin-bottom:24px; }
        .lp-grad-text { background:linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .lp-hero p { font-size:19px; color:rgba(255,255,255,.6); line-height:1.6; max-width:620px; margin:0 auto 36px; }
        .lp-hero-cta { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; margin-bottom:18px; }
        .lp-social-proof { display:flex; align-items:center; justify-content:center; gap:8px; font-size:13px; color:rgba(255,255,255,.4); }

        /* HERO MOCKUP */
        .lp-mockup { margin-top:60px; position:relative; }
        .lp-mockup-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; max-width:720px; margin:0 auto; }
        .lp-mockup-card { aspect-ratio:4/5; border-radius:18px; overflow:hidden; border:1px solid rgba(255,255,255,.1); background:linear-gradient(160deg,#1a1130,#0d0a1a); position:relative; box-shadow:0 20px 60px rgba(0,0,0,.5); }
        .lp-mockup-card:nth-child(2) { transform:translateY(-24px); border-color:rgba(247,37,133,.3); }
        .lp-mockup-card img { width:100%; height:100%; object-fit:cover; }

        /* SECTIONS */
        .lp-section { padding:80px 0; }
        .lp-section-eyebrow { text-align:center; color:#F72585; font-size:14px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:12px; }
        .lp-section h2 { text-align:center; font-size:38px; font-weight:800; letter-spacing:-1px; margin-bottom:14px; }
        .lp-section-sub { text-align:center; font-size:17px; color:rgba(255,255,255,.55); max-width:600px; margin:0 auto 56px; line-height:1.6; }

        /* FEATURES */
        .lp-features { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        .lp-feat { background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.02)); border:1px solid rgba(255,255,255,.08); border-radius:20px; padding:32px 28px; transition:border-color .2s, transform .2s; }
        .lp-feat:hover { border-color:rgba(247,37,133,.3); transform:translateY(-4px); }
        .lp-feat-icon { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,rgba(255,106,0,.2),rgba(247,37,133,.2)); display:flex; align-items:center; justify-content:center; font-size:26px; margin-bottom:18px; }
        .lp-feat h3 { font-size:19px; font-weight:700; margin-bottom:10px; }
        .lp-feat p { font-size:14.5px; color:rgba(255,255,255,.55); line-height:1.6; }

        /* PARA QUEM */
        .lp-fit { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
        .lp-fit-card { border-radius:20px; padding:36px 32px; }
        .lp-fit-yes { background:rgba(29,158,117,.08); border:1px solid rgba(29,158,117,.25); }
        .lp-fit-no { background:rgba(226,75,74,.06); border:1px solid rgba(226,75,74,.2); }
        .lp-fit-card h3 { font-size:22px; font-weight:700; margin-bottom:20px; display:flex; align-items:center; gap:10px; }
        .lp-fit-card ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:14px; }
        .lp-fit-card li { font-size:15px; color:rgba(255,255,255,.75); display:flex; gap:12px; line-height:1.5; }

        /* STEPS */
        .lp-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:28px; counter-reset:step; }
        .lp-step { text-align:center; position:relative; }
        .lp-step-num { width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF); display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:800; font-family:'Sora'; margin:0 auto 20px; box-shadow:0 8px 24px rgba(247,37,133,.4); }
        .lp-step h3 { font-size:18px; font-weight:700; margin-bottom:8px; }
        .lp-step p { font-size:14px; color:rgba(255,255,255,.55); line-height:1.6; }

        /* PROVA SOCIAL */
        .lp-testi { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        .lp-testi-card { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:28px 26px; }
        .lp-stars { color:#FFB800; font-size:15px; margin-bottom:14px; letter-spacing:2px; }
        .lp-testi-card p { font-size:14.5px; color:rgba(255,255,255,.8); line-height:1.6; margin-bottom:20px; }
        .lp-testi-author { display:flex; align-items:center; gap:12px; }
        .lp-testi-avatar { width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16px; }
        .lp-testi-author div span { display:block; }
        .lp-testi-name { font-size:14px; font-weight:600; }
        .lp-testi-role { font-size:12px; color:rgba(255,255,255,.45); }

        /* PLANOS */
        .lp-plans { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; align-items:start; }
        .lp-plan { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:22px; padding:36px 30px; position:relative; display:flex; flex-direction:column; }
        .lp-plan.hl { border-color:#F72585; background:linear-gradient(160deg,rgba(247,37,133,.1),rgba(123,44,255,.05)); box-shadow:0 16px 60px rgba(247,37,133,.2); transform:scale(1.04); }
        .lp-plan-badge { position:absolute; top:-13px; left:50%; transform:translateX(-50%); background:linear-gradient(135deg,#FF6A00,#F72585); font-size:11px; font-weight:700; padding:6px 16px; border-radius:99px; white-space:nowrap; font-family:'Sora'; }
        .lp-plan h3 { font-size:22px; font-weight:700; margin-bottom:6px; }
        .lp-plan-price { font-size:46px; font-weight:800; letter-spacing:-1.5px; font-family:'Sora'; }
        .lp-plan-price span { font-size:16px; font-weight:400; color:rgba(255,255,255,.45); }
        .lp-plan-credits { font-size:13px; color:#FF8FC7; font-weight:600; margin:4px 0 24px; }
        .lp-plan ul { list-style:none; padding:0; margin:0 0 28px; display:flex; flex-direction:column; gap:12px; flex:1; }
        .lp-plan li { font-size:14px; color:rgba(255,255,255,.72); display:flex; gap:10px; line-height:1.4; }
        .lp-plan li::before { content:'✓'; color:#1D9E75; font-weight:800; flex-shrink:0; }
        .lp-plan-btn { width:100%; height:50px; border-radius:14px; font-size:15px; font-weight:700; cursor:pointer; font-family:'Sora'; }

        /* FAQ */
        .lp-faq { max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }
        .lp-faq-item { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow:hidden; }
        .lp-faq-q { width:100%; padding:22px 26px; background:none; border:none; color:#fff; font-size:16px; font-weight:600; font-family:'Sora'; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:16px; text-align:left; }
        .lp-faq-a { padding:0 26px 22px; font-size:15px; color:rgba(255,255,255,.6); line-height:1.7; }
        .lp-faq-toggle { font-size:22px; color:#F72585; flex-shrink:0; transition:transform .2s; }

        /* CTA FINAL */
        .lp-final { text-align:center; padding:90px 0; background:linear-gradient(160deg,rgba(247,37,133,.08),transparent); border-radius:32px; margin:40px 0; }
        .lp-final h2 { font-size:42px; font-weight:800; letter-spacing:-1.5px; margin-bottom:16px; }
        .lp-final p { font-size:18px; color:rgba(255,255,255,.6); margin-bottom:36px; }

        /* FOOTER */
        .lp-footer { border-top:1px solid rgba(255,255,255,.06); padding:40px 0; text-align:center; color:rgba(255,255,255,.4); font-size:13px; }

        /* MOBILE FIRST */
        @media (max-width:768px) {
          .lp-nav-links { display:none; }
          .lp-hero { padding:56px 0 48px; }
          .lp-hero h1 { font-size:38px; letter-spacing:-1px; }
          .lp-hero p { font-size:16px; }
          .lp-mockup-grid { grid-template-columns:1fr 1fr; gap:12px; max-width:340px; }
          .lp-mockup-card:nth-child(3) { display:none; }
          .lp-mockup-card:nth-child(2) { transform:none; }
          .lp-section { padding:56px 0; }
          .lp-section h2 { font-size:28px; }
          .lp-section-sub { font-size:15px; margin-bottom:40px; }
          .lp-features, .lp-steps, .lp-testi { grid-template-columns:1fr; gap:16px; }
          .lp-fit { grid-template-columns:1fr; }
          .lp-plans { grid-template-columns:1fr; gap:32px; }
          .lp-plan.hl { transform:none; order:-1; }
          .lp-final h2 { font-size:30px; }
        }
      `}</style>

      <div className="lp">
        {/* Glows */}
        <div style={{ position:'absolute', top:0, right:'-10%', width:600, height:600, background:'radial-gradient(circle, rgba(123,44,255,.15) 0%, transparent 65%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'40%', left:'-15%', width:600, height:600, background:'radial-gradient(circle, rgba(247,37,133,.1) 0%, transparent 65%)', pointerEvents:'none' }} />

        {/* NAV */}
        <nav className="lp-nav">
          <div className="lp-nav-in">
            <img src="/logo.png" alt="aiin" style={{ height:32 }}
              onError={e => { const el=e.target as HTMLImageElement; el.style.display='none'; const s=document.createElement('span'); s.textContent='aiin'; Object.assign(s.style,{fontSize:'26px',fontWeight:'800',fontFamily:'Sora',background:'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}); el.parentElement?.appendChild(s) }} />
            <div className="lp-nav-links">
              <a href="#como">Como funciona</a>
              <a href="#planos">Planos</a>
              <a href="#faq">Dúvidas</a>
            </div>
            <button className="lp-btn lp-btn-ghost" onClick={onStart} style={{ padding:'9px 20px', fontSize:14 }}>Entrar</button>
          </div>
        </nav>

        <div className="lp-wrap">
          {/* HERO */}
          <section className="lp-hero">
            <div className="lp-eyebrow">✦ Inteligência artificial para Instagram</div>
            <h1>Sua marca no Instagram<br/>no <span className="lp-grad-text">piloto automático</span></h1>
            <p>Do briefing ao post pronto. A aiin cria, escreve e agenda seu conteúdo com IA que aprende a identidade da sua marca — sem você precisar saber design.</p>
            <div className="lp-hero-cta">
              <button className="lp-btn lp-btn-grad" onClick={onStart} style={{ padding:'16px 32px', fontSize:16 }}>✦ Começar com 1 post grátis</button>
              <button className="lp-btn lp-btn-ghost" onClick={() => document.getElementById('como')?.scrollIntoView()} style={{ padding:'16px 28px', fontSize:16 }}>Ver como funciona</button>
            </div>
            <div className="lp-social-proof">🔒 Sem cartão para testar · Cancele quando quiser</div>

            {/* Mockup */}
            <div className="lp-mockup">
              <div className="lp-mockup-grid">
                {['linear-gradient(160deg,#FF6A00,#F72585)','linear-gradient(160deg,#7B2CFF,#F72585)','linear-gradient(160deg,#1a1130,#3d1a5c)'].map((bg,i) => (
                  <div key={i} className="lp-mockup-card" style={{ background:bg }}>
                    <div style={{ padding:'24px 20px', height:'100%', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                      <div style={{ fontSize:12, fontWeight:600, opacity:.7 }}>aiin</div>
                      <div>
                        <div style={{ fontFamily:'Sora', fontSize:i===1?26:22, fontWeight:800, lineHeight:1.1, marginBottom:8 }}>
                          {i===0?'Crie. Publique. Cresça.':i===1?'Sua marca em destaque':'Conteúdo que converte'}
                        </div>
                        <div style={{ fontSize:12, opacity:.7 }}>{i===0?'Posts com IA':i===1?'Carrosséis prontos':'Stories automáticos'}</div>
                      </div>
                      <div style={{ fontSize:11, opacity:.5 }}>✦ gerado por IA</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* O QUE ENTREGA */}
          <section className="lp-section">
            <div className="lp-section-eyebrow">O que a aiin entrega</div>
            <h2>Tudo que sua marca precisa pra crescer</h2>
            <p className="lp-section-sub">Uma plataforma completa que substitui agência, designer e social media — por uma fração do custo.</p>
            <div className="lp-features">
              {[
                { icon:'🧬', title:'Brand DNA inteligente', desc:'A IA aprende as cores, o tom de voz e o estilo da sua marca. Todo conteúdo sai com a sua cara, sempre coerente.' },
                { icon:'🎨', title:'Posts, carrosséis e stories', desc:'Arte profissional + legenda + hashtags em segundos. Feed, carrossel de até 5 slides e stories prontos pra postar.' },
                { icon:'📅', title:'Agendamento automático', desc:'A aiin publica sozinha no melhor horário. Você aprova e esquece — o conteúdo sai no piloto automático.' },
                { icon:'🗓', title:'Calendário de marketing', desc:'Datas comemorativas, feriados e datas de profissões do Brasil. Nunca mais perca uma oportunidade de post.' },
                { icon:'📊', title:'Insights que evoluem', desc:'Relatórios de performance e melhores horários. A IA aprende o que funciona e melhora os próximos posts.' },
                { icon:'⬇', title:'Download e liberdade', desc:'Baixe todas as artes pra postar do seu jeito — com música, no seu tempo. Você sempre no controle.' },
              ].map(f => (
                <div key={f.title} className="lp-feat">
                  <div className="lp-feat-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* PARA QUEM É / NÃO É */}
          <section className="lp-section">
            <div className="lp-section-eyebrow">A aiin é pra você?</div>
            <h2>Feita pra quem quer resultado<br/>sem complicação</h2>
            <div className="lp-fit" style={{ marginTop:48 }}>
              <div className="lp-fit-card lp-fit-yes">
                <h3>✅ A aiin é pra você se...</h3>
                <ul>
                  <li><span>✓</span> Você tem um negócio e não tem tempo de criar conteúdo</li>
                  <li><span>✓</span> Quer presença profissional no Instagram sem contratar agência</li>
                  <li><span>✓</span> Não sabe design nem quer aprender ferramentas complexas</li>
                  <li><span>✓</span> Precisa postar com constância mas sempre esquece</li>
                  <li><span>✓</span> Quer que o conteúdo tenha a cara da sua marca</li>
                </ul>
              </div>
              <div className="lp-fit-card lp-fit-no">
                <h3>🚫 Talvez não seja se...</h3>
                <ul>
                  <li><span>✕</span> Você já tem uma equipe de marketing completa e satisfeita</li>
                  <li><span>✕</span> Procura uma ferramenta só de edição manual de imagem</li>
                  <li><span>✕</span> Não usa Instagram como canal do seu negócio</li>
                  <li><span>✕</span> Quer controle pixel a pixel de cada detalhe da arte</li>
                </ul>
              </div>
            </div>
          </section>

          {/* COMO FUNCIONA */}
          <section className="lp-section" id="como">
            <div className="lp-section-eyebrow">Simples assim</div>
            <h2>Do zero ao post pronto em 3 passos</h2>
            <p className="lp-section-sub">Configure uma vez e deixe a inteligência artificial trabalhar por você.</p>
            <div className="lp-steps">
              {[
                { n:'1', t:'Configure sua marca', d:'Responda perguntas rápidas sobre seu negócio, cores e tom de voz. A IA cria seu Brand DNA.' },
                { n:'2', t:'A IA cria o conteúdo', d:'Peça um post, carrossel ou campanha inteira. Arte, legenda e hashtags prontas em segundos.' },
                { n:'3', t:'Aprove e publique', d:'Revise, ajuste se quiser e agende. A aiin publica sozinha no melhor horário.' },
              ].map(s => (
                <div key={s.n} className="lp-step">
                  <div className="lp-step-num">{s.n}</div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* PROVA SOCIAL */}
          <section className="lp-section">
            <div className="lp-section-eyebrow">Quem usa, recomenda</div>
            <h2>Marcas que já estão no automático</h2>
            <div className="lp-testi" style={{ marginTop:48 }}>
              {[
                { txt:'Eu não tinha tempo nem cabeça pra postar. Com a aiin meu Instagram virou profissional e eu nem preciso pensar nisso.', name:'Marina Costa', role:'Loja de roupas', av:'M' },
                { txt:'O Brand DNA é surreal. Os posts saem exatamente com a identidade da minha marca, parece que tem um designer dedicado.', name:'Rafael Lima', role:'Estúdio de tatuagem', av:'R' },
                { txt:'Economizei o valor de uma agência inteira. E o melhor: posto todo dia agora, sem esforço nenhum.', name:'Juliana Reis', role:'Nutricionista', av:'J' },
              ].map(t => (
                <div key={t.name} className="lp-testi-card">
                  <div className="lp-stars">★★★★★</div>
                  <p>"{t.txt}"</p>
                  <div className="lp-testi-author">
                    <div className="lp-testi-avatar">{t.av}</div>
                    <div>
                      <span className="lp-testi-name">{t.name}</span>
                      <span className="lp-testi-role">{t.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* PLANOS */}
          <section className="lp-section" id="planos">
            <div className="lp-section-eyebrow">Planos</div>
            <h2>Escolha o seu plano</h2>
            <p className="lp-section-sub">Comece grátis com 1 post. Assine quando quiser publicar de verdade. Cancele a hora que quiser.</p>
            <div className="lp-plans">
              {displayPlans.map(plan => (
                <div key={plan.id} className={`lp-plan ${plan.highlight ? 'hl' : ''}`}>
                  {plan.highlight && <div className="lp-plan-badge">⭐ MAIS POPULAR</div>}
                  <h3>{plan.name}</h3>
                  <div className="lp-plan-price">R$ {plan.monthly_price}<span>/mês</span></div>
                  <div className="lp-plan-credits">{plan.monthly_credits} créditos por mês</div>
                  <ul>{plan.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                  <button className="lp-plan-btn lp-btn" onClick={onStart} style={{
                    background: plan.highlight ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : 'rgba(255,255,255,.08)',
                    border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,.18)',
                    color:'#fff',
                  }}>Começar agora</button>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="lp-section" id="faq">
            <div className="lp-section-eyebrow">Dúvidas frequentes</div>
            <h2>Perguntas que todo mundo faz</h2>
            <div className="lp-faq" style={{ marginTop:48 }}>
              {FAQ.map((item, i) => (
                <div key={i} className="lp-faq-item">
                  <button className="lp-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    {item.q}
                    <span className="lp-faq-toggle" style={{ transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                  </button>
                  {openFaq === i && <div className="lp-faq-a">{item.a}</div>}
                </div>
              ))}
            </div>
          </section>

          {/* CTA FINAL */}
          <section className="lp-final">
            <h2>Pronto pra crescer no automático?</h2>
            <p>Crie sua conta e faça seu primeiro post grátis agora mesmo.</p>
            <button className="lp-btn lp-btn-grad" onClick={onStart} style={{ padding:'18px 40px', fontSize:17 }}>✦ Criar minha conta grátis</button>
          </section>
        </div>

        {/* FOOTER */}
        <footer className="lp-footer">
          <div className="lp-wrap">
            aiin · Inteligência artificial para Instagram · {new Date().getFullYear()}
          </div>
        </footer>
      </div>
    </>
  )
}
