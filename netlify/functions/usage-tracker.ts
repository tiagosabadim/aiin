// aiin · usage-tracker — registra custo estimado de cada chamada à OpenAI
// Importado pelas Netlify Functions. Preços baseados na tabela OpenAI (maio/2026).
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Preços por 1M tokens (USD) — ajuste conforme a tabela vigente da OpenAI
const PRICING = {
  'gpt-4o':       { input: 2.50,  output: 10.00 },  // por 1M tokens
  'gpt-4o-mini':  { input: 0.15,  output: 0.60  },
}

// Preço fixo por imagem gpt-image-1 (qualidade high, retrato) ≈ USD
const IMAGE_PRICE = {
  'gpt-image-1-high':   0.19,
  'gpt-image-1-medium': 0.07,
  'gpt-image-1-low':    0.02,
}

interface TrackParams {
  workspace_id?: string | null
  brand_id?: string | null
  operation: 'content' | 'image' | 'regenerate' | 'schedule' | 'visual_context'
  model: string
  units?: number
  input_tokens?: number
  output_tokens?: number
  image_quality?: 'high' | 'medium' | 'low'
}

export async function trackUsage(p: TrackParams): Promise<void> {
  try {
    let cost = 0

    // Custo de imagem
    if (p.operation === 'image' || p.operation === 'regenerate' || p.operation === 'visual_context') {
      const key = `gpt-image-1-${p.image_quality ?? 'high'}` as keyof typeof IMAGE_PRICE
      cost += (IMAGE_PRICE[key] ?? IMAGE_PRICE['gpt-image-1-high']) * (p.units ?? 1)
    }

    // Custo de tokens (texto)
    const pricing = PRICING[p.model as keyof typeof PRICING]
    if (pricing) {
      cost += (p.input_tokens ?? 0)  / 1_000_000 * pricing.input
      cost += (p.output_tokens ?? 0) / 1_000_000 * pricing.output
    }

    await supabase.from('api_usage').insert({
      workspace_id:  p.workspace_id ?? null,
      brand_id:      p.brand_id ?? null,
      operation:     p.operation,
      model:         p.model,
      units:         p.units ?? 1,
      input_tokens:  p.input_tokens ?? 0,
      output_tokens: p.output_tokens ?? 0,
      cost_usd:      Number(cost.toFixed(5)),
    })
  } catch (e) {
    // Logging de custo nunca deve quebrar a geração
    console.error('[usage-tracker] falha ao registrar:', (e as Error).message)
  }
}
