// ============================================================
//  aiin · Netlify Background Function v2
//  Usa Responses API com previous_response_id para manter
//  contexto visual da marca (logo, referências) entre gerações
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

// ============================================================
//  Handler principal
// ============================================================
export const handler = async (event: any) => {
  let job_id: string | undefined

  try {
    const body = JSON.parse(event.body ?? '{}')
    job_id = body.job_id
    const { workspace_id, brand_id, job_type, quantity, extra_context, hashtags } = body

    await supabase.from('content_jobs').update({ status: 'processing' }).eq('id', job_id)

    // Busca brand completo com assets
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('*, brand_assets(*), brand_learnings(*)')
      .eq('id', brand_id)
      .single()

    if (!brand) throw new Error('Marca não encontrada')

    const slideCount = job_type === 'carrossel_5' ? 5
      : job_type === 'carrossel_7' ? 7
      : job_type === 'story_sequencia' ? 3
      : 1

    // Garante contexto visual da marca (logo + referências)
    const brandContextId = await ensureBrandContext(brand)

    // Processa cada post
    for (let i = 0; i < (quantity ?? 1); i++) {
      try {
        // 1. GPT-4o gera estrutura + prompts de imagem
        const content = await generateContent(brand, job_type, slideCount, extra_context, hashtags)

        // 2. gpt-image-2 via Responses API com contexto da marca
        for (let s = 0; s < content.slides.length; s++) {
          const slide = content.slides[s]
          const imageResult = await generateImageWithBrandContext(
            slide, brand, job_type, brandContextId
          )

          // Upload para Supabase Storage
          const fileName = `${workspace_id}/generated/${job_id}_post${i+1}_slide${s+1}.png`
          const buffer = Buffer.from(imageResult.b64, 'base64')

          const { error: uploadErr } = await supabase.storage
            .from('posts')
            .upload(fileName, buffer, { contentType: 'image/png', upsert: true })

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
            content.slides[s].public_url = urlData.publicUrl
          }
        }

        // 3. Salva creative_output
        const firstSlide = content.slides[0]
        const { data: output } = await supabase.from('creative_outputs').insert({
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

        // 4. Salva slides do carrossel
        if (output && slideCount > 1) {
          for (let s = 0; s < content.slides.length; s++) {
            const slide = content.slides[s]
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
//  Garante contexto visual da marca via Responses API
//  Faz upload da logo + referências e salva o response_id
// ============================================================
async function ensureBrandContext(brand: any): Promise<string | null> {
  // Se já tem contexto salvo, retorna direto
  if (brand.openai_thread_id) return brand.openai_thread_id

  // Busca logo e assets da marca
  const logoAsset = brand.brand_assets?.find((a: any) => a.asset_type === 'logo')
  const refAssets = brand.brand_assets?.slice(0, 4) ?? [] // até 4 referências

  if (!logoAsset && refAssets.length === 0) return null

  try {
    // Monta mensagem com imagens de referência
    const content: any[] = [
      {
        type: 'input_text',
        text: `Esta é a identidade visual da marca ${brand.name}. 
Memorize estes elementos visuais para usar em todas as gerações:
- Logo: deve aparecer em todas as imagens geradas
- Cores da marca: ${brand.color_palette?.map((c: any) => `${c.name} ${c.hex}`).join(', ')}
- Slogan: ${brand.slogans?.find((s: any) => s.active)?.text ?? ''}
- Estilo: ${brand.design_rules ?? 'profissional e moderno'}
- Segmento: ${brand.segment}

Use estes elementos em TODAS as imagens que gerar para esta marca.`,
      }
    ]

    // Adiciona logo
    if (logoAsset?.public_url) {
      content.push({
        type: 'input_image',
        image_url: logoAsset.public_url,
      })
    }

    // Adiciona referências visuais
    for (const asset of refAssets) {
      if (asset.public_url && asset.asset_type !== 'logo') {
        content.push({
          type: 'input_image',
          image_url: asset.public_url,
        })
      }
    }

    // Cria contexto via Responses API
    const res = await fetch(`${OPENAI_BASE}/responses`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [{ role: 'user', content }],
      }),
    })

    const data = await res.json()
    const responseId = data.id

    if (responseId) {
      // Salva o response_id na marca para reusar
      await supabase.from('brand_profiles')
        .update({ openai_thread_id: responseId })
        .eq('id', brand.id)
    }

    return responseId ?? null

  } catch (err: any) {
    console.error('Erro ao criar contexto da marca:', err.message)
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

  const size = jobType === 'story' || jobType === 'story_sequencia' || jobType === 'capa_reels'
    ? '1024x1536' : '1024x1024'

  const prompt = `Crie uma imagem profissional para Instagram para a marca ${brand.name}.

${slide.visual_prompt}

OBRIGATÓRIO incluir na imagem:
${slide.headline ? `- Título em destaque (em português): "${slide.headline}"` : ''}
${slide.body ? `- Texto secundário (em português): "${slide.body}"` : ''}
${slide.cta ? `- Botão ou chamada para ação: "${slide.cta}"` : ''}
- Logo da marca conforme referência enviada anteriormente
- Cores da marca: ${brandColors}
- Slogan: ${activeSlogans}
- Estilo: ${brand.design_rules ?? 'profissional, moderno, clean'}
- Segmento: ${brand.segment}

Qualidade máxima, texto legível em português, identidade visual consistente.`

  const requestBody: any = {
    model: 'gpt-4o',
    input: [{
      role: 'user',
      content: [{
        type: 'input_text',
        text: prompt,
      }]
    }],
    tools: [{
      type: 'image_generation',
      size,
      quality: 'high',
      output_format: 'png',
    }],
  }

  // Usa contexto da marca se disponível
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

  // Extrai b64 da resposta
  const imageOutput = data.output?.find((o: any) => o.type === 'image_generation_call')
  if (!imageOutput?.result) throw new Error('Imagem não gerada na resposta')

  return { b64: imageOutput.result }
}

// ============================================================
//  GPT-4o — gera estrutura completa do post
// ============================================================
async function generateContent(
  brand: any, jobType: string, slideCount: number,
  extraContext: string, hashtags: string[]
): Promise<GeneratedContent> {

  const isCarousel = slideCount > 1
  const brandColors = brand.color_palette?.map((c: any) => `${c.name}: ${c.hex}`).join(', ') ?? ''
  const activeSlogans = brand.slogans?.filter((s: any) => s.active).map((s: any) => s.text).join(', ') ?? ''
  const learnings = brand.brand_learnings?.map((l: any) => l.content).join('\n') ?? ''

  const prompt = `Você é um especialista em marketing digital e Instagram no Brasil.

BRAND DNA:
${brand.ai_brand_dna ?? ''}

MARCA: ${brand.name}
Segmento: ${brand.segment}
Público: ${brand.target_audience}
Tom de voz: ${brand.tone_of_voice}
Objetivo: ${brand.main_objective}
Produtos/Serviços: ${brand.products}
Slogan: ${activeSlogans}
Cores: ${brandColors}
Regras de design: ${brand.design_rules ?? ''}
Palavras proibidas: ${brand.forbidden_words?.join(', ') ?? ''}
${learnings ? `\nAprendizados anteriores:\n${learnings}` : ''}

PEDIDO:
- Tipo: ${jobType}
- ${isCarousel ? `Carrossel com ${slideCount} slides` : 'Post único'}
- Contexto extra: ${extraContext ?? ''}
- Hashtags base: ${hashtags?.join(' ') ?? ''}

${isCarousel ? `
Crie um carrossel de ${slideCount} slides:
- Slide 1 (CAPA): headline que para o scroll, impactante
- Slides 2 a ${slideCount - 1}: um ponto de valor por slide, texto curto
- Slide ${slideCount}: CTA claro e direto
` : 'Crie um post único com imagem e legenda.'}

Para cada slide, o visual_prompt deve ser em inglês e muito detalhado:
incluir composição, iluminação, estilo, elementos visuais, texto que deve aparecer na imagem em português.

Retorne SOMENTE este JSON sem markdown:
{
  "caption": "legenda em português com emojis e quebras de linha\\n\\n#hashtags",
  "hashtags": ["#tag1", "#tag2"],
  "ai_score": 8.5,
  "slides": [
    {
      "headline": "título em português",
      "body": "texto corpo em português",
      "cta": "chamada para ação em português (só último slide)",
      "visual_prompt": "detailed English prompt for image generation with brand colors, style, text overlays in Portuguese, composition"
    }
  ]
}`

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Você é um especialista em marketing digital no Brasil. Sempre responda em JSON válido sem markdown.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })

  const data = await res.json()
  if (data.error) throw new Error(`GPT-4o: ${data.error.message}`)

  return JSON.parse(data.choices[0].message.content)
}
