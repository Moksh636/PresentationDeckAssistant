import type { MembershipAccessRole, OrganizationMembership } from '../types/models'

export interface WorkerPrepFormValues {
  email: string
  displayName: string
  /** Effective job title stored on membership */
  roleTitle: string
  /** Effective department stored on membership */
  department: string
  /** Optional scaffold mirrored for invite flows */
  invitedRoleTitle?: string
  invitedDepartment?: string
  accessRole: MembershipAccessRole
  roleLocked?: boolean
  departmentLocked?: boolean
}

/**
 * Builds the membership row used by {@link addOrganizationMember} for mock / draft workers.
 */
export function buildDraftOrganizationMemberRow(
  input: WorkerPrepFormValues,
  options?: { userId?: string },
): Omit<OrganizationMembership, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> {
  const email = input.email.trim()
  const displayName =
    input.displayName.trim() ||
    (email.includes('@') ? email.slice(0, email.indexOf('@')) : email) ||
    'Teammate'

  const userId =
    options?.userId ??
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `placeholder-${crypto.randomUUID()}`
      : `placeholder-${Math.random().toString(36).slice(2, 12)}`)

  return {
    userId,
    email,
    displayName,
    roleTitle: input.roleTitle.trim() || 'Member',
    department: input.department.trim() || 'General',
    accessRole: input.accessRole,
    invitedRoleTitle: input.invitedRoleTitle?.trim() || undefined,
    invitedDepartment: input.invitedDepartment?.trim() || undefined,
    roleLocked: input.roleLocked === true ? true : undefined,
    departmentLocked: input.departmentLocked === true ? true : undefined,
  }
}
