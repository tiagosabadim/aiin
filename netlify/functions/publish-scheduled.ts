// ============================================================
//  aiin · Netlify Scheduled Function
//  Publica posts agendados no Instagram via Meta Graph API
//  Roda a cada 5 minutos via cron
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export const handler = async () => {
  try {
    const now = new Date().toISOString()

    // Busca posts agendados que já passaram do horário
    const { data: posts } = await supabase
      .from('scheduled_posts')
      .select(`
        id, workspace_id, output_id, brand_id, scheduled_at,
        output:creative_outputs(public_url, caption, format),
        brand:brand_profiles(instagram_account_id, instagram_access_token)
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .limit(10)

    if (!posts || posts.length === 0) {
      console.log('Nenhum post para publicar agora.')
      return { statusCode: 200, body: 'ok' }
    }

    console.log(`Publicando ${posts.length} posts...`)

    for (const post of posts as any[]) {
      try {
        const brand  = post.brand
        const output = post.output

        if (!brand?.instagram_account_id || !brand?.instagram_access_token) {
          console.log(`Post ${post.id}: sem credenciais do Instagram`)
          await supabase.from('scheduled_posts').update({
            status: 'failed',
            error_message: 'Token ou Account ID do Instagram não configurado',
          }).eq('id', post.id)
          continue
        }

        if (!output?.public_url) {
          console.log(`Post ${post.id}: sem imagem`)
          await supabase.from('scheduled_posts').update({
            status: 'failed',
            error_message: 'Imagem não disponível',
          }).eq('id', post.id)
          continue
        }

        // Marca como publicando
        await supabase.from('scheduled_posts').update({ status: 'publishing' }).eq('id', post.id)

        const accountId = brand.instagram_account_id
        const token     = brand.instagram_access_token
        const caption   = output.caption ?? ''
        const imageUrl  = output.public_url

        // Passo 1 — Cria container de mídia
        const containerRes = await fetch(
          `https://graph.facebook.com/v19.0/${accountId}/media`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_url: imageUrl,
              caption,
              access_token: token,
            }),
          }
        )
        const containerData = await containerRes.json()

        if (containerData.error) {
          throw new Error(`Container error: ${containerData.error.message}`)
        }

        const containerId = containerData.id
        console.log(`Container criado: ${containerId}`)

        // Aguarda 3s para o container processar
        await new Promise(r => setTimeout(r, 3000))

        // Passo 2 — Publica o container
        const publishRes = await fetch(
          `https://graph.facebook.com/v19.0/${accountId}/media_publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              creation_id: containerId,
              access_token: token,
            }),
          }
        )
        const publishData = await publishRes.json()

        if (publishData.error) {
          throw new Error(`Publish error: ${publishData.error.message}`)
        }

        const instagramPostId = publishData.id
        console.log(`Publicado! Instagram Post ID: ${instagramPostId}`)

        // Atualiza status no banco
        await supabase.from('scheduled_posts').update({
          status: 'published',
          instagram_post_id: instagramPostId,
          published_at: new Date().toISOString(),
        }).eq('id', post.id)

        await supabase.from('creative_outputs').update({
          status: 'published',
          instagram_post_id: instagramPostId,
          published_at: new Date().toISOString(),
        }).eq('id', post.output_id)

      } catch (err: any) {
        console.error(`Erro ao publicar post ${post.id}:`, err.message)
        await supabase.from('scheduled_posts').update({
          status: 'failed',
          error_message: err.message,
        }).eq('id', post.id)
      }
    }

    return { statusCode: 200, body: JSON.stringify({ published: posts.length }) }

  } catch (err: any) {
    console.error('Erro geral:', err.message)
    return { statusCode: 500, body: err.message }
  }
}
