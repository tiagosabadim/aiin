// aiin · LoginPage v4 — Desktop idêntico à referência + Mobile first
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const FEATURES = [
  { icon: '/icons/icon-dna.png',      fallback: '✦', text: 'Brand DNA que aprende com sua marca' },
  { icon: '/icons/icon-posts.png',    fallback: '◫', text: 'Posts, carrosséis e stories com IA'  },
  { icon: '/icons/icon-agenda.png',   fallback: '📅', text: 'Agendamento e publicação automática' },
  { icon: '/icons/icon-insights.png', fallback: '📊', text: 'Insights e aprendizado contínuo'    },
]

export function LoginPage() {
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [isSignup,   setIsSignup]   = useState(false)
  const [done,       setDone]       = useState(false)
  const [emailFocus, setEmailFocus] = useState(false)
  const [passFocus,  setPassFocus]  = useState(false)

  const submit = async () => {
    if (!email || !password) return
    setLoading(true); setError(null)
    try {
      if (isSignup) {
        const { error: e } = await supabase.auth.signUp({ email, password })
        if (e) throw e
        setDone(true)
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password })
        if (e) throw e
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao entrar')
    } finally { setLoading(false) }
  }

  const loginGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }

  const recoverPass = async () => {
    if (!email) { setError('Preencha o email primeiro'); return }
    await supabase.auth.resetPasswordForEmail(email)
    alert('Email de recuperação enviado!')
  }

  return (
    <>
      {/* ── CSS responsivo separado — nunca toca desktop arrumando mobile ── */}
      <style>{`
        .login-root {
          min-height: 100vh;
          display: flex;
          position: relative;
          overflow: hidden;
          background: #08060F;
          background-image: url(/login-bg.png), url(/login-bg.jpg);
          background-size: cover;
          background-position: center;
        }

        /* DESKTOP — duas colunas */
        .login-left {
          flex: 1;
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 48px 60px 10%;
        }
        .login-right {
          width: 600px;
          flex-shrink: 0;
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 72px 48px 24px;
        }
        .login-card {
          width: 100%;
          max-width: 460px;
          background: #ffffff;
          border-radius: 20px;
          padding: 44px 44px;
          box-shadow: 0 24px 80px rgba(0,0,0,.4);
        }
        .login-logo { height: 96px; object-fit: contain; max-width: 260px; }
        .login-logo-mb { margin-bottom: 40px; }
        .login-headline {
          font-size: 60px;
          font-weight: 800;
          color: white;
          letter-spacing: -2px;
          line-height: 1.05;
          margin-bottom: 20px;
          white-space: nowrap;
        }
        .login-desc {
          font-size: 15px;
          color: rgba(255,255,255,.5);
          line-height: 1.7;
          margin-bottom: 44px;
        }
        .login-feature-icon {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(255,255,255,.12);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; overflow: hidden;
        }
        .login-features { display: flex; flex-direction: column; gap: 20px; }
        .login-feature-text { font-size: 15px; color: rgba(255,255,255,.7); }

        /* MOBILE — card tela cheia, esquerda some */
        @media (max-width: 768px) {
          .login-left { display: none; }
          .login-right {
            width: 100%;
            padding: 0;
            align-items: flex-start;
            min-height: 100vh;
          }
          .login-card {
            max-width: 100%;
            min-height: 100vh;
            border-radius: 0;
            padding: 48px 24px 40px;
            display: flex;
            flex-direction: column;
          }
          .login-card-inner { flex: 1; display: flex; flex-direction: column; justify-content: center; }
        }

        /* Input focus */
        .login-input {
          width: 100%;
          height: 52px;
          padding-left: 44px;
          padding-right: 44px;
          border: 1.5px solid rgba(7,13,31,.12);
          border-radius: 12px;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          background: #fff;
          color: #070D1F;
          transition: border-color .15s;
        }
        .login-input:focus { border-color: #F72585; }
        .login-btn-primary {
          width: 100%; height: 52px;
          background: linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF);
          border: none; border-radius: 14px;
          color: white; font-size: 16px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 20px rgba(247,37,133,.35);
          transition: opacity .15s;
        }
        .login-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
        .login-btn-google {
          width: 100%; height: 52px;
          background: #fff;
          border: 1.5px solid rgba(7,13,31,.12);
          border-radius: 14px;
          font-size: 15px; font-weight: 500;
          cursor: pointer; font-family: inherit;
          display: flex; align-items: center; justify-content: center; gap: 12px;
          color: #374151; transition: border-color .15s;
        }
        .login-btn-google:hover { border-color: #F72585; }
      `}</style>

      <div className="login-root">

        {/* Glows */}
        <div style={{ position:'absolute', bottom:'-5%', right:'30%', width:600, height:400, zIndex:1, background:'radial-gradient(ellipse, rgba(123,44,255,.4) 0%, transparent 65%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'0', right:'15%', width:400, height:300, zIndex:1, background:'radial-gradient(ellipse, rgba(247,37,133,.25) 0%, transparent 65%)', pointerEvents:'none' }} />

        {/* ESQUERDA */}
        <div className="login-left">
          <div className="login-logo-mb">
            <img src="/logo.png" alt="aiin" className="login-logo"
              onError={e => {
                const el = e.target as HTMLImageElement
                el.style.display = 'none'
                const s = document.createElement('span')
                s.textContent = 'aiin'
                Object.assign(s.style, { fontSize:'60px', fontWeight:'800', background:'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', display:'block' })
                el.parentElement?.appendChild(s)
              }}
            />
          </div>

          <h1 className="login-headline">
            Crie. Publique.{' '}
            <span style={{ background:'linear-gradient(135deg,#FF6A00,#F72585)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Cresça.
            </span>
          </h1>

          <p className="login-desc">
            Do briefing ao post pronto.<br />
            Conteúdo estático automático com IA.
          </p>

          <div className="login-features">
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div className="login-feature-icon">
                  <img src={f.icon} alt="" style={{ width:30, height:30, objectFit:'contain' }}
                    onError={e => { const el = e.target as HTMLImageElement; el.style.display='none'; el.parentElement!.innerHTML=`<span style="font-size:20px">${f.fallback}</span>` }} />
                </div>
                <span className="login-feature-text">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* DIREITA */}
        <div className="login-right">
          <div className="login-card">
            <div className="login-card-inner">

              {/* Mobile: logo no topo do card */}
              <div style={{ display:'none' }} className="login-mobile-logo">
                <img src="/logo.png" alt="aiin" style={{ height:48, marginBottom:32, display:'block' }} />
              </div>

              <h2 style={{ fontSize:28, fontWeight:700, color:'#070D1F', letterSpacing:'-.5px', marginBottom:6, textAlign:'center' }}>
                {isSignup ? 'Criar sua conta' : 'Entrar no aiin'}
              </h2>
              <p style={{ fontSize:14, color:'#6B7280', textAlign:'center', marginBottom:32 }}>
                {isSignup ? 'Comece a criar posts com IA hoje.' : 'Bem-vindo de volta.'}
              </p>

              {done ? (
                <div style={{ padding:'24px', background:'#E1F5EE', border:'1px solid rgba(29,158,117,.2)', borderRadius:14, textAlign:'center' }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>✉️</div>
                  <div style={{ fontSize:16, fontWeight:600, color:'#1D9E75', marginBottom:8 }}>Confirme seu email</div>
                  <div style={{ fontSize:14, color:'#374151' }}>Enviamos um link para <strong>{email}</strong></div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                  <div>
                    <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:7 }}>Email</label>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'#9CA3AF', pointerEvents:'none' }}>✉</span>
                      <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&submit()}
                        placeholder="seu@email.com" autoComplete="email"
                        className="login-input" />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:7 }}>Senha</label>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'#9CA3AF', pointerEvents:'none' }}>🔒</span>
                      <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&submit()}
                        placeholder="••••••••" autoComplete={isSignup?'new-password':'current-password'}
                        className="login-input" />
                      <button onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:17, padding:0 }}>
                        {showPass?'🙈':'👁'}
                      </button>
                    </div>
                    {!isSignup && (
                      <div style={{ textAlign:'right', marginTop:8 }}>
                        <button onClick={recoverPass} style={{ background:'none', border:'none', color:'#F72585', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
                          Esqueci minha senha
                        </button>
                      </div>
                    )}
                  </div>

                  {error && <div style={{ padding:'10px 14px', background:'#FCEBEB', border:'1px solid rgba(226,75,74,.2)', borderRadius:10, fontSize:13, color:'#E24B4A' }}>{error}</div>}

                  <button onClick={submit} disabled={loading||!email||!password} className="login-btn-primary" style={{ marginTop:4 }}>
                    {loading
                      ? <><div style={{ width:18, height:18, border:'2.5px solid rgba(255,255,255,.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 1s linear infinite' }} /> Entrando...</>
                      : isSignup ? 'Criar conta →' : 'Entrar →'
                    }
                  </button>

                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1, height:1, background:'rgba(7,13,31,.08)' }} />
                    <span style={{ fontSize:13, color:'#9CA3AF' }}>ou</span>
                    <div style={{ flex:1, height:1, background:'rgba(7,13,31,.08)' }} />
                  </div>

                  <button onClick={loginGoogle} className="login-btn-google">
                    <svg width="20" height="20" viewBox="0 0 48 48">
                      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.2 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.3 0-9.6-2.8-11.3-7l-6.6 5.1C9.7 39.6 16.3 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.5l6.2 5.2C40.8 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
                    </svg>
                    Continuar com Google
                  </button>

                  <p style={{ textAlign:'center', fontSize:14, color:'#9CA3AF', margin:'4px 0 0' }}>
                    {isSignup?'Já tem conta?':'Não tem conta?'}{' '}
                    <button onClick={()=>{setIsSignup(!isSignup);setError(null)}}
                      style={{ background:'none', border:'none', color:'#F72585', cursor:'pointer', fontSize:14, fontFamily:'inherit', fontWeight:600 }}>
                      {isSignup?'Entrar':'Criar conta'}
                    </button>
                  </p>

                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
