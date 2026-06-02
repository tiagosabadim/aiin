// ============================================================
//  aiin · Netlify Scheduled Function
//  Publica posts agendados no Instagram via Meta Graph API
//  Roda a cada 5 minutos via cron
//  Robusto: verifica status real do container antes de publicar,
//  com retry e tratamento de erro por etapa.
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const GRAPH = 'https://graph.facebook.com/v22.0'

// Limpa a URL (remove cache-bust ?v=) — Graph rejeita query strings
const cleanUrl = (u: string) => u.split('?')[0]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Cria um container de mídia, com retry em caso de falha transitória
async function createContainer(accountId: string, token: string, body: Record<string, any>): Promise<string> {
  let lastErr = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${GRAPH}/${accountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: token }),
    })
    const data = await res.json()
    if (!data.error && data.id) return data.id
    lastErr = data.error?.message ?? 'erro desconhecido'
    // Erros transitórios (rate limit, indisponível) → espera e tenta de novo
    const code = data.error?.code
    if (code === 4 || code === 2 || code === 1) { await sleep(3000 * attempt); continue }
    // Erro permanente → para já
    throw new Error(lastErr)
  }
  throw new Error(`Falha após 3 tentativas: ${lastErr}`)
}

// Verifica o status de processamento de um container (FINISHED, IN_PROGRESS, ERROR)
async function waitContainerReady(containerId: string, token: string, maxWaitMs = 60000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`)
    const data = await res.json()
    const status = data.status_code
    if (status === 'FINISHED') return
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Container falhou: ${data.status ?? status}`)
    }
    // IN_PROGRESS → espera e checa de novo
    await sleep(3000)
  }
  throw new Error('Timeout aguardando processamento do container')
}

export const handler = async () => {
  try {
    const now = new Date().toISOString()

    const { data: posts } = await supabase
      .from('scheduled_posts')
      .select(`
        id, workspace_id, output_id, brand_id, scheduled_at,
        output:creative_outputs(id, public_url, caption, format),
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
          await supabase.from('scheduled_posts').update({
            status: 'failed', error_message: 'Token ou Account ID do Instagram não configurado',
          }).eq('id', post.id)
          continue
        }
        if (!output?.public_url) {
          await supabase.from('scheduled_posts').update({
            status: 'failed', error_message: 'Imagem não disponível',
          }).eq('id', post.id)
          continue
        }

        await supabase.from('scheduled_posts').update({ status: 'publishing' }).eq('id', post.id)

        const accountId = brand.instagram_account_id
        const token     = brand.instagram_access_token
        const caption   = output.caption ?? ''
        const isCarousel = output.format?.startsWith('carrossel')

        // Monta a lista de URLs dos slides
        let slideUrls: string[] = [output.public_url]
        if (isCarousel) {
          const { data: pages } = await supabase
            .from('carousel_pages')
            .select('public_url, page_number')
            .eq('creative_output_id', output.id)
            .order('page_number')
          const urls = (pages ?? []).map((p: any) => p.public_url).filter(Boolean)
          if (urls.length > 1) slideUrls = urls
          console.log(`Post ${post.id}: carrossel com ${slideUrls.length} slides`)
        }

        let containerId: string

        if (isCarousel && slideUrls.length > 1) {
          // ── CARROSSEL ──
          // 1) Um container por slide, esperando CADA um ficar pronto
          const childIds: string[] = []
          for (let i = 0; i < slideUrls.length; i++) {
            const childId = await createContainer(accountId, token, {
              image_url: cleanUrl(slideUrls[i]),
              is_carousel_item: true,
            })
            await waitContainerReady(childId, token)  // espera o slide processar de verdade
            childIds.push(childId)
            console.log(`  slide ${i + 1}/${slideUrls.length} pronto: ${childId}`)
          }

          // 2) Container pai CAROUSEL
          containerId = await createContainer(accountId, token, {
            media_type: 'CAROUSEL',
            children: childIds.join(','),
            caption,
          })
          await waitContainerReady(containerId, token)
          console.log(`Carrossel pronto: ${containerId} (${childIds.length} slides)`)

        } else {
          // ── IMAGEM ÚNICA ──
          containerId = await createContainer(accountId, token, {
            image_url: cleanUrl(output.public_url),
            caption,
          })
          await waitContainerReady(containerId, token)
          console.log(`Container pronto: ${containerId}`)
        }

        // Publica (com retry em erro transitório)
        let instagramPostId = ''
        let pubErr = ''
        for (let attempt = 1; attempt <= 3; attempt++) {
          const publishRes = await fetch(`${GRAPH}/${accountId}/media_publish`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: containerId, access_token: token }),
          })
          const publishData = await publishRes.json()
          if (!publishData.error && publishData.id) { instagramPostId = publishData.id; break }
          pubErr = publishData.error?.message ?? 'erro ao publicar'
          // Media ainda processando → espera e tenta de novo
          if (publishData.error?.code === 9007 || publishData.error?.code === 4) { await sleep(4000 * attempt); continue }
          throw new Error(`Publish error: ${pubErr}`)
        }
        if (!instagramPostId) throw new Error(`Publish error: ${pubErr}`)

        console.log(`Publicado! Instagram Post ID: ${instagramPostId}`)

        await supabase.from('scheduled_posts').update({
          status: 'published', instagram_post_id: instagramPostId, published_at: new Date().toISOString(),
        }).eq('id', post.id)
        await supabase.from('creative_outputs').update({
          status: 'published', instagram_post_id: instagramPostId, published_at: new Date().toISOString(),
        }).eq('id', post.output_id)

      } catch (err: any) {
        console.error(`Erro ao publicar post ${post.id}:`, err.message)
        await supabase.from('scheduled_posts').update({
          status: 'failed', error_message: (err.message ?? 'erro desconhecido').slice(0, 500),
        }).eq('id', post.id)
      }
    }

    return { statusCode: 200, body: JSON.stringify({ processed: posts.length }) }

  } catch (err: any) {
    console.error('publish-scheduled error:', err.message)
    return { statusCode: 500, body: err.message }
  }
}
