// ============================================================
//  aiin · Netlify Function: generate-schedule
//  Chama GPT-4o para gerar cronograma de posts.
//  Mantém a OpenAI key segura no servidor.
// ============================================================

const OPENAI_KEY = process.env.OPENAI_API_KEY!

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

function json(statusCode: number, body: object) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) }
}

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const { prompt } = JSON.parse(event.body ?? '{}')
    if (!prompt) return json(400, { error: 'prompt é obrigatório' })

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Você é um estrategista de conteúdo para Instagram no Brasil. Responda sempre em JSON válido sem markdown.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const data = await res.json()
    if (data.error) return json(500, { error: data.error.message })

    return json(200, { content: data.choices[0].message.content })

  } catch (err: any) {
    console.error('generate-schedule error:', err.message)
    return json(500, { error: err.message ?? 'Erro interno' })
  }
}
