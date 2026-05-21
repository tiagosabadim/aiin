// ============================================================
//  aiin · API helpers — backend intermediário
//  O frontend NUNCA chama o n8n direto.
//  Tudo passa por aqui primeiro.
// ============================================================

import { supabase } from './supabase'
import type { ContentType, ContentBrief, CreativeOutput } from '../types/database'

// ---- Workspace ----

export async function getOrCreateWorkspace(userId: string, name: string) {
  // Busca workspace existente
  const { data: existing } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)
    .limit(1)
    .single()

  if (existing) return existing

  // Cria novo workspace
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ owner_id: userId, name })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getUserWorkspace(userId: string) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*, subscriptions(*), brand_profiles(*)')
    .eq('owner_id', userId)
    .limit(1)
    .single()

  if (error) return null
  return data
}

// ---- Créditos ----

export async function getAvailableCredits(workspaceId: string): Promise<number> {
  const { data, error } = await supabase
    .rpc('get_available_credits', { p_workspace_id: workspaceId })

  if (error) return 0
  return data ?? 0
}

export async function getRequiredCredits(jobType: ContentType): Promise<number> {
  const { data, error } = await supabase
    .rpc('get_required_credits', { p_job_type: jobType })

  if (error) return 1
  return data ?? 1
}

// ---- Content Job ----

export async function createContentJob(params: {
  workspaceId: string
  briefId: string
  brandId: string
  jobType: ContentType
  inputPayload: Record<string, unknown>
}) {
  const { workspaceId, briefId, brandId, jobType, inputPayload } = params

  // 1. Calcula créditos necessários
  const requiredCredits = await getRequiredCredits(jobType)

  // 2. Verifica saldo
  const available = await getAvailableCredits(workspaceId)
  if (available < requiredCredits) {
    throw new Error(`Créditos insuficientes. Necessário: ${requiredCredits}, disponível: ${available}`)
  }

  // 3. Cria o job
  const idempotencyKey = `${briefId}-${Date.now()}`
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
      idempotency_key: idempotencyKey,
    })
    .select()
    .single()

  if (jobErr) throw jobErr

  // 4. Debita créditos
  const { data: debited, error: debitErr } = await supabase
    .rpc('debit_credits', {
      p_workspace_id: workspaceId,
      p_job_id: job.id,
      p_amount: requiredCredits,
      p_description: `Geração: ${jobType}`,
    })

  if (debitErr || !debited) {
    // Cancela o job se não conseguiu debitar
    await supabase.from('content_jobs').update({ status: 'error', error_message: 'Falha ao debitar créditos' }).eq('id', job.id)
    throw new Error('Falha ao debitar créditos')
  }

  // 5. Marca créditos como debitados
  await supabase.from('content_jobs').update({ credits_debited: true, status: 'processing' }).eq('id', job.id)

  // 6. Atualiza briefing
  await supabase.from('content_briefs').update({ status: 'processing' }).eq('id', briefId)

  // 7. Chama o n8n
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          brief_id: briefId,
          brand_id: brandId,
          workspace_id: workspaceId,
          job_type: jobType,
          ...inputPayload,
        }),
      })
      await supabase.from('content_jobs').update({ status: 'processing' }).eq('id', job.id)
    } catch (err) {
      // Reembolsa se o n8n falhar
      await supabase.rpc('refund_credits', {
        p_workspace_id: workspaceId,
        p_job_id: job.id,
        p_amount: requiredCredits,
        p_description: 'Reembolso: falha ao chamar n8n',
      })
      await supabase.from('content_jobs').update({ status: 'error', error_message: 'Falha ao chamar n8n' }).eq('id', job.id)
      throw new Error('Falha ao iniciar geração')
    }
  }

  return job
}

// ---- Aprovação ----

export async function approveOutput(outputId: string, userId: string) {
  const { error } = await supabase
    .from('creative_outputs')
    .update({ status: 'approved' })
    .eq('id', outputId)

  if (error) throw error

  await supabase.from('approval_events').insert({
    output_id: outputId,
    user_id: userId,
    action: 'approved',
  })
}

export async function rejectOutput(outputId: string, userId: string, notes?: string) {
  const { error } = await supabase
    .from('creative_outputs')
    .update({ status: 'rejected', approval_notes: notes })
    .eq('id', outputId)

  if (error) throw error

  await supabase.from('approval_events').insert({
    output_id: outputId,
    user_id: userId,
    action: 'rejected',
    notes,
  })
}

export async function scheduleOutput(outputId: string, userId: string, scheduledAt: Date) {
  // Busca workspace_id do output
  const { data: output } = await supabase
    .from('creative_outputs')
    .select('workspace_id, brand_id')
    .eq('id', outputId)
    .single()

  if (!output) throw new Error('Output não encontrado')

  const { error } = await supabase
    .from('creative_outputs')
    .update({ status: 'scheduled', scheduled_at: scheduledAt.toISOString() })
    .eq('id', outputId)

  if (error) throw error

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
    .eq('id', brandId)
    .single()

  if (!brand) throw new Error('Marca não encontrada')

  const dna = `
BRAND DNA — ${brand.name}

Segmento: ${brand.segment ?? 'não informado'}
Público: ${brand.target_audience ?? 'não informado'}
Objetivo: ${brand.main_objective ?? 'não informado'}
Tom de voz: ${brand.tone_of_voice ?? 'não informado'}
Produtos/Serviços: ${brand.products ?? 'não informado'}
Slogan ativo: ${brand.slogans?.find((s: { text: string; active: boolean }) => s.active)?.text ?? 'não definido'}
Cores: ${brand.color_palette?.map((c: { name: string; hex: string }) => `${c.name} ${c.hex}`).join(', ') ?? 'não definidas'}
Fontes: ${brand.typography?.title ?? 'não definidas'}
Palavras proibidas: ${brand.forbidden_words?.join(', ') ?? 'nenhuma'}
Regras de design: ${brand.design_rules ?? 'nenhuma'}
Assets disponíveis: ${brand.brand_assets?.length ?? 0} imagens
Aprendizados: ${brand.brand_learnings?.map((l: { content: string }) => l.content).join(' | ') ?? 'nenhum ainda'}
  `.trim()

  await supabase
    .from('brand_profiles')
    .update({ ai_brand_dna: dna })
    .eq('id', brandId)

  return dna
}
