import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useWorkspace } from '../../context/useWorkspace'
import { isOwnerOrAdmin } from '../../data/postAuthRedirect'

/** Restricts wrapped routes to organization owners/admins. */
export function OwnerConsoleGuard() {
  const auth = useAuth()
  const { workspace } = useWorkspace()

  if (!auth.user) {
    return <Navigate to="/auth" replace />
  }

  if (!isOwnerOrAdmin(workspace, auth.user.id)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
