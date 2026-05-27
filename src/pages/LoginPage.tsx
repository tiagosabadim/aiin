import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex' }}>

      {/* Left — brand */}
      <div style={{ flex:1, background:'#05060D', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:48, position:'relative', overflow:'hidden' }}>
        {/* Glow de fundo */}
        <div style={{ position:'absolute', top:'30%', left:'50%', transform:'translate(-50%,-50%)', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(247,37,133,.15) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'20%', right:'20%', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(123,44,255,.1) 0%, transparent 70%)', pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:1, textAlign:'center', maxWidth:400 }}>
          {/* Logo */}
          <div style={{ width:64, height:64, borderRadius:20, background:'var(--gradient)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:28, color:'white', marginBottom:24, boxShadow:'0 12px 32px rgba(247,37,133,.3)' }}>★</div>

          <div style={{ fontSize:32, fontWeight:800, color:'white', letterSpacing:'-.5px', marginBottom:8 }}>
            <span style={{ background:'var(--gradient)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>aiin</span>
          </div>

          <div style={{ fontSize:18, fontWeight:600, color:'rgba(255,255,255,.9)', marginBottom:16, letterSpacing:'-.2px' }}>
            Crie. Publique. Cresça.
          </div>

          <div style={{ fontSize:14, color:'rgba(255,255,255,.45)', lineHeight:1.8, marginBottom:40 }}>
            Do briefing ao post pronto.<br/>
            Conteúdo estático automático com IA.
          </div>

          {/* Feature list */}
          {[
            ['✦', 'Brand DNA que aprende com sua marca'],
            ['◫', 'Posts, carrosseis e stories com IA'],
            ['📅', 'Agendamento e publicação automática'],
            ['📊', 'Insights e aprendizado contínuo'],
          ].map(([icon, text]) => (
            <div key={String(text)} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, textAlign:'left' }}>
              <div style={{ width:32, height:32, borderRadius:10, background:'rgba(247,37,133,.12)', border:'1px solid rgba(247,37,133,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{icon}</div>
              <span style={{ fontSize:13, color:'rgba(255,255,255,.6)' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — form */}
      <div style={{ width:440, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:48, background:'var(--bg)' }}>
        <div style={{ width:'100%', maxWidth:360 }}>

          <div style={{ marginBottom:28 }}>
            <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-1)', letterSpacing:'-.3px', marginBottom:6 }}>
              {isSignup ? 'Criar sua conta' : 'Entrar no aiin'}
            </h1>
            <p style={{ fontSize:14, color:'var(--text-3)' }}>
              {isSignup ? 'Comece a criar posts com IA hoje.' : 'Bem-vindo de volta.'}
            </p>
          </div>

          {done ? (
            <div style={{ padding:'16px', background:'var(--success-light)', border:'1px solid rgba(29,158,117,.2)', borderRadius:'var(--radius-lg)', textAlign:'center' }}>
              <div style={{ fontSize:24, marginBottom:8 }}>✉️</div>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--success)', marginBottom:4 }}>Confirme seu email</div>
              <div style={{ fontSize:13, color:'var(--text-2)' }}>Enviamos um link de confirmação para <strong>{email}</strong></div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="seu@email.com" autoComplete="email" />
              </div>
              <div>
                <label className="label">Senha</label>
                <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="••••••••" autoComplete={isSignup ? 'new-password' : 'current-password'} />
              </div>

              {error && (
                <div style={{ padding:'10px 12px', background:'var(--red-light)', border:'1px solid rgba(226,75,74,.2)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--red)' }}>{error}</div>
              )}

              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:4 }} onClick={submit} disabled={loading || !email || !password}>
                {loading
                  ? <><span className="spin" style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }} /> Entrando...</>
                  : isSignup ? 'Criar conta →' : 'Entrar →'
                }
              </button>

              <div style={{ textAlign:'center', fontSize:13, color:'var(--text-3)' }}>
                {isSignup ? 'Já tem conta?' : 'Não tem conta?'}{' '}
                <button onClick={() => { setIsSignup(!isSignup); setError(null) }}
                  style={{ background:'none', border:'none', color:'var(--accent-pink)', cursor:'pointer', fontSize:13, fontFamily:'var(--font-sans)', fontWeight:500 }}>
                  {isSignup ? 'Entrar' : 'Criar conta'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
