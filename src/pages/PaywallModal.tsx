// aiin · PaywallModal — trava após o post grátis, mostra os 3 planos + checkout Stripe
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Plan {
  id: string; name: string; monthly_price: number; monthly_credits: number
  features: string[]; highlight: boolean
}

export function PaywallModal({ workspaceId, userEmail, onClose }: {
  workspaceId: string; userEmail?: string; onClose?: () => void
}) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('plans').select('*').eq('active', true).order('display_order')
      .then(({ data }) => {
        if (data) setPlans(data.map((p: any) => ({
          ...p, features: Array.isArray(p.features) ? p.features : [],
        })))
      })
  }, [])

  const subscribe = async (planId: string) => {
    setLoading(planId); setError(null)
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, workspace_id: workspaceId, user_email: userEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao iniciar pagamento')
      window.location.href = data.url  // redireciona pro Stripe Checkout
    } catch (e: any) {
      setError(e.message ?? 'Erro ao assinar')
      setLoading(null)
    }
  }

  return (
    <>
      <style>{`
        .pw-overlay { position:fixed; inset:0; background:rgba(7,13,31,.75); backdrop-filter:blur(4px); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; overflow-y:auto; }
        .pw-modal { background:#fff; border-radius:24px; max-width:920px; width:100%; padding:40px; position:relative; }
        .pw-title { font-size:26px; font-weight:800; color:#070D1F; text-align:center; letter-spacing:-.5px; margin-bottom:6px; }
        .pw-sub { font-size:15px; color:#6B7280; text-align:center; margin-bottom:32px; }
        .pw-plans { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        .pw-plan { border:1.5px solid rgba(7,13,31,.1); border-radius:18px; padding:24px 22px; position:relative; display:flex; flex-direction:column; }
        .pw-plan.hl { border-color:#F72585; background:rgba(247,37,133,.03); }
        .pw-badge { position:absolute; top:-11px; left:50%; transform:translateX(-50%); background:linear-gradient(135deg,#FF6A00,#F72585); color:#fff; font-size:10px; font-weight:700; padding:4px 12px; border-radius:99px; white-space:nowrap; }
        .pw-plan h3 { font-size:18px; font-weight:700; color:#070D1F; }
        .pw-price { font-size:34px; font-weight:800; color:#070D1F; letter-spacing:-1px; margin:10px 0 2px; }
        .pw-price span { font-size:14px; font-weight:400; color:#9CA3AF; }
        .pw-credits { font-size:12px; color:#F72585; font-weight:600; margin-bottom:18px; }
        .pw-plan ul { list-style:none; padding:0; margin:0 0 20px; display:flex; flex-direction:column; gap:9px; flex:1; }
        .pw-plan li { font-size:12.5px; color:#374151; display:flex; gap:7px; line-height:1.4; }
        .pw-plan li::before { content:'✓'; color:#1D9E75; font-weight:700; flex-shrink:0; }
        .pw-btn { width:100%; height:46px; border-radius:12px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; }

        @media (max-width:768px) {
          .pw-modal { padding:28px 20px; border-radius:20px; }
          .pw-title { font-size:21px; }
          .pw-sub { font-size:13px; margin-bottom:24px; }
          .pw-plans { grid-template-columns:1fr; gap:28px; }
          .pw-plan.hl { order:-1; }
        }
      `}</style>

      <div className="pw-overlay">
        <div className="pw-modal">
          {onClose && (
            <button onClick={onClose} style={{ position:'absolute', top:20, right:20, background:'none', border:'none', fontSize:22, color:'#9CA3AF', cursor:'pointer' }}>×</button>
          )}

          <div style={{ fontSize:32, textAlign:'center', marginBottom:8 }}>🎉</div>
          <h2 className="pw-title">Você usou seu post grátis!</h2>
          <p className="pw-sub">Escolha um plano para continuar criando conteúdo com a aiin.</p>

          {error && (
            <div style={{ maxWidth:400, margin:'0 auto 20px', padding:'10px 14px', background:'#FCEBEB', border:'1px solid rgba(226,75,74,.2)', borderRadius:10, fontSize:13, color:'#E24B4A', textAlign:'center' }}>{error}</div>
          )}

          <div className="pw-plans">
            {plans.map(plan => (
              <div key={plan.id} className={`pw-plan ${plan.highlight ? 'hl' : ''}`}>
                {plan.highlight && <div className="pw-badge">⭐ MAIS POPULAR</div>}
                <h3>{plan.name}</h3>
                <div className="pw-price">R$ {plan.monthly_price}<span>/mês</span></div>
                <div className="pw-credits">{plan.monthly_credits} créditos por mês</div>
                <ul>{plan.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                <button className="pw-btn" onClick={() => subscribe(plan.id)} disabled={!!loading} style={{
                  background: plan.highlight ? 'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)' : 'transparent',
                  border: plan.highlight ? 'none' : '1.5px solid rgba(7,13,31,.15)',
                  color: plan.highlight ? '#fff' : '#070D1F',
                  opacity: loading && loading !== plan.id ? .5 : 1,
                }}>
                  {loading === plan.id ? 'Redirecionando...' : 'Assinar ' + plan.name}
                </button>
              </div>
            ))}
          </div>

          <p style={{ textAlign:'center', fontSize:12, color:'#9CA3AF', marginTop:24 }}>
            Pagamento seguro via Stripe · Cancele quando quiser
          </p>
        </div>
      </div>
    </>
  )
}
