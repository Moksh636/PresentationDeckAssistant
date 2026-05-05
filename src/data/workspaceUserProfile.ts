import type { User } from '@supabase/supabase-js'
import { OWNER_USER_ID } from './sourceIngestion'
import type { UserProfileRef } from './companyBrainMutations'

export function workspaceUserProfileFromAuth(user: User | null, isLocalDevBypass: boolean): UserProfileRef {
  if (!user || isLocalDevBypass) {
    const email = typeof user?.email === 'string' ? user.email : 'local-workspace@deckspace.local'

    const displayName =
      (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
      email.split('@')[0] ||
      'Local workspace'

    return {
      userId: OWNER_USER_ID,
      email,
      displayName,
    }
  }

  const email = typeof user.email === 'string' ? user.email : 'user@deckspace.local'
  const displayName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    email.split('@')[0] ||
    'Member'

  return {
    userId: user.id,
    email,
    displayName,
  }
}
