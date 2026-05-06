import { Navigate, Outlet } from 'react-router-dom'
import { useWorkspace } from '../../context/useWorkspace'

/** Prevents repeating owner onboarding once an organization already exists locally. */
export function OwnerOnboardingGate() {
  const { workspace } = useWorkspace()

  if (workspace.companyBrain.organizations.length > 0) {
    return <Navigate to="/owner" replace />
  }

  return <Outlet />
}
