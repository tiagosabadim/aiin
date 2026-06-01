// aiin · regenerate-image — regenera a arte do post (post simples OU carrossel inteiro)
// 1ª regeneração grátis; depois cobra o valor cheio do formato
import { createClient } from '@supabase/supabase-js'
import { trackUsage } from './usage-tracker'

const OPENAI_KEY  = process.env.OPENAI_API_KEY!
const OPENAI_BASE = 'https://api.openai.com/v1'
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const FORMAT_COST: Record<string, number> = {
  post_simples: 1, post_premium: 2, capa_reels: 1, story: 1,
  story_sequencia: 2, carrossel_5: 3, carrossel_7: 4, campanha: 2, kit_campanha: 6,
}

function getImageSize(jobType: string): string {
  if (jobType === 'story' || jobType === 'story_sequencia' || jobType === 'capa_reels') return '864x1536'
  return '1024x1280'
}

// Gera UMA imagem a partir de um slide + contexto da marca
async function generateOneImage(opts: {
  visualPrompt: string; instruction: string; headline: string; body: string; cta: string
  brand: any; size: string; brandColors: string; slogans: string
  logoUrl?: string; refUrls: string[]
}): Promise<{ b64: string; responseId: string | null }> {
  const prompt = `Gere uma imagem profissional para Instagram da marca ${opts.brand?.name ?? ''}.

DESCRIÇÃO VISUAL ORIGINAL DESTE SLIDE:
${opts.visualPrompt || 'post para Instagram profissional e moderno'}

🔧 AJUSTE SOLICITADO PELO USUÁRIO (aplicar com prioridade, mantendo o resto):
${opts.instruction}

TEXTO OBRIGATÓRIO NA IMAGEM (em português):
${opts.headline ? `• Título: "${opts.headline}"` : ''}
${opts.body ? `• Texto: "${opts.body}"` : ''}
${opts.cta ? `• CTA: "${opts.cta}"` : ''}

IDENTIDADE DA MARCA (obrigatório):
• Logo conforme referência visual enviada
• Cores: ${opts.brandColors}
• Slogan: ${opts.slogans}
• Estilo: ${opts.brand?.design_rules ?? 'profissional, clean, moderno'}
• Segmento: ${opts.brand?.segment ?? ''}

REQUISITOS: formato ${opts.size === '1024x1280' ? '4:5 retrato' : '9:16 vertical'}, texto legível em português, alta resolução.`

  const content: any[] = [{ type: 'input_text', text: prompt }]
  if (opts.logoUrl) content.push({ type: 'input_image', image_url: opts.logoUrl })
  for (const u of opts.refUrls) content.push({ type: 'input_image', image_url: u })

  const res = await fetch(`${OPENAI_BASE}/responses`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [{ role: 'user', content }],
      tools: [{ type: 'image_generation', size: opts.size, quality: 'high', output_format: 'png' }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  const img = data.output?.find((o: any) => o.type === 'image_generation_call')
  if (!img?.result) throw new Error('Imagem não retornada')
  return { b64: img.result, responseId: data.id ?? null }
}

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }

  try {
    const { output_id, instruction, workspace_id } = JSON.parse(event.body ?? '{}')
    if (!output_id || !instruction) {
      return { statusCode: 400, body: JSON.stringify({ error: 'output_id e instruction obrigatórios' }) }
    }

    const { data: output, error: outErr } = await supabase
      .from('creative_outputs').select('*').eq('id', output_id).single()
    if (outErr || !output) return { statusCode: 404, body: JSON.stringify({ error: 'Post não encontrado' }) }

    const { data: brand } = await supabase
      .from('brand_profiles').select('*, brand_assets(*)').eq('id', output.brand_id).single()

    const editCount = output.edit_count ?? 0
    const isCarousel = output.format?.startsWith('carrossel')

    // Marca regenerando
    await supabase.from('creative_outputs').update({ regenerating: true, regen_error: null }).eq('id', output_id)

    // Cobrança: 1ª grátis. Depois, valor cheio do formato
    if (editCount >= 1) {
      const cost = FORMAT_COST[output.format] ?? 1
      const { data: ok, error: cErr } = await supabase.rpc('debit_credits', {
        p_workspace_id: workspace_id, p_job_id: null, p_amount: cost,
        p_description: `Refazer ${output.format} (${editCount + 1}ª vez)`,
      })
      if (cErr || ok === false) {
        await supabase.from('creative_outputs').update({ regenerating: false, regen_error: `Você precisa de ${cost} créditos para refazer este ${isCarousel ? 'carrossel' : 'post'}.` }).eq('id', output_id)
        return { statusCode: 402, body: JSON.stringify({ error: 'Créditos insuficientes' }) }
      }
    }

    const brandColors = brand?.color_palette?.map((c: any) => `${c.name}: ${c.hex}`).join(', ') ?? ''
    const slogans = brand?.slogans?.filter((s: any) => s.active).map((s: any) => s.text).join(', ') ?? ''
    const size = getImageSize(output.format)
    const assets = brand?.brand_assets ?? []
    const logoUrl = assets.find((a: any) => a.asset_type === 'logo')?.public_url
    const refUrls = assets.filter((a: any) => a.asset_type !== 'logo').slice(0, 3).map((a: any) => a.public_url).filter(Boolean)

    let lastResponseId: string | null = output.image_response_id ?? null

    if (isCarousel) {
      // ── CARROSSEL: regenera TODOS os slides ──
      const { data: pages } = await supabase
        .from('carousel_pages').select('*').eq('creative_output_id', output_id).order('page_number')

      if (!pages || pages.length === 0) throw new Error('Slides do carrossel não encontrados')

      console.log(`[regen] carrossel ${output_id} | ${pages.length} slides`)

      for (const page of pages) {
        const result = await generateOneImage({
          visualPrompt: page.visual_prompt ?? '', instruction,
          headline: page.headline ?? '', body: page.body ?? '', cta: page.cta ?? '',
          brand, size, brandColors, slogans, logoUrl, refUrls,
        })
        const fileName = page.storage_path ?? `${workspace_id}/generated/${output_id}_slide${page.page_number}.png`
        const buffer = Buffer.from(result.b64, 'base64')
        await supabase.storage.from('posts').upload(fileName, buffer, { contentType: 'image/png', upsert: true })
        const { data: u } = supabase.storage.from('posts').getPublicUrl(fileName)
        const slideUrl = `${u.publicUrl}?v=${Date.now()}`

        // Atualiza a página do carrossel
        await supabase.from('carousel_pages').update({ public_url: slideUrl }).eq('id', page.id)

        // O slide 1 vira a capa (public_url do output)
        if (page.page_number === 1) {
          await supabase.from('creative_outputs').update({ public_url: slideUrl }).eq('id', output_id)
          lastResponseId = result.responseId
        }
        console.log(`[regen] slide ${page.page_number}/${pages.length} ok`)
        await trackUsage({ workspace_id, brand_id: brand?.id, operation: 'regenerate', model: 'gpt-image-1', units: 1, image_quality: 'high' })
      }

    } else {
      // ── POST SIMPLES: 1 imagem ──
      const result = await generateOneImage({
        visualPrompt: output.image_prompt ?? '', instruction,
        headline: '', body: '', cta: '',
        brand, size, brandColors, slogans, logoUrl, refUrls,
      })
      const fileName = output.storage_path ?? `${workspace_id}/generated/${output_id}_regen.png`
      const buffer = Buffer.from(result.b64, 'base64')
      const { error: upErr } = await supabase.storage.from('posts').upload(fileName, buffer, { contentType: 'image/png', upsert: true })
      if (upErr) throw new Error(`Upload: ${upErr.message}`)
      const { data: u } = supabase.storage.from('posts').getPublicUrl(fileName)
      const publicUrl = `${u.publicUrl}?v=${Date.now()}`
      await supabase.from('creative_outputs').update({ public_url: publicUrl }).eq('id', output_id)
      lastResponseId = result.responseId
      await trackUsage({ workspace_id, brand_id: brand?.id, operation: 'regenerate', model: 'gpt-image-1', units: 1, image_quality: 'high' })
    }

    // Finaliza
    await supabase.from('creative_outputs').update({
      image_response_id: lastResponseId,
      edit_count: editCount + 1,
      regenerating: false,
    }).eq('id', output_id)

    return { statusCode: 200, body: JSON.stringify({ ok: true, edit_count: editCount + 1 }) }

  } catch (e: any) {
    console.error('regenerate-image error:', e.message)
    const raw = (e.message ?? '').toLowerCase()
    let friendly = 'Não foi possível gerar a imagem agora. Volte mais tarde ou entre em contato com o suporte.'
    if (raw.includes('quota') || raw.includes('billing') || raw.includes('insufficient')) {
      friendly = 'Serviço de imagens temporariamente indisponível. Volte mais tarde ou entre em contato com o suporte.'
    }
    try {
      const { output_id } = JSON.parse(event.body ?? '{}')
      if (output_id) await supabase.from('creative_outputs').update({ regenerating: false, regen_error: friendly }).eq('id', output_id)
    } catch {}
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
