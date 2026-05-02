import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/useAuth'
import { useWorkspace } from '../../context/useWorkspace'
import {
  saveWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  type WorkspaceSnapshotClient,
} from '../../data/workspaceCloudPersistence'
import { supabase } from '../../data/supabaseClient'
import { useToast } from '../feedback/toastContext'

interface AuthControlsProps {
  variant?: 'full' | 'compact'
}

export function AuthControls({ variant = 'full' }: AuthControlsProps) {
  const auth = useAuth()
  const { workspace, replaceWorkspace } = useWorkspace()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isCompact = variant === 'compact'

  useEffect(() => {
    if (!isCompact || !isPopoverOpen) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null

      if (target && containerRef.current?.contains(target)) {
        return
      }

      setIsPopoverOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPopoverOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isCompact, isPopoverOpen])

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!email.trim()) {
      showToast('Enter an email address to sign in.', 'error')
      return
    }

    setIsBusy(true)

    try {
      await auth.signInWithEmail(email.trim())
      showToast('Check your email for the Supabase sign-in link.', 'success')
      setEmail('')
    } catch {
      showToast('Could not send sign-in link.', 'error')
    } finally {
      setIsBusy(false)
    }
  }

  const handleSignOut = async () => {
    setIsBusy(true)

    try {
      await auth.signOut()
      showToast('Signed out. Local mode remains available.', 'info')
    } catch {
      showToast('Could not sign out.', 'error')
    } finally {
      setIsBusy(false)
    }
  }

  const handleSaveToCloud = async () => {
    if (!supabase || !auth.user) {
      showToast('Sign in with Supabase before saving to cloud.', 'error')
      return
    }

    setIsBusy(true)

    try {
      const cloudClient = supabase as unknown as WorkspaceSnapshotClient
      const snapshot = await saveWorkspaceSnapshot({
        supabase: cloudClient,
        userId: auth.user.id,
        workspace,
      })

      showToast(`Workspace saved to cloud at ${new Date(snapshot.updatedAt).toLocaleTimeString()}.`, 'success')
    } catch {
      showToast('Cloud save failed. Local work is still saved in this browser.', 'error')
    } finally {
      setIsBusy(false)
    }
  }

  const handleLoadFromCloud = async () => {
    if (!supabase || !auth.user) {
      showToast('Sign in with Supabase before loading from cloud.', 'error')
      return
    }

    setIsBusy(true)

    try {
      const cloudClient = supabase as unknown as WorkspaceSnapshotClient
      const snapshot = await loadWorkspaceSnapshot({
        supabase: cloudClient,
        userId: auth.user.id,
      })

      if (!snapshot) {
        showToast('No cloud snapshot exists for this account yet.', 'info')
        return
      }

      replaceWorkspace(snapshot.workspace)
      showToast(`Loaded cloud snapshot from ${new Date(snapshot.updatedAt).toLocaleString()}.`, 'success')
    } catch {
      showToast('Cloud load failed. Local workspace was left unchanged.', 'error')
    } finally {
      setIsBusy(false)
    }
  }

  const label = !auth.isSupabaseConfigured
    ? 'Local'
    : auth.user
      ? 'Cloud'
      : 'Sign'

  return (
    <div
      ref={containerRef}
      className={`auth-controls ${isCompact ? 'auth-controls--compact' : ''}`}
    >
      {isCompact ? (
        <button
          type="button"
          className="auth-controls__compact-trigger"
          aria-expanded={isPopoverOpen}
          title={auth.isSupabaseConfigured ? 'Cloud sync' : 'Local mode'}
          onClick={() => setIsPopoverOpen((current) => !current)}
        >
          {label}
        </button>
      ) : null}

      <div className={`auth-controls__panel ${isCompact && isPopoverOpen ? 'is-open' : ''}`}>
        <AuthPanelContent
          email={email}
          isBusy={isBusy || auth.isLoading}
          onEmailChange={setEmail}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onSaveToCloud={handleSaveToCloud}
          onLoadFromCloud={handleLoadFromCloud}
        />
      </div>
    </div>
  )
}

interface AuthPanelContentProps {
  email: string
  isBusy: boolean
  onEmailChange: (email: string) => void
  onSignIn: (event: FormEvent<HTMLFormElement>) => void
  onSignOut: () => void
  onSaveToCloud: () => void
  onLoadFromCloud: () => void
}

function AuthPanelContent({
  email,
  isBusy,
  onEmailChange,
  onSignIn,
  onSignOut,
  onSaveToCloud,
  onLoadFromCloud,
}: AuthPanelContentProps) {
  const auth = useAuth()

  if (!auth.isSupabaseConfigured) {
    return (
      <section className="auth-card" aria-label="Local persistence mode">
        <span className="auth-card__status">Local mode</span>
        <p>Supabase is not configured. Work is saved in this browser.</p>
      </section>
    )
  }

  if (auth.isLoading) {
    return (
      <section className="auth-card" aria-label="Checking auth status">
        <span className="auth-card__status">Checking auth</span>
        <p>Looking for an existing Supabase session.</p>
      </section>
    )
  }

  if (!auth.user) {
    return (
      <form className="auth-card" aria-label="Sign in with email" onSubmit={onSignIn}>
        <span className="auth-card__status">Sign in to sync</span>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            placeholder="you@example.com"
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
        <button type="submit" className="secondary-button" disabled={isBusy}>
          {isBusy ? 'Sending...' : 'Sign in'}
        </button>
      </form>
    )
  }

  return (
    <section className="auth-card" aria-label="Cloud persistence controls">
      <span className="auth-card__status">Cloud ready</span>
      <p>{auth.user.email}</p>
      <div className="auth-card__actions">
        <button type="button" className="secondary-button" disabled={isBusy} onClick={onSaveToCloud}>
          Save to Cloud
        </button>
        <button type="button" className="secondary-button" disabled={isBusy} onClick={onLoadFromCloud}>
          Load from Cloud
        </button>
      </div>
      <button type="button" className="ghost-button" disabled={isBusy} onClick={onSignOut}>
        Sign out
      </button>
    </section>
  )
}
