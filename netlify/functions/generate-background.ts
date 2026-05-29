// ============================================================
//  aiin · Netlify Background Function v3
//  - Post estático sempre 1080x1350
//  - Título do briefing vai pro prompt
//  - Todos os dados do onboarding no prompt
//  - Responses API com contexto visual da marca
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const OPENAI_KEY = process.env.OPENAI_API_KEY!
const OPENAI_BASE = 'https://api.openai.com/v1'

interface Slide {
  headline: string
  body: string
  cta?: string
  visual_prompt: string
  public_url?: string
}

interface GeneratedContent {
  caption: string
  hashtags: string[]
  slides: Slide[]
  ai_score: number
}

// ---- Tamanho fixo por tipo ----
function getImageSize(jobType: string): string {
  // Todas as dimensões divisíveis por 16 (requisito da API)
  if (jobType === 'story' || jobType === 'story_sequencia' || jobType === 'capa_reels') {
    return '864x1536' // 9:16 vertical — stories e reels
  }
  // Feed e carrossel: proporção 4:5 (maior alcance no Instagram)
  return '1024x1280' // 4:5 retrato — feed e carrossel
}

// ============================================================
//  Handler principal
// ============================================================
export const handler = async (event: any) => {
  let job_id: string | undefined

  try {
    const body = JSON.parse(event.body ?? '{}')
    job_id = body.job_id
    const {
      workspace_id, brand_id, job_type, quantity,
      extra_context, hashtags,
      // Dados completos do briefing/onboarding
      title, objective, tone_of_voice, target_audience,
      products, design_rules, forbidden_words, slogans,
      color_palette, instagram_handle,
      // Campos avulsos
      slide_count, reference_urls,
    } = body

    await supabase.from('content_jobs').update({ status: 'processing' }).eq('id', job_id)

    // Busca brand completo
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('*, brand_assets(*), brand_learnings(*)')
      .eq('id', brand_id)
      .single()

    if (!brand) throw new Error('Marca não encontrada')

    // Mescla dados do briefing com dados da marca
    // (briefing tem prioridade — cliente pode querer tom diferente)
    const mergedBrand = {
      ...brand,
      tone_of_voice: tone_of_voice || brand.tone_of_voice,
      target_audience: target_audience || brand.target_audience,
      products: products || brand.products,
      design_rules: design_rules || brand.design_rules,
      forbidden_words: forbidden_words || brand.forbidden_words,
      color_palette: color_palette || brand.color_palette,
      slogans: slogans || brand.slogans,
    }

    const slideCount = slide_count
      ?? (job_type === 'carrossel_5' ? 5
      : job_type === 'carrossel_7' ? 7
      : job_type === 'story_sequencia' ? 3
      : 1)

    // Adicionar referências do usuário no contexto
    const extraContextFinal = [
      extra_context,
      reference_urls?.length ? `Imagens de referência fornecidas pelo usuário: ${reference_urls.join(', ')}` : null,
    ].filter(Boolean).join('\n') || extra_context

    // Garante contexto visual da marca (logo + referências)
    const brandContextId = await ensureBrandContext(mergedBrand)

    // Processa cada post da quantidade solicitada
    for (let i = 0; i < (quantity ?? 1); i++) {
      try {
        // 1. GPT-4o gera estrutura completa
        const content = await generateContent(
          mergedBrand, job_type, slideCount,
          title, objective, extraContextFinal, hashtags
        )

        // 2. Gera todas as imagens EM PARALELO para caber no timeout
        console.log(`Gerando ${content.slides.length} slides em paralelo...`)
        await Promise.all(content.slides.map(async (slide, s) => {
          try {
            const imageResult = await generateImageWithBrandContext(
              slide, mergedBrand, job_type, brandContextId
            )
            const fileName = `${workspace_id}/generated/${job_id}_post${i+1}_slide${s+1}.png`
            const buffer = Buffer.from(imageResult.b64, 'base64')

            const { error: uploadErr } = await supabase.storage
              .from('posts')
              .upload(fileName, buffer, { contentType: 'image/png', upsert: true })

            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
              content.slides[s].public_url = urlData.publicUrl
              console.log(`Slide ${s+1} gerado e salvo`)
            } else {
              console.error(`Upload slide ${s+1}:`, uploadErr.message)
            }
          } catch (slideErr: any) {
            console.error(`Erro slide ${s+1}:`, slideErr.message)
          }
        }))

        // 3. Salva creative_output
        const firstSlide = content.slides[0]
        const { data: output, error: outErr } = await supabase.from('creative_outputs').insert({
          workspace_id,
          job_id,
          brand_id,
          format: job_type,
          variation_number: i + 1,
          public_url: firstSlide?.public_url ?? null,
          storage_path: `${workspace_id}/generated/${job_id}_post${i+1}_slide1.png`,
          caption: content.caption,
          hashtags: content.hashtags,
          image_prompt: firstSlide?.visual_prompt ?? null,
          status: 'pending',
          ai_score: content.ai_score,
        }).select().single()

        if (outErr) console.error('Erro ao salvar output:', outErr.message)

        // 4. Salva slides do carrossel
        if (output && slideCount > 1) {
          const slidesToProcess = content.slides.slice(0, slideCount)
          for (let s = 0; s < slidesToProcess.length; s++) {
            const slide = slidesToProcess[s]
            await supabase.from('carousel_pages').insert({
              creative_output_id: output.id,
              page_number: s + 1,
              headline: slide.headline,
              body: slide.body,
              visual_prompt: slide.visual_prompt,
              public_url: slide.public_url ?? null,
              storage_path: `${workspace_id}/generated/${job_id}_post${i+1}_slide${s+1}.png`,
            })
          }
        }

      } catch (postErr: any) {
        console.error(`Erro no post ${i+1}:`, postErr.message)
      }
    }

    await supabase.from('content_jobs').update({ status: 'waiting_approval' }).eq('id', job_id)
    await supabase.from('content_briefs').update({ status: 'done' }).eq('id', body.brief_id)

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }

  } catch (err: any) {
    console.error('Erro geral:', err.message)
    if (job_id) {
      await supabase.from('content_jobs')
        .update({ status: 'error', error_message: err.message })
        .eq('id', job_id)
      const body = JSON.parse(event.body ?? '{}')
      if (body.workspace_id) {
        await supabase.rpc('refund_credits', {
          p_workspace_id: body.workspace_id,
          p_job_id: job_id,
          p_amount: body.required_credits ?? 1,
          p_description: 'Reembolso: erro na geração',
        })
      }
    }
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

// ============================================================
//  Garante contexto visual da marca (logo + referências)
// ============================================================
async function ensureBrandContext(brand: any): Promise<string | null> {
  if (brand.openai_thread_id) {
    console.log('Usando contexto existente:', brand.openai_thread_id)
    return brand.openai_thread_id
  }

  const logoAsset = brand.brand_assets?.find((a: any) => a.asset_type === 'logo')
  const refAssets = brand.brand_assets?.filter((a: any) => a.asset_type !== 'logo').slice(0, 3) ?? []

  if (!logoAsset && refAssets.length === 0) {
    console.log('Sem assets — gerando sem contexto visual')
    return null
  }

  try {
    const content: any[] = [{
      type: 'input_text',
      text: `Esta é a identidade visual completa da marca "${brand.name}".
Memorize todos estes elementos para aplicar em TODAS as imagens geradas:

IDENTIDADE VISUAL:
- Nome da marca: ${brand.name}
- Segmento: ${brand.segment}
- Cores oficiais: ${brand.color_palette?.map((c: any) => `${c.name} ${c.hex}`).join(', ')}
- Slogan ativo: ${brand.slogans?.find((s: any) => s.active)?.text ?? ''}
- Estilo de design: ${brand.design_rules ?? 'profissional, clean, moderno'}
- Tom de comunicação: ${brand.tone_of_voice}
- Público-alvo: ${brand.target_audience}

A logo enviada deve aparecer em TODAS as imagens geradas.
As referências visuais mostram o estilo visual que a marca usa.
Mantenha consistência total com esta identidade em todas as gerações.`,
    }]

    // Adiciona logo
    if (logoAsset?.public_url) {
      content.push({ type: 'input_image', image_url: logoAsset.public_url })
      console.log('Logo adicionada ao contexto')
    }

    // Adiciona referências visuais
    for (const asset of refAssets) {
      if (asset.public_url) {
        content.push({ type: 'input_image', image_url: asset.public_url })
      }
    }

    const res = await fetch(`${OPENAI_BASE}/responses`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [{ role: 'user', content }],
      }),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error.message)

    const responseId = data.id
    console.log('Contexto da marca criado:', responseId)

    if (responseId) {
      await supabase.from('brand_profiles')
        .update({ openai_thread_id: responseId })
        .eq('id', brand.id)
    }

    return responseId ?? null

  } catch (err: any) {
    console.error('Erro ao criar contexto:', err.message)
    return null
  }
}

