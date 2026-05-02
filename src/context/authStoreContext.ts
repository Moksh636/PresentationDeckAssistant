import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  isSupabaseConfigured: boolean
  isLoading: boolean
  session: Session | null
  user: User | null
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
