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

export interface IntelReviewRequestInput {
  setup: DeckSetupInput
  fileAssets?: FileAssetSummaryInput[]
  sourceTraces?: SourceTraceInput[]
  webResearchEnabled?: boolean
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
}

const ALLOWED_TRACE_TYPES = new Set<SourceTraceType>([
  'deck-input',
  'uploaded-file',
  'generated-summary',
  'previous-deck',
  'web-research',
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

  return {
    setup,
    fileAssets: sanitizeFileAssets(record.fileAssets),
    sourceTraces: sanitizeSourceTraces(record.sourceTraces),
    webResearchEnabled: record.webResearchEnabled === true,
  }
}

function meetingGoalText(setup: DeckSetupInput): string {
  return setup.meetingGoal?.trim() || setup.goal.trim()
}

export function buildIntelReviewResponse(input: IntelReviewRequestInput): IntelReviewResponse {
  const { setup, fileAssets = [], sourceTraces = [], webResearchEnabled = false } = input
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
      const snippet = asset.possibleGoal?.trim() || asset.extractedTextPreview?.trim() || asset.summary?.trim()
      if (!snippet) {
        return undefined
      }

      const clipped = snippet.length > 220 ? `${snippet.slice(0, 220)}...` : snippet
      return `${asset.name ?? 'Uploaded source'}: ${clipped}`
    })
    .filter((point): point is string => Boolean(point))
    .slice(0, 6)

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
      proofPoints,
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
      citations: sourceTraces,
    },
    warnings,
  }
}
