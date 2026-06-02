// ============================================================
//  aiin · publish-scheduled (Scheduled Function — cron 5min)
//  LEVE e RÁPIDA: apenas encontra posts prontos e dispara a
//  publish-worker-background para cada um (que faz o trabalho
//  pesado em até 15min). Não publica nada diretamente, para
//  não estourar o limite de 30s das scheduled functions.
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const APP_URL = process.env.APP_URL ?? 'https://aiinapp.netlify.app'

export const handler = async () => {
  try {
    const now = new Date().toISOString()

    // Resgate: posts presos em 'publishing' há mais de 20min (worker morreu/falhou)
    // voltam para 'scheduled' para nova tentativa.
    const stuck = new Date(Date.now() - 20 * 60 * 1000).toISOString()
    await supabase.from('scheduled_posts')
      .update({ status: 'scheduled' })
      .eq('status', 'publishing')
      .lt('scheduled_at', stuck)

    const { data: posts } = await supabase
      .from('scheduled_posts')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .limit(25)

    if (!posts || posts.length === 0) {
      console.log('Nenhum post para publicar agora.')
      return { statusCode: 200, body: 'ok' }
    }

    console.log(`${posts.length} post(s) prontos. Disparando workers...`)

    for (const post of posts) {
      // Marca como publishing ANTES de disparar, para o próximo ciclo do cron
      // não pegar o mesmo post de novo (evita publicação duplicada).
      await supabase.from('scheduled_posts').update({ status: 'publishing' }).eq('id', post.id)

      // Dispara a worker em background (não espera terminar — invocação assíncrona)
      fetch(`${APP_URL}/.netlify/functions/publish-worker-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      }).catch(err => console.error(`Falha ao disparar worker para ${post.id}:`, err.message))

      console.log(`  worker disparado para post ${post.id}`)
    }

    return { statusCode: 200, body: JSON.stringify({ dispatched: posts.length }) }

  } catch (err: any) {
    console.error('publish-scheduled error:', err.message)
    return { statusCode: 500, body: err.message }
  }
}
