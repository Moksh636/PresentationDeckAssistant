import type {
  ApprovedMessagingItem,
  CaseStudyItem,
  CompanyActivityKind,
  CompanyActivityLog,
  CompanyBrandKit,
  CompanyBrainCatalogDepartment,
  CompanyBrainCatalogRole,
  CompanyBrainWorkspaceSlice,
  CompanyKnowledgeItem,
  CompanyKnowledgeSourceType,
  KnowledgeApprovalStatus,
  KnowledgeFolder,
  KnowledgeOrgPreferenceMode,
  Organization,
  OrganizationMembership,
  ProductServiceItem,
  WorkspaceState,
} from '../types/models'
import { createId } from '../utils/ids.ts'
import { seedCompanyCatalogForOrganization } from './companyCatalogSeed.ts'
import { createEmptyCompanyBrainWorkspaceSlice, slugifyOrganizationName } from './companyBrainNormalize.ts'

function nowIso() {
  return new Date().toISOString()
}

function uniqueOrgSlug(baseSlug: string, organizations: Organization[]): string {
  let candidate = baseSlug
  let suffix = 2
  const existing = new Set(organizations.map((org) => org.slug))
  while (existing.has(candidate)) {
    candidate = `${baseSlug}-${suffix}`
    suffix++
  }
  return candidate
}

export function getMembershipForOrgUser(
  workspace: WorkspaceState,
  organizationId: string,
  userId: string,
): OrganizationMembership | undefined {
  return workspace.companyBrain.organizationMemberships.find(
    (m) => m.organizationId === organizationId && m.userId === userId,
  )
}

export function canManageCompanyBrain(
  workspace: WorkspaceState,
  organizationId: string,
  userId: string,
): boolean {
  const m = getMembershipForOrgUser(workspace, organizationId, userId)
  return m?.accessRole === 'owner' || m?.accessRole === 'admin'
}

function appendLog(slice: CompanyBrainWorkspaceSlice, log: Omit<CompanyActivityLog, 'id' | 'createdAt'>): CompanyBrainWorkspaceSlice {
  const entry: CompanyActivityLog = {
    ...log,
    id: createId('company-activity'),
    createdAt: nowIso(),
  }

  return {
    ...slice,
    activityLogs: [entry, ...slice.activityLogs].slice(0, 200),
  }
}

export function dismissCompanyOnboarding(workspace: WorkspaceState): WorkspaceState {
  return {
    ...workspace,
    companyBrain: {
      ...workspace.companyBrain,
      onboarding: {
        ...workspace.companyBrain.onboarding,
        dismissed: true,
      },
    },
  }
}

export function setActiveOrganization(workspace: WorkspaceState, organizationId: string): WorkspaceState {
  return {
    ...workspace,
    companyBrain: {
      ...workspace.companyBrain,
      activeOrganizationId: organizationId,
    },
  }
}

export type CompanyOnboardingVariant = 'owner-create' | 'worker-profile'

export interface CompleteCompanyOnboardingInput {
  companyName: string
  /** Defaults to worker-profile for backward compatibility with earlier callers. */
  variant?: CompanyOnboardingVariant
  /** Required when `variant` is `worker-profile` (default). */
  roleTitle?: string
  /** Required when `variant` is `worker-profile` (default). */
  department?: string
  /** Owner-first company creation (company website). */
  website?: string
  /** Optional label stored on the owner membership row for display. */
  ownerDisplayName?: string
  knowledgeOrgPreference?: KnowledgeOrgPreferenceMode
}

export interface UserProfileRef {
  userId: string
  email: string
  displayName: string
}

