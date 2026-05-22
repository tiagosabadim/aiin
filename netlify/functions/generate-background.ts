// ============================================================
//  aiin · Netlify Background Function
//  /netlify/functions/generate.ts
//  Substitui o n8n completamente.
//  Roda em background (até 15 min) — sem timeout.
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role para bypass do RLS
)

const OPENAI_KEY = process.env.OPENAI_API_KEY!

// ---- tipos ----
interface Slide {
  headline: string
  body: string
  cta?: string
  visual_prompt: string
  image_b64?: string
  public_url?: string
}

interface GeneratedContent {
  caption: string
  hashtags: string[]
  slides: Slide[]         // 1 item = post simples, N itens = carrossel
  content_type: string
  ai_score: number
}

// ============================================================
//  Handler principal
// ============================================================
export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body ?? '{}')
    const {
      job_id,
      workspace_id,
      brand_id,
      job_type,
      quantity,
      extra_context,
      hashtags,
    } = body

    // Atualiza job para processing
    await supabase.from('content_jobs')
      .update({ status: 'processing' })
      .eq('id', job_id)

    // Busca Brand DNA completo
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('*, brand_assets(*), brand_learnings(*)')
      .eq('id', brand_id)
      .single()

    if (!brand) throw new Error('Marca não encontrada')

    // Monta número de slides baseado no tipo
    const slideCount = job_type === 'carrossel_5' ? 5
      : job_type === 'carrossel_7' ? 7
      : job_type === 'story_sequencia' ? 3
      : 1

    // Processa cada post da quantidade solicitada
    for (let i = 0; i < (quantity ?? 1); i++) {
      try {
        // 1. GPT-4o gera estrutura completa do post
        const content = await generateContent(brand, job_type, slideCount, extra_context, hashtags)

        // 2. Gera imagem para cada slide
        for (let s = 0; s < content.slides.length; s++) {
          const slide = content.slides[s]
          const imageResult = await generateImage(slide, brand, job_type)
          content.slides[s].image_b64 = imageResult.b64
        }

        // 3. Faz upload de cada slide para o Supabase Storage
        for (let s = 0; s < content.slides.length; s++) {
          const slide = content.slides[s]
          if (!slide.image_b64) continue

          const fileName = `${workspace_id}/generated/${job_id}_post${i+1}_slide${s+1}.png`
          const buffer = Buffer.from(slide.image_b64, 'base64')

          const { error: uploadErr } = await supabase.storage
            .from('posts')
            .upload(fileName, buffer, { contentType: 'image/png', upsert: true })

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
            content.slides[s].public_url = urlData.publicUrl
          }
        }

        // 4. Salva creative_output
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

        // 5. Salva slides do carrossel
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

      } catch (postErr) {
        console.error(`Erro no post ${i+1}:`, postErr)
      }
    }

    // Atualiza job para waiting_approval
    await supabase.from('content_jobs')
      .update({ status: 'waiting_approval' })
      .eq('id', job_id)

    await supabase.from('content_briefs')
      .update({ status: 'done' })
      .eq('id', body.brief_id)

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }

  } catch (err: any) {
    console.error('Erro geral:', err)

    // Reembolsa créditos em caso de erro
    if (event.body) {
      const body = JSON.parse(event.body)
      if (body.job_id) {
        await supabase.from('content_jobs')
          .update({ status: 'error', error_message: err.message })
          .eq('id', body.job_id)

        await supabase.rpc('refund_credits', {
          p_workspace_id: body.workspace_id,
          p_job_id: body.job_id,
          p_amount: body.required_credits ?? 1,
          p_description: 'Reembolso automático: erro na geração',
        })
      }
    }

    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

// ============================================================
//  GPT-4o — gera estrutura completa do post
// ============================================================
async function generateContent(
  brand: any,
  jobType: string,
  slideCount: number,
  extraContext: string,
  hashtags: string[],
): Promise<GeneratedContent> {

  const isCarousel = slideCount > 1
  const brandColors = brand.color_palette?.map((c: any) => `${c.name}: ${c.hex}`).join(', ') ?? 'não definidas'
  const activeSlogans = brand.slogans?.filter((s: any) => s.active).map((s: any) => s.text).join(', ') ?? ''
  const learnings = brand.brand_learnings?.map((l: any) => l.content).join('\n') ?? 'nenhum'

  const systemPrompt = `Você é um especialista em marketing digital e criação de conteúdo para Instagram no Brasil.
Você cria conteúdo em PORTUGUÊS BRASILEIRO, seguindo rigorosamente a identidade da marca.
Sempre retorne um JSON válido sem markdown.`

  const userPrompt = `
BRAND DNA COMPLETO:
${brand.ai_brand_dna ?? 'Não gerado ainda'}

IDENTIDADE DA MARCA:
- Nome: ${brand.name}
- Segmento: ${brand.segment}
- Público-alvo: ${brand.target_audience}
- Tom de voz: ${brand.tone_of_voice}
- Objetivo: ${brand.main_objective}
- Produtos/Serviços: ${brand.products}
- Slogan(s) ativo(s): ${activeSlogans}
- Cores da marca: ${brandColors}
- Fontes: ${brand.typography?.title ?? 'não definidas'}
- Regras de design: ${brand.design_rules ?? 'nenhuma'}
- Palavras proibidas: ${brand.forbidden_words?.join(', ') ?? 'nenhuma'}

APRENDIZADOS ANTERIORES (o que funcionou):
${learnings}

PEDIDO:
- Tipo: ${jobType}
- ${isCarousel ? `Carrossel com ${slideCount} slides` : 'Post único'}
- Contexto extra: ${extraContext ?? 'nenhum'}
- Hashtags base: ${hashtags?.join(' ') ?? 'usar da marca'}

INSTRUÇÕES:
${isCarousel ? `
Crie um carrossel de ${slideCount} slides com narrativa progressiva:
- Slide 1 (CAPA): headline impactante que para o scroll
- Slides 2 a ${slideCount - 1}: conteúdo de valor, um ponto por slide
- Slide ${slideCount} (CTA): chamada para ação clara
` : `
Crie um post único com imagem e legenda completa.
`}

Para cada slide, crie um visual_prompt MUITO DETALHADO em inglês para gerar a imagem, incluindo:
- Estilo visual baseado nas cores da marca (${brandColors})
- Texto que deve aparecer NA imagem (headline, body text em português)
- Composição, iluminação, elementos visuais
- Referência ao segmento: ${brand.segment}
- Estilo profissional para Instagram

Retorne SOMENTE este JSON:
{
  "caption": "legenda completa em português com emojis e quebras de linha",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "ai_score": 8.5,
  "slides": [
    {
      "headline": "texto do headline em português",
      "body": "texto do corpo em português",
      "cta": "chamada para ação (só no último slide)",
      "visual_prompt": "extremely detailed prompt in English for image generation including: exact colors ${brandColors}, text overlays in Portuguese, composition, style, lighting, brand elements"
    }
  ]
}
`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })

  const data = await res.json()
  const text = data.choices[0].message.content
  return JSON.parse(text)
}

