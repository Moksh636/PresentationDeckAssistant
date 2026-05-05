import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

const LOCAL_DEV_BYPASS_KEY = 'deckspace-local-dev-bypass'

export function readLocalDevBypassFlag(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(LOCAL_DEV_BYPASS_KEY) === '1'
  } catch {
    return false
  }
}

export function writeLocalDevBypassFlag(active: boolean) {
  try {
    if (active) {
      sessionStorage.setItem(LOCAL_DEV_BYPASS_KEY, '1')
    } else {
      sessionStorage.removeItem(LOCAL_DEV_BYPASS_KEY)
    }
  } catch {
    // ignore
  }
}

export interface AuthContextValue {
  isSupabaseConfigured: boolean
  isLoading: boolean
  session: Session | null
  user: User | null
  /** True when env vars are missing and local dev entry was chosen */
  isLocalDevBypass: boolean
  /** Whether protected app routes may render */
  canAccessApp: boolean
  signInWithEmail: (email: string) => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (email: string, password: string) => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  enterLocalDevMode: () => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
