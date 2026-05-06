import type {
  CompanyKnowledgeItem,
  CompanyKnowledgeSourceType,
  DeckSetup,
  MembershipAccessRole,
} from '../types/models'

/** Deck fields used for heuristic relevance (no embeddings); partial for legacy/partial setups. */
export type DeckSetupRetrievalPick = Partial<
  Pick<
    DeckSetup,
    | 'targetCompany'
    | 'buyerPersona'
    | 'audience'
    | 'offeringSummary'
    | 'goal'
    | 'meetingGoal'
    | 'knownPainPoints'
    | 'presentationType'
    | 'deckType'
  >
>

export interface RelevantCompanyKnowledgeArgs {
  organizationId: string
  /** Current member's title (for role-scoped items). */
  userRoleTitle: string
  department: string
  /** Access role for coarse gating (needs-review visibility for non-admins). */
  accessRole: MembershipAccessRole
  currentUserId: string
  deckSetup: DeckSetupRetrievalPick
  knowledgeItems: CompanyKnowledgeItem[]
  /** Active company-managed role names (bonus when membership aligns with configured titles). */
  companyCatalogRoleNames?: string[]
  /** Active company-managed department names (bonus when membership aligns). */
  companyCatalogDepartmentNames?: string[]
}

export interface CompanyKnowledgeRetrievalExplanation {
  matchedRole?: boolean
  matchedDepartment?: boolean
  /** Tags on the item that also appear in tokenized deck brief fields. */
  matchedTags?: string[]
  /** True when meeting goal / goal tokens overlap item text; string lists a few overlapping tokens. */
  matchedDeckGoalTokens?: boolean | string
  matchedBuyerPersona?: boolean
  matchedTargetCompany?: boolean
  matchedOfferingSummary?: boolean
  matchedKnownPainPoints?: boolean
  approvedSource: boolean
  /** Plain-language reason when deck type / presentation hints boost this source type. */
  sourceTypeRelevance?: string
  /** Short visibility scope description for UI ("Organization-wide", etc.). */
  visibilitySummary?: string
  catalogRoleBonus?: boolean
  catalogDepartmentBonus?: boolean
}

export type CompanyKnowledgeRelevanceBand = 'high' | 'medium' | 'low'

export interface RankedCompanyKnowledgeEntry {
  item: CompanyKnowledgeItem
  score: number
  band: CompanyKnowledgeRelevanceBand
  explanation: CompanyKnowledgeRetrievalExplanation
}

/**
 * Fixed bands on the heuristic score scale (approval baseline ~120 + stacked bonuses).
 * - High: strong brief alignment or rich keyword overlap on approved items.
 * - Medium: visible approved items with lighter overlap, or elevated needs-review for eligible viewers.
 * - Low: weak overlap but still surfaced (approved / eligible review).
 */
export const COMPANY_KNOWLEDGE_SCORE_BAND_THRESHOLDS = {
  high: 168,
  medium: 108,
} as const

function relevanceBandForScore(score: number): CompanyKnowledgeRelevanceBand {
  if (score >= COMPANY_KNOWLEDGE_SCORE_BAND_THRESHOLDS.high) {
    return 'high'
  }
  if (score >= COMPANY_KNOWLEDGE_SCORE_BAND_THRESHOLDS.medium) {
    return 'medium'
  }
  return 'low'
}

function normalizedCatalogNameMatch(value: string, catalog: readonly string[]): boolean {
  const v = value.trim().toLowerCase()
  if (!v || catalog.length === 0) {
    return false
  }
  const set = new Set(catalog.map((n) => n.trim().toLowerCase()).filter(Boolean))
  return set.has(v)
}

