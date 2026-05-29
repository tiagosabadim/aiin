// aiin · LoginPage v2 — conforme mockup aprovado
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── ESQUERDA — brand ── */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'center',
        padding: '48px 64px',
      }}>
        {/* Background image com fallback de gradiente */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'url(/login-bg.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          backgroundColor: '#08060F',
        }} />
        {/* Overlay escuro para legibilidade */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(135deg, rgba(8,6,15,.75) 0%, rgba(8,6,15,.5) 100%)' }} />

        {/* Conteúdo */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 480 }}>

          {/* Logo */}
          <div style={{ marginBottom: 40 }}>
            <img src="/logo.png" alt="aiin" style={{ height: 40, objectFit: 'contain' }}
              onError={e => {
                const el = e.target as HTMLImageElement
                el.style.display = 'none'
                const fb = document.createElement('div')
                fb.innerHTML = '<span style="font-size:32px;font-weight:800;background:linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent">aiin</span>'
                el.parentElement?.appendChild(fb)
              }}
            />
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 42, fontWeight: 800, color: 'white', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 16 }}>
            Crie. Publique.{' '}
            <span style={{ background: 'linear-gradient(135deg,#FF6A00,#F72585)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cresça.</span>
          </h1>

          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.55)', lineHeight: 1.7, marginBottom: 40 }}>
            Do briefing ao post pronto.<br />
            Conteúdo estático automático com IA.
          </p>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={f.icon} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }}
                    onError={e => { const el = e.target as HTMLImageElement; el.style.display = 'none'; el.parentElement!.textContent = f.fallback }} />
                </div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', fontWeight: 400 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── DIREITA — form ── */}
      <div style={{ width: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', background: '#fff' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Card */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '40px 36px', boxShadow: '0 4px 40px rgba(0,0,0,.08)', border: '1px solid rgba(7,13,31,.07)' }}>

            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#070D1F', letterSpacing: '-.4px', marginBottom: 6, textAlign: 'center' }}>
              {isSignup ? 'Criar sua conta' : 'Entrar no aiin'}
            </h2>
            <p style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 28 }}>
              {isSignup ? 'Comece a criar posts com IA hoje.' : 'Bem-vindo de volta.'}
            </p>

            {done ? (
              <div style={{ padding: '20px', background: '#E1F5EE', border: '1px solid rgba(29,158,117,.2)', borderRadius: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>✉️</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1D9E75', marginBottom: 6 }}>Confirme seu email</div>
                <div style={{ fontSize: 13, color: '#374151' }}>Enviamos um link para <strong>{email}</strong></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Email */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Email</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#9CA3AF' }}>✉</span>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submit()}
                      placeholder="seu@email.com" autoComplete="email"
                      style={{ width: '100%', height: 46, paddingLeft: 38, paddingRight: 14, border: '1.5px solid rgba(7,13,31,.12)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#F72585'}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(7,13,31,.12)'}
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Senha</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#9CA3AF' }}>🔒</span>
                    <input
                      type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submit()}
                      placeholder="••••••••" autoComplete={isSignup ? 'new-password' : 'current-password'}
                      style={{ width: '100%', height: 46, paddingLeft: 38, paddingRight: 44, border: '1.5px solid rgba(7,13,31,.12)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#F72585'}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(7,13,31,.12)'}
                    />
                    <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, padding: 0 }}>
                      {showPass ? '🙈' : '👁'}
                    </button>
                  </div>
                  {!isSignup && (
                    <div style={{ textAlign: 'right', marginTop: 6 }}>
                      <button onClick={async () => { if (!email) { setError('Preencha o email para recuperar a senha'); return }; await supabase.auth.resetPasswordForEmail(email); setError(null); alert('Email de recuperação enviado!') }} style={{ background: 'none', border: 'none', color: '#F72585', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Esqueci minha senha
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <div style={{ padding: '10px 12px', background: '#FCEBEB', border: '1px solid rgba(226,75,74,.2)', borderRadius: 8, fontSize: 13, color: '#E24B4A' }}>{error}</div>
                )}

                {/* Botão principal */}
                <button onClick={submit} disabled={loading || !email || !password}
                  style={{ width: '100%', height: 48, background: loading || !email || !password ? '#e5e7eb' : 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)', border: 'none', borderRadius: 12, color: loading || !email || !password ? '#9CA3AF' : 'white', fontSize: 15, fontWeight: 700, cursor: loading || !email || !password ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: loading || !email || !password ? 'none' : '0 4px 16px rgba(247,37,133,.3)', transition: 'all .2s', marginTop: 4 }}>
                  {loading
                    ? <><div style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Entrando...</>
                    : isSignup ? 'Criar conta →' : 'Entrar →'
                  }
                </button>

                {/* Divisor */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(7,13,31,.08)' }} />
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>ou</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(7,13,31,.08)' }} />
                </div>

                {/* Google */}
                <button onClick={signInWithGoogle}
                  style={{ width: '100%', height: 46, background: '#fff', border: '1.5px solid rgba(7,13,31,.12)', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#374151', transition: 'border-color .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#F72585'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(7,13,31,.12)'}>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.2 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.3 0-9.6-2.8-11.3-7l-6.6 5.1C9.7 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.5l6.2 5.2C40.8 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
                  Continuar com Google
                </button>

                {/* Trocar modo */}
                <p style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
                  {isSignup ? 'Já tem conta?' : 'Não tem conta?'}{' '}
                  <button onClick={() => { setIsSignup(!isSignup); setError(null) }}
                    style={{ background: 'none', border: 'none', color: '#F72585', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
                    {isSignup ? 'Entrar' : 'Criar conta'}
                  </button>
                </p>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
