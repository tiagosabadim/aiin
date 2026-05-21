// ============================================================
//  aiin · useOutputs hook — substitui usePosts
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CreativeOutput, OutputStatus } from '../types/database'

export function useOutputs(workspaceId: string, status?: OutputStatus) {
  const [outputs, setOutputs] = useState<CreativeOutput[]>([])
  const [loading, setLoading]  = useState(true)

  const fetch = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    let q = supabase
      .from('creative_outputs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data } = await q
    setOutputs(data ?? [])
    setLoading(false)
  }, [workspaceId, status])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (!workspaceId) return
    const ch = supabase.channel(`outputs:${workspaceId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'creative_outputs',
        filter: `workspace_id=eq.${workspaceId}`,
      }, () => fetch())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workspaceId, fetch])

  return { outputs, loading, refetch: fetch }
}
