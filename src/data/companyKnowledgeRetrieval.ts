import type { CompanyKnowledgeItem, DeckSetup, MembershipAccessRole } from '../types/models'

export interface RelevantCompanyKnowledgeArgs {
  organizationId: string
  /** Current member's title (for role-scoped items). */
  userRoleTitle: string
  department: string
  /** Access role for coarse gating (needs-review visibility for non-admins). */
  accessRole: MembershipAccessRole
  currentUserId: string
  deckSetup: Pick<DeckSetup, 'targetCompany' | 'buyerPersona' | 'offeringSummary' | 'goal' | 'knownPainPoints'>
  knowledgeItems: CompanyKnowledgeItem[]
  /** Active company-managed role names (bonus when membership aligns with configured titles). */
  companyCatalogRoleNames?: string[]
  /** Active company-managed department names (bonus when membership aligns). */
  companyCatalogDepartmentNames?: string[]
}

function normalizedCatalogNameMatch(value: string, catalog: readonly string[]): boolean {
  const v = value.trim().toLowerCase()
  if (!v || catalog.length === 0) {
    return false
  }
  const set = new Set(catalog.map((n) => n.trim().toLowerCase()).filter(Boolean))
  return set.has(v)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 2)
}

function uniqTokens(values: string[]): string[] {
  return [...new Set(values)]
}

function overlaps(a: string[], b: string[]): number {
  const setB = new Set(b)
  let count = 0
  for (const x of a) {
    if (setB.has(x)) {
      count++
    }
  }
  return count
}

function passesVisibility(
  item: CompanyKnowledgeItem,
  args: Omit<RelevantCompanyKnowledgeArgs, 'deckSetup' | 'knowledgeItems'>,
): boolean {
  const dept = args.department.trim().toLowerCase()
  const roleTitle = args.userRoleTitle.trim().toLowerCase()

  switch (item.visibility) {
    case 'company':
      return true
    case 'private':
      return item.uploadedByUserId === args.currentUserId
    case 'department': {
      if (!dept) {
        return false
      }
      const allowed =
        item.allowedDepartments?.map((d) => d.trim().toLowerCase()).filter(Boolean) ?? []
      if (allowed.length === 0) {
        return true
      }
      return allowed.includes(dept)
    }
    case 'role': {
      if (!roleTitle) {
        return false
      }
      const allowedTitles =
        item.allowedRoleTitles?.map((d) => d.trim().toLowerCase()).filter(Boolean) ?? []
      if (allowedTitles.length === 0) {
        return true
      }
      return allowedTitles.includes(roleTitle)
    }
    default:
      return false
  }
}

function statusScore(
  item: CompanyKnowledgeItem,
  accessRole: MembershipAccessRole,
  currentUserId: string,
): number {
  if (item.approvalStatus === 'approved') {
    return 120
  }
  if (item.approvalStatus === 'needs-review') {
    if (item.uploadedByUserId === currentUserId) {
      return 45
    }
    if (accessRole === 'owner' || accessRole === 'admin') {
      return 40
    }
    return -1000
  }
  if (item.approvalStatus === 'archived' || item.approvalStatus === 'rejected') {
    return -1000
  }
  return -1000
}

/** Mock “retrieval” ranking for Company Brain items (no embeddings / no paid APIs). */
export function getRelevantCompanyKnowledgeForUser(
  args: RelevantCompanyKnowledgeArgs,
): CompanyKnowledgeItem[] {
  const keywords = uniqTokens(
    tokenize(
      [
        args.deckSetup.targetCompany,
        args.deckSetup.buyerPersona,
        args.deckSetup.offeringSummary,
        args.deckSetup.goal,
        ...(args.deckSetup.knownPainPoints ?? []),
      ]
        .filter(Boolean)
        .join(' '),
    ),
  )

  const orgItems = args.knowledgeItems.filter((item) => item.organizationId === args.organizationId)

  const scored = orgItems
    .map((item) => {
      const vizArgs: Omit<RelevantCompanyKnowledgeArgs, 'deckSetup' | 'knowledgeItems'> = {
        organizationId: args.organizationId,
        userRoleTitle: args.userRoleTitle,
        department: args.department,
        accessRole: args.accessRole,
        currentUserId: args.currentUserId,
      }

      if (!passesVisibility(item, vizArgs)) {
        return null
      }

      const s = statusScore(item, args.accessRole, args.currentUserId)
      if (s < 0) {
        return null
      }

      let score = s
      const dept = args.department.trim().toLowerCase()
      if (dept && item.allowedDepartments?.map((d) => d.toLowerCase()).includes(dept)) {
        score += 35
      }
      if (
        args.companyCatalogDepartmentNames?.length &&
        normalizedCatalogNameMatch(args.department, args.companyCatalogDepartmentNames)
      ) {
        score += 10
      }
      const title = item.title.toLowerCase()
      const roleTitle = args.userRoleTitle.trim().toLowerCase()
      if (roleTitle && item.allowedRoleTitles?.map((r) => r.toLowerCase()).includes(roleTitle)) {
        score += 30
      }
      if (
        args.companyCatalogRoleNames?.length &&
        normalizedCatalogNameMatch(args.userRoleTitle, args.companyCatalogRoleNames)
      ) {
        score += 10
      }

      const haystackTokens = uniqTokens(
        tokenize(
          [item.title, item.description, ...item.tags, item.sourceType].filter(Boolean).join(' '),
        ),
      )
      score += overlaps(haystackTokens, keywords) * 12
      if (
        keywords.some(
          (kw) => kw && (title.includes(kw) || item.description.toLowerCase().includes(kw)),
        )
      ) {
        score += 15
      }

      return { item, score }
    })
    .filter((row): row is { item: CompanyKnowledgeItem; score: number } => Boolean(row))

  scored.sort((a, b) => b.score - a.score)
  return scored.map((row) => row.item)
}
