import type {
  ApprovedMessagingItem,
  CaseStudyItem,
  CompanyActivityKind,
  CompanyActivityLog,
  CompanyBrandKit,
  CompanyBrainWorkspaceSlice,
  CompanyKnowledgeItem,
  CompanyKnowledgeSourceType,
  KnowledgeApprovalStatus,
  KnowledgeFolder,
  KnowledgeVisibilityScope,
  MembershipAccessRole,
  Organization,
  OrganizationMembership,
  ProductServiceItem,
} from '../types/models'

const ACCESS_ROLES: MembershipAccessRole[] = ['owner', 'admin', 'member', 'viewer']
const APPROVAL_STATUSES: KnowledgeApprovalStatus[] = ['approved', 'needs-review', 'rejected', 'archived']
const VIS_SCOPES: KnowledgeVisibilityScope[] = ['company', 'department', 'role', 'private']
const SOURCE_TYPES: CompanyKnowledgeSourceType[] = [
  'contract',
  'deck',
  'proposal',
  'notes',
  'case-study',
  'product-doc',
  'policy',
  'transcript',
  'other',
]

const ACTIVITY_KINDS = new Set<CompanyActivityKind>([
  'knowledge-item-created',
  'knowledge-item-approved',
  'knowledge-item-rejected',
  'brand-kit-updated',
  'approved-messaging-added',
  'case-study-added',
  'product-service-added',
  'member-added',
])

function nowIso() {
  return new Date().toISOString()
}

