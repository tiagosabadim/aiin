// ============================================================
//  PostAI · useAuth hook
// ============================================================

import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  useEffect(() => {
    // Sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, loading: false })
    })

    // Escuta mudanças de auth (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState({ user: session?.user ?? null, session, loading: false })
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUpWithEmail = (email: string, password: string) =>
    supabase.auth.signUp({ email, password })

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })

  const signOut = () => supabase.auth.signOut()

  return { ...state, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut }
}
