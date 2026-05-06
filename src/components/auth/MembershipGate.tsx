import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useWorkspace } from '../../context/useWorkspace'
import { useAuth } from '../../context/useAuth'
import { userHasAnyOrganizationMembership } from '../../data/postAuthRedirect'

/**
 * Requires at least one Company Brain membership before App Shell or owner onboarding sub-routes.
 * `/join-company` stays outside this gate so invitees can accept without entering the main shell first.
 */
export function MembershipGate() {
  const auth = useAuth()
  const { workspace } = useWorkspace()
  const location = useLocation()

  const userId = auth.user?.id ?? ''
  const path = location.pathname

  if (!userId) {
    return <Outlet />
  }

  const onboarding = path.startsWith('/onboarding')
  if (onboarding || userHasAnyOrganizationMembership(workspace, userId)) {
    return <Outlet />
  }

  return <Navigate to="/join-company" replace state={{ from: `${path}${location.search}` }} />
}
