export type SourceTraceType =
  | 'deck-input'
  | 'uploaded-file'
  | 'generated-summary'
  | 'previous-deck'
  | 'web-research'

export interface SourceTraceInput {
  fileId: string
  fileName: string
  sourceType: SourceTraceType
  confidence: number
  extractedSnippet: string
  addedByUserId: string
}

export interface DeckSetupInput {
  goal: string
  audience: string
  tone: string
  presentationType: string
  requiredSections: string[]
  notes: string
  webResearch: boolean
  usePreviousDeckContext: boolean
  shareSetupInputs: boolean
  targetCompany?: string
  targetWebsite?: string
  buyerPersona?: string
  offeringSummary?: string
  meetingGoal?: string
  knownPainPoints?: string[]
  desiredCta?: string
  deckType?: string
}

export interface FileAssetSummaryInput {
  name?: string
  summary?: string
  extractedTextPreview?: string
  possibleGoal?: string
}

/** Sanitized Company Brain row (subset of client `CompanyKnowledgeItem`). */
export interface CompanyKnowledgeItemInput {
  id: string
  title: string
  description: string
  fileAssetId?: string
  sourceType: string
  approvalStatus: string
  tags: string[]
}

export interface CompanyBrainSourceUsedOutput {
  id: string
  title: string
  sourceType: string
  approvalStatus: string
  citationBacked: boolean
  citationCount: number
  memoryOnly: boolean
}

export interface IntelReviewRequestInput {
  setup: DeckSetupInput
  fileAssets: FileAssetSummaryInput[]
  sourceTraces: SourceTraceInput[]
  webResearchEnabled: boolean
  companyKnowledgeItems: CompanyKnowledgeItemInput[]
  selectedCompanyKnowledgeItemIds: string[]
  /** Merged deck + workspace file id → traces (deck assets overwrite workspace on id collision). */
  assetTracesByFileId: Map<string, SourceTraceInput[]>
}

export interface IntelReviewResponse {
  intel: {
    companySummary: string
    inferredPriorities: string[]
    painPoints: string[]
    proofPoints: string[]
    objections: string[]
    recommendedPitchAngle: string
    citations: SourceTraceInput[]
  }
  warnings: string[]
  companyBrainSourcesUsed: CompanyBrainSourceUsedOutput[]
}

const ALLOWED_TRACE_TYPES = new Set<SourceTraceType>([
  'deck-input',
  'uploaded-file',
  'generated-summary',
  'previous-deck',
  'web-research',
])

const APPROVAL_STATUSES = new Set<string>(['approved', 'needs-review', 'rejected', 'archived'])

const SOURCE_TYPES = new Set<string>([
  'contract',
  'deck',
  'proposal',
  'notes',
  'case-study',
  'product-doc',
  'policy',
  'transcript',
  'other',
])

function trimText(value: unknown, max = 4000): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().slice(0, max)
}

function trimOptionalText(value: unknown, max = 4000): string | undefined {
  const next = trimText(value, max)
  return next || undefined
}

function sanitizeStringArray(value: unknown, maxItems = 8, maxItemLength = 220): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => trimText(item, maxItemLength)).filter(Boolean).slice(0, maxItems)
}

function requireString(value: unknown, field: string): string {
  const next = trimText(value)
  if (!next) {
    throw new Error(`Invalid request: ${field} is required.`)
  }

  return next
}

export function sanitizeSourceTraces(value: unknown, max = 12): SourceTraceInput[] {
  if (!Array.isArray(value)) {
    return []
  }

  const out: SourceTraceInput[] = []
  const seen = new Set<string>()

  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue
    }

    const record = raw as Record<string, unknown>
    const fileId = trimText(record.fileId, 120)
    const fileName = trimText(record.fileName, 220)
    const extractedSnippet = trimText(record.extractedSnippet, 500)

    if (!fileId || !fileName || !extractedSnippet) {
      continue
    }

    const rawType = trimText(record.sourceType, 40)
    const sourceType = ALLOWED_TRACE_TYPES.has(rawType as SourceTraceType)
      ? (rawType as SourceTraceType)
      : 'uploaded-file'

    const confidenceValue = typeof record.confidence === 'number' ? record.confidence : 0.5
    const confidence = Math.max(0, Math.min(1, confidenceValue))

    const addedByUserId = trimText(record.addedByUserId, 120) || 'unknown'

    const key = [fileId, fileName, extractedSnippet, addedByUserId].join('|')
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    out.push({
      fileId,
      fileName,
      sourceType,
      confidence,
      extractedSnippet,
      addedByUserId,
    })

    if (out.length >= max) {
      break
    }
  }

  return out
}

