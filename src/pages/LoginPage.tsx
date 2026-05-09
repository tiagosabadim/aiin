import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

type Mode = 'login' | 'signup'

export function LoginPage() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const [mode, setMode]       = useState<Mode>('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await signInWithEmail(email, password)
        if (error) throw error
      } else {
        const { error } = await signUpWithEmail(email, password)
        if (error) throw error
        setSuccess('Conta criada! Verifique seu e-mail para confirmar.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(
        msg.includes('Invalid login') ? 'E-mail ou senha incorretos.' :
        msg.includes('already registered') ? 'Este e-mail já está cadastrado.' :
        msg
      )
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: 'var(--bg)',
    }}>

      {/* ---- Lado esquerdo: marca ---- */}
      <div style={{
        background: 'var(--brand)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* padrão decorativo */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.06) 0%, transparent 50%),
                            radial-gradient(circle at 80% 80%, rgba(255,255,255,0.04) 0%, transparent 40%)`,
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white"/>
              </svg>
            </div>
            <span style={{ fontSize: 20, fontWeight: 500, color: 'white', fontFamily: 'var(--font-sans)' }}>
              PostAI
            </span>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 38,
            color: 'white',
            lineHeight: 1.25,
            marginBottom: 20,
            fontStyle: 'italic',
          }}>
            Posts que<br />aprendem com<br />você.
          </p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, maxWidth: 320 }}>
            Briefing → IA cria posts → você aprova → publica automaticamente no Instagram. A cada ciclo, os posts ficam melhores.
          </p>
        </div>

        <div style={{ position: 'relative', display: 'flex', gap: 28 }}>
          {[['38k', 'Posts gerados'], ['94%', 'Taxa de aprovação'], ['2.4×', 'Mais engajamento']].map(([val, label]) => (
            <div key={label}>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'white' }}>{val}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Lado direito: form ---- */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 52px',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 28,
            color: 'var(--text-1)',
            marginBottom: 8,
          }}>
            {mode === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 28 }}>
            {mode === 'login'
              ? 'Entre para gerenciar seus posts.'
              : 'Comece grátis, sem cartão de crédito.'}
          </p>

          {/* Google */}
          <button
            onClick={handleGoogle}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '10px 16px',
              border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              color: 'var(--text-1)',
              fontSize: 14,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              marginBottom: 20,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>ou com e-mail</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid var(--border-md)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  color: 'var(--text-1)',
                  background: 'var(--surface)',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-md)'}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid var(--border-md)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  color: 'var(--text-1)',
                  background: 'var(--surface)',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-md)'}
              />
            </div>

            {error && (
              <div style={{
                padding: '9px 12px',
                background: 'var(--red-light)',
                border: '1px solid rgba(192,57,43,0.2)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                padding: '9px 12px',
                background: 'var(--brand-light)',
                border: '1px solid rgba(61,90,62,0.2)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--brand-dark)',
              }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: loading ? 'var(--brand-mid)' : 'var(--brand)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4,
              }}
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginTop: 20 }}>
            {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setSuccess(null) }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand)',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
              }}
            >
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
