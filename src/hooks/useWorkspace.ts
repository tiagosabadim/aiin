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
  const { user } = useAuth()
  const [state, setState] = useState<WorkspaceState>({
    workspace: null, brand: null, subscription: null, credits: 0, loading: true,
  })

  const fetch = async () => {
    if (!user) { setState(s => ({ ...s, loading: false })); return }

    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .limit(1)
      .single()

    if (!ws) { setState(s => ({ ...s, loading: false })); return }

    const [{ data: brand }, { data: sub }] = await Promise.all([
      supabase.from('brand_profiles').select('*').eq('workspace_id', ws.id).limit(1).single(),
      supabase.from('subscriptions').select('*').eq('workspace_id', ws.id).eq('status', 'active').limit(1).single(),
    ])

    const credits = (sub?.monthly_credits_available ?? 0) + (sub?.extra_credits_available ?? 0)

    setState({ workspace: ws, brand: brand ?? null, subscription: sub ?? null, credits, loading: false })
  }

  useEffect(() => { fetch() }, [user])

  return { ...state, refetch: fetch }
}