function sanitizeFileAssets(value: unknown, max = 8): FileAssetSummaryInput[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .slice(0, max)
    .map((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return undefined
      }

      const record = raw as Record<string, unknown>
      const name = trimOptionalText(record.name, 220)
      const summary = trimOptionalText(record.summary, 300)
      const extractedTextPreview = trimOptionalText(record.extractedTextPreview, 300)
      const possibleGoal = trimOptionalText(record.possibleGoal, 220)

      if (!name && !summary && !extractedTextPreview && !possibleGoal) {
        return undefined
      }

      return { name, summary, extractedTextPreview, possibleGoal }
    })
    .filter((asset): asset is FileAssetSummaryInput => Boolean(asset))
}

function traceDedupeKey(trace: SourceTraceInput): string {
  return [trace.fileId, trace.fileName, trace.extractedSnippet, trace.addedByUserId].join('|')
}

function mergeTraceLists(base: SourceTraceInput[], extra: SourceTraceInput[], maxTotal: number): SourceTraceInput[] {
  const seen = new Set(base.map(traceDedupeKey))
  const out = [...base]
  for (const t of extra) {
    const k = traceDedupeKey(t)
    if (seen.has(k)) {
      continue
    }
    seen.add(k)
    out.push(t)
    if (out.length >= maxTotal) {
      break
    }
  }
  return out
}

/**
 * Pull `id` + `sourceTrace` from client file asset blobs (bounded).
 * Workspace map is merged first; deck `fileAssets` overwrite on duplicate ids (matches `mergeAssetsForKnowledgeTraceLookup`).
 */
export function buildAssetTraceMapFromRawBundles(
  workspaceRaw: unknown,
  deckRaw: unknown,
  maxAssets = 48,
  maxTracesPerAsset = 12,
): Map<string, SourceTraceInput[]> {
  const workspace = sanitizeTraceCarrierArray(workspaceRaw, maxAssets, maxTracesPerAsset)
  const deck = sanitizeTraceCarrierArray(deckRaw, maxAssets, maxTracesPerAsset)
  const merged = new Map<string, SourceTraceInput[]>(workspace)
  for (const [id, traces] of deck) {
    merged.set(id, traces)
  }
  return merged
}

function sanitizeTraceCarrierArray(
  raw: unknown,
  maxAssets: number,
  maxTracesPerAsset: number,
): Map<string, SourceTraceInput[]> {
  const map = new Map<string, SourceTraceInput[]>()
  if (!Array.isArray(raw)) {
    return map
  }

  for (const entry of raw.slice(0, maxAssets)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }

    const record = entry as Record<string, unknown>
    const id = trimText(record.id, 120)
    if (!id) {
      continue
    }

    const traces = sanitizeSourceTraces(record.sourceTrace, maxTracesPerAsset)
    map.set(id, traces)
  }

  return map
}

export function sanitizeCompanyKnowledgeItems(value: unknown, maxItems = 32): CompanyKnowledgeItemInput[] {
  if (!Array.isArray(value)) {
    return []
  }

  const out: CompanyKnowledgeItemInput[] = []
  const seen = new Set<string>()

  for (const raw of value.slice(0, maxItems)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue
    }

    const record = raw as Record<string, unknown>
    const id = trimText(record.id, 120)
    const title = trimText(record.title, 220)
    if (!id || !title) {
      continue
    }

    if (seen.has(id)) {
      continue
    }
    seen.add(id)

    const description = trimText(record.description, 2000)
    const fileAssetIdRaw = trimOptionalText(record.fileAssetId, 120)
    const fileAssetId = fileAssetIdRaw && fileAssetIdRaw.length > 0 ? fileAssetIdRaw : undefined

    const st = trimText(record.sourceType, 40)
    const sourceType = SOURCE_TYPES.has(st) ? st : 'other'

    const ap = trimText(record.approvalStatus, 40)
    const approvalStatus = APPROVAL_STATUSES.has(ap) ? ap : 'needs-review'

    const tags = sanitizeStringArray(record.tags, 24, 80)

    out.push({
      id,
      title,
      description,
      fileAssetId,
      sourceType,
      approvalStatus,
      tags,
    })
  }

  return out
}

