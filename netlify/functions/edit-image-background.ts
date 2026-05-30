// aiin · edit-image — edita a imagem REAL do post enviando-a como input
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
    if (!output.public_url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Post sem imagem para editar' }) }
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

    // 3. Baixar a imagem ATUAL do post (remove query string de cache-bust)
    const cleanUrl = output.public_url.split('?')[0]
    const imgRes = await fetch(cleanUrl)
    if (!imgRes.ok) throw new Error('Não foi possível baixar a imagem original')
    const imgArrayBuffer = await imgRes.arrayBuffer()
    const imgBuffer = Buffer.from(imgArrayBuffer)

    // 4. Montar prompt de edição
    const editPrompt = `Aplique este ajuste na imagem, mantendo a composição, o texto e a identidade visual existentes: ${instruction}. Mantenha tudo o que não foi mencionado exatamente como está na imagem original.`

    // 5. Chamar /images/edits com a imagem real como input (edição de verdade)
    const form = new FormData()
    form.append('model', 'gpt-image-1')
    form.append('image', new Blob([imgBuffer], { type: 'image/png' }), 'image.png')
    form.append('prompt', editPrompt)
    form.append('size', getSize(output.format))
    form.append('quality', 'high')

    const res = await fetch(`${OPENAI_BASE}/images/edits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: form,
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error.message)

    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error('Imagem editada não retornada')

    // 6. Upload da nova imagem (sobrescreve a antiga)
    const fileName = output.storage_path ?? `${workspace_id}/generated/${output_id}_edited.png`
    const buffer = Buffer.from(b64, 'base64')

    const { error: upErr } = await supabase.storage
      .from('posts')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true })

    if (upErr) throw new Error(`Upload: ${upErr.message}`)

    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

    // 7. Atualizar o output
    await supabase.from('creative_outputs').update({
      public_url: publicUrl,
      edit_count: editCount + 1,
    }).eq('id', output_id)

    return {
      statusCode: 200,
      body: JSON.stringify({ public_url: publicUrl, edit_count: editCount + 1, charged: editCount >= 1 }),
    }

  } catch (e: any) {
    console.error('edit-image error:', e.message)
    return { statusCode: 500, body: JSON.stringify({ error: e.message ?? 'Erro ao editar imagem' }) }
  }
}

function getSize(format: string): string {
  // gpt-image-1 aceita: 1024x1024, 1024x1536 (retrato), 1536x1024 (paisagem)
  if (format === 'story' || format === 'capa_reels') return '1024x1536'
  return '1024x1536' // posts 4:5 e carrossel usam retrato
}
