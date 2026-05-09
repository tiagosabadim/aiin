// ============================================================
//  PostAI · usePosts hook
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Post, PostStatus } from '../types/database'

export function usePosts(brandId: string, status?: PostStatus) {
  const [posts, setPosts]     = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('posts')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) setError(error.message)
    else setPosts(data ?? [])
    setLoading(false)
  }, [brandId, status])

  useEffect(() => { fetch() }, [fetch])

  // Realtime: escuta mudanças nos posts desta marca
  useEffect(() => {
    const channel = supabase
      .channel(`posts:${brandId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `brand_id=eq.${brandId}` },
        () => fetch()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [brandId, fetch])

  const approvePost = async (postId: string) => {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'approved' })
      .eq('id', postId)
    if (error) throw error
  }

  const rejectPost = async (postId: string, reason?: string) => {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'rejected', rejection_reason: reason ?? null })
      .eq('id', postId)
    if (error) throw error
  }

  const schedulePost = async (postId: string, scheduledAt: Date) => {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'scheduled', scheduled_at: scheduledAt.toISOString() })
      .eq('id', postId)
    if (error) throw error
  }

  const updateCaption = async (postId: string, caption: string) => {
    const { error } = await supabase
      .from('posts')
      .update({ caption })
      .eq('id', postId)
    if (error) throw error
  }

  return { posts, loading, error, approvePost, rejectPost, schedulePost, updateCaption, refetch: fetch }
}