export function sanitizeSelectedCompanyKnowledgeIds(value: unknown, max = 64): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of value.slice(0, max)) {
    const id = trimText(raw, 120)
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    out.push(id)
  }
  return out
}

function effectiveCompanyKnowledgeItems(
  items: CompanyKnowledgeItemInput[],
  selectedIds: string[],
): CompanyKnowledgeItemInput[] {
  if (selectedIds.length === 0) {
    return items
  }
  const allow = new Set(selectedIds)
  return items.filter((item) => allow.has(item.id))
}

function collectTracesForKnowledgeItem(
  item: CompanyKnowledgeItemInput,
  assetTracesByFileId: Map<string, SourceTraceInput[]>,
): SourceTraceInput[] {
  if (!item.fileAssetId) {
    return []
  }
  return assetTracesByFileId.get(item.fileAssetId) ?? []
}

function buildCompanyBrainSourcesUsed(
  items: CompanyKnowledgeItemInput[],
  assetTracesByFileId: Map<string, SourceTraceInput[]>,
): CompanyBrainSourceUsedOutput[] {
  return items.map((item) => {
    const traces = collectTracesForKnowledgeItem(item, assetTracesByFileId)
    const citationCount = traces.length
    const citationBacked = citationCount > 0
    return {
      id: item.id,
      title: item.title,
      sourceType: item.sourceType,
      approvalStatus: item.approvalStatus,
      citationBacked,
      citationCount,
      memoryOnly: !citationBacked,
    }
  })
}

export function sanitizeIntelReviewRequest(raw: unknown): IntelReviewRequestInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid request body.')
  }

  const record = raw as Record<string, unknown>
  const setupRaw = record.setup

  if (!setupRaw || typeof setupRaw !== 'object' || Array.isArray(setupRaw)) {
    throw new Error('Invalid request: setup is required.')
  }

  const setupRecord = setupRaw as Record<string, unknown>
  const setup: DeckSetupInput = {
    goal: requireString(setupRecord.goal, 'setup.goal'),
    audience: trimText(setupRecord.audience, 220),
    tone: trimText(setupRecord.tone, 120),
    presentationType: trimText(setupRecord.presentationType, 140),
    requiredSections: sanitizeStringArray(setupRecord.requiredSections, 12, 120),
    notes: trimText(setupRecord.notes, 1500),
    webResearch: setupRecord.webResearch === true,
    usePreviousDeckContext: setupRecord.usePreviousDeckContext === true,
    shareSetupInputs: setupRecord.shareSetupInputs === true,
    targetCompany: trimOptionalText(setupRecord.targetCompany, 220),
    targetWebsite: trimOptionalText(setupRecord.targetWebsite, 220),
    buyerPersona: trimOptionalText(setupRecord.buyerPersona, 220),
    offeringSummary: trimOptionalText(setupRecord.offeringSummary, 320),
    meetingGoal: trimOptionalText(setupRecord.meetingGoal, 320),
    knownPainPoints: sanitizeStringArray(setupRecord.knownPainPoints, 8, 220),
    desiredCta: trimOptionalText(setupRecord.desiredCta, 240),
    deckType: trimOptionalText(setupRecord.deckType, 120),
  }

  const companyKnowledgeItems = sanitizeCompanyKnowledgeItems(record.companyKnowledgeItems)
  const selectedCompanyKnowledgeItemIds = sanitizeSelectedCompanyKnowledgeIds(record.selectedCompanyKnowledgeItemIds)
  const assetTracesByFileId = buildAssetTraceMapFromRawBundles(record.workspaceFileAssets, record.fileAssets)

  return {
    setup,
    fileAssets: sanitizeFileAssets(record.fileAssets),
    sourceTraces: sanitizeSourceTraces(record.sourceTraces),
    webResearchEnabled: record.webResearchEnabled === true,
    companyKnowledgeItems,
    selectedCompanyKnowledgeItemIds,
    assetTracesByFileId,
  }
}

function meetingGoalText(setup: DeckSetupInput): string {
  return setup.meetingGoal?.trim() || setup.goal.trim()
}