export function completeCompanyOnboarding(
  workspace: WorkspaceState,
  input: CompleteCompanyOnboardingInput,
  profile: UserProfileRef,
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain ?? createEmptyCompanyBrainWorkspaceSlice()

  const trimmedName = input.companyName.trim()
  if (!trimmedName) {
    return workspace
  }

  const variant: CompanyOnboardingVariant = input.variant ?? 'worker-profile'
  const ownerRoleTitle =
    input.ownerDisplayName?.trim() ||
    profile.displayName.trim() ||
    'Owner'
  const resolvedRoleTitle =
    variant === 'owner-create' ? ownerRoleTitle : (input.roleTitle ?? '').trim()
  const resolvedDepartment = variant === 'owner-create' ? '' : (input.department ?? '').trim()

  if (variant === 'worker-profile' && (!resolvedRoleTitle || !resolvedDepartment)) {
    return workspace
  }

  const orgId = createId('organization')
  const slugBase = slugifyOrganizationName(trimmedName)
  const slug = uniqueOrgSlug(slugBase, slice.organizations)
  const org: Organization = {
    id: orgId,
    name: trimmedName,
    slug,
    website: input.website?.trim() || undefined,
    createdByUserId: profile.userId,
    createdAt: iso,
    updatedAt: iso,
  }

  const seeded = seedCompanyCatalogForOrganization({ organizationId: orgId, iso })

  const membership: OrganizationMembership = {
    id: createId('membership'),
    organizationId: orgId,
    userId: profile.userId,
    email: profile.email,
    displayName: profile.displayName,
    roleTitle: resolvedRoleTitle,
    department: resolvedDepartment,
    accessRole: 'owner',
    createdAt: iso,
    updatedAt: iso,
  }

  let nextSlice: CompanyBrainWorkspaceSlice = {
    ...slice,
    organizations: [org, ...slice.organizations],
    organizationMemberships: [membership, ...slice.organizationMemberships],
    companyRoles: [...seeded.companyRoles, ...slice.companyRoles],
    companyDepartments: [...seeded.companyDepartments, ...slice.companyDepartments],
    activeOrganizationId: orgId,
    onboarding: {
      dismissed: slice.onboarding.dismissed,
      companyName: trimmedName,
      roleTitle: resolvedRoleTitle,
      department: resolvedDepartment,
      setupCompletedAt: iso,
      knowledgeOrgPreference: input.knowledgeOrgPreference ?? slice.onboarding.knowledgeOrgPreference,
    },
  }

  nextSlice = appendLog(nextSlice, {
    organizationId: orgId,
    actorUserId: profile.userId,
    kind: 'member-added',
    detail: `Company workspace initialized: ${trimmedName}`,
  })

  return {
    ...workspace,
    companyBrain: nextSlice,
  }
}

export function upsertCompanyCatalogDepartment(
  workspace: WorkspaceState,
  organizationId: string,
  input: Pick<CompanyBrainCatalogDepartment, 'name'> &
    Partial<Pick<CompanyBrainCatalogDepartment, 'description' | 'archived'>> & {
      id?: string
    },
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain
  const id =
    input.id ??
    slice.companyDepartments.find(
      (d) => d.organizationId === organizationId && d.name.trim() === input.name.trim() && !d.archived,
    )?.id ??
    createId('cdept')
  const existing = slice.companyDepartments.find((d) => d.id === id && d.organizationId === organizationId)
  const nextRow: CompanyBrainCatalogDepartment = existing
    ? {
        ...existing,
        name: input.name.trim() || existing.name,
        description:
          typeof input.description === 'string' ? input.description : existing.description,
        archived:
          input.archived === true ? true : existing.archived === true ? true : undefined,
        updatedAt: iso,
      }
    : {
        id,
        organizationId,
        name: input.name.trim() || 'Department',
        description: typeof input.description === 'string' ? input.description : undefined,
        archived: input.archived === true ? true : undefined,
        createdAt: iso,
        updatedAt: iso,
      }

  return {
    ...workspace,
    companyBrain: {
      ...slice,
      companyDepartments: [nextRow, ...slice.companyDepartments.filter((d) => d.id !== id)],
    },
  }
}

export function archiveCompanyCatalogDepartment(
  workspace: WorkspaceState,
  organizationId: string,
  departmentId: string,
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain

  return {
    ...workspace,
    companyBrain: {
      ...slice,
      companyDepartments: slice.companyDepartments.map((d) =>
        d.id === departmentId && d.organizationId === organizationId
          ? { ...d, archived: true, updatedAt: iso }
          : d,
      ),
    },
  }
}

