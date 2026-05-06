import { Navigate } from 'react-router-dom'
import { AuthLoadingScreen } from './AuthLoadingScreen'
import { useAuth } from '../../context/useAuth'
import { useWorkspace } from '../../context/useWorkspace'
import { resolveDefaultAuthenticatedPath } from '../../data/postAuthRedirect'

/** Sends unknown paths to the marketing home or the role-aware default app route. */
export function CatchAllRedirect() {
  const auth = useAuth()
  const { workspace } = useWorkspace()

  if (auth.isLoading) {
    return <AuthLoadingScreen />
  }

  if (auth.canAccessApp && auth.user) {
    return <Navigate to={resolveDefaultAuthenticatedPath(workspace, auth.user.id)} replace />
  }

  return <Navigate to="/" replace />
}
