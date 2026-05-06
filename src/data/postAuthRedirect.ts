import type { WorkspaceState } from '../types/models'
import { getMembershipForOrgUser } from './companyBrainMutations.ts'

/**
 * Default landing route after sign-in for owners/admins vs ICs.
 * Owners land on `/owner` (company console); everyone else uses the pitch workspace dashboard.
 */
export function resolveDefaultAuthenticatedPath(
  workspace: WorkspaceState,
  userId: string,
): '/owner' | '/dashboard' {
  const orgId = workspace.companyBrain?.activeOrganizationId
  if (!orgId) {
    return '/dashboard'
  }

  const membership = getMembershipForOrgUser(workspace, orgId, userId)
  if (membership?.accessRole === 'owner' || membership?.accessRole === 'admin') {
    return '/owner'
  }

  return '/dashboard'
}

/** Used when an authenticated visitor hits `/signup` — steer net-new companies into the wizard. */
export function resolvePostSignupPath(workspace: WorkspaceState, userId: string): string {
  if (!workspace.companyBrain?.organizations?.length) {
    return '/onboarding/company'
  }
  return resolveDefaultAuthenticatedPath(workspace, userId)
}

export function isOwnerOrAdmin(workspace: WorkspaceState, userId: string): boolean {
  const orgId = workspace.companyBrain?.activeOrganizationId
  if (!orgId) {
    return false
  }
  const membership = getMembershipForOrgUser(workspace, orgId, userId)
  return membership?.accessRole === 'owner' || membership?.accessRole === 'admin'
}