export function upsertCompanyCatalogRole(
  workspace: WorkspaceState,
  organizationId: string,
  input: Pick<CompanyBrainCatalogRole, 'name'> &
    Partial<Pick<CompanyBrainCatalogRole, 'description' | 'defaultDepartmentId' | 'archived'>> & {
      id?: string
    },
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain
  const id =
    input.id ??
    slice.companyRoles.find(
      (r) =>
        r.organizationId === organizationId && r.name.trim() === input.name.trim() && !r.archived,
    )?.id ??
    createId('crole')
  const existing = slice.companyRoles.find((r) => r.id === id && r.organizationId === organizationId)

  let defaultDepartmentId = input.defaultDepartmentId
  if (defaultDepartmentId) {
    const deptOk = slice.companyDepartments.some(
      (d) => d.id === defaultDepartmentId && d.organizationId === organizationId && !d.archived,
    )
    if (!deptOk) {
      defaultDepartmentId = undefined
    }
  }

  const nextRow: CompanyBrainCatalogRole = existing
    ? {
        ...existing,
        name: input.name.trim() || existing.name,
        description:
          typeof input.description === 'string' ? input.description : existing.description,
        defaultDepartmentId:
          defaultDepartmentId !== undefined ? defaultDepartmentId : existing.defaultDepartmentId,
        archived:
          input.archived === true ? true : existing.archived === true ? true : undefined,
        updatedAt: iso,
      }
    : {
        id,
        organizationId,
        name: input.name.trim() || 'Role',
        description: typeof input.description === 'string' ? input.description : undefined,
        defaultDepartmentId,
        archived: input.archived === true ? true : undefined,
        createdAt: iso,
        updatedAt: iso,
      }

  return {
    ...workspace,
    companyBrain: {
      ...slice,
      companyRoles: [nextRow, ...slice.companyRoles.filter((r) => r.id !== id)],
    },
  }
}

export function archiveCompanyCatalogRole(
  workspace: WorkspaceState,
  organizationId: string,
  roleId: string,
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain

  return {
    ...workspace,
    companyBrain: {
      ...slice,
      companyRoles: slice.companyRoles.map((r) =>
        r.id === roleId && r.organizationId === organizationId ? { ...r, archived: true, updatedAt: iso } : r,
      ),
    },
  }
}

export function upsertKnowledgeFolder(
  workspace: WorkspaceState,
  organizationId: string,
  folder: Pick<KnowledgeFolder, 'name'> &
    Partial<Pick<KnowledgeFolder, 'parentFolderId' | 'description' | 'suggestedByAi' | 'ownerApproved'>> & {
      id?: string
    },
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain
  const id = folder.id ?? createId('kfolder')
  const existing = slice.knowledgeFolders.find((f) => f.id === id)
  const nextRow: KnowledgeFolder = existing
    ? {
        ...existing,
        name: folder.name.trim() || existing.name,
        parentFolderId:
          folder.parentFolderId !== undefined ? folder.parentFolderId : existing.parentFolderId,
        description: folder.description !== undefined ? folder.description : existing.description,
        suggestedByAi:
          folder.suggestedByAi !== undefined ? folder.suggestedByAi : existing.suggestedByAi,
        ownerApproved:
          folder.ownerApproved !== undefined ? folder.ownerApproved : existing.ownerApproved,
        updatedAt: iso,
      }
    : {
        id,
        organizationId,
        name: folder.name.trim() || 'Folder',
        parentFolderId: folder.parentFolderId,
        description: folder.description,
        suggestedByAi: folder.suggestedByAi,
        ownerApproved: folder.ownerApproved,
        createdAt: iso,
        updatedAt: iso,
      }

  return {
    ...workspace,
    companyBrain: {
      ...slice,
      knowledgeFolders: [
        nextRow,
        ...slice.knowledgeFolders.filter((f) => f.id !== id),
      ],
    },
  }
}

export interface UpsertKnowledgeItemInput {
  id?: string
  title: string
  description?: string
  sourceType?: CompanyKnowledgeSourceType
  tags?: string[]
  folderId?: string
  suggestedFolderId?: string
  ownerApprovedFolder?: boolean
  visibility?: CompanyKnowledgeItem['visibility']
  approvalStatus?: KnowledgeApprovalStatus
  allowedDepartments?: string[]
  allowedRoleTitles?: string[]
  fileAssetId?: string
}