export function buildIntelReviewResponse(input: IntelReviewRequestInput): IntelReviewResponse {
  const {
    setup,
    fileAssets = [],
    sourceTraces = [],
    webResearchEnabled = false,
    companyKnowledgeItems,
    selectedCompanyKnowledgeItemIds,
    assetTracesByFileId,
  } = input

  const knowledgeItems = effectiveCompanyKnowledgeItems(companyKnowledgeItems, selectedCompanyKnowledgeItemIds)

  const companyBrainSourcesUsed = buildCompanyBrainSourcesUsed(knowledgeItems, assetTracesByFileId)

  const linkedTracesLists = knowledgeItems
    .map((item) => collectTracesForKnowledgeItem(item, assetTracesByFileId))
    .filter((list) => list.length > 0)

  let mergedCitations = [...sourceTraces]
  const MAX_CITATIONS = 12
  for (const list of linkedTracesLists) {
    mergedCitations = mergeTraceLists(mergedCitations, list, MAX_CITATIONS)
    if (mergedCitations.length >= MAX_CITATIONS) {
      break
    }
  }

  const company = setup.targetCompany?.trim()
  const buyer = (setup.buyerPersona ?? setup.audience).trim()
  const offering = setup.offeringSummary?.trim()
  const goal = meetingGoalText(setup)
  const pains = (setup.knownPainPoints ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8)

  const summaryLines = [
    company ? `Account: ${company}` : undefined,
    buyer ? `Buyer lens: ${buyer}` : undefined,
    offering ? `Offering: ${offering}` : undefined,
    goal ? `Meeting goal: ${goal}` : undefined,
  ].filter(Boolean) as string[]

  const topSummary = fileAssets.find((asset) => asset.summary?.trim())?.summary?.trim()
  const companySummary =
    summaryLines.length > 0
      ? summaryLines.join('\n')
      : topSummary
        ? `Working note from latest source summary: ${topSummary}`
        : 'Add target company, buyer, offering, and meeting goal in the brief, then generate an intel draft.'

  const inferredPriorities: string[] = []
  const lowerGoal = goal.toLowerCase()
  if (lowerGoal.includes('renew') || lowerGoal.includes('expansion')) {
    inferredPriorities.push('Quantify renewal risk and expansion upside')
  }
  if (offering) {
    inferredPriorities.push(`Tie ${offering} to measurable outcomes the buyer already tracks`)
  }
  inferredPriorities.push('Confirm economic buyer versus champion and decision timeline')
  if (inferredPriorities.length < 3) {
    inferredPriorities.push('Land a crisp next step aligned to the desired CTA')
  }

  const proofPoints = fileAssets
    .map((asset) => {
      const snippet =
        asset.possibleGoal?.trim() || asset.extractedTextPreview?.trim() || asset.summary?.trim()
      if (!snippet) {
        return undefined
      }

      const clipped = snippet.length > 220 ? `${snippet.slice(0, 220)}...` : snippet
      return `${asset.name ?? 'Uploaded source'}: ${clipped}`
    })
    .filter((point): point is string => Boolean(point))

  for (const item of knowledgeItems.slice(0, 8)) {
    const excerpt = item.description?.trim() || item.tags.join(', ')
    if (excerpt) {
      const clipped = excerpt.length > 220 ? `${excerpt.slice(0, 220)}...` : excerpt
      proofPoints.push(`[Company Brain] ${item.title}: ${clipped}`)
    } else {
      proofPoints.push(`[Company Brain] ${item.title} (${item.sourceType})`)
    }
  }

  if (proofPoints.length === 0) {
    proofPoints.push('Upload parsed sources to surface proof-ready snippets here.')
  }

  const warnings: string[] = []
  if (webResearchEnabled) {
    warnings.push('Web research is enabled in request but not connected yet; using only provided setup/source data.')
  }

  return {
    intel: {
      companySummary,
      inferredPriorities: inferredPriorities.slice(0, 6),
      painPoints:
        pains.length > 0
          ? pains
          : ['Validate top pains with the buyer; placeholder until discovery confirms wording.'],
      proofPoints: proofPoints.slice(0, 24),
      objections: [
        'Procurement or security review may slow signature timing.',
        'Competitive bake-off or do-nothing inertia.',
      ],
      recommendedPitchAngle:
        company && offering
          ? `Position ${offering} as the fastest path for ${company} to make progress on: ${goal || 'their stated initiative'}.`
          : goal
            ? `Anchor the narrative on the meeting goal: ${goal}`
            : 'Open with account-specific context, then align proof to the buyer priority.',
      citations: mergedCitations.slice(0, MAX_CITATIONS),
    },
    warnings,
    companyBrainSourcesUsed,
  }
}
