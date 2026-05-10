/**
 * Mirrors `src/data/intelAiResponseValidation.ts` for Deno Edge (no `src/` imports).
 * Keep limits and coercion aligned when editing validation rules.
 */

export type CitationTraceType =
  | 'deck-input'
  | 'uploaded-file'
  | 'generated-summary'
  | 'previous-deck'
  | 'web-research'

export interface CitationTraceShape {
  fileId: string
  fileName: string
  sourceType: CitationTraceType
  confidence: number
  extractedSnippet: string
  addedByUserId: string
}

const SOURCE_TRACE_TYPES: CitationTraceType[] = [
  'deck-input',
  'uploaded-file',
  'generated-summary',
  'previous-deck',
  'web-research',
]

function normalizeSourceTraceType(value: unknown): CitationTraceType {
  return SOURCE_TRACE_TYPES.includes(value as CitationTraceType)
    ? (value as CitationTraceType)
    : 'generated-summary'
}

export const INTEL_AI_LIMITS = {
  maxCompanySummaryLength: 8000,
  maxRecommendedPitchAngleLength: 2000,
  maxStringListItems: 24,
  maxStringListItemLength: 600,
  maxCitations: 12,
  maxExtractedSnippetLength: 2000,
  maxFileNameLength: 512,
  maxAddedByUserIdLength: 120,
} as const

export interface ValidateDeckIntelShapeOptions {
  allowedCitationFileIds: ReadonlySet<string>
  limits?: Partial<typeof INTEL_AI_LIMITS>
}

export interface ValidateDeckIntelShapeEdgeResult {
  intel: {
    companySummary?: string
    inferredPriorities?: string[]
    painPoints?: string[]
    proofPoints?: string[]
    objections?: string[]
    recommendedPitchAngle?: string
    citations?: CitationTraceShape[]
  }
  warnings: string[]
}

function trimStr(s: string, max: number): string {
  const t = s.trim()
  return t.length > max ? t.slice(0, max) : t
}

function clampConfidence(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    return 0.64
  }
  return Math.min(1, Math.max(0, n))
}

function normalizeStringList(
  value: unknown,
  maxItems: number,
  maxElemLen: number,
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value.slice(0, maxItems)) {
    if (typeof item !== 'string') {
      continue
    }
    const t = trimStr(item, maxElemLen)
    if (!t || seen.has(t)) {
      continue
    }
    seen.add(t)
    out.push(t)
  }
  return out.length > 0 ? out : undefined
}

function coerceCitation(
  raw: unknown,
  allowlist: ReadonlySet<string>,
  limits: typeof INTEL_AI_LIMITS,
  onWarn: (reason: string) => void,
): CitationTraceShape | undefined {
  if (typeof raw === 'string') {
    onWarn('String citations are not allowlisted by fileId; drop or map server-side.')
    return undefined
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    onWarn('Invalid citation row shape.')
    return undefined
  }

  const record = raw as Record<string, unknown>
  const fileIdRaw = typeof record.fileId === 'string' ? record.fileId.trim() : ''
  if (!fileIdRaw) {
    onWarn('Citation missing fileId.')
    return undefined
  }

  if (!allowlist.has(fileIdRaw)) {
    onWarn(`Citation fileId not in allowlist (${fileIdRaw}).`)
    return undefined
  }

  const fileName =
    typeof record.fileName === 'string' && record.fileName.trim()
      ? trimStr(record.fileName, limits.maxFileNameLength)
      : 'Intel citation'

  const addedByUserId =
    typeof record.addedByUserId === 'string' && record.addedByUserId.trim()
      ? trimStr(record.addedByUserId, limits.maxAddedByUserIdLength)
      : 'unknown'

  const extractedSnippet =
    typeof record.extractedSnippet === 'string'
      ? trimStr(record.extractedSnippet, limits.maxExtractedSnippetLength)
      : typeof record.fileName === 'string' && record.fileName.trim()
        ? trimStr(record.fileName, limits.maxExtractedSnippetLength)
        : ''

  if (!extractedSnippet) {
    onWarn(`Citation ${fileIdRaw} missing excerpt text.`)
    return undefined
  }

  return {
    fileId: fileIdRaw,
    fileName,
    sourceType: normalizeSourceTraceType(record.sourceType),
    confidence: clampConfidence(record.confidence),
    extractedSnippet,
    addedByUserId,
  }
}