function pickString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function slugifyOrganizationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `org-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeAccessRole(value: unknown): MembershipAccessRole {
  return ACCESS_ROLES.includes(value as MembershipAccessRole) ? (value as MembershipAccessRole) : 'member'
}

function normalizeApprovalStatus(value: unknown): KnowledgeApprovalStatus {
  return APPROVAL_STATUSES.includes(value as KnowledgeApprovalStatus)
    ? (value as KnowledgeApprovalStatus)
    : 'needs-review'
}

function normalizeVisibility(value: unknown): KnowledgeVisibilityScope {
  return VIS_SCOPES.includes(value as KnowledgeVisibilityScope) ? (value as KnowledgeVisibilityScope) : 'company'
}

function normalizeSourceType(value: unknown): CompanyKnowledgeSourceType {
  return SOURCE_TYPES.includes(value as CompanyKnowledgeSourceType) ? (value as CompanyKnowledgeSourceType) : 'other'
}

export function createEmptyCompanyBrainWorkspaceSlice(): CompanyBrainWorkspaceSlice {
  return {
    activeOrganizationId: '',
    organizations: [],
    organizationMemberships: [],
    knowledgeFolders: [],
    knowledgeItems: [],
    brandKits: [],
    approvedMessaging: [],
    caseStudies: [],
    productsServices: [],
    activityLogs: [],
    onboarding: {
      dismissed: false,
    },
  }
}

export function normalizeCompanyBrainWorkspaceSlice(
  raw: unknown,
  options: { now?: string } = {},
): CompanyBrainWorkspaceSlice {
  const iso = options.now ?? nowIso()
  const base = createEmptyCompanyBrainWorkspaceSlice()

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return base
  }

  const record = raw as Record<string, unknown>
  const activeOrganizationId =
    typeof record.activeOrganizationId === 'string' ? record.activeOrganizationId : ''

  const organizations: Organization[] = Array.isArray(record.organizations)
    ? record.organizations.map((row, index): Organization => {
        const r = row as Record<string, unknown>
        return {
          id: typeof r.id === 'string' ? r.id : `organization-legacy-${index + 1}`,
          name: typeof r.name === 'string' ? r.name : 'Workspace',
          slug: typeof r.slug === 'string' ? r.slug : slugifyOrganizationName(typeof r.name === 'string' ? r.name : 'workspace'),
          createdByUserId: typeof r.createdByUserId === 'string' ? r.createdByUserId : 'user-owner-1',
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : iso,
          updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : iso,
        }
      })
    : []

  const organizationMemberships: OrganizationMembership[] = Array.isArray(record.organizationMemberships)
    ? record.organizationMemberships.map((row, index): OrganizationMembership => {
        const r = row as Record<string, unknown>
        return {
          id: typeof r.id === 'string' ? r.id : `membership-legacy-${index + 1}`,
          organizationId:
            typeof r.organizationId === 'string' ? r.organizationId : organizations[0]?.id ?? '',
          userId: typeof r.userId === 'string' ? r.userId : 'user-owner-1',
          email: typeof r.email === 'string' ? r.email : '',
          displayName: typeof r.displayName === 'string' ? r.displayName : 'Member',
          roleTitle: typeof r.roleTitle === 'string' ? r.roleTitle : '',
          department: typeof r.department === 'string' ? r.department : '',
          accessRole: normalizeAccessRole(r.accessRole),
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : iso,
          updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : iso,
        }
      })
    : []

  const knowledgeFolders: KnowledgeFolder[] = Array.isArray(record.knowledgeFolders)
    ? record.knowledgeFolders.map((row, index): KnowledgeFolder => {
        const r = row as Record<string, unknown>
        return {
          id: typeof r.id === 'string' ? r.id : `kfolder-legacy-${index + 1}`,
          organizationId: typeof r.organizationId === 'string' ? r.organizationId : organizations[0]?.id ?? '',
          name: typeof r.name === 'string' ? r.name : 'General',
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : iso,
          updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : iso,
        }
      })
    : []

  const knowledgeItems: CompanyKnowledgeItem[] = Array.isArray(record.knowledgeItems)
    ? record.knowledgeItems.map((row, index): CompanyKnowledgeItem => {
        const r = row as Record<string, unknown>
        const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : []
        const allowedDepartments = Array.isArray(r.allowedDepartments)
          ? r.allowedDepartments.filter((d): d is string => typeof d === 'string')
          : undefined
        const allowedRoleTitles = Array.isArray(r.allowedRoleTitles)
          ? r.allowedRoleTitles.filter((d): d is string => typeof d === 'string')
          : undefined
        return {
          id: typeof r.id === 'string' ? r.id : `know-legacy-${index + 1}`,
          organizationId: typeof r.organizationId === 'string' ? r.organizationId : organizations[0]?.id ?? '',
          folderId: typeof r.folderId === 'string' ? r.folderId : undefined,
          uploadedByUserId: typeof r.uploadedByUserId === 'string' ? r.uploadedByUserId : 'user-owner-1',
          title: typeof r.title === 'string' ? r.title : 'Untitled item',
          description: typeof r.description === 'string' ? r.description : '',
          fileAssetId: typeof r.fileAssetId === 'string' ? r.fileAssetId : undefined,
          sourceType: normalizeSourceType(r.sourceType),
          tags,
          approvalStatus: normalizeApprovalStatus(r.approvalStatus),
          visibility: normalizeVisibility(r.visibility),
          allowedDepartments,
          allowedRoleTitles,
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : iso,
          updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : iso,
          lastReviewedAt: typeof r.lastReviewedAt === 'string' ? r.lastReviewedAt : undefined,
        }
      })
    : []

  const brandKits: CompanyBrandKit[] = Array.isArray(record.brandKits)
    ? record.brandKits.map((row, index): CompanyBrandKit => {
        const r = row as Record<string, unknown>
        return {
          id: typeof r.id === 'string' ? r.id : `brand-legacy-${index + 1}`,
          organizationId: typeof r.organizationId === 'string' ? r.organizationId : organizations[0]?.id ?? '',
          logoAssetId: typeof r.logoAssetId === 'string' ? r.logoAssetId : undefined,
          primaryColor: typeof r.primaryColor === 'string' ? r.primaryColor : '#111827',
          secondaryColor: typeof r.secondaryColor === 'string' ? r.secondaryColor : '#6b7280',
          accentColor: typeof r.accentColor === 'string' ? r.accentColor : '#2563eb',
          fontFamily: typeof r.fontFamily === 'string' ? r.fontFamily : 'system-ui',
          defaultDeckTone: typeof r.defaultDeckTone === 'string' ? r.defaultDeckTone : '',
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : iso,
          updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : iso,
        }
      })
    : []

  const approvedMessaging: ApprovedMessagingItem[] = Array.isArray(record.approvedMessaging)
    ? record.approvedMessaging.map((row, index): ApprovedMessagingItem => {
        const r = row as Record<string, unknown>
        return {
          id: typeof r.id === 'string' ? r.id : `msg-legacy-${index + 1}`,
          organizationId: typeof r.organizationId === 'string' ? r.organizationId : organizations[0]?.id ?? '',
          title: typeof r.title === 'string' ? r.title : 'Message',
          content: typeof r.content === 'string' ? r.content : '',
          category: typeof r.category === 'string' ? r.category : 'General',
          tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
          approvalStatus: normalizeApprovalStatus(r.approvalStatus),
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : iso,
          updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : iso,
        }
      })
    : []

  const caseStudies: CaseStudyItem[] = Array.isArray(record.caseStudies)
    ? record.caseStudies.map((row, index): CaseStudyItem => {
        const r = row as Record<string, unknown>
        return {
          id: typeof r.id === 'string' ? r.id : `cs-legacy-${index + 1}`,
          organizationId: typeof r.organizationId === 'string' ? r.organizationId : organizations[0]?.id ?? '',
          title: typeof r.title === 'string' ? r.title : 'Case study',
          customerName: typeof r.customerName === 'string' ? r.customerName : '',
          industry: typeof r.industry === 'string' ? r.industry : '',
          challenge: typeof r.challenge === 'string' ? r.challenge : '',
          solution: typeof r.solution === 'string' ? r.solution : '',
          outcome: typeof r.outcome === 'string' ? r.outcome : '',
          approvedQuote: typeof r.approvedQuote === 'string' ? r.approvedQuote : undefined,
          sourceKnowledgeItemIds: Array.isArray(r.sourceKnowledgeItemIds)
            ? r.sourceKnowledgeItemIds.filter((id): id is string => typeof id === 'string')
            : [],
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : iso,
          updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : iso,
        }
      })
    : []

  const productsServices: ProductServiceItem[] = Array.isArray(record.productsServices)
    ? record.productsServices.map((row, index): ProductServiceItem => {
        const r = row as Record<string, unknown>
        return {
          id: typeof r.id === 'string' ? r.id : `ps-legacy-${index + 1}`,
          organizationId: typeof r.organizationId === 'string' ? r.organizationId : organizations[0]?.id ?? '',
          name: typeof r.name === 'string' ? r.name : 'Offering',
          description: typeof r.description === 'string' ? r.description : '',
          targetBuyer: typeof r.targetBuyer === 'string' ? r.targetBuyer : '',
          keyBenefits: Array.isArray(r.keyBenefits)
            ? r.keyBenefits.filter((s): s is string => typeof s === 'string')
            : [],
          proofPoints: Array.isArray(r.proofPoints)
            ? r.proofPoints.filter((s): s is string => typeof s === 'string')
            : [],
          commonObjections: Array.isArray(r.commonObjections)
            ? r.commonObjections.filter((s): s is string => typeof s === 'string')
            : [],
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : iso,
          updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : iso,
        }
      })
    : []

  const activityLogs: CompanyActivityLog[] = Array.isArray(record.activityLogs)
    ? record.activityLogs.map((row, index): CompanyActivityLog => {
        const r = row as Record<string, unknown>
        const rawKind = pickString(r.kind, 'knowledge-item-created')
        const kind: CompanyActivityLog['kind'] = ACTIVITY_KINDS.has(rawKind as CompanyActivityKind)
          ? (rawKind as CompanyActivityKind)
          : 'knowledge-item-created'
        return {
          id: typeof r.id === 'string' ? r.id : `act-legacy-${index + 1}`,
          organizationId: typeof r.organizationId === 'string' ? r.organizationId : organizations[0]?.id ?? '',
          actorUserId: typeof r.actorUserId === 'string' ? r.actorUserId : 'user-owner-1',
          kind,
          detail: typeof r.detail === 'string' ? r.detail : '',
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : iso,
        }
      })
    : []

  const onboardingRaw =
    typeof record.onboarding === 'object' && record.onboarding && !Array.isArray(record.onboarding)
      ? (record.onboarding as Record<string, unknown>)
      : {}
  const onboarding = {
    dismissed: onboardingRaw.dismissed === true,
    companyName: typeof onboardingRaw.companyName === 'string' ? onboardingRaw.companyName : undefined,
    roleTitle: typeof onboardingRaw.roleTitle === 'string' ? onboardingRaw.roleTitle : undefined,
    department: typeof onboardingRaw.department === 'string' ? onboardingRaw.department : undefined,
    setupCompletedAt:
      typeof onboardingRaw.setupCompletedAt === 'string' ? onboardingRaw.setupCompletedAt : undefined,
  }

  return {
    ...base,
    activeOrganizationId,
    organizations,
    organizationMemberships,
    knowledgeFolders,
    knowledgeItems,
    brandKits,
    approvedMessaging,
    caseStudies,
    productsServices,
    activityLogs,
    onboarding,
  }
}
