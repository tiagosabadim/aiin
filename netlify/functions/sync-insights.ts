// ============================================================
//  aiin · sync-insights (Netlify Scheduled Function)
//  Cron: todo dia às 6h da manhã
//  Puxa métricas do Instagram Graph API para todos os
//  workspaces com token configurado e posts publicados.
//  Salva em brand_learnings para alimentar o Brand DNA.
// ============================================================
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface PostInsight {
  instagram_post_id: string
  impressions: number
  reach: number
  likes: number
  comments: number
  saved: number
  shares: number
  engagement_rate: number
}

export const handler = async (event: any) => {
  try {
    // Se vier workspace_id/brand_id no body → sincroniza SÓ aquela marca (chamada manual do dashboard)
    // Se não vier → cron diário, percorre todas (uso controlado, agendado)
    let scopeWorkspaceId: string | null = null
    let scopeBrandId: string | null = null
    try {
      const body = JSON.parse(event?.body ?? '{}')
      scopeWorkspaceId = body.workspace_id ?? null
      scopeBrandId = body.brand_id ?? null
    } catch { /* sem body = cron */ }

    console.log(`sync-insights: iniciando${scopeWorkspaceId ? ` (workspace ${scopeWorkspaceId})` : ' (todas as marcas - cron)'}...`)

    // Monta a query: filtrada por workspace/brand, ou todas
    let q = supabase
      .from('brand_profiles')
      .select('id, workspace_id, name, instagram_account_id, instagram_access_token')
      .not('instagram_access_token', 'is', null)
      .not('instagram_account_id', 'is', null)

    if (scopeBrandId) q = q.eq('id', scopeBrandId)
    else if (scopeWorkspaceId) q = q.eq('workspace_id', scopeWorkspaceId)

    const { data: brands } = await q

    if (!brands?.length) {
      console.log('Nenhuma marca com Instagram configurado neste escopo.')
      return { statusCode: 200, body: JSON.stringify({ synced: 0 }) }
    }

    for (const brand of brands) {
      try {
        await syncBrandInsights(brand)
      } catch (err: any) {
        console.error(`Erro na marca ${brand.name}:`, err.message)
      }
    }

    return { statusCode: 200, body: JSON.stringify({ synced: brands.length }) }
  } catch (err: any) {
    console.error('Erro geral sync-insights:', err.message)
    return { statusCode: 500, body: err.message }
  }
}

