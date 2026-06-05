// ============================================================
//  aiin · useWorkspace hook
// ============================================================
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Workspace, BrandProfile, Subscription } from '../types/database'

interface WorkspaceState {
  workspace: Workspace | null
  brand: BrandProfile | null
  subscription: Subscription | null
  credits: number
  loading: boolean
}

export function useWorkspace() {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<WorkspaceState>({
    workspace: null, brand: null, subscription: null, credits: 0, loading: true,
  })

  const fetch = async () => {
    // Enquanto o auth ainda está verificando a sessão, mantém carregando.
    // Isso evita o "flash" do onboarding no refresh (quando user ainda é null
    // por estar carregando, não por não existir).
    if (authLoading) {
      setState(s => ({ ...s, loading: true }))
      return
    }

    // Auth terminou e não há usuário → realmente deslogado.
    if (!user) {
      setState({ workspace: null, brand: null, subscription: null, credits: 0, loading: false })
      return
    }

    // Auth terminou e há usuário → busca o workspace (mantém loading durante a busca).
    setState(s => ({ ...s, loading: true }))

    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!ws) {
      setState({ workspace: null, brand: null, subscription: null, credits: 0, loading: false })
      return
    }

    const [{ data: brand }, { data: sub }] = await Promise.all([
      supabase.from('brand_profiles').select('*').eq('workspace_id', ws.id).limit(1).maybeSingle(),
      supabase.from('subscriptions').select('*, plan:plans(*)').eq('workspace_id', ws.id).eq('status', 'active').limit(1).maybeSingle(),
    ])

    const credits = (sub?.monthly_credits_available ?? 0) + (sub?.extra_credits_available ?? 0)

    setState({ workspace: ws, brand: brand ?? null, subscription: sub ?? null, credits, loading: false })
  }

  // Re-busca sempre que o auth resolver ou o usuário mudar.
  useEffect(() => { fetch() }, [user, authLoading])

  return { ...state, refetch: fetch }
}