export function upsertCompanyKnowledgeItem(
  workspace: WorkspaceState,
  organizationId: string,
  profile: UserProfileRef,
  input: UpsertKnowledgeItemInput,
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain
  const id = input.id ?? createId('know')
  const existing = slice.knowledgeItems.find((k) => k.id === id)
  const isNew = !existing

  const nextRow: CompanyKnowledgeItem = existing
    ? {
        ...existing,
        organizationId,
        folderId: input.folderId ?? existing.folderId,
        suggestedFolderId:
          input.suggestedFolderId !== undefined ? input.suggestedFolderId : existing.suggestedFolderId,
        ownerApprovedFolder:
          input.ownerApprovedFolder !== undefined
            ? input.ownerApprovedFolder
            : existing.ownerApprovedFolder,
        title: input.title.trim() || existing.title,
        description: typeof input.description === 'string' ? input.description : existing.description,
        sourceType: input.sourceType ?? existing.sourceType,
        tags: Array.isArray(input.tags) ? input.tags : existing.tags,
        approvalStatus: input.approvalStatus ?? existing.approvalStatus,
        visibility: input.visibility ?? existing.visibility,
        allowedDepartments: input.allowedDepartments ?? existing.allowedDepartments,
        allowedRoleTitles: input.allowedRoleTitles ?? existing.allowedRoleTitles,
        fileAssetId: input.fileAssetId ?? existing.fileAssetId,
        updatedAt: iso,
      }
    : {
        id,
        organizationId,
        folderId: input.folderId,
        suggestedFolderId: input.suggestedFolderId,
        ownerApprovedFolder: input.ownerApprovedFolder,
        uploadedByUserId: profile.userId,
        title: input.title.trim() || 'Untitled',
        description: input.description?.trim() ?? '',
        fileAssetId: input.fileAssetId,
        sourceType: input.sourceType ?? 'other',
        tags: input.tags ?? [],
        approvalStatus: input.approvalStatus ?? 'needs-review',
        visibility: input.visibility ?? 'company',
        allowedDepartments: input.allowedDepartments,
        allowedRoleTitles: input.allowedRoleTitles,
        createdAt: iso,
        updatedAt: iso,
      }

  let nextSlice: CompanyBrainWorkspaceSlice = {
    ...slice,
    knowledgeItems: [nextRow, ...slice.knowledgeItems.filter((k) => k.id !== id)],
  }

  if (isNew) {
    nextSlice = appendLog(nextSlice, {
      organizationId,
      actorUserId: profile.userId,
      kind: 'knowledge-item-created',
      detail: `Registered knowledge item: ${nextRow.title}`,
    })
  }

  return {
    ...workspace,
    companyBrain: nextSlice,
  }
}

export function deleteCompanyKnowledgeItem(
  workspace: WorkspaceState,
  organizationId: string,
  itemId: string,
): WorkspaceState {
  const slice = workspace.companyBrain
  return {
    ...workspace,
    companyBrain: {
      ...slice,
      knowledgeItems: slice.knowledgeItems.filter(
        (k) => !(k.id === itemId && k.organizationId === organizationId),
      ),
    },
  }
}

export function setKnowledgeApproval(
  workspace: WorkspaceState,
  organizationId: string,
  actor: UserProfileRef,
  itemId: string,
  approvalStatus: KnowledgeApprovalStatus,
  detail?: string,
): WorkspaceState {
  const slice = workspace.companyBrain
  const iso = nowIso()

  let kind: CompanyActivityKind = 'knowledge-item-approved'
  if (approvalStatus === 'rejected') {
    kind = 'knowledge-item-rejected'
  } else if (approvalStatus === 'archived') {
    kind = 'knowledge-item-rejected'
  }

  const nextItems = slice.knowledgeItems.map((k) =>
    k.id === itemId && k.organizationId === organizationId
      ? {
          ...k,
          approvalStatus,
          lastReviewedAt: iso,
          updatedAt: iso,
        }
      : k,
  )

  let nextSlice: CompanyBrainWorkspaceSlice = {
    ...slice,
    knowledgeItems: nextItems,
  }

  nextSlice = appendLog(nextSlice, {
    organizationId,
    actorUserId: actor.userId,
    kind,
    detail: detail ?? `Knowledge item ${approvalStatus}: ${itemId}`,
  })

  return {
    ...workspace,
    companyBrain: nextSlice,
  }
}

export function markKnowledgeReviewed(
  workspace: WorkspaceState,
  organizationId: string,
  itemId: string,
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain
  return {
    ...workspace,
    companyBrain: {
      ...slice,
      knowledgeItems: slice.knowledgeItems.map((k) =>
        k.id === itemId && k.organizationId === organizationId
          ? { ...k, lastReviewedAt: iso, updatedAt: iso }
          : k,
      ),
    },
  }
}

