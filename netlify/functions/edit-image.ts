// aiin · edit-image — edita imagem de um post via Responses API (gpt-image)
// 1ª edição grátis, demais cobram 1 crédito
import { createClient } from '@supabase/supabase-js'

const OPENAI_KEY  = process.env.OPENAI_API_KEY!
const OPENAI_BASE = 'https://api.openai.com/v1'
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { output_id, instruction, workspace_id } = JSON.parse(event.body ?? '{}')
    if (!output_id || !instruction) {
      return { statusCode: 400, body: JSON.stringify({ error: 'output_id e instruction obrigatórios' }) }
    }

    // 1. Buscar o output
    const { data: output, error: outErr } = await supabase
      .from('creative_outputs')
      .select('*')
      .eq('id', output_id)
      .single()

    if (outErr || !output) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Post não encontrado' }) }
    }

    const editCount = output.edit_count ?? 0

    // 2. Da segunda edição em diante, cobra 1 crédito
    if (editCount >= 1) {
      const { data: creditOk, error: creditErr } = await supabase.rpc('debit_credits', {
        p_workspace_id: workspace_id,
        p_job_id: null,
        p_amount: 1,
        p_description: `Edição de imagem (${editCount + 1}ª vez)`,
      })
      if (creditErr || creditOk === false) {
        return { statusCode: 402, body: JSON.stringify({ error: 'Créditos insuficientes para nova edição' }) }
      }
    }

    // 3. Montar requisição de edição
    const editPrompt = `Edite a imagem anterior aplicando este ajuste solicitado pelo usuário, mantendo o restante da composição, textos e identidade visual intactos:\n\n"${instruction}"\n\nIMPORTANTE: aplique APENAS o ajuste pedido. Não altere textos, logo ou cores da marca a não ser que o ajuste peça explicitamente.`

    const requestBody: any = {
      model: 'gpt-4o',
      input: [{ role: 'user', content: [{ type: 'input_text', text: editPrompt }] }],
      tools: [{ type: 'image_generation', quality: 'high', output_format: 'png' }],
    }

    // Usa o contexto da imagem anterior se existir (edição contextual de verdade)
    if (output.image_response_id) {
      requestBody.previous_response_id = output.image_response_id
    }

    const res = await fetch(`${OPENAI_BASE}/responses`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error.message)

    const imageOutput = data.output?.find((o: any) => o.type === 'image_generation_call')
    if (!imageOutput?.result) {
      throw new Error('Imagem editada não retornada')
    }

    // 4. Upload da nova imagem (sobrescreve)
    const fileName = output.storage_path ?? `${workspace_id}/generated/${output_id}_edited.png`
    const buffer = Buffer.from(imageOutput.result, 'base64')

    const { error: upErr } = await supabase.storage
      .from('posts')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true })

    if (upErr) throw new Error(`Upload: ${upErr.message}`)

    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
    // Cache-bust para a UI recarregar a imagem nova
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

    // 5. Atualizar o output
    await supabase.from('creative_outputs').update({
      public_url: publicUrl,
      image_response_id: data.id ?? output.image_response_id,
      edit_count: editCount + 1,
    }).eq('id', output_id)

    return {
      statusCode: 200,
      body: JSON.stringify({
        public_url: publicUrl,
        edit_count: editCount + 1,
        charged: editCount >= 1,
      }),
    }

  } catch (e: any) {
    console.error('edit-image error:', e.message)
    return { statusCode: 500, body: JSON.stringify({ error: e.message ?? 'Erro ao editar imagem' }) }
  }
}