// ============================================================
//  gpt-image-2 via Responses API com contexto da marca
// ============================================================
async function generateImageWithBrandContext(
  slide: Slide, brand: any, jobType: string, previousResponseId: string | null
): Promise<{ b64: string }> {

  const brandColors = brand.color_palette?.map((c: any) => `${c.name}: ${c.hex}`).join(', ') ?? ''
  const activeSlogans = brand.slogans?.filter((s: any) => s.active).map((s: any) => s.text).join(', ') ?? ''
  const size = getImageSize(jobType)

  const prompt = `Gere uma imagem profissional para Instagram da marca ${brand.name}.

DESCRIÇÃO VISUAL:
${slide.visual_prompt}

TEXTO OBRIGATÓRIO NA IMAGEM (em português):
${slide.headline ? `• Título principal: "${slide.headline}"` : ''}
${slide.body ? `• Texto secundário: "${slide.body}"` : ''}
${slide.cta ? `• Call-to-action: "${slide.cta}"` : ''}

IDENTIDADE DA MARCA (aplicar obrigatoriamente):
• Logo: posicionar conforme referência visual enviada anteriormente
• Cores: ${brandColors}
• Slogan: ${activeSlogans}
• Estilo: ${brand.design_rules ?? 'profissional, clean, moderno'}
• Segmento: ${brand.segment}

REQUISITOS TÉCNICOS:
• Formato: ${size === '1080x1350' ? '4:5 retrato (1080x1350px)' : '9:16 vertical (1080x1920px)'}
• Qualidade máxima para Instagram
• Texto legível e em português
• Alta resolução, sem bordas desnecessárias`

  const requestBody: any = {
    model: 'gpt-4o',
    input: [{
      role: 'user',
      content: [{ type: 'input_text', text: prompt }]
    }],
    tools: [{
      type: 'image_generation',
      size,
      quality: 'high',
      output_format: 'png',
    }],
  }

  if (previousResponseId) {
    requestBody.previous_response_id = previousResponseId
  }

  const res = await fetch(`${OPENAI_BASE}/responses`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  const data = await res.json()
  if (data.error) throw new Error(`Responses API: ${data.error.message}`)

  const imageOutput = data.output?.find((o: any) => o.type === 'image_generation_call')
  if (!imageOutput?.result) {
    console.error('Response completo:', JSON.stringify(data).slice(0, 500))
    throw new Error('Imagem não retornada pela Responses API')
  }

  return { b64: imageOutput.result }
}

// ============================================================
//  GPT-4o — gera estrutura completa com TODOS os dados
// ============================================================
async function generateContent(
  brand: any, jobType: string, slideCount: number,
  title: string, objective: string,
  extraContext: string, hashtags: string[]
): Promise<GeneratedContent> {

  const isCarousel = slideCount > 1
  const brandColors = brand.color_palette?.map((c: any) => `${c.name}: ${c.hex}`).join(', ') ?? ''
  const activeSlogans = brand.slogans?.filter((s: any) => s.active).map((s: any) => s.text).join(', ') ?? ''
  const learnings = brand.brand_learnings?.map((l: any) => l.content).join('\n') ?? ''
  const imageSize = getImageSize(jobType)

  const prompt = `Você é um especialista em marketing digital e criação de conteúdo para Instagram no Brasil.
Crie conteúdo SEMPRE em português brasileiro, seguindo rigorosamente a identidade da marca.

════════════════════════════════════
BRAND DNA COMPLETO
════════════════════════════════════
${brand.ai_brand_dna ?? '(Brand DNA não gerado ainda)'}

════════════════════════════════════
IDENTIDADE DA MARCA
════════════════════════════════════
Nome: ${brand.name}
Segmento: ${brand.segment ?? 'não informado'}
Cidade/Região: ${brand.city ?? 'não informada'}
Público-alvo: ${brand.target_audience ?? 'não informado'}
Objetivo principal da marca: ${brand.main_objective ?? 'não informado'}
Produtos/Serviços: ${brand.products ?? 'não informado'}
Tom de voz: ${brand.tone_of_voice ?? 'não informado'}
Slogan(s) ativo(s): ${activeSlogans || 'não definido'}
Cores da marca: ${brandColors || 'não definidas'}
Tipografia: ${brand.typography?.title ?? 'não definida'}
Regras de design: ${brand.design_rules ?? 'nenhuma regra específica'}
Palavras/abordagens proibidas: ${brand.forbidden_words?.join(', ') ?? 'nenhuma'}
Instagram: ${brand.instagram_handle ?? 'não informado'}
${learnings ? `\nAprendizados de posts anteriores:\n${learnings}` : ''}

════════════════════════════════════
BRIEFING DO PEDIDO
════════════════════════════════════
${title ? `Tema/Título da postagem: ${title}` : ''}
Objetivo do post: ${objective ?? 'não informado'}
Tipo de conteúdo: ${jobType}
${isCarousel ? `Formato: Carrossel com ${slideCount} slides` : 'Formato: Post único'}
Contexto extra / instruções adicionais: ${extraContext ?? 'nenhum'}
Hashtags base sugeridas: ${hashtags?.join(' ') ?? 'usar hashtags relevantes da marca'}
Dimensão da imagem: ${imageSize}

════════════════════════════════════
INSTRUÇÕES DE CRIAÇÃO
════════════════════════════════════
${isCarousel ? `
OBRIGATÓRIO: crie EXATAMENTE ${slideCount} slide${slideCount > 1 ? 's' : ''} — não mais, não menos.
Estrutura dos ${slideCount} slides:
• Slide 1 (CAPA): headline impactante que para o scroll. Deve despertar curiosidade ou identificação imediata.
• Slides 2 a ${slideCount - 1}: um ponto de valor por slide. Texto curto, direto, fácil de ler rapidamente.
• Slide ${slideCount} (CTA): chamada para ação clara e específica. Diga exatamente o que o usuário deve fazer.

Narrativa progressiva — cada slide deve fazer o usuário querer ver o próximo.
` : `
Post único:
• Imagem impactante e coerente com a identidade visual da marca
• Legenda completa com emojis, linha de destaque e hashtags
`}

Para o visual_prompt de cada slide, descreva em INGLÊS detalhado:
- Composição e layout (onde fica cada elemento)
- Iluminação e ambiente
- Elementos visuais e estilo
- Textos que devem aparecer NA imagem (em português)
- Referência às cores da marca: ${brandColors}
- Estilo fotográfico/ilustrativo
- Qualidade e mood da imagem

════════════════════════════════════
FORMATO DE RESPOSTA
════════════════════════════════════
Retorne SOMENTE este JSON válido, sem markdown, sem explicações.
O array "slides" deve ter EXATAMENTE ${slideCount} objeto${slideCount !== 1 ? 's' : ''}.

${JSON.stringify({
  caption: "legenda completa em português com emojis e quebras de linha\n\n#hashtag1 #hashtag2",
  hashtags: ["#hashtag1", "#hashtag2", "#hashtag3"],
  ai_score: 8.5,
  slides: Array.from({ length: slideCount }, (_, i) => ({
    headline: `Título do slide ${i + 1} em português`,
    body: "texto do corpo em português (2-3 linhas no máximo)",
    cta: i === slideCount - 1 ? "chamada para ação no último slide" : "",
    visual_prompt: "Detailed English prompt for this slide: composition, lighting, style, brand colors, text overlays in Portuguese, photography style, mood, quality"
  }))
}, null, 2)}`

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em marketing digital e Instagram no Brasil. Crie conteúdo em português brasileiro. Sempre retorne JSON válido sem markdown. Respeite EXATAMENTE o número de slides solicitado.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.75,
      max_tokens: Math.min(1200 + slideCount * 600, 4000),
      response_format: { type: 'json_object' },
    }),
  })

  const data = await res.json()
  if (data.error) throw new Error(`GPT-4o: ${data.error.message}`)

  const result = JSON.parse(data.choices[0].message.content)

  // Garante que slides é array e tem pelo menos 1 item
  if (!result.slides || result.slides.length === 0) {
    result.slides = [{
      headline: title || brand.name,
      body: extraContext || '',
      visual_prompt: `Professional Instagram post for ${brand.name}, ${brand.segment}, colors: ${brandColors}, clean modern design`,
    }]
  }

  return result
}
