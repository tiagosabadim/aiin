// ============================================================
//  aiin · Netlify Function: generate-visual-context
//  Gera 1 imagem teste para validar o contexto visual da marca.
//  Chamada por: VisualContextPage → POST /api/generate-visual-context
//  NÃO consome créditos do plano.
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const OPENAI_KEY  = process.env.OPENAI_API_KEY!
const OPENAI_BASE = 'https://api.openai.com/v1'

// ============================================================
//  Handler
// ============================================================
export const handler = async (event: any) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  try {
    const { workspace_id, brand_id, adjustment_note } = JSON.parse(event.body ?? '{}')

    if (!workspace_id || !brand_id) {
      return json(400, { error: 'workspace_id e brand_id são obrigatórios' })
    }

    // Busca brand completo com assets
    const { data: brand, error: brandErr } = await supabase
      .from('brand_profiles')
      .select('*, brand_assets(*)')
      .eq('id', brand_id)
      .single()

    if (brandErr || !brand) {
      return json(404, { error: 'Marca não encontrada' })
    }

    // 1. Garante (ou reutiliza) contexto visual da marca
    const brandContextId = await ensureBrandContext(brand)

    // 2. Gera imagem teste com contexto da marca
    const { b64, usedContextId } = await generateTestImage(brand, brandContextId, adjustment_note)

    // 3. Upload para Supabase Storage
    const fileName   = `${workspace_id}/visual-context-test/${brand_id}_${Date.now()}.png`
    const buffer     = Buffer.from(b64, 'base64')

    const { error: uploadErr } = await supabase.storage
      .from('posts')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true })

    if (uploadErr) {
      console.error('Upload error:', uploadErr.message)
      return json(500, { error: 'Erro ao salvar imagem: ' + uploadErr.message })
    }

    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)

    // 4. Persiste o context id (previous_response_id) na marca para reutilizar
    if (usedContextId) {
      await supabase
        .from('brand_profiles')
        .update({ openai_thread_id: usedContextId })
        .eq('id', brand_id)
    }

    return json(200, { image_url: urlData.publicUrl })

  } catch (err: any) {
    console.error('Erro generate-visual-context:', err.message)
    return json(500, { error: err.message ?? 'Erro interno' })
  }
}

// ============================================================
//  Garante contexto visual da marca (logo + referências)
//  Reutiliza openai_thread_id se já existir
// ============================================================
async function ensureBrandContext(brand: any): Promise<string | null> {
  if (brand.openai_thread_id) {
    console.log('Reutilizando contexto existente:', brand.openai_thread_id)
    return brand.openai_thread_id
  }

  const logoAsset = brand.brand_assets?.find((a: any) => a.asset_type === 'logo')
  const refAssets = brand.brand_assets?.filter((a: any) => a.asset_type !== 'logo').slice(0, 3) ?? []

  if (!logoAsset && refAssets.length === 0) {
    console.log('Sem assets visuais — gerando sem contexto de imagem')
    return null
  }

  try {
    const content: any[] = [{
      type: 'input_text',
      text: `Esta é a identidade visual completa da marca "${brand.name}".
Memorize todos estes elementos para aplicar em TODAS as imagens geradas:

IDENTIDADE VISUAL:
- Nome da marca: ${brand.name}
- Segmento: ${brand.segment ?? 'não informado'}
- Cores oficiais: ${brand.color_palette?.map((c: any) => `${c.name} ${c.hex}`).join(', ') ?? 'não definidas'}
- Slogan ativo: ${brand.slogans?.find((s: any) => s.active)?.text ?? 'não definido'}
- Estilo de design: ${brand.design_rules ?? 'profissional, clean, moderno'}
- Tom de comunicação: ${brand.tone_of_voice ?? 'profissional'}
- Público-alvo: ${brand.target_audience ?? 'não informado'}

A logo enviada deve aparecer em TODAS as imagens geradas.
As referências visuais mostram o estilo visual que a marca usa.
Mantenha consistência total com esta identidade em todas as gerações.`,
    }]

    if (logoAsset?.public_url) {
      content.push({ type: 'input_image', image_url: logoAsset.public_url })
    }

    for (const asset of refAssets) {
      if (asset.public_url) {
        content.push({ type: 'input_image', image_url: asset.public_url })
      }
    }

    const res = await fetch(`${OPENAI_BASE}/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [{ role: 'user', content }],
      }),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error.message)

    console.log('Contexto da marca criado:', data.id)
    return data.id ?? null

  } catch (err: any) {
    console.error('Erro ao criar contexto da marca:', err.message)
    return null
  }
}

// ============================================================
//  Gera imagem teste com gpt-image-2 via Responses API
// ============================================================
async function generateTestImage(
  brand: any,
  previousResponseId: string | null,
  adjustmentNote?: string,
): Promise<{ b64: string; usedContextId: string | null }> {

  const brandColors   = brand.color_palette?.map((c: any) => `${c.name}: ${c.hex}`).join(', ') ?? ''
  const activeSlogans = brand.slogans?.filter((s: any) => s.active).map((s: any) => s.text).join(' | ') ?? ''

  const basePrompt = `Gere uma imagem de teste para validar a identidade visual da marca ${brand.name}.

OBJETIVO: Confirmar que você entendeu corretamente a identidade visual da marca.

IDENTIDADE DA MARCA (aplicar obrigatoriamente):
• Nome: ${brand.name}
• Segmento: ${brand.segment ?? ''}
• Cores: ${brandColors || 'usar cores da logo'}
• Slogan: ${activeSlogans || ''}
• Estilo: ${brand.design_rules ?? 'profissional, clean, moderno'}

COMPOSIÇÃO DA IMAGEM TESTE:
• Fundo com as cores da marca
• Logo da marca em destaque e bem posicionada
• Nome da marca "${brand.name}" em tipografia clara
• Slogan "${activeSlogans}" se houver
• Layout limpo e profissional
• Qualidade premium para Instagram (formato 4:5, 1024x1280px)

Esta é uma imagem de VALIDAÇÃO — mostre a identidade visual da marca de forma clara e fiel.`

  const prompt = adjustmentNote
    ? `${basePrompt}\n\nAJUSTE SOLICITADO PELO CLIENTE:\n${adjustmentNote}\n\nAplique este ajuste mantendo toda a identidade visual da marca.`
    : basePrompt

  const requestBody: any = {
    model: 'gpt-4o',
    input: [{
      role: 'user',
      content: [{ type: 'input_text', text: prompt }],
    }],
    tools: [{
      type: 'image_generation',
      size: '1024x1280',
      quality: 'high',
      output_format: 'png',
    }],
  }

  if (previousResponseId) {
    requestBody.previous_response_id = previousResponseId
  }

  const res = await fetch(`${OPENAI_BASE}/responses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  const data = await res.json()
  if (data.error) throw new Error(`Responses API: ${data.error.message}`)

  const imageOutput = data.output?.find((o: any) => o.type === 'image_generation_call')
  if (!imageOutput?.result) {
    console.error('Response:', JSON.stringify(data).slice(0, 500))
    throw new Error('Imagem não retornada pela Responses API')
  }

  return { b64: imageOutput.result, usedContextId: data.id ?? previousResponseId }
}

// ============================================================
//  Helpers
// ============================================================
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

function json(statusCode: number, body: object) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  }
}
