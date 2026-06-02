// aiin · analyze-profile — análise completa do perfil do Instagram com IA
// Roda em background (até 15min). Puxa conta + posts recentes, gera nota e recomendações.
import { createClient } from '@supabase/supabase-js'
import { trackUsage } from './usage-tracker'

const OPENAI_KEY = process.env.OPENAI_API_KEY!
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const GRAPH = 'https://graph.facebook.com/v22.0'

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  try {
    const { workspace_id, brand_id } = JSON.parse(event.body ?? '{}')
    if (!workspace_id || !brand_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'workspace_id e brand_id obrigatórios' }) }
    }

    const { data: brand } = await supabase
      .from('brand_profiles').select('*').eq('id', brand_id).single()

    if (!brand?.instagram_account_id || !brand?.instagram_access_token) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Instagram não conectado' }) }
    }

    const accountId = brand.instagram_account_id
    const token = brand.instagram_access_token

    // 1. Dados do perfil (conta business)
    const profileRes = await fetch(
      `${GRAPH}/${accountId}?fields=name,username,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${token}`
    )
    const profile = await profileRes.json()
    if (profile.error) throw new Error(`Perfil: ${profile.error.message}`)

    // 2. Últimos posts (até 25) com métricas básicas
    const mediaRes = await fetch(
      `${GRAPH}/${accountId}/media?fields=caption,media_type,like_count,comments_count,timestamp,permalink&limit=25&access_token=${token}`
    )
    const mediaData = await mediaRes.json()
    const posts = mediaData.data ?? []

    // 3. Métricas agregadas da conta (métricas válidas na v22+: reach, views)
    // 'impressions' e 'profile_views' foram descontinuadas — usar 'reach' e 'views'
    let reach = 0, views = 0
    try {
      const insightsRes = await fetch(
        `${GRAPH}/${accountId}/insights?metric=reach,views&period=days_28&metric_type=total_value&access_token=${token}`
      )
      const insightsData = await insightsRes.json()
      for (const m of insightsData.data ?? []) {
        const val = m.total_value?.value ?? m.values?.[0]?.value ?? 0
        if (m.name === 'reach') reach = val
        if (m.name === 'views') views = val
      }
    } catch { /* insights podem não estar disponíveis em contas novas */ }
    const impressions = views  // mantém compat com o resto do código (views substituiu impressions)
    const profileViews = 0

    // 4. Calcula engajamento médio dos posts
    const totalEng = posts.reduce((s: number, p: any) => s + (p.like_count ?? 0) + (p.comments_count ?? 0), 0)
    const avgEng = posts.length > 0 ? totalEng / posts.length : 0
    const engRate = profile.followers_count > 0 ? (avgEng / profile.followers_count) * 100 : 0

    // 5. Salva snapshot de métricas da conta
    const { data: lastMetric } = await supabase
      .from('brand_metrics').select('followers_count')
      .eq('workspace_id', workspace_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const followersDelta = lastMetric ? (profile.followers_count ?? 0) - lastMetric.followers_count : 0

    await supabase.from('brand_metrics').insert({
      workspace_id, brand_id,
      followers_count: profile.followers_count ?? 0,
      follows_count: profile.follows_count ?? 0,
      media_count: profile.media_count ?? 0,
      reach, impressions, profile_views: profileViews,
      followers_delta: followersDelta,
    })

    // 5.5. Busca a analise anterior para dar inteligencia/memoria a IA
    const { data: prevAnalysis } = await supabase
      .from('profile_analysis')
      .select('score, bio_suggestion, improvements, created_at')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let historyContext = ''
    if (prevAnalysis) {
      const daysSince = Math.floor((Date.now() - new Date(prevAnalysis.created_at).getTime()) / 86400000)
      const currentBio = (profile.biography ?? '').trim()
      const suggestedBio = (prevAnalysis.bio_suggestion ?? '').trim()
      const bioMatches = !!(suggestedBio && currentBio &&
        (currentBio === suggestedBio ||
         currentBio.replace(/\s+/g,' ').toLowerCase().includes(suggestedBio.replace(/\s+/g,' ').toLowerCase().slice(0, 40))))
      const prevImprovements = (prevAnalysis.improvements ?? [])
        .map((i) => `- [${i.area}] ${i.suggestion}`).join('\n')

      historyContext = [
        '',
        '=== HISTORICO (IMPORTANTE - seja inteligente e evite repetir) ===',
        `Ja houve uma analise anterior ha ${daysSince} dia(s). Nota anterior: ${prevAnalysis.score ?? '?'}/100.`,
        '',
        'Recomendacoes que JA foram dadas antes:',
        (prevImprovements || '(nenhuma)'),
        '',
        bioMatches
          ? `A BIO ATUAL JA E A QUE VOCE SUGERIU antes. O usuario APLICOU sua sugestao. NAO sugira trocar a bio de novo. Mudancas de bio precisam de pelo menos 30 dias para medir efeito. ${daysSince < 30 ? `Faltam ~${30 - daysSince} dias para avaliar o impacto. Reconheca que a bio foi melhorada e esta em periodo de avaliacao.` : 'Ja passou tempo suficiente - so sugira ajuste na bio se houver motivo CLARO e novo nos dados.'}`
          : 'A bio mudou ou nao seguiu a sugestao anterior - pode avaliar normalmente.',
        '',
        'REGRAS DE INTELIGENCIA:',
        '- NAO repita recomendacoes ja dadas se o usuario aparenta te-las seguido.',
        '- Se uma mudanca foi feita ha menos de 30 dias, de tempo de medir - elogie o progresso em vez de pedir nova mudanca.',
        '- Foque em recomendacoes NOVAS, diferentes das anteriores, baseadas no que os dados mostram agora.',
        '- Se o perfil esta estavel e sem novos problemas, diga isso e sugira so manutencao ou pequenos ajustes.',
        '================================================================',
      ].join('\n')
    }

    // 6. Monta o contexto para a IA analisar
    const postsContext = posts.slice(0, 15).map((p: any, i: number) =>
      `Post ${i+1} (${p.media_type}): ${(p.caption ?? '').slice(0, 120)} | ${p.like_count ?? 0} likes, ${p.comments_count ?? 0} comentários`
    ).join('\n')

    const analysisPrompt = `Você é um especialista em marketing de Instagram. Analise este perfil e dê uma avaliação honesta e útil.

PERFIL:
- Nome: ${profile.name ?? brand.name}
- @${profile.username ?? ''}
- Bio: "${profile.biography ?? '(sem bio)'}"
- Seguidores: ${profile.followers_count ?? 0}
- Seguindo: ${profile.follows_count ?? 0}
- Posts publicados: ${profile.media_count ?? 0}
- Engajamento médio por post: ${avgEng.toFixed(0)} interações (${engRate.toFixed(1)}% dos seguidores)
- Alcance (28 dias): ${reach}

SEGMENTO DA MARCA: ${brand.segment ?? 'não informado'}
PÚBLICO-ALVO: ${brand.target_audience ?? 'não informado'}

ÚLTIMOS POSTS:
${postsContext || '(sem posts recentes)'}
${historyContext}

Responda APENAS com um JSON válido (sem markdown, sem crases) neste formato:
{
  "score": <nota de 0 a 100 avaliando a saúde geral do perfil>,
  "summary": "<resumo de 2 frases sobre o estado do perfil>",
  "strengths": [{"title": "<ponto forte>", "desc": "<explicação curta>"}],
  "improvements": [{"area": "<bio|foto|feed|frequência|engajamento|conteúdo>", "suggestion": "<sugestão prática e específica>", "priority": "<alta|media|baixa>"}],
  "bio_suggestion": "<sugestao de bio reescrita SOMENTE se a bio precisar melhorar E nao for ja uma sugestao sua aplicada recentemente; senao retorne string vazia>"
}

Dê de 2 a 4 pontos fortes e de 3 a 5 melhorias. Seja específico e prático, não genérico.`

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: analysisPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    })
    const aiData = await aiRes.json()
    if (aiData.error) throw new Error(`IA: ${aiData.error.message}`)

    await trackUsage({
      workspace_id, brand_id, operation: 'content', model: 'gpt-4o',
      input_tokens: aiData.usage?.prompt_tokens ?? 0,
      output_tokens: aiData.usage?.completion_tokens ?? 0,
    })

    const analysis = JSON.parse(aiData.choices[0].message.content)

    // 7. Salva a análise
    await supabase.from('profile_analysis').insert({
      workspace_id, brand_id,
      score: analysis.score ?? 0,
      summary: analysis.summary ?? '',
      strengths: analysis.strengths ?? [],
      improvements: analysis.improvements ?? [],
      bio_suggestion: analysis.bio_suggestion ?? '',
      account_data: {
        username: profile.username, followers: profile.followers_count,
        media_count: profile.media_count, avg_engagement: avgEng, eng_rate: engRate,
      },
    })

    console.log(`[analyze-profile] ${brand.name}: nota ${analysis.score}`)
    return { statusCode: 200, body: JSON.stringify({ ok: true, score: analysis.score }) }

  } catch (e: any) {
    console.error('analyze-profile error:', e.message)
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
