// aiin · regenerate-image — regenera a arte do post pelo prompt + ajuste do usuário
// Reusa o mesmo motor de geração (gpt-image via Responses API) mantendo Brand DNA
// 1ª regeneração grátis, demais cobram 1 crédito
import { createClient } from '@supabase/supabase-js'

const OPENAI_KEY  = process.env.OPENAI_API_KEY!
const OPENAI_BASE = 'https://api.openai.com/v1'
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function getImageSize(jobType: string): string {
  if (jobType === 'story' || jobType === 'capa_reels') return '1080x1920'
  return '1080x1350'
}

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { output_id, instruction, workspace_id } = JSON.parse(event.body ?? '{}')
    if (!output_id || !instruction) {
      return { statusCode: 400, body: JSON.stringify({ error: 'output_id e instruction obrigatórios' }) }
    }

    // 1. Buscar output + brand + carousel pages
    const { data: output, error: outErr } = await supabase
      .from('creative_outputs')
      .select('*, brand:brand_profiles(*, brand_assets(*))')
      .eq('id', output_id)
      .single()

    if (outErr || !output) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Post não encontrado' }) }
    }

    const brand = output.brand
    const editCount = output.edit_count ?? 0

    // Marca como regenerando — persiste no banco, visível em qualquer device
    await supabase.from('creative_outputs').update({ regenerating: true }).eq('id', output_id)

    // 2. Cobrar crédito da 2ª regeneração em diante
    if (editCount >= 1) {
      const { data: creditOk, error: creditErr } = await supabase.rpc('debit_credits', {
        p_workspace_id: workspace_id,
        p_job_id: null,
        p_amount: 1,
        p_description: `Nova arte do post (${editCount + 1}ª vez)`,
      })
      if (creditErr || creditOk === false) {
        return { statusCode: 402, body: JSON.stringify({ error: 'Créditos insuficientes' }) }
      }
    }

    // 3. Reconstruir o "slide" original a partir do que foi salvo
    // Para post simples está no output; para carrossel pega a primeira página
    let headline = '', body = '', cta = ''
    if (output.format?.startsWith('carrossel')) {
      const { data: page } = await supabase
        .from('carousel_pages')
        .select('headline, body, visual_prompt')
        .eq('creative_output_id', output_id)
        .eq('page_number', 1)
        .single()
      headline = page?.headline ?? ''
      body = page?.body ?? ''
    }

    const brandColors  = brand?.color_palette?.map((c: any) => `${c.name}: ${c.hex}`).join(', ') ?? ''
    const activeSlogans = brand?.slogans?.filter((s: any) => s.active).map((s: any) => s.text).join(', ') ?? ''
    const size = getImageSize(output.format)

    // 4. Logo + referências da marca (já vieram no join)
    const assets = brand?.brand_assets ?? []
    const logoAsset = assets.find((a: any) => a.asset_type === 'logo')
    const refAssets = assets.filter((a: any) => a.asset_type !== 'logo').slice(0, 3)

    // 5. Montar prompt: original + AJUSTE DO USUÁRIO em destaque
    const prompt = `Gere uma imagem profissional para Instagram da marca ${brand?.name ?? ''}.

DESCRIÇÃO VISUAL ORIGINAL:
${output.image_prompt ?? 'post para Instagram profissional e moderno'}

🔧 AJUSTE SOLICITADO PELO USUÁRIO (aplicar com prioridade, mantendo o resto):
${instruction}

TEXTO OBRIGATÓRIO NA IMAGEM (em português):
${headline ? `• Título principal: "${headline}"` : ''}
${body ? `• Texto secundário: "${body}"` : ''}
${cta ? `• Call-to-action: "${cta}"` : ''}

IDENTIDADE DA MARCA (aplicar obrigatoriamente):
• Logo: posicionar conforme referência visual enviada
• Cores: ${brandColors}
• Slogan: ${activeSlogans}
• Estilo: ${brand?.design_rules ?? 'profissional, clean, moderno'}
• Segmento: ${brand?.segment ?? ''}

REQUISITOS TÉCNICOS:
• Formato: ${size === '1080x1350' ? '4:5 retrato' : '9:16 vertical'}
• Qualidade máxima, texto legível em português, alta resolução`

    // 6. Montar conteúdo com logo + referências como contexto visual
    const content: any[] = [{ type: 'input_text', text: prompt }]
    if (logoAsset?.public_url) content.push({ type: 'input_image', image_url: logoAsset.public_url })
    for (const a of refAssets) {
      if (a.public_url) content.push({ type: 'input_image', image_url: a.public_url })
    }

    const res = await fetch(`${OPENAI_BASE}/responses`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [{ role: 'user', content }],
        tools: [{ type: 'image_generation', size, quality: 'high', output_format: 'png' }],
      }),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error.message)

    const imageOutput = data.output?.find((o: any) => o.type === 'image_generation_call')
    if (!imageOutput?.result) throw new Error('Imagem não retornada')

    // 7. Upload (sobrescreve a antiga)
    const fileName = output.storage_path ?? `${workspace_id}/generated/${output_id}_regen.png`
    const buffer = Buffer.from(imageOutput.result, 'base64')

    const { error: upErr } = await supabase.storage
      .from('posts')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true })

    if (upErr) throw new Error(`Upload: ${upErr.message}`)

    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

    await supabase.from('creative_outputs').update({
      public_url: publicUrl,
      image_response_id: data.id ?? output.image_response_id,
      edit_count: editCount + 1,
      regenerating: false,
    }).eq('id', output_id)

    return {
      statusCode: 200,
      body: JSON.stringify({ public_url: publicUrl, edit_count: editCount + 1 }),
    }

  } catch (e: any) {
    console.error('regenerate-image error:', e.message)
    // Libera o post mesmo em caso de erro
    try {
      const { output_id } = JSON.parse(event.body ?? '{}')
      if (output_id) await supabase.from('creative_outputs').update({ regenerating: false }).eq('id', output_id)
    } catch {}
    return { statusCode: 500, body: JSON.stringify({ error: e.message ?? 'Erro ao regenerar' }) }
  }
}