// ============================================================
//  gpt-image-2 — gera imagem por slide
// ============================================================
async function generateImage(slide: Slide, brand: any, jobType: string): Promise<{ b64: string }> {
  const brandColors = brand.color_palette?.map((c: any) => `${c.name}: ${c.hex}`).join(', ') ?? ''
  const activeSlogans = brand.slogans?.filter((s: any) => s.active).map((s: any) => s.text).join(', ') ?? ''

  // Dimensão baseada no tipo
  const size = jobType === 'story' || jobType === 'story_sequencia' || jobType === 'capa_reels'
    ? '1024x1792'  // vertical 9:16
    : '1024x1024'  // quadrado (feed)

  const finalPrompt = `${slide.visual_prompt}

BRAND IDENTITY:
- Brand name: ${brand.name}
- Active slogan: ${activeSlogans}
- Brand colors: ${brandColors}
- Design rules: ${brand.design_rules ?? 'professional, clean'}

MANDATORY TEXT IN IMAGE (in Portuguese):
${slide.headline ? `- Main headline: "${slide.headline}"` : ''}
${slide.body ? `- Body text: "${slide.body}"` : ''}
${slide.cta ? `- CTA button: "${slide.cta}"` : ''}

REQUIREMENTS:
- Professional Instagram post quality
- Text must be clearly readable in Portuguese
- Use exact brand colors: ${brandColors}
- High contrast, sharp text rendering
- ${brand.segment} industry aesthetic
- No watermarks, no borders`

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt: finalPrompt,
      n: 1,
      size,
      quality: 'high',
      output_format: 'png',
    }),
  })

  const data = await res.json()

  if (data.error) throw new Error(`gpt-image-2: ${data.error.message}`)

  const imgData = data.data[0]; return { b64: imgData.b64_json || imgData.url, isUrl: !imgData.b64_json }
}