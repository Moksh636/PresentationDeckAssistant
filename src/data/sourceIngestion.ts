import type {
  DeckSetup,
  ExtractedMetadata,
  FileAsset,
  FileAssetKind,
  FileAssetStatus,
  FileContributorRole,
  GeneratedDeckReport,
  SourceTrace,
  SourceTraceType,
} from '../types/models'
import { formatFileSize } from '../utils/formatters'

export const OWNER_USER_ID = 'user-owner-1'
export const COLLABORATOR_USER_ID = 'user-collaborator-1'

interface FileAssetSeedInput {
  id: string
  deckId: string
  name: string
  kind: FileAssetKind
  sizeBytes: number
  uploadedAt: string
  sizeLabel?: string
  summary?: string
  status?: FileAssetStatus
  uploadedByUserId?: string
  uploadedByRole?: FileContributorRole
  highlightForOwnerReview?: boolean
  extractedTextPreview?: string
  extractedMetadata?: ExtractedMetadata
  possibleAudience?: string
  possibleGoal?: string
  possibleSections?: string[]
  possibleTone?: string
  sourceTrace?: SourceTrace[]
  starred?: boolean
  trashedAt?: string
  report?: GeneratedDeckReport
}

export interface SourceMaterialsSummary {
  totalFiles: number
  parsedFiles: number
  highlightedFiles: number
  suggestedAudience: string
  suggestedGoal: string
  suggestedTone: string
  suggestedSections: string[]
  tracePreview: SourceTrace[]
  summaryText: string
}

function cleanFileLabel(name: string) {
  return name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

function detectSignalTopic(name: string, kind: FileAssetKind) {
  const lowerName = name.toLowerCase()

  if (lowerName.includes('board') || lowerName.includes('investor') || lowerName.includes('market')) {
    return {
      audience: 'Board members and executive staff',
      goal: 'Turn the source materials into a decision-ready board narrative with a clear recommendation.',
      sections: ['Market context', 'Execution progress', 'Financial signal', 'Investment ask'],
      tone: 'Confident, concise, evidence-driven',
      topic: 'board narrative',
    }
  }

  if (lowerName.includes('launch') || lowerName.includes('readout') || lowerName.includes('release')) {
    return {
      audience: 'Product and GTM leads',
      goal: 'Convert launch learnings into a crisp readout with concrete next actions.',
      sections: ['What shipped', 'Customer signal', 'Risks and blockers', 'Next actions'],
      tone: 'Plain-spoken and practical',
      topic: 'launch readout',
    }
  }

  if (lowerName.includes('forecast') || lowerName.includes('finance') || lowerName.includes('model')) {
    return {
      audience: 'Finance and operating leads',
      goal: 'Use the model to explain the most important performance signal and what it implies.',
      sections: ['Metric overview', 'Trend drivers', 'Scenario outlook', 'Recommendation'],
      tone: 'Analytical and direct',
      topic: 'financial model',
    }
  }

  if (kind === 'sheet') {
    return {
      audience: 'Operational stakeholders',
      goal: 'Translate structured data into a presentation-ready storyline.',
      sections: ['Metric overview', 'Pattern summary', 'Recommendation'],
      tone: 'Analytical and direct',
      topic: 'structured data summary',
    }
  }

  if (kind === 'image') {
    return {
      audience: 'Design and review stakeholders',
      goal: 'Use the visual source material to support a concise review narrative.',
      sections: ['Visual snapshot', 'Observation', 'Action'],
      tone: 'Visual and pointed',
      topic: 'visual review',
    }
  }

  if (kind === 'report') {
    return {
      audience: 'Internal stakeholders',
      goal: `Review the generated report for ${cleanFileLabel(name)}.`,
      sections: ['Executive Summary', 'Key Points', 'Source References'],
      tone: 'Business document',
      topic: 'generated report',
    }
  }

  return {
    audience: 'Internal stakeholders',
    goal: `Turn ${cleanFileLabel(name)} into a structured presentation storyline.`,
    sections: ['Context', 'Key findings', 'Recommendation'],
    tone: kind === 'doc' ? 'Clear and narrative-driven' : 'Clear and concise',
    topic: cleanFileLabel(name) || 'source material',
  }
}

function buildMockMetadata(name: string, kind: FileAssetKind, sizeBytes: number): ExtractedMetadata {
  const lowerName = name.toLowerCase()

  return {
    detectedTopic: titleCase(cleanFileLabel(name) || 'Source Material'),
    ingestionMode: 'mock-local-parser',
    containsTables: kind === 'sheet' || lowerName.includes('model'),
    containsNarrative: kind === 'doc' || kind === 'pdf',
    approximatePages: Math.max(1, Math.round(sizeBytes / 180000)),
  }
}

export function createSourceTrace(input: SourceTrace): SourceTrace {
  return input
}

export function createDeckInputTrace(
  fileName: string,
  extractedSnippet: string,
  sourceType: SourceTraceType = 'deck-input',
  confidence = 0.96,
) {
  return createSourceTrace({
    fileId: `${sourceType}:${fileName.toLowerCase().replace(/\s+/g, '-')}`,
    fileName,
    sourceType,
    confidence,
    extractedSnippet,
    addedByUserId: OWNER_USER_ID,
  })
}

export function normalizeSourceTrace(
  trace: SourceTrace | string,
  index: number,
  fallback: Pick<SourceTrace, 'fileId' | 'fileName' | 'sourceType' | 'addedByUserId'>,
): SourceTrace {
  if (typeof trace === 'string') {
    return createSourceTrace({
      fileId: `${fallback.fileId}-${index + 1}`,
      fileName: fallback.fileName,
      sourceType: fallback.sourceType,
      confidence: 0.64,
      extractedSnippet: trace,
      addedByUserId: fallback.addedByUserId,
    })
  }

  return {
    ...trace,
    confidence: typeof trace.confidence === 'number' ? trace.confidence : 0.64,
    extractedSnippet: trace.extractedSnippet || trace.fileName,
  }
}

export function createMockFileAsset(input: FileAssetSeedInput): FileAsset {
  const signal = detectSignalTopic(input.name, input.kind)
  const uploaderRole = input.uploadedByRole ?? 'owner'
  const uploaderUserId =
    input.uploadedByUserId ??
    (uploaderRole === 'owner' ? OWNER_USER_ID : COLLABORATOR_USER_ID)
  const extractedTextPreview =
    input.extractedTextPreview ??
    `Mock extraction suggests this ${input.kind} contains ${signal.topic} context that can feed deck setup and source trace.`
  const sourceTrace =
    input.sourceTrace ??
    [
      createSourceTrace({
        fileId: input.id,
        fileName: input.name,
        sourceType: 'uploaded-file',
        confidence: input.kind === 'sheet' ? 0.81 : 0.74,
        extractedSnippet: extractedTextPreview,
        addedByUserId: uploaderUserId,
      }),
    ]

  return {
    id: input.id,
    deckId: input.deckId,
    name: input.name,
    kind: input.kind,
    status: input.status ?? 'parsed',
    uploadedByUserId: uploaderUserId,
    uploadedByRole: uploaderRole,
    highlightForOwnerReview:
      input.highlightForOwnerReview ?? uploaderRole === 'collaborator',
    sizeBytes: input.sizeBytes,
    sizeLabel: input.sizeLabel ?? formatFileSize(input.sizeBytes),
    summary:
      input.summary ??
      `Mock ingestion is ready for ${signal.topic}. Replace this with parser output once backend extraction is available.`,
    uploadedAt: input.uploadedAt,
    extractedTextPreview,
    extractedMetadata:
      input.extractedMetadata ?? buildMockMetadata(input.name, input.kind, input.sizeBytes),
    possibleAudience: input.possibleAudience ?? signal.audience,
    possibleGoal: input.possibleGoal ?? signal.goal,
    possibleSections: input.possibleSections ?? signal.sections,
    possibleTone: input.possibleTone ?? signal.tone,
    sourceTrace,
    starred: input.starred,
    trashedAt: input.trashedAt,
    report: input.report,
  }
}

function getRankedFiles(fileAssets: FileAsset[]) {
  return [...fileAssets].sort((left, right) => {
    const leftScore =
      (left.status === 'parsed' ? 2 : 0) +
      (left.highlightForOwnerReview ? 1 : 0) +
      (left.sourceTrace[0]?.confidence ?? 0)
    const rightScore =
      (right.status === 'parsed' ? 2 : 0) +
      (right.highlightForOwnerReview ? 1 : 0) +
      (right.sourceTrace[0]?.confidence ?? 0)

    return rightScore - leftScore
  })
}

function pickMostCommon(values: string[]) {
  const counts = values.reduce<Map<string, number>>((accumulator, value) => {
    if (!value.trim()) {
      return accumulator
    }

    accumulator.set(value, (accumulator.get(value) ?? 0) + 1)
    return accumulator
  }, new Map())

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? ''
}

function removeExistingSourceSummary(notes: string) {
  return notes.replace(/\n\nSource material summary:\n[\s\S]*$/u, '').trim()
}

export function autoFillPresentationFieldsFromFiles(
  fileAssets: FileAsset[],
  currentSetup: DeckSetup,
): Partial<DeckSetup> {
  const usableFiles = getRankedFiles(fileAssets).filter(
    (asset) =>
      asset.possibleAudience ||
      asset.possibleGoal ||
      asset.possibleSections.length > 0 ||
      asset.possibleTone,
  )

  if (usableFiles.length === 0) {
    return {}
  }

  const topFile = usableFiles[0]
  const audience = pickMostCommon(usableFiles.map((asset) => asset.possibleAudience))
  const tone = pickMostCommon(usableFiles.map((asset) => asset.possibleTone))
  const requiredSections = [...new Set(usableFiles.flatMap((asset) => asset.possibleSections))]
  const noteFragments = usableFiles
    .slice(0, 3)
    .map((asset) => `${asset.name}: ${asset.extractedTextPreview}`)
  const notes = [
    removeExistingSourceSummary(currentSetup.notes),
    noteFragments.length > 0 ? `Source material summary:\n${noteFragments.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    goal: topFile.possibleGoal || currentSetup.goal,
    audience: audience || currentSetup.audience,
    tone: tone || currentSetup.tone,
    requiredSections: requiredSections.length > 0 ? requiredSections : currentSetup.requiredSections,
    notes,
  }
}

export function buildSourceMaterialsSummary(fileAssets: FileAsset[]): SourceMaterialsSummary {
  const parsedFiles = fileAssets.filter((asset) => asset.status === 'parsed')
  const highlightedFiles = fileAssets.filter((asset) => asset.highlightForOwnerReview)
  const autofill = autoFillPresentationFieldsFromFiles(fileAssets, {
    goal: '',
    audience: '',
    tone: '',
    presentationType: '',
    requiredSections: [],
    notes: '',
    webResearch: false,
    usePreviousDeckContext: false,
    shareSetupInputs: false,
  })
  const tracePreview = getRankedFiles(fileAssets)
    .flatMap((asset) => asset.sourceTrace)
    .slice(0, 4)

  return {
    totalFiles: fileAssets.length,
    parsedFiles: parsedFiles.length,
    highlightedFiles: highlightedFiles.length,
    suggestedAudience: autofill.audience ?? '',
    suggestedGoal: autofill.goal ?? '',
    suggestedTone: autofill.tone ?? '',
    suggestedSections: autofill.requiredSections ?? [],
    tracePreview,
    summaryText:
      fileAssets.length === 0
        ? 'No source materials have been uploaded yet.'
        : `Mock ingestion found ${fileAssets.length} source file${fileAssets.length === 1 ? '' : 's'}, with ${parsedFiles.length} parsed and ${highlightedFiles.length} flagged for owner review.`,
  }
}