async function syncBrandInsights(brand: any) {
  const { id: brandId, workspace_id, instagram_account_id, instagram_access_token, name } = brand
  const token = instagram_access_token
  const accountId = instagram_account_id

  // Busca posts publicados nos últimos 90 dias que ainda não têm insights
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: outputs } = await supabase
    .from('creative_outputs')
    .select('id, instagram_post_id, published_at, caption, format')
    .eq('workspace_id', workspace_id)
    .eq('status', 'published')
    .not('instagram_post_id', 'is', null)
    .or('instagram_deleted.is.null,instagram_deleted.eq.false')
    .gte('published_at', ninetyDaysAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(50)

  if (!outputs?.length) {
    console.log(`${name}: sem posts publicados para sincronizar`)
    return
  }

  console.log(`${name}: sincronizando ${outputs.length} posts...`)

  const insights: PostInsight[] = []

  for (const output of outputs) {
    try {
      // ── 1. Likes e comentários: campos diretos do post (sempre disponíveis, sem insights) ──
      const fieldsRes = await fetch(
        `https://graph.facebook.com/v22.0/${output.instagram_post_id}?fields=like_count,comments_count,media_type&access_token=${token}`
      )
      const fieldsData = await fieldsRes.json()

      // Se o post não existe (deletado pelo usuário ou ID antigo), marca como deletado e para de tentar
      if (fieldsData.error) {
        const msg = (fieldsData.error.message ?? '').toLowerCase()
        const notFound = msg.includes('does not exist') || fieldsData.error.code === 100
        if (notFound) {
          await supabase.from('creative_outputs').update({ instagram_deleted: true }).eq('id', output.id)
          console.log(`Post ${output.instagram_post_id}: deletado do Instagram — marcado, não será mais sincronizado`)
        } else {
          console.log(`Post ${output.instagram_post_id}: ${fieldsData.error.message} — pulando`)
        }
        continue
      }

      const likes = fieldsData.like_count ?? 0
      const comments = fieldsData.comments_count ?? 0

      // ── 2. Insights (reach, saved, shares): tolerante a erro de permissão/métrica ──
      let reach = 0, saved = 0, shares = 0, impressions = 0
      try {
        // Métricas básicas que funcionam em imagem e carrossel
        const insRes = await fetch(
          `https://graph.facebook.com/v22.0/${output.instagram_post_id}/insights?metric=reach,saved,shares&access_token=${token}`
        )
        const insData = await insRes.json()
        if (!insData.error) {
          for (const item of insData.data ?? []) {
            const v = item.values?.[0]?.value ?? 0
            if (item.name === 'reach') reach = v
            if (item.name === 'saved') saved = v
            if (item.name === 'shares') shares = v
          }
        } else {
          console.log(`Post ${output.instagram_post_id}: insights indisponíveis (${insData.error.message}) — usando só likes/comentários`)
        }
      } catch { /* insights podem não existir para o tipo de mídia; segue com likes/comentários */ }

      const engagementRate = reach > 0 ? ((likes + comments + saved + shares) / reach) * 100 : 0

      insights.push({
        instagram_post_id: output.instagram_post_id,
        impressions, reach, likes, comments, saved, shares,
        engagement_rate: Math.round(engagementRate * 100) / 100,
      })

      const { error: upErr } = await supabase.from('post_insights').upsert({
        workspace_id: brand.workspace_id,
        output_id: output.id,
        instagram_post_id: output.instagram_post_id,
        impressions, reach, likes, comments, saved, shares,
        engagement_rate: Math.round(engagementRate * 100) / 100,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'output_id' })

      if (upErr) console.error(`Falha ao salvar insights do post ${output.instagram_post_id}: ${upErr.message}`)
      else console.log(`Post ${output.instagram_post_id}: ${likes} likes, ${comments} comentários, reach ${reach} — salvo`)

    } catch (err: any) {
      console.error(`Erro no post ${output.instagram_post_id}:`, err.message)
    }
  }

  if (!insights.length) return

  // Analisa os dados com GPT-4o e gera aprendizado
  const learning = await generateLearning(brand, outputs, insights)
  if (learning) {
    await supabase.from('brand_learnings').insert({
      workspace_id,
      brand_id: brandId,
      learning_type: 'performance',
      content: learning,
    })
    console.log(`${name}: aprendizado salvo.`)
  }
}

async function generateLearning(brand: any, outputs: any[], insights: PostInsight[]): Promise<string> {
  // Ordena por engajamento
  const sorted = [...insights].sort((a, b) => b.engagement_rate - a.engagement_rate)
  const top3    = sorted.slice(0, 3)
  const bottom3 = sorted.slice(-3)

  // Cruza com captions
  const outputMap = Object.fromEntries(outputs.map(o => [o.instagram_post_id, o]))

  const topPosts = top3.map(i => {
    const o = outputMap[i.instagram_post_id]
    return `"${o?.caption?.slice(0,80) ?? 'sem legenda'}..." → ${i.engagement_rate}% engaj, ${i.reach} alcance, ${i.likes} likes, ${i.saved} salvamentos`
  }).join('\n')

  const bottomPosts = bottom3.map(i => {
    const o = outputMap[i.instagram_post_id]
    return `"${o?.caption?.slice(0,80) ?? 'sem legenda'}..." → ${i.engagement_rate}% engaj, ${i.reach} alcance`
  }).join('\n')

  const avgEngagement = insights.reduce((s, i) => s + i.engagement_rate, 0) / insights.length
  const avgReach      = insights.reduce((s, i) => s + i.reach, 0) / insights.length

  const prompt = `Você é um analista de Instagram especializado em pequenos negócios no Brasil.

MARCA: ${brand.name} (${brand.segment})
PERÍODO ANALISADO: últimos 90 dias
POSTS ANALISADOS: ${insights.length}
MÉDIAS: ${avgEngagement.toFixed(2)}% engajamento, ${Math.round(avgReach)} alcance médio

TOP 3 POSTS (maior engajamento):
${topPosts}

PIORES 3 POSTS (menor engajamento):
${bottomPosts}

Baseado nesses dados reais, escreva um aprendizado curto (máximo 4 frases) que:
1. Identifica o padrão do que funcionou melhor
2. Aponta o que deve ser evitado
3. Dá uma recomendação prática para os próximos posts

Seja específico, direto e baseado nos dados. Em português.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.5,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}
