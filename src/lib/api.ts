// ============================================================
//  aiin · API helpers v2
//  Frontend → api.ts → Netlify Function → OpenAI + Supabase
//  O frontend NUNCA chama a OpenAI direto.
// ============================================================

import { supabase } from './supabase'
import type { ContentType } from '../types/database'
import { CREDIT_COSTS } from '../types/database'

// ---- Workspace ----
export async function getOrCreateWorkspace(userId: string, name: string) {
  const { data: existing } = await supabase
    .from('workspaces').select('*').eq('owner_id', userId).limit(1).single()
  if (existing) return existing

  const { data, error } = await supabase
    .from('workspaces').insert({ owner_id: userId, name }).select().single()
  if (error) throw error
  return data
}

export async function getUserWorkspace(userId: string) {
  const { data } = await supabase
    .from('workspaces')
    .select('*, subscriptions(*), brand_profiles(*)')
    .eq('owner_id', userId).limit(1).single()
  return data ?? null
}

// ---- Créditos ----
export async function getAvailableCredits(workspaceId: string): Promise<number> {
  const { data } = await supabase.rpc('get_available_credits', { p_workspace_id: workspaceId })
  return data ?? 0
}

export async function getRequiredCredits(jobType: ContentType): Promise<number> {
  return CREDIT_COSTS[jobType] ?? 1
}

// ---- Content Job ----
export async function createContentJob(params: {
  workspaceId: string
  briefId: string
  brandId: string
  jobType: ContentType
  quantity: number
  inputPayload: Record<string, unknown>
}) {
  const { workspaceId, briefId, brandId, jobType, quantity, inputPayload } = params

  // 1. Calcula créditos
  const creditPerUnit = CREDIT_COSTS[jobType] ?? 1
  const requiredCredits = creditPerUnit * (quantity ?? 1)

  // 2. Verifica saldo
  const available = await getAvailableCredits(workspaceId)
  if (available < requiredCredits) {
    throw new Error(`Créditos insuficientes. Necessário: ${requiredCredits}, disponível: ${available}`)
  }

  // 3. Cria o job
  const { data: job, error: jobErr } = await supabase
    .from('content_jobs')
    .insert({
      workspace_id: workspaceId,
      brief_id: briefId,
      brand_id: brandId,
      job_type: jobType,
      status: 'pending',
      required_credits: requiredCredits,
      input_payload: inputPayload,
      idempotency_key: `${briefId}-${Date.now()}`,
    })
    .select().single()

  if (jobErr) throw jobErr

  // 4. Debita créditos
  const { data: debited } = await supabase.rpc('debit_credits', {
    p_workspace_id: workspaceId,
    p_job_id: job.id,
    p_amount: requiredCredits,
    p_description: `Geração: ${jobType} × ${quantity}`,
  })

  if (!debited) {
    await supabase.from('content_jobs').update({ status: 'error' }).eq('id', job.id)
    throw new Error('Falha ao debitar créditos')
  }

  await supabase.from('content_jobs')
    .update({ credits_debited: true, status: 'processing' })
    .eq('id', job.id)

  // 5. Chama a Netlify Function (background — retorna imediatamente)
  const apiBase = import.meta.env.VITE_API_BASE ?? ''
  try {
    await fetch(`${apiBase}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        brief_id: briefId,
        brand_id: brandId,
        workspace_id: workspaceId,
        job_type: jobType,
        quantity,
        required_credits: requiredCredits,
        ...inputPayload,
      }),
    })
  } catch (err) {
    // Reembolsa se a função falhar
    await supabase.rpc('refund_credits', {
      p_workspace_id: workspaceId,
      p_job_id: job.id,
      p_amount: requiredCredits,
      p_description: 'Reembolso: falha ao iniciar geração',
    })
    await supabase.from('content_jobs')
      .update({ status: 'error', error_message: 'Falha ao iniciar geração' })
      .eq('id', job.id)
    throw new Error('Falha ao iniciar geração')
  }

  return job
}

// ---- Aprovação ----
export async function approveOutput(outputId: string, userId: string) {
  await supabase.from('creative_outputs').update({ status: 'approved' }).eq('id', outputId)
  await supabase.from('approval_events').insert({ output_id: outputId, user_id: userId, action: 'approved' })
}

export async function rejectOutput(outputId: string, userId: string, notes?: string) {
  await supabase.from('creative_outputs').update({ status: 'rejected', approval_notes: notes }).eq('id', outputId)
  await supabase.from('approval_events').insert({ output_id: outputId, user_id: userId, action: 'rejected', notes })
}

export async function scheduleOutput(outputId: string, userId: string, scheduledAt: Date) {
  const { data: output } = await supabase
    .from('creative_outputs').select('workspace_id, brand_id').eq('id', outputId).single()
  if (!output) throw new Error('Output não encontrado')

  await supabase.from('creative_outputs')
    .update({ status: 'scheduled', scheduled_at: scheduledAt.toISOString() })
    .eq('id', outputId)

  await supabase.from('scheduled_posts').insert({
    workspace_id: output.workspace_id,
    output_id: outputId,
    brand_id: output.brand_id,
    scheduled_at: scheduledAt.toISOString(),
  })

  await supabase.from('approval_events').insert({
    workspace_id: output.workspace_id,
    output_id: outputId,
    user_id: userId,
    action: 'scheduled',
  })
}

// ---- Brand DNA ----
export async function generateBrandDNA(brandId: string): Promise<string> {
  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('*, brand_assets(*), brand_learnings(*)')
    .eq('id', brandId).single()

  if (!brand) throw new Error('Marca não encontrada')

  const dna = `
BRAND DNA — ${brand.name}
Segmento: ${brand.segment ?? '—'}
Público: ${brand.target_audience ?? '—'}
Objetivo: ${brand.main_objective ?? '—'}
Tom de voz: ${brand.tone_of_voice ?? '—'}
Produtos/Serviços: ${brand.products ?? '—'}
Slogan ativo: ${brand.slogans?.find((s: any) => s.active)?.text ?? '—'}
Cores: ${brand.color_palette?.map((c: any) => `${c.name} ${c.hex}`).join(', ') ?? '—'}
Fontes: ${brand.typography?.title ?? '—'}
Palavras proibidas: ${brand.forbidden_words?.join(', ') ?? 'nenhuma'}
Regras de design: ${brand.design_rules ?? 'nenhuma'}
Assets disponíveis: ${brand.brand_assets?.length ?? 0} imagens
Aprendizados: ${brand.brand_learnings?.map((l: any) => l.content).join(' | ') ?? 'nenhum ainda'}
  `.trim()

  await supabase.from('brand_profiles').update({ ai_brand_dna: dna }).eq('id', brandId)
  return dna
}