export function tokenize(text: string): string[] {
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

function intersectTokens(a: string[], b: string[]): string[] {
  const setB = new Set(b)
  return uniqTokens([...a.filter((x) => setB.has(x))])
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

function visibilitySummaryForItem(
  item: CompanyKnowledgeItem,
  dept: string,
  roleTitle: string,
): string | undefined {
  switch (item.visibility) {
    case 'company':
      return 'Organization-wide visibility'
    case 'private':
      return 'Private to uploader visibility'
    case 'department': {
      const allowed = item.allowedDepartments?.filter(Boolean) ?? []
      if (allowed.length === 0) {
        return 'Department visibility (any department)'
      }
      if (dept && allowed.map((d) => d.toLowerCase()).includes(dept.trim().toLowerCase())) {
        return `Department visibility (includes yours)`
      }
      return `Department visibility (${allowed.length} listed)`
    }
    case 'role': {
      const allowed = item.allowedRoleTitles?.filter(Boolean) ?? []
      if (allowed.length === 0) {
        return 'Role visibility (any role title)'
      }
      if (
        roleTitle &&
        allowed.map((r) => r.toLowerCase()).includes(roleTitle.trim().toLowerCase())
      ) {
        return `Role visibility (includes your title)`
      }
      return `Role visibility (${allowed.length} titles)`
    }
    default:
      return undefined
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

function deckBriefSourceTypeHints(deckSetup: DeckSetupRetrievalPick): {
  boostForSourceType: Partial<Record<CompanyKnowledgeSourceType, number>>
  humanLines: string[]
} {
  const blob = [
    deckSetup.presentationType ?? '',
    deckSetup.deckType ?? '',
    deckSetup.meetingGoal ?? '',
    deckSetup.goal ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const boostForSourceType: Partial<Record<CompanyKnowledgeSourceType, number>> = {}
  const humanLines: string[] = []

  if (
    /\b(case\s*study|customer\s*stor(y|ies)|win\s*stor(y|ies)|proof\s*point)\b/.test(blob) ||
    /\bcase\b/.test(blob)
  ) {
    boostForSourceType['case-study'] = 22
    humanLines.push('Brief hints favor customer proof assets for this deck shape')
  }
  if (/\b(proposal|pricing|commercial|renewal|expansion|pilot)\b/.test(blob)) {
    boostForSourceType.proposal = 14
    boostForSourceType.policy = 12
    humanLines.push('Brief hints favor proposals and guardrail materials')
  }
  if (/\b(executive|briefing|board)\b/.test(blob)) {
    boostForSourceType.deck = 16
    humanLines.push('Brief hints favor narrative deck collateral')
  }
  if (/\b(product|technical|demo|architecture)\b/.test(blob)) {
    boostForSourceType['product-doc'] = 18
    humanLines.push('Brief hints favor product documentation')
  }
  if (/\b(contract|legal|msa|terms)\b/.test(blob)) {
    boostForSourceType.contract = 18
    humanLines.push('Brief hints favor contracts and legal references')
  }

  return { boostForSourceType, humanLines }
}

function haystackTokens(item: CompanyKnowledgeItem): string[] {
  return uniqTokens(
    tokenize([item.title, item.description, ...item.tags, item.sourceType].filter(Boolean).join(' ')),
  )
}

function meetingGoalText(deckSetup: DeckSetupRetrievalPick): string {
  const m = deckSetup.meetingGoal?.trim()
  if (m) {
    return m
  }
  return deckSetup.goal?.trim() ?? ''
}

/** Ranked rows with UI-facing explanations (mock heuristic retrieval). */
export function getRelevantCompanyKnowledgeForUserWithExplanations(
  args: RelevantCompanyKnowledgeArgs,
): RankedCompanyKnowledgeEntry[] {
  const deptNorm = args.department.trim().toLowerCase()
  const roleNorm = args.userRoleTitle.trim().toLowerCase()

  const targetCompanyTokens = uniqTokens(tokenize(args.deckSetup.targetCompany ?? ''))
  const buyerTokens = uniqTokens(
    tokenize([args.deckSetup.buyerPersona ?? '', args.deckSetup.audience ?? ''].filter(Boolean).join(' ')),
  )
  const offeringTokens = uniqTokens(tokenize(args.deckSetup.offeringSummary ?? ''))
  const goalTokens = uniqTokens(tokenize(meetingGoalText(args.deckSetup)))
  const painTokens = uniqTokens(
    tokenize((args.deckSetup.knownPainPoints ?? []).filter(Boolean).join(' ')),
  )

  const combinedBriefTokens = uniqTokens([
    ...targetCompanyTokens,
    ...buyerTokens,
    ...offeringTokens,
    ...goalTokens,
    ...painTokens,
  ])

  const { boostForSourceType, humanLines: deckHintLines } = deckBriefSourceTypeHints(args.deckSetup)

  const orgItems = args.knowledgeItems.filter((item) => item.organizationId === args.organizationId)

  const vizArgs: Omit<RelevantCompanyKnowledgeArgs, 'deckSetup' | 'knowledgeItems'> = {
    organizationId: args.organizationId,
    userRoleTitle: args.userRoleTitle,
    department: args.department,
    accessRole: args.accessRole,
    currentUserId: args.currentUserId,
  }

  const scored = orgItems
    .map((item) => {
      if (!passesVisibility(item, vizArgs)) {
        return null
      }

      const s = statusScore(item, args.accessRole, args.currentUserId)
      if (s < 0) {
        return null
      }

      let score = s

      const explanation: CompanyKnowledgeRetrievalExplanation = {
        approvedSource: item.approvalStatus === 'approved',
        visibilitySummary: visibilitySummaryForItem(item, args.department, args.userRoleTitle),
      }

      if (
        deptNorm &&
        item.allowedDepartments &&
        item.allowedDepartments.map((d) => d.toLowerCase()).includes(deptNorm)
      ) {
        score += 35
        explanation.matchedDepartment = true
      }

      if (
        args.companyCatalogDepartmentNames?.length &&
        normalizedCatalogNameMatch(args.department, args.companyCatalogDepartmentNames)
      ) {
        score += 10
        explanation.catalogDepartmentBonus = true
      }

      const titleLower = item.title.toLowerCase()
      const descLower = item.description.toLowerCase()

      if (
        roleNorm &&
        item.allowedRoleTitles &&
        item.allowedRoleTitles.map((r) => r.toLowerCase()).includes(roleNorm)
      ) {
        score += 30
        explanation.matchedRole = true
      }

      if (
        args.companyCatalogRoleNames?.length &&
        normalizedCatalogNameMatch(args.userRoleTitle, args.companyCatalogRoleNames)
      ) {
        score += 10
        explanation.catalogRoleBonus = true
      }

      const itemHaystack = haystackTokens(item)

      const tagTokens = uniqTokens(item.tags.flatMap((t) => tokenize(t)))
      const matchedTags = intersectTokens(tagTokens, combinedBriefTokens)
      if (matchedTags.length > 0) {
        explanation.matchedTags = matchedTags.slice(0, 8)
        score += matchedTags.length * 14
      }

      score += overlaps(itemHaystack, combinedBriefTokens) * 12

      if (
        combinedBriefTokens.some(
          (kw) => kw && (titleLower.includes(kw) || descLower.includes(kw)),
        )
      ) {
        score += 15
      }

      const tgtOverlap = intersectTokens(itemHaystack, targetCompanyTokens)
      if (targetCompanyTokens.length > 0 && tgtOverlap.length > 0) {
        explanation.matchedTargetCompany = true
        score += 12 + Math.min(18, tgtOverlap.length * 6)
      }

      const buyerOverlap = intersectTokens(itemHaystack, buyerTokens)
      if (buyerTokens.length > 0 && buyerOverlap.length > 0) {
        explanation.matchedBuyerPersona = true
        score += 12 + Math.min(16, buyerOverlap.length * 5)
      }

      const goalOverlap = intersectTokens(itemHaystack, goalTokens)
      if (goalTokens.length > 0 && goalOverlap.length > 0) {
        explanation.matchedDeckGoalTokens =
          goalOverlap.length <= 4 ? goalOverlap.join(', ') : true
        score += 12 + Math.min(18, goalOverlap.length * 6)
      }

      const offeringOverlap = intersectTokens(itemHaystack, offeringTokens)
      if (offeringTokens.length > 0 && offeringOverlap.length > 0) {
        explanation.matchedOfferingSummary = true
        score += 10 + Math.min(14, offeringOverlap.length * 4)
      }

      const painOverlap = intersectTokens(itemHaystack, painTokens)
      if (painTokens.length > 0 && painOverlap.length > 0) {
        explanation.matchedKnownPainPoints = true
        score += 10 + Math.min(14, painOverlap.length * 4)
      }

      const typeBoost = boostForSourceType[item.sourceType]
      if (typeBoost) {
        score += typeBoost
        const line = deckHintLines.find((l) => {
          if (item.sourceType === 'case-study') {
            return l.includes('proof')
          }
          if (item.sourceType === 'proposal' || item.sourceType === 'policy') {
            return l.includes('proposals')
          }
          if (item.sourceType === 'deck') {
            return l.includes('narrative')
          }
          if (item.sourceType === 'product-doc') {
            return l.includes('product documentation')
          }
          if (item.sourceType === 'contract') {
            return l.includes('contracts')
          }
          return false
        })
        if (line) {
          explanation.sourceTypeRelevance = `${line} (${item.sourceType})`
        } else {
          explanation.sourceTypeRelevance = `Brief/deck-type alignment with ${item.sourceType}`
        }
      }

      return {
        item,
        score,
        band: relevanceBandForScore(score),
        explanation,
      }
    })
    .filter((row): row is RankedCompanyKnowledgeEntry => Boolean(row))

  scored.sort((a, b) => b.score - a.score)
  return scored
}

/** Mock “retrieval” ranking for Company Brain items (no embeddings / no paid APIs). */
export function getRelevantCompanyKnowledgeForUser(
  args: RelevantCompanyKnowledgeArgs,
): CompanyKnowledgeItem[] {
  return getRelevantCompanyKnowledgeForUserWithExplanations(args).map((row) => row.item)
}
