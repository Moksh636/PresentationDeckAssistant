import type { WorkspaceState } from '../types/models'
import { getMembershipForOrgUser } from './companyBrainMutations.ts'
import { OWNER_USER_ID } from './sourceIngestion.ts'

export function userHasAnyOrganizationMembership(workspace: WorkspaceState, userId: string): boolean {
  return workspace.companyBrain.organizationMemberships.some((m) => m.userId === userId)
}

/**
 * Default landing route after sign-in for owners/admins vs ICs.
 * Users with no organization membership are routed to `/join-company` first (invite acceptance scaffold).
 */
export function resolveDefaultAuthenticatedPath(
  workspace: WorkspaceState,
  userId: string,
): '/owner' | '/dashboard' | '/join-company' {
  if (!userHasAnyOrganizationMembership(workspace, userId)) {
    return '/join-company'
  }

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

/** Used when an authenticated visitor hits `/signup` — same membership gate as default sign-in routing. */
export function resolvePostSignupPath(workspace: WorkspaceState, userId: string): string {
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

export function canAccessOwnerConsole(
  workspace: WorkspaceState,
  auth: { userId: string | null; isLocalDevBypass: boolean },
): boolean {
  if (auth.userId && isOwnerOrAdmin(workspace, auth.userId)) {
    return true
  }

  if (!auth.isLocalDevBypass) {
    return false
  }

  return isOwnerOrAdmin(workspace, OWNER_USER_ID)
}
