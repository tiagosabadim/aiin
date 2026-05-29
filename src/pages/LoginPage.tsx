// aiin · LoginPage v3 — idêntico à referência
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const FEATURES = [
  { icon: '/icons/icon-dna.png',      fallback: '✦', text: 'Brand DNA que aprende com sua marca' },
  { icon: '/icons/icon-posts.png',    fallback: '◫', text: 'Posts, carrosséis e stories com IA'  },
  { icon: '/icons/icon-agenda.png',   fallback: '📅', text: 'Agendamento e publicação automática' },
  { icon: '/icons/icon-insights.png', fallback: '📊', text: 'Insights e aprendizado contínuo'    },
]

export function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isSignup, setIsSignup] = useState(false)
  const [done, setDone]         = useState(false)

  const submit = async () => {
    if (!email || !password) return
    setLoading(true); setError(null)
    try {
      if (isSignup) {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        setDone(true)
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao entrar')
    } finally { setLoading(false) }
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: '100%', height: 52, paddingLeft: 44, paddingRight: 44,
    border: `1.5px solid ${focused ? '#F72585' : 'rgba(7,13,31,.12)'}`,
    borderRadius: 12, fontSize: 15, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box', background: '#FAFAFA',
    color: '#070D1F', transition: 'border-color .15s',
  })

  const [emailFocus, setEmailFocus] = useState(false)
  const [passFocus, setPassFocus]   = useState(false)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden', background: '#08060F', backgroundImage: 'url(/login-bg.png), url(/login-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* Glows decorativos — idênticos à referência */}
      <div style={{ position: 'absolute', bottom: '-5%', right: '25%', width: 600, height: 400, zIndex: 1, background: 'radial-gradient(ellipse, rgba(123,44,255,.35) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '0', right: '10%', width: 400, height: 300, zIndex: 1, background: 'radial-gradient(ellipse, rgba(247,37,133,.25) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '20%', left: '5%', width: 300, height: 300, zIndex: 1, background: 'radial-gradient(circle, rgba(123,44,255,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* ── ESQUERDA — brand ── */}
      <div style={{ flex: 1, position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 8%' }}>

        {/* Logo grande */}
        <div style={{ marginBottom: 36 }}>
          <img src="/logo.png" alt="aiin"
            style={{ height: 80, objectFit: 'contain', maxWidth: 220 }}
            onError={e => {
              const el = e.target as HTMLImageElement
              el.style.display = 'none'
              const s = document.createElement('span')
              s.textContent = 'aiin'
              Object.assign(s.style, { fontSize: '48px', fontWeight: '800', background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'block' })
              el.parentElement?.appendChild(s)
            }}
          />
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 58, fontWeight: 800, color: 'white', letterSpacing: '-2px', lineHeight: 1.1, marginBottom: 20, whiteSpace: 'nowrap' }}>
          Crie. Publique.{' '}
          <span style={{ background: 'linear-gradient(135deg,#FF6A00,#F72585)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Cresça.
          </span>
        </h1>

        <p style={{ fontSize: 15, color: 'rgba(255,255,255,.45)', lineHeight: 1.7, marginBottom: 44 }}>
          Do briefing ao post pronto.<br />
          Conteúdo estático automático com IA.
        </p>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', backdropFilter: 'blur(8px)' }}>
                <img src={f.icon} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }}
                  onError={e => { const el = e.target as HTMLImageElement; el.style.display = 'none'; el.parentElement!.innerHTML = `<span style="font-size:20px">${f.fallback}</span>` }} />
              </div>
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,.65)', fontWeight: 400 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── DIREITA — card flutuante ── */}
      <div style={{ width: 540, flexShrink: 0, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 80px 48px 20px' }}>

        <div style={{ width: '100%', maxWidth: 420, background: 'rgba(255,255,255,.98)', borderRadius: 20, padding: '40px 36px', boxShadow: '0 32px 80px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.08)' }}>

          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#070D1F', letterSpacing: '-.5px', marginBottom: 6, textAlign: 'center' }}>
            {isSignup ? 'Criar sua conta' : 'Entrar no aiin'}
          </h2>
          <p style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 32 }}>
            {isSignup ? 'Comece a criar posts com IA hoje.' : 'Bem-vindo de volta.'}
          </p>

          {done ? (
            <div style={{ padding: '24px', background: '#E1F5EE', border: '1px solid rgba(29,158,117,.2)', borderRadius: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1D9E75', marginBottom: 8 }}>Confirme seu email</div>
              <div style={{ fontSize: 14, color: '#374151' }}>Enviamos um link para <strong>{email}</strong></div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Email */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9CA3AF', pointerEvents: 'none' }}>✉</span>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
                    placeholder="seu@email.com" autoComplete="email"
                    style={inputStyle(emailFocus)}
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9CA3AF', pointerEvents: 'none' }}>🔒</span>
                  <input
                    type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    onFocus={() => setPassFocus(true)} onBlur={() => setPassFocus(false)}
                    placeholder="••••••••" autoComplete={isSignup ? 'new-password' : 'current-password'}
                    style={inputStyle(passFocus)}
                  />
                  <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 17, padding: 0, lineHeight: 1 }}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
                {!isSignup && (
                  <div style={{ textAlign: 'right', marginTop: 8 }}>
                    <button
                      onClick={async () => {
                        if (!email) { setError('Preencha o email para recuperar a senha'); return }
                        await supabase.auth.resetPasswordForEmail(email)
                        setError(null)
                        alert('Email de recuperação enviado!')
                      }}
                      style={{ background: 'none', border: 'none', color: '#F72585', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                      Esqueci minha senha
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: '#FCEBEB', border: '1px solid rgba(226,75,74,.2)', borderRadius: 10, fontSize: 13, color: '#E24B4A' }}>{error}</div>
              )}

              {/* Botão entrar */}
              <button
                onClick={submit}
                disabled={loading || !email || !password}
                style={{ width: '100%', height: 52, background: 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 14, color: 'white', fontSize: 16, fontWeight: 700, cursor: loading || !email || !password ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(247,37,133,.35)', opacity: loading || !email || !password ? .5 : 1, transition: 'opacity .15s', marginTop: 4 }}>
                {loading
                  ? <><div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Entrando...</>
                  : isSignup ? 'Criar conta →' : 'Entrar →'
                }
              </button>

              {/* Divisor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(7,13,31,.08)' }} />
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>ou</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(7,13,31,.08)' }} />
              </div>

              {/* Google */}
              <button
                onClick={signInWithGoogle}
                style={{ width: '100%', height: 52, background: '#fff', border: '1.5px solid rgba(7,13,31,.12)', borderRadius: 14, fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#374151' }}>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.2 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.3 0-9.6-2.8-11.3-7l-6.6 5.1C9.7 39.6 16.3 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.5l6.2 5.2C40.8 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
                </svg>
                Continuar com Google
              </button>

              {/* Trocar modo */}
              <p style={{ textAlign: 'center', fontSize: 14, color: '#9CA3AF', margin: '4px 0 0' }}>
                {isSignup ? 'Já tem conta?' : 'Não tem conta?'}{' '}
                <button
                  onClick={() => { setIsSignup(!isSignup); setError(null) }}
                  style={{ background: 'none', border: 'none', color: '#F72585', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600 }}>
                  {isSignup ? 'Entrar' : 'Criar conta'}
                </button>
              </p>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
