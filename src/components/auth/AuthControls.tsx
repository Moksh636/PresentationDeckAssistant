import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { useWorkspace } from '../../context/useWorkspace'
import {
  saveWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  type WorkspaceSnapshotClient,
} from '../../data/workspaceCloudPersistence'
import { supabase } from '../../data/supabaseClient'
import { createDemoWorkspaceState } from '../../data/demoWorkspaceSeed'
import { seedWorkspaceState } from '../../data/mockWorkspace'
import { useToast } from '../feedback/toastContext'

interface AuthControlsProps {
  variant?: 'full' | 'compact'
}

export function AuthControls({ variant = 'full' }: AuthControlsProps) {
  const auth = useAuth()
  const { workspace, replaceWorkspace } = useWorkspace()
  const { showToast } = useToast()
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

  const handleSignOut = async () => {
    setIsBusy(true)

    try {
      const hadSession = Boolean(auth.session)
      await auth.signOut()
      showToast(hadSession ? 'Signed out.' : 'Returned to sign-in screen.', 'info')
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

  const handleLoadDemoWorkspace = () => {
    replaceWorkspace(createDemoWorkspaceState())
    showToast('Loaded Northstar FieldOps demo workspace.', 'success')
  }

  const handleResetDemoWorkspace = () => {
    replaceWorkspace(seedWorkspaceState())
    showToast('Reset workspace to default local seed.', 'info')
  }

  const label = !auth.isSupabaseConfigured
    ? 'Local'
    : auth.user
      ? auth.user.email?.split('@')[0] ?? 'Account'
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
          title={
            !auth.isSupabaseConfigured
              ? 'Local development'
              : auth.user
                ? auth.user.email ?? 'Account'
                : 'Sign in'
          }
          onClick={() => setIsPopoverOpen((current) => !current)}
        >
          {label}
        </button>
      ) : null}

      <div className={`auth-controls__panel ${isCompact && isPopoverOpen ? 'is-open' : ''}`}>
        <AuthPanelContent
          isBusy={isBusy || auth.isLoading}
          onSignOut={handleSignOut}
          onSaveToCloud={handleSaveToCloud}
          onLoadFromCloud={handleLoadFromCloud}
          onLoadDemoWorkspace={handleLoadDemoWorkspace}
          onResetDemoWorkspace={handleResetDemoWorkspace}
        />
      </div>
    </div>
  )
}

interface AuthPanelContentProps {
  isBusy: boolean
  onSignOut: () => void
  onSaveToCloud: () => void
  onLoadFromCloud: () => void
  onLoadDemoWorkspace: () => void
  onResetDemoWorkspace: () => void
}

function AuthPanelContent({
  isBusy,
  onSignOut,
  onSaveToCloud,
  onLoadFromCloud,
  onLoadDemoWorkspace,
  onResetDemoWorkspace,
}: AuthPanelContentProps) {
  const auth = useAuth()

  if (!auth.isSupabaseConfigured) {
    return (
      <section className="auth-card" aria-label="Local workspace mode">
        <span className="auth-card__status">Local workspace mode</span>
        <p className="muted-copy">
          Browser-only workspace. Use “Continue in local workspace mode” on the sign-in screen when cloud
          settings are unavailable.
        </p>
        <button type="button" className="ghost-button" disabled={isBusy} onClick={onSignOut}>
          Return to sign-in screen
        </button>
        <div className="auth-card__actions auth-card__actions--demo">
          <button type="button" className="secondary-button" disabled={isBusy} onClick={onLoadDemoWorkspace}>
            Load demo workspace
          </button>
          <button type="button" className="ghost-button" disabled={isBusy} onClick={onResetDemoWorkspace}>
            Reset demo workspace
          </button>
        </div>
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
      <section className="auth-card" aria-label="Sign in required">
        <span className="auth-card__status">Signed out</span>
        <p className="muted-copy">Use the sign-in page to continue.</p>
      </section>
    )
  }

  return (
    <section className="auth-card" aria-label="Cloud persistence controls">
      <span className="auth-card__status">Signed in</span>
      <p className="auth-card__email">{auth.user.email}</p>
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