export function upsertBrandKit(
  workspace: WorkspaceState,
  organizationId: string,
  actor: UserProfileRef,
  input: Partial<
    Pick<
      CompanyBrandKit,
      | 'primaryColor'
      | 'secondaryColor'
      | 'accentColor'
      | 'fontFamily'
      | 'defaultDeckTone'
      | 'logoAssetId'
    >
  > & { id?: string },
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain
  const id = input.id ?? slice.brandKits.find((b) => b.organizationId === organizationId)?.id ?? createId('brand')
  const existing = slice.brandKits.find((b) => b.id === id)

  const nextRow: CompanyBrandKit = existing
    ? {
        ...existing,
        primaryColor: input.primaryColor ?? existing.primaryColor,
        secondaryColor: input.secondaryColor ?? existing.secondaryColor,
        accentColor: input.accentColor ?? existing.accentColor,
        fontFamily: input.fontFamily ?? existing.fontFamily,
        defaultDeckTone: input.defaultDeckTone ?? existing.defaultDeckTone,
        logoAssetId: input.logoAssetId ?? existing.logoAssetId,
        updatedAt: iso,
      }
    : {
        id,
        organizationId,
        logoAssetId: input.logoAssetId,
        primaryColor: input.primaryColor ?? '#111827',
        secondaryColor: input.secondaryColor ?? '#6b7280',
        accentColor: input.accentColor ?? '#2563eb',
        fontFamily: input.fontFamily ?? 'system-ui',
        defaultDeckTone: input.defaultDeckTone ?? '',
        createdAt: iso,
        updatedAt: iso,
      }

  let nextSlice: CompanyBrainWorkspaceSlice = {
    ...slice,
    brandKits: [nextRow, ...slice.brandKits.filter((b) => b.id !== id)],
  }

  nextSlice = appendLog(nextSlice, {
    organizationId,
    actorUserId: actor.userId,
    kind: 'brand-kit-updated',
    detail: `Brand kit saved for organization ${organizationId}`,
  })

  return {
    ...workspace,
    companyBrain: nextSlice,
  }
}

export function upsertApprovedMessaging(
  workspace: WorkspaceState,
  organizationId: string,
  actor: UserProfileRef,
  input: Pick<ApprovedMessagingItem, 'title' | 'content' | 'category' | 'tags' | 'approvalStatus'> & {
    id?: string
  },
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain
  const id = input.id ?? createId('msg')
  const existing = slice.approvedMessaging.find((m) => m.id === id)
  const isNew = !existing

  const nextRow: ApprovedMessagingItem = existing
    ? {
        ...existing,
        title: input.title,
        content: input.content,
        category: input.category,
        tags: input.tags,
        approvalStatus: input.approvalStatus,
        updatedAt: iso,
      }
    : {
        id,
        organizationId,
        title: input.title,
        content: input.content,
        category: input.category,
        tags: input.tags,
        approvalStatus: input.approvalStatus,
        createdAt: iso,
        updatedAt: iso,
      }

  let nextSlice: CompanyBrainWorkspaceSlice = {
    ...slice,
    approvedMessaging: [nextRow, ...slice.approvedMessaging.filter((m) => m.id !== id)],
  }

  if (isNew) {
    nextSlice = appendLog(nextSlice, {
      organizationId,
      actorUserId: actor.userId,
      kind: 'approved-messaging-added',
      detail: `Approved messaging item: ${nextRow.title}`,
    })
  }

  return {
    ...workspace,
    companyBrain: nextSlice,
  }
}

export function deleteApprovedMessaging(
  workspace: WorkspaceState,
  organizationId: string,
  messageId: string,
): WorkspaceState {
  const slice = workspace.companyBrain
  return {
    ...workspace,
    companyBrain: {
      ...slice,
      approvedMessaging: slice.approvedMessaging.filter(
        (m) => !(m.id === messageId && m.organizationId === organizationId),
      ),
    },
  }
}

