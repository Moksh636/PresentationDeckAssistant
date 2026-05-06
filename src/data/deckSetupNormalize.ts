import type { DeckIntel, DeckSetup, SourceTrace, SourceTraceType } from '../types/models'

const DEFAULT_OWNER_ID = 'user-owner-1'

const SOURCE_TRACE_TYPES: SourceTraceType[] = [
  'deck-input',
  'uploaded-file',
  'generated-summary',
  'previous-deck',
  'web-research',
]

function pickOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const strings = value.filter((item): item is string => typeof item === 'string')

  return strings.length > 0 ? strings : undefined
}

/** Non-empty string ids (e.g. screenshot asset refs on `Deck`). */
export function normalizeScreenshotAssetIdsForDeck(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const ids = value.filter((item): item is string => typeof item === 'string' && item.length > 0)

  return ids.length > 0 ? ids : undefined
}

function normalizeKnownPainPoints(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function normalizeSourceTraceType(value: unknown): SourceTraceType {
  return SOURCE_TRACE_TYPES.includes(value as SourceTraceType)
    ? (value as SourceTraceType)
    : 'generated-summary'
}

function coerceIntelCitation(trace: unknown, index: number): SourceTrace | undefined {
  const fallbackId = `intel-citation-${index + 1}`

  if (typeof trace === 'string') {
    return {
      fileId: fallbackId,
      fileName: 'Intel citation',
      sourceType: 'generated-summary',
      confidence: 0.64,
      extractedSnippet: trace,
      addedByUserId: DEFAULT_OWNER_ID,
    }
  }

  if (typeof trace !== 'object' || trace === null || Array.isArray(trace)) {
    return undefined
  }

  const record = trace as Record<string, unknown>
  const fileId =
    typeof record.fileId === 'string' && record.fileId.trim() ? record.fileId.trim() : undefined
  const fileName =
    typeof record.fileName === 'string' && record.fileName.trim()
      ? record.fileName.trim()
      : 'Intel citation'
  const addedByUserId =
    typeof record.addedByUserId === 'string' && record.addedByUserId.trim()
      ? record.addedByUserId.trim()
      : DEFAULT_OWNER_ID
  const extractedSnippet =
    typeof record.extractedSnippet === 'string'
      ? record.extractedSnippet
      : typeof record.fileName === 'string' && record.fileName.trim()
        ? record.fileName.trim()
        : ''

  if (!extractedSnippet.trim()) {
    return undefined
  }

  const confidence = typeof record.confidence === 'number' ? record.confidence : 0.64

  return {
    fileId: fileId ?? fallbackId,
    fileName,
    sourceType: normalizeSourceTraceType(record.sourceType),
    confidence,
    extractedSnippet,
    addedByUserId,
  }
}

function normalizeIntel(rawIntel: unknown): DeckIntel | undefined {
  if (!rawIntel || typeof rawIntel !== 'object' || Array.isArray(rawIntel)) {
    return undefined
  }

  const record = rawIntel as Record<string, unknown>
  const intel: DeckIntel = {}

  const companySummary = pickOptionalString(record, 'companySummary')
  if (companySummary !== undefined) {
    intel.companySummary = companySummary
  }

  const recommendedPitchAngle = pickOptionalString(record, 'recommendedPitchAngle')
  if (recommendedPitchAngle !== undefined) {
    intel.recommendedPitchAngle = recommendedPitchAngle
  }

  const inferredPriorities = normalizeStringList(record.inferredPriorities)
  if (inferredPriorities) {
    intel.inferredPriorities = inferredPriorities
  }

  const painPoints = normalizeStringList(record.painPoints)
  if (painPoints) {
    intel.painPoints = painPoints
  }

  const proofPoints = normalizeStringList(record.proofPoints)
  if (proofPoints) {
    intel.proofPoints = proofPoints
  }

  const objections = normalizeStringList(record.objections)
  if (objections) {
    intel.objections = objections
  }

  const citations = Array.isArray(record.citations)
    ? record.citations
        .map((trace, index) => coerceIntelCitation(trace, index))
        .filter((citation): citation is SourceTrace => Boolean(citation))
    : []

  if (citations.length > 0) {
    intel.citations = citations
  }

  return Object.keys(intel).length > 0 ? intel : undefined
}

/** Normalizes persisted deck setup (additive fields + legacy compatibility). */
export function normalizeDeckSetup(rawSetup: Record<string, unknown>): DeckSetup {
  const shareSetupInputs = rawSetup.shareSetupInputs === true
  const citationReviewMode =
    rawSetup.citationReviewMode === 'strict-approved-only'
      ? 'strict-approved-only'
      : 'permissive'

  const setup: DeckSetup = {
    goal: typeof rawSetup.goal === 'string' ? rawSetup.goal : '',
    audience: typeof rawSetup.audience === 'string' ? rawSetup.audience : '',
    tone: typeof rawSetup.tone === 'string' ? rawSetup.tone : '',
    presentationType:
      typeof rawSetup.presentationType === 'string' ? rawSetup.presentationType : 'Account pitch deck',
    requiredSections: Array.isArray(rawSetup.requiredSections)
      ? rawSetup.requiredSections.filter((section): section is string => typeof section === 'string')
      : [],
    notes: typeof rawSetup.notes === 'string' ? rawSetup.notes : '',
    webResearch: rawSetup.webResearch === true,
    usePreviousDeckContext: rawSetup.usePreviousDeckContext === true,
    shareSetupInputs,
    citationReviewMode,
  }

  const targetCompany = pickOptionalString(rawSetup, 'targetCompany')
  if (targetCompany !== undefined) {
    setup.targetCompany = targetCompany
  }

  const targetWebsite = pickOptionalString(rawSetup, 'targetWebsite')
  if (targetWebsite !== undefined) {
    setup.targetWebsite = targetWebsite
  }

  const buyerPersona = pickOptionalString(rawSetup, 'buyerPersona')
  if (buyerPersona !== undefined) {
    setup.buyerPersona = buyerPersona
  }

  const offeringSummary = pickOptionalString(rawSetup, 'offeringSummary')
  if (offeringSummary !== undefined) {
    setup.offeringSummary = offeringSummary
  }

  const meetingGoal = pickOptionalString(rawSetup, 'meetingGoal')
  if (meetingGoal !== undefined) {
    setup.meetingGoal = meetingGoal
  }

  const desiredCta = pickOptionalString(rawSetup, 'desiredCta')
  if (desiredCta !== undefined) {
    setup.desiredCta = desiredCta
  }

  const deckType = pickOptionalString(rawSetup, 'deckType')
  if (deckType !== undefined) {
    setup.deckType = deckType
  }

  const brandKitId = pickOptionalString(rawSetup, 'brandKitId')
  if (brandKitId !== undefined) {
    setup.brandKitId = brandKitId
  }

  const knownPainPoints = normalizeKnownPainPoints(rawSetup.knownPainPoints)
  if (knownPainPoints !== undefined) {
    setup.knownPainPoints = knownPainPoints
  }

  const approvedMessagingIds = normalizeScreenshotAssetIdsForDeck(rawSetup.approvedMessagingIds)
  if (approvedMessagingIds) {
    setup.approvedMessagingIds = approvedMessagingIds
  }

  const caseStudyIds = normalizeScreenshotAssetIdsForDeck(rawSetup.caseStudyIds)
  if (caseStudyIds) {
    setup.caseStudyIds = caseStudyIds
  }

  const selectedCompanyKnowledgeItemIds = normalizeScreenshotAssetIdsForDeck(
    rawSetup.selectedCompanyKnowledgeItemIds,
  )
  if (selectedCompanyKnowledgeItemIds) {
    setup.selectedCompanyKnowledgeItemIds = selectedCompanyKnowledgeItemIds
  }

  const intel = normalizeIntel(rawSetup.intel)
  if (intel) {
    setup.intel = intel
  }

  return setup
}

/** Mirrors deck-level persisted fields applied in `normalizeWorkspaceState` (for tests). */
export function normalizeDeckPersistedSurface(deckRecord: Record<string, unknown>): {
  setup: DeckSetup
  screenshotAssetIds?: string[]
} {
  const rawSetup =
    typeof deckRecord.setup === 'object' && deckRecord.setup
      ? (deckRecord.setup as Record<string, unknown>)
      : {}

  return {
    setup: normalizeDeckSetup(rawSetup),
    screenshotAssetIds: normalizeScreenshotAssetIdsForDeck(deckRecord.screenshotAssetIds),
  }
}
