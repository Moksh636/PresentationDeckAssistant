import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthLoadingScreen } from './AuthLoadingScreen'
import { useAuth } from '../../context/useAuth'
import { useWorkspace } from '../../context/useWorkspace'
import { resolveDefaultAuthenticatedPath, resolvePostSignupPath } from '../../data/postAuthRedirect'

/** Allows marketing + auth entry routes for signed-out visitors; signed-in users are routed onward. */
export function GuestOnlyLayout() {
  const auth = useAuth()
  const { workspace } = useWorkspace()
  const location = useLocation()

  if (auth.isLoading) {
    return <AuthLoadingScreen />
  }

  if (!auth.canAccessApp || !auth.user) {
    return <Outlet />
  }

  const fromState = (location.state as { from?: string } | null)?.from
  const fallback =
    location.pathname === '/signup'
      ? resolvePostSignupPath(workspace, auth.user.id)
      : resolveDefaultAuthenticatedPath(workspace, auth.user.id)

  const target =
    typeof fromState === 'string' && fromState.length > 0 && !fromState.startsWith('/auth')
      ? fromState
      : fallback

  return <Navigate to={target} replace />
}