export function upsertCaseStudy(
  workspace: WorkspaceState,
  organizationId: string,
  actor: UserProfileRef,
  input: Omit<CaseStudyItem, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> & { id?: string },
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain
  const id = input.id ?? createId('cs')
  const existing = slice.caseStudies.find((c) => c.id === id)
  const isNew = !existing

  const nextRow: CaseStudyItem = existing
    ? {
        ...existing,
        ...input,
        organizationId,
        updatedAt: iso,
      }
    : {
        id,
        organizationId,
        title: input.title,
        customerName: input.customerName,
        industry: input.industry,
        challenge: input.challenge,
        solution: input.solution,
        outcome: input.outcome,
        approvedQuote: input.approvedQuote,
        sourceKnowledgeItemIds: input.sourceKnowledgeItemIds,
        createdAt: iso,
        updatedAt: iso,
      }

  let nextSlice: CompanyBrainWorkspaceSlice = {
    ...slice,
    caseStudies: [nextRow, ...slice.caseStudies.filter((c) => c.id !== id)],
  }

  if (isNew) {
    nextSlice = appendLog(nextSlice, {
      organizationId,
      actorUserId: actor.userId,
      kind: 'case-study-added',
      detail: `Case study: ${nextRow.title}`,
    })
  }

  return {
    ...workspace,
    companyBrain: nextSlice,
  }
}

export function deleteCaseStudy(
  workspace: WorkspaceState,
  organizationId: string,
  caseStudyId: string,
): WorkspaceState {
  const slice = workspace.companyBrain
  return {
    ...workspace,
    companyBrain: {
      ...slice,
      caseStudies: slice.caseStudies.filter(
        (c) => !(c.id === caseStudyId && c.organizationId === organizationId),
      ),
    },
  }
}

export function upsertProductService(
  workspace: WorkspaceState,
  organizationId: string,
  actor: UserProfileRef,
  input: Omit<ProductServiceItem, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> & { id?: string },
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain
  const id = input.id ?? createId('ps')
  const existing = slice.productsServices.find((p) => p.id === id)
  const isNew = !existing

  const nextRow: ProductServiceItem = existing
    ? {
        ...existing,
        ...input,
        organizationId,
        updatedAt: iso,
      }
    : {
        id,
        organizationId,
        name: input.name,
        description: input.description,
        targetBuyer: input.targetBuyer,
        keyBenefits: input.keyBenefits,
        proofPoints: input.proofPoints,
        commonObjections: input.commonObjections,
        createdAt: iso,
        updatedAt: iso,
      }

  let nextSlice: CompanyBrainWorkspaceSlice = {
    ...slice,
    productsServices: [nextRow, ...slice.productsServices.filter((p) => p.id !== id)],
  }

  if (isNew) {
    nextSlice = appendLog(nextSlice, {
      organizationId,
      actorUserId: actor.userId,
      kind: 'product-service-added',
      detail: `Product/service: ${nextRow.name}`,
    })
  }

  return {
    ...workspace,
    companyBrain: nextSlice,
  }
}

export function deleteProductService(
  workspace: WorkspaceState,
  organizationId: string,
  productId: string,
): WorkspaceState {
  const slice = workspace.companyBrain
  return {
    ...workspace,
    companyBrain: {
      ...slice,
      productsServices: slice.productsServices.filter(
        (p) => !(p.id === productId && p.organizationId === organizationId),
      ),
    },
  }
}

export function addOrganizationMember(
  workspace: WorkspaceState,
  organizationId: string,
  actor: UserProfileRef,
  member: Omit<OrganizationMembership, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'> & {
    id?: string
  },
): WorkspaceState {
  const iso = nowIso()
  const slice = workspace.companyBrain
  const id = member.id ?? createId('membership')
  const row: OrganizationMembership = {
    id,
    organizationId,
    userId: member.userId,
    email: member.email,
    displayName: member.displayName,
    roleTitle: member.roleTitle,
    department: member.department,
    accessRole: member.accessRole,
    createdAt: iso,
    updatedAt: iso,
    invitedRoleTitle: member.invitedRoleTitle?.trim() || undefined,
    invitedDepartment: member.invitedDepartment?.trim() || undefined,
    roleLocked: member.roleLocked === true ? true : undefined,
    departmentLocked: member.departmentLocked === true ? true : undefined,
  }

  let nextSlice: CompanyBrainWorkspaceSlice = {
    ...slice,
    organizationMemberships: [row, ...slice.organizationMemberships.filter((m) => m.id !== id)],
  }

  nextSlice = appendLog(nextSlice, {
    organizationId,
    actorUserId: actor.userId,
    kind: 'member-added',
    detail: `Member added: ${member.displayName} (${member.accessRole})`,
  })

  return {
    ...workspace,
    companyBrain: nextSlice,
  }
}
