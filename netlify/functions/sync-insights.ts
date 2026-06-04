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
      //
      // ⚠️ LIMITAÇÃO CONHECIDA (app em Standard Access / dev mode):
      // O endpoint /{media-id}/insights exige a permissão `instagram_manage_insights`,
      // que NÃO está disponível no app enquanto ele não passar pelo App Review da Meta.
      // Por isso reach/saved/shares por POST vêm 0 hoje (erro #10 permission).
      // Likes e comentários funcionam normalmente (vêm dos campos diretos do post, acima).
      //
      // ✅ QUANDO FIZER O APP REVIEW (para produção com contas de clientes):
      //   1. Solicitar a permissão `instagram_manage_insights` (Advanced Access) no painel da Meta
      //   2. Regerar o token incluindo essa permissão
      //   3. A partir daí, reach/saved/shares por post passam a vir preenchidos automaticamente
      //      (este código já está pronto, é só a permissão liberar)
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

  // Analisa os dados com GPT-4o e gera aprendizado de performance
  const learning = await generateLearning(brand, outputs, insights)
  if (learning) {
    // Consolida: mantém só o aprendizado de performance MAIS RECENTE (não empilha contraditórios).
    // Apaga os de performance anteriores desta marca e insere o novo.
    await supabase.from('brand_learnings')
      .delete()
      .eq('brand_id', brandId)
      .eq('learning_type', 'performance')
    await supabase.from('brand_learnings').insert({
      workspace_id,
      brand_id: brandId,
      learning_type: 'performance',
      content: learning,
    })
    console.log(`${name}: aprendizado de performance atualizado.`)
  }
}

async function generateLearning(brand: any, outputs: any[], insights: PostInsight[]): Promise<string> {
  const outputMap = Object.fromEntries(outputs.map(o => [o.instagram_post_id, o]))

  // Score de interação robusto: usa likes+comentários+saves+shares (não depende só de reach,
  // que pode vir 0 por falta de permissão de insights de mídia). Saves e shares pesam mais.
  const interactionScore = (i: any) =>
    (i.likes ?? 0) + (i.comments ?? 0) * 2 + (i.saved ?? 0) * 3 + (i.shares ?? 0) * 4

  const enriched = insights.map(i => {
    const o = outputMap[i.instagram_post_id]
    return { ...i, output: o, score: interactionScore(i), format: o?.format ?? 'desconhecido' }
  }).filter(e => e.output)

  const sorted  = [...enriched].sort((a, b) => b.score - a.score)
  const top3    = sorted.slice(0, 3)
  const bottom3 = sorted.slice(-3)

  const fmtLine = (e: any) =>
    `[${e.format}] "${e.output?.caption?.slice(0,70) ?? 'sem legenda'}..." → ${e.likes} likes, ${e.comments} coment, ${e.saved} salv, ${e.shares} compart (alcance ${e.reach})`

  const topPosts    = top3.map(fmtLine).join('\n')
  const bottomPosts = bottom3.map(fmtLine).join('\n')

  // Performance por FORMATO (qual tipo de conteúdo rende mais para esta marca)
  const byFormat: Record<string, { n: number; score: number }> = {}
  for (const e of enriched) {
    byFormat[e.format] = byFormat[e.format] ?? { n: 0, score: 0 }
    byFormat[e.format].n += 1
    byFormat[e.format].score += e.score
  }
  const formatPerf = Object.entries(byFormat)
    .map(([f, v]) => `${f}: média ${(v.score / v.n).toFixed(1)} de interação (${v.n} posts)`)
    .join('\n')

  const avgEngagement = insights.reduce((s, i) => s + i.engagement_rate, 0) / insights.length
  const avgReach      = insights.reduce((s, i) => s + i.reach, 0) / insights.length

  const prompt = `Você é um estrategista de conteúdo que analisa a performance REAL de uma marca no Instagram para ensinar a IA de geração a criar posts cada vez melhores PARA ESTA MARCA ESPECÍFICA.

MARCA: ${brand.name} (${brand.segment})
PERÍODO: últimos 90 dias | POSTS: ${insights.length}
MÉDIAS: ${avgEngagement.toFixed(2)}% engajamento, ${Math.round(avgReach)} alcance

PERFORMANCE POR FORMATO:
${formatPerf}

TOP POSTS (mais interação — saves e compartilhamentos pesam mais):
${topPosts}

PIORES POSTS:
${bottomPosts}

Analise os dados e gere um APRENDIZADO ACIONÁVEL para guiar as próximas gerações desta marca. Foque em padrões concretos, não em conselhos genéricos. Escreva em português, direto, no formato:

• FORMATO QUE MAIS RENDE: [qual formato performa melhor para esta marca, com base nos dados]
• TEMAS/ÂNGULOS QUE FUNCIONARAM: [padrões dos top posts — tipo de assunto, abordagem, tom]
• O QUE EVITAR: [padrões dos piores posts]
• RECOMENDAÇÃO PARA OS PRÓXIMOS POSTS: [direção concreta e específica]

Se os dados ainda forem poucos (menos de 5 posts), diga que a base ainda é pequena e dê uma recomendação inicial cautelosa, sem conclusões fortes.`

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
