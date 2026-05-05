import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../data/supabaseClient'
import {
  AuthContext,
  readLocalDevBypassFlag,
  writeLocalDevBypassFlag,
} from './authStoreContext'
import type { AuthContextValue } from './authStoreContext'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(supabase))
  const [localDevBypass, setLocalDevBypass] = useState(() => readLocalDevBypassFlag())

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let isMounted = true

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isMounted) {
          setSession(data.session)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setSession(null)
          setIsLoading(false)
        }
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const enterLocalDevMode = useCallback(() => {
    writeLocalDevBypassFlag(true)
    setLocalDevBypass(true)
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.')
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      throw error
    }
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.')
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw error
    }
  }, [])

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.')
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      throw error
    }
  }, [])

  const resetPasswordForEmail = useCallback(async (email: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.')
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    })

    if (error) {
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    writeLocalDevBypassFlag(false)
    setLocalDevBypass(false)

    if (!supabase) {
      return
    }

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }
  }, [])

  const canAccessApp = useMemo(() => {
    if (!isSupabaseConfigured) {
      return localDevBypass
    }

    return Boolean(session?.user)
  }, [localDevBypass, session?.user])

  const value = useMemo<AuthContextValue>(
    () => ({
      isSupabaseConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
      isLocalDevBypass: localDevBypass,
      canAccessApp,
      signInWithEmail,
      signInWithPassword,
      signUpWithPassword,
      resetPasswordForEmail,
      enterLocalDevMode,
      signOut,
    }),
    [
      canAccessApp,
      enterLocalDevMode,
      isLoading,
      localDevBypass,
      resetPasswordForEmail,
      session,
      signInWithEmail,
      signInWithPassword,
      signOut,
      signUpWithPassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