export function validateDeckIntelShapeEdge(
  raw: unknown,
  options: ValidateDeckIntelShapeOptions,
): ValidateDeckIntelShapeEdgeResult {
  const warnings: string[] = []
  const limits: typeof INTEL_AI_LIMITS = { ...INTEL_AI_LIMITS, ...options.limits }
  const allow = options.allowedCitationFileIds

  if (raw === null || raw === undefined) {
    warnings.push('Intel payload was null or undefined; returned empty intel.')
    return { intel: {}, warnings }
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push('Intel payload was not a plain object; returned empty intel.')
    return { intel: {}, warnings }
  }

  const record = raw as Record<string, unknown>
  const intel: ValidateDeckIntelShapeEdgeResult['intel'] = {}

  if (typeof record.companySummary === 'string') {
    const t = trimStr(record.companySummary, limits.maxCompanySummaryLength)
    if (t) {
      intel.companySummary = t
    }
  }

  if (typeof record.recommendedPitchAngle === 'string') {
    const t = trimStr(record.recommendedPitchAngle, limits.maxRecommendedPitchAngleLength)
    if (t) {
      intel.recommendedPitchAngle = t
    }
  }

  const inferredPriorities = normalizeStringList(
    record.inferredPriorities,
    limits.maxStringListItems,
    limits.maxStringListItemLength,
  )
  if (inferredPriorities) {
    intel.inferredPriorities = inferredPriorities
  }

  const painPoints = normalizeStringList(record.painPoints, limits.maxStringListItems, limits.maxStringListItemLength)
  if (painPoints) {
    intel.painPoints = painPoints
  }

  const proofPoints = normalizeStringList(record.proofPoints, limits.maxStringListItems, limits.maxStringListItemLength)
  if (proofPoints) {
    intel.proofPoints = proofPoints
  }

  const objections = normalizeStringList(record.objections, limits.maxStringListItems, limits.maxStringListItemLength)
  if (objections) {
    intel.objections = objections
  }

  if (Array.isArray(record.citations)) {
    const citations: CitationTraceShape[] = []
    let dropped = 0

    const scanCap = Math.min(record.citations.length, Math.max(limits.maxCitations * 4, 48))
    if (record.citations.length > scanCap) {
      warnings.push(`Scanned first ${scanCap} citation rows (${record.citations.length} provided).`)
    }

    for (let i = 0; i < scanCap && citations.length < limits.maxCitations; i++) {
      const c = coerceCitation(record.citations[i], allow, limits, (msg) => {
        warnings.push(msg)
        dropped += 1
      })
      if (c) {
        citations.push(c)
      }
    }

    if (record.citations.length > limits.maxCitations) {
      warnings.push(`Citation list length exceeds max (${limits.maxCitations}); excess not retained.`)
    }

    if (dropped > 0) {
      warnings.push(`Dropped ${dropped} citation(s) (allowlist / shape).`)
    }

    if (citations.length > 0) {
      intel.citations = citations
    }
  }

  return { intel, warnings }
}

/** Build citation allowlist: request traces + resolved file-backed Company Brain traces (exclude memory-only). */
export function buildCitationFileIdAllowlistEdge(args: {
  requestTraces: ReadonlyArray<Pick<CitationTraceShape, 'fileId'>>
  companyBrainResolvedTraces: ReadonlyArray<Pick<CitationTraceShape, 'fileId'>>
}): Set<string> {
  const out = new Set<string>()
  for (const t of args.requestTraces) {
    const id = typeof t.fileId === 'string' ? t.fileId.trim() : ''
    if (id) {
      out.add(id)
    }
  }
  for (const t of args.companyBrainResolvedTraces) {
    const id = typeof t.fileId === 'string' ? t.fileId.trim() : ''
    if (id) {
      out.add(id)
    }
  }
  return out
}

/** True when validated intel has enough structured content to return instead of deterministic fallback. */
export function isValidatedIntelUsable(intel: ValidateDeckIntelShapeEdgeResult['intel']): boolean {
  const summaryOk = typeof intel.companySummary === 'string' && intel.companySummary.trim().length >= 12
  const pitchOk = typeof intel.recommendedPitchAngle === 'string' && intel.recommendedPitchAngle.trim().length >= 12
  const listOk = (list?: string[]) => Boolean(list && list.some((s) => s.trim().length >= 8))
  const citationsOk = Boolean(intel.citations && intel.citations.length > 0)

  return (
    summaryOk ||
    pitchOk ||
    listOk(intel.inferredPriorities) ||
    listOk(intel.painPoints) ||
    listOk(intel.proofPoints) ||
    listOk(intel.objections) ||
    citationsOk
  )
}
