// ============================================================
//  aiin · publish-worker (Background Function — até 15min)
//  Publica UM post agendado no Instagram. Chamada pela
//  publish-scheduled (cron) com { post_id } no body.
//  Faz o trabalho pesado: containers + polling de status + publish.
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const GRAPH = 'https://graph.facebook.com/v22.0'
const cleanUrl = (u: string) => u.split('?')[0]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function createContainer(accountId: string, token: string, body: Record<string, any>): Promise<string> {
  let lastErr = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${GRAPH}/${accountId}/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: token }),
    })
    const data = await res.json()
    if (!data.error && data.id) return data.id
    lastErr = data.error?.message ?? 'erro desconhecido'
    const code = data.error?.code
    if (code === 4 || code === 2 || code === 1) { await sleep(3000 * attempt); continue }
    throw new Error(lastErr)
  }
  throw new Error(`Falha após 3 tentativas: ${lastErr}`)
}

async function waitContainerReady(containerId: string, token: string, maxWaitMs = 120000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`)
    const data = await res.json()
    const status = data.status_code
    if (status === 'FINISHED') return
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Container falhou: ${data.status ?? status}`)
    await sleep(3000)
  }
  throw new Error('Timeout aguardando processamento do container')
}

export const handler = async (event: any) => {
  let postId = ''
  try {
    const body = JSON.parse(event?.body ?? '{}')
    postId = body.post_id
    if (!postId) return { statusCode: 400, body: 'post_id obrigatório' }

    // Carrega o post agendado + output + brand
    const { data: post } = await supabase
      .from('scheduled_posts')
      .select(`
        id, output_id, brand_id,
        output:creative_outputs(id, public_url, caption, format),
        brand:brand_profiles(instagram_account_id, instagram_access_token)
      `)
      .eq('id', postId)
      .single()

    if (!post) { console.error(`Post ${postId} não encontrado`); return { statusCode: 404, body: 'not found' } }

    const brand  = (post as any).brand
    const output = (post as any).output

    if (!brand?.instagram_account_id || !brand?.instagram_access_token) {
      await supabase.from('scheduled_posts').update({ status: 'failed', error_message: 'Credenciais do Instagram não configuradas' }).eq('id', postId)
      return { statusCode: 200, body: 'sem credenciais' }
    }
    if (!output?.public_url) {
      await supabase.from('scheduled_posts').update({ status: 'failed', error_message: 'Imagem não disponível' }).eq('id', postId)
      return { statusCode: 200, body: 'sem imagem' }
    }

    const accountId  = brand.instagram_account_id
    const token      = brand.instagram_access_token
    const caption    = output.caption ?? ''
    const isCarousel = output.format?.startsWith('carrossel')

    let slideUrls: string[] = [output.public_url]
    if (isCarousel) {
      const { data: pages } = await supabase
        .from('carousel_pages')
        .select('public_url, page_number')
        .eq('creative_output_id', output.id)
        .order('page_number')
      const urls = (pages ?? []).map((p: any) => p.public_url).filter(Boolean)
      if (urls.length > 1) slideUrls = urls
      console.log(`Post ${postId}: carrossel com ${slideUrls.length} slides`)
    }

    let containerId: string

    if (isCarousel && slideUrls.length > 1) {
      const childIds: string[] = []
      for (let i = 0; i < slideUrls.length; i++) {
        const childId = await createContainer(accountId, token, {
          image_url: cleanUrl(slideUrls[i]),
          is_carousel_item: true,
        })
        await waitContainerReady(childId, token)
        childIds.push(childId)
        console.log(`  slide ${i + 1}/${slideUrls.length} pronto: ${childId}`)
      }
      containerId = await createContainer(accountId, token, {
        media_type: 'CAROUSEL', children: childIds.join(','), caption,
      })
      await waitContainerReady(containerId, token)
      console.log(`Carrossel pronto: ${containerId} (${childIds.length} slides)`)
    } else {
      containerId = await createContainer(accountId, token, {
        image_url: cleanUrl(output.public_url), caption,
      })
      await waitContainerReady(containerId, token)
      console.log(`Container pronto: ${containerId}`)
    }

    // Publica com retry
    let instagramPostId = ''
    let pubErr = ''
    for (let attempt = 1; attempt <= 3; attempt++) {
      const pubRes = await fetch(`${GRAPH}/${accountId}/media_publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerId, access_token: token }),
      })
      const pubData = await pubRes.json()
      if (!pubData.error && pubData.id) { instagramPostId = pubData.id; break }
      pubErr = pubData.error?.message ?? 'erro ao publicar'
      if (pubData.error?.code === 9007 || pubData.error?.code === 4) { await sleep(5000 * attempt); continue }
      throw new Error(`Publish error: ${pubErr}`)
    }
    if (!instagramPostId) throw new Error(`Publish error: ${pubErr}`)

    console.log(`Publicado! Instagram Post ID: ${instagramPostId}`)

    await supabase.from('scheduled_posts').update({
      status: 'published', instagram_post_id: instagramPostId, published_at: new Date().toISOString(),
    }).eq('id', postId)
    await supabase.from('creative_outputs').update({
      status: 'published', instagram_post_id: instagramPostId, published_at: new Date().toISOString(),
    }).eq('id', (post as any).output_id)

    return { statusCode: 200, body: JSON.stringify({ ok: true, instagramPostId }) }

  } catch (err: any) {
    console.error(`Erro ao publicar post ${postId}:`, err.message)
    if (postId) {
      await supabase.from('scheduled_posts').update({
        status: 'failed', error_message: (err.message ?? 'erro desconhecido').slice(0, 500),
      }).eq('id', postId)
    }
    return { statusCode: 500, body: err.message }
  }
}
