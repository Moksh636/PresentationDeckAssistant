import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useWorkspace } from '../../context/useWorkspace'
import { canAccessOwnerConsole } from '../../data/postAuthRedirect'

/** Restricts wrapped routes to organization owners/admins. */
export function OwnerConsoleGuard() {
  const auth = useAuth()
  const { workspace } = useWorkspace()
  const canAccess = canAccessOwnerConsole(workspace, {
    userId: auth.user?.id ?? null,
    isLocalDevBypass: auth.isLocalDevBypass,
  })

  if (!canAccess) {
    if (!auth.user && !auth.isLocalDevBypass) {
      return <Navigate to="/auth" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
