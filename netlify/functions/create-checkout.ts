// aiin · create-checkout — cria sessão de Stripe Checkout para assinar um plano
import { createClient } from '@supabase/supabase-js'

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!
const APP_URL    = process.env.APP_URL ?? 'https://aiinapp.netlify.app'
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { plan_id, workspace_id, user_email } = JSON.parse(event.body ?? '{}')
    if (!plan_id || !workspace_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'plan_id e workspace_id obrigatórios' }) }
    }

    // Buscar o plano e seu price_id do Stripe
    const { data: plan, error: planErr } = await supabase
      .from('plans').select('*').eq('id', plan_id).single()

    if (planErr || !plan) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Plano não encontrado' }) }
    }
    if (!plan.stripe_price_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Plano sem price_id do Stripe configurado' }) }
    }

    // Criar sessão de checkout via API REST do Stripe (sem SDK)
    const params = new URLSearchParams()
    params.append('mode', 'subscription')
    params.append('line_items[0][price]', plan.stripe_price_id)
    params.append('line_items[0][quantity]', '1')
    params.append('success_url', `${APP_URL}/#checkout-success?session_id={CHECKOUT_SESSION_ID}`)
    params.append('cancel_url', `${APP_URL}/#dashboard`)
    params.append('client_reference_id', workspace_id)
    params.append('metadata[workspace_id]', workspace_id)
    params.append('metadata[plan_id]', plan_id)
    if (user_email) params.append('customer_email', user_email)

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const session = await res.json()
    if (session.error) throw new Error(session.error.message)

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) }

  } catch (e: any) {
    console.error('create-checkout error:', e.message)
    return { statusCode: 500, body: JSON.stringify({ error: e.message ?? 'Erro ao criar checkout' }) }
  }
}
