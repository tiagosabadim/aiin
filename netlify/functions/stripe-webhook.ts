// aiin · stripe-webhook — ativa a subscription quando o pagamento confirma
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const stripeEvent = JSON.parse(event.body ?? '{}')

    // checkout.session.completed → assinatura paga e ativa
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object
      const workspaceId = session.metadata?.workspace_id ?? session.client_reference_id
      const planId = session.metadata?.plan_id

      if (workspaceId && planId) {
        const { data: plan } = await supabase.from('plans').select('*').eq('id', planId).single()

        const periodEnd = new Date()
        periodEnd.setMonth(periodEnd.getMonth() + 1)

        // Cria ou atualiza a subscription
        const { data: existing } = await supabase
          .from('subscriptions').select('id').eq('workspace_id', workspaceId).maybeSingle()

        const subData = {
          workspace_id: workspaceId,
          plan_id: planId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          monthly_credits_available: plan?.monthly_credits ?? 0,
          extra_credits_available: 0,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
        }

        if (existing) {
          await supabase.from('subscriptions').update(subData).eq('id', existing.id)
        } else {
          await supabase.from('subscriptions').insert(subData)
        }

        // Atualiza o plano do workspace
        await supabase.from('workspaces').update({ plan_id: planId }).eq('id', workspaceId)
      }
    }

    // invoice.paid → renovação mensal, recarrega créditos
    if (stripeEvent.type === 'invoice.paid') {
      const invoice = stripeEvent.data.object
      const subId = invoice.subscription
      if (subId) {
        const { data: sub } = await supabase
          .from('subscriptions').select('*, plan:plans(*)').eq('stripe_subscription_id', subId).maybeSingle()
        if (sub) {
          const periodEnd = new Date(); periodEnd.setMonth(periodEnd.getMonth() + 1)
          await supabase.from('subscriptions').update({
            status: 'active',
            monthly_credits_available: sub.plan?.monthly_credits ?? 0,
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
          }).eq('id', sub.id)
        }
      }
    }

    // subscription cancelada
    if (stripeEvent.type === 'customer.subscription.deleted') {
      const sub = stripeEvent.data.object
      await supabase.from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', sub.id)
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) }

  } catch (e: any) {
    console.error('stripe-webhook error:', e.message)
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
