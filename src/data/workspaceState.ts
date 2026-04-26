import { createChartSuggestionsFromFiles } from './chartSuggestions'
import { createDefaultCollaborationSettings, getMockActor } from './collaboration'
import { normalizeSlideBlock } from './slideLayout'
import { createMockFileAsset, normalizeSourceTrace } from './sourceIngestion'
import type {
  ChartSuggestion,
  ChartSuggestionStatus,
  ChartType,
  Comment,
  Deck,
  DeckVersion,
  FileAssetKind,
  GeneratedDeckReport,
  Slide,
  SlideBlock,
  WorkspaceState,
} from '../types/models'

type RawWorkspaceState = Partial<WorkspaceState> & {
  fileAssets?: Array<Record<string, unknown>>
  chartSuggestions?: Array<Record<string, unknown>>
  slides?: Array<Record<string, unknown>>
  deckVersions?: Array<Record<string, unknown>>
}

function normalizeBlock(rawBlock: SlideBlock | Record<string, unknown>): SlideBlock {
  const blockRecord = rawBlock as Record<string, unknown>
  const rawTrace = Array.isArray(blockRecord.sourceTrace) ? blockRecord.sourceTrace : []

  return {
    ...(rawBlock as SlideBlock),
    sourceTrace: rawTrace.map((trace, index) =>
      normalizeSourceTrace(
        trace as string | Parameters<typeof normalizeSourceTrace>[0],
        index,
        {
          fileId: `${typeof blockRecord.id === 'string' ? blockRecord.id : 'block'}-source`,
          fileName: 'Block source',
          sourceType: 'generated-summary',
          addedByUserId: 'user-owner-1',
        },
      ),
    ),
  }
}

function normalizeSlide(rawSlide: Slide | Record<string, unknown>): Slide {
  const slideRecord = rawSlide as Record<string, unknown>
  const deckId = typeof slideRecord.deckId === 'string' ? slideRecord.deckId : ''
  const slideId = typeof slideRecord.id === 'string' ? slideRecord.id : 'slide-legacy'
  const rawTrace = Array.isArray(slideRecord.sourceTrace) ? slideRecord.sourceTrace : []
  const rawBlocks = Array.isArray(slideRecord.blocks) ? slideRecord.blocks : []

  return {
    ...(rawSlide as Slide),
    id: slideId,
    deckId,
    sourceTrace: rawTrace.map((trace, index) =>
      normalizeSourceTrace(
        trace as string | Parameters<typeof normalizeSourceTrace>[0],
        index,
        {
          fileId: `${deckId || 'deck'}-legacy-source`,
          fileName: 'Legacy source',
          sourceType: 'generated-summary',
          addedByUserId: 'user-owner-1',
        },
      ),
    ),
    blocks: rawBlocks.map((block, index) =>
      normalizeSlideBlock(normalizeBlock(block as SlideBlock | Record<string, unknown>), index),
    ),
  }
}

function normalizeDeckVersion(rawVersion: DeckVersion | Record<string, unknown>): DeckVersion {
  const versionRecord = rawVersion as Record<string, unknown>
  const slideSnapshot = Array.isArray(versionRecord.slideSnapshot)
    ? versionRecord.slideSnapshot.map((slide) =>
        normalizeSlide(slide as Slide | Record<string, unknown>),
      )
    : []

  return {
    ...(rawVersion as DeckVersion),
    slideSnapshot,
  }
}

function normalizeDeck(rawDeck: Deck | Record<string, unknown>): Deck {
  const deckRecord = rawDeck as Record<string, unknown>
  const rawSetup =
    typeof deckRecord.setup === 'object' && deckRecord.setup
      ? (deckRecord.setup as Record<string, unknown>)
      : {}
  const rawCollaboration =
    typeof deckRecord.collaboration === 'object' && deckRecord.collaboration
      ? (deckRecord.collaboration as Record<string, unknown>)
      : {}
  const shareSetupInputs = rawSetup.shareSetupInputs === true

  return {
    ...(rawDeck as Deck),
    setup: {
      goal: typeof rawSetup.goal === 'string' ? rawSetup.goal : '',
      audience: typeof rawSetup.audience === 'string' ? rawSetup.audience : '',
      tone: typeof rawSetup.tone === 'string' ? rawSetup.tone : '',
      presentationType:
        typeof rawSetup.presentationType === 'string' ? rawSetup.presentationType : 'Strategy update',
      requiredSections: Array.isArray(rawSetup.requiredSections)
        ? rawSetup.requiredSections.filter((section): section is string => typeof section === 'string')
        : [],
      notes: typeof rawSetup.notes === 'string' ? rawSetup.notes : '',
      webResearch: rawSetup.webResearch === true,
      usePreviousDeckContext: rawSetup.usePreviousDeckContext === true,
      shareSetupInputs,
    },
    collaboration: {
      ...createDefaultCollaborationSettings(shareSetupInputs),
      isShared: rawCollaboration.isShared === true,
      access: rawCollaboration.access === 'comment-only' ? 'comment-only' : 'comment-only',
      allowCollaboratorUploads:
        typeof rawCollaboration.allowCollaboratorUploads === 'boolean'
          ? rawCollaboration.allowCollaboratorUploads
          : shareSetupInputs,
    },
  }
}

function normalizeComments(rawComments: unknown): Comment[] {
  if (!Array.isArray(rawComments)) {
    return []
  }

  return rawComments.map((rawComment, index) => {
    const commentRecord = rawComment as Record<string, unknown>
    const rawMessages = Array.isArray(commentRecord.messages) ? commentRecord.messages : []

    if (rawMessages.length > 0) {
      return {
        ...(rawComment as Comment),
        id: typeof commentRecord.id === 'string' ? commentRecord.id : `comment-thread-${index + 1}`,
        projectId:
          typeof commentRecord.projectId === 'string' ? commentRecord.projectId : '',
        deckId: typeof commentRecord.deckId === 'string' ? commentRecord.deckId : '',
        slideId: typeof commentRecord.slideId === 'string' ? commentRecord.slideId : undefined,
        blockId: typeof commentRecord.blockId === 'string' ? commentRecord.blockId : undefined,
        inputFieldKey:
          typeof commentRecord.inputFieldKey === 'string'
            ? (commentRecord.inputFieldKey as Comment['inputFieldKey'])
            : undefined,
        createdAt:
          typeof commentRecord.createdAt === 'string'
            ? commentRecord.createdAt
            : new Date().toISOString(),
        updatedAt:
          typeof commentRecord.updatedAt === 'string'
            ? commentRecord.updatedAt
            : typeof commentRecord.createdAt === 'string'
              ? commentRecord.createdAt
              : new Date().toISOString(),
        resolved: commentRecord.resolved === true,
        messages: rawMessages.map((rawMessage, messageIndex) => {
          const messageRecord = rawMessage as Record<string, unknown>
          const actor =
            messageRecord.authorRole === 'collaborator'
              ? getMockActor('collaborator')
              : getMockActor('owner')

          return {
            id:
              typeof messageRecord.id === 'string'
                ? messageRecord.id
                : `comment-message-${index + 1}-${messageIndex + 1}`,
            author:
              typeof messageRecord.author === 'string' ? messageRecord.author : actor.name,
            authorUserId:
              typeof messageRecord.authorUserId === 'string'
                ? messageRecord.authorUserId
                : actor.userId,
            authorRole:
              messageRecord.authorRole === 'collaborator' ? 'collaborator' : 'owner',
            message:
              typeof messageRecord.message === 'string' ? messageRecord.message : '',
            createdAt:
              typeof messageRecord.createdAt === 'string'
                ? messageRecord.createdAt
                : new Date().toISOString(),
          }
        }),
      }
    }

    const actor =
      commentRecord.author === 'AI assistant'
        ? getMockActor('owner')
        : getMockActor('owner')
    const createdAt =
      typeof commentRecord.createdAt === 'string'
        ? commentRecord.createdAt
        : new Date().toISOString()

    return {
      id: typeof commentRecord.id === 'string' ? commentRecord.id : `comment-thread-${index + 1}`,
      projectId: typeof commentRecord.projectId === 'string' ? commentRecord.projectId : '',
      deckId: typeof commentRecord.deckId === 'string' ? commentRecord.deckId : '',
      slideId: typeof commentRecord.slideId === 'string' ? commentRecord.slideId : undefined,
      blockId: typeof commentRecord.blockId === 'string' ? commentRecord.blockId : undefined,
      inputFieldKey:
        typeof commentRecord.inputFieldKey === 'string'
          ? (commentRecord.inputFieldKey as Comment['inputFieldKey'])
          : undefined,
      createdAt,
      updatedAt: createdAt,
      resolved: commentRecord.resolved === true,
      messages: [
        {
          id: `comment-message-${index + 1}-1`,
          author: typeof commentRecord.author === 'string' ? commentRecord.author : actor.name,
          authorUserId: actor.userId,
          authorRole: actor.role,
          message: typeof commentRecord.message === 'string' ? commentRecord.message : '',
          createdAt,
        },
      ],
    }
  })
}

function normalizeChartSuggestions(
  rawSuggestions: unknown,
  fileAssets: ReturnType<typeof createMockFileAsset>[],
): ChartSuggestion[] {
  const normalizedSuggestions = Array.isArray(rawSuggestions)
    ? rawSuggestions.map((rawSuggestion, index) => {
        const suggestionRecord = rawSuggestion as Record<string, unknown>
        const chartType =
          suggestionRecord.chartType === 'line' ||
          suggestionRecord.chartType === 'bar' ||
          suggestionRecord.chartType === 'comparison' ||
          suggestionRecord.chartType === 'kpi'
            ? (suggestionRecord.chartType as ChartType)
            : 'bar'
        const status: ChartSuggestionStatus =
          suggestionRecord.status === 'accepted' || suggestionRecord.status === 'rejected'
            ? suggestionRecord.status
            : 'suggested'

        return {
          id:
            typeof suggestionRecord.id === 'string'
              ? suggestionRecord.id
              : `chart-suggestion-legacy-${index + 1}`,
          deckId: typeof suggestionRecord.deckId === 'string' ? suggestionRecord.deckId : '',
          fileId: typeof suggestionRecord.fileId === 'string' ? suggestionRecord.fileId : '',
          title:
            typeof suggestionRecord.title === 'string'
              ? suggestionRecord.title
              : 'Suggested chart',
          chartType,
          reason:
            typeof suggestionRecord.reason === 'string'
              ? suggestionRecord.reason
              : 'Mock tabular source data can support a chart.',
          confidence:
            typeof suggestionRecord.confidence === 'number' ? suggestionRecord.confidence : 0.66,
          dataPreview: Array.isArray(suggestionRecord.dataPreview)
            ? suggestionRecord.dataPreview.filter((item): item is string => typeof item === 'string')
            : [],
          status,
        }
      })
    : []

  const backfilledSuggestions = createChartSuggestionsFromFiles(
    fileAssets,
    normalizedSuggestions,
  )
  const backfilledIds = new Set(backfilledSuggestions.map((suggestion) => suggestion.id))

  return [
    ...backfilledSuggestions,
    ...normalizedSuggestions.filter((suggestion) => !backfilledIds.has(suggestion.id)),
  ]
}

function normalizeFileAssetKind(kind: unknown): FileAssetKind {
  return kind === 'pdf' ||
    kind === 'doc' ||
    kind === 'sheet' ||
    kind === 'image' ||
    kind === 'report' ||
    kind === 'other'
    ? kind
    : 'other'
}

function normalizeGeneratedReport(rawReport: unknown): GeneratedDeckReport | undefined {
  if (!rawReport || typeof rawReport !== 'object') {
    return undefined
  }

  const reportRecord = rawReport as Record<string, unknown>
  const reportType = reportRecord.reportType === 'detailed' ? 'detailed' : 'concise'

  return {
    id: typeof reportRecord.id === 'string' ? reportRecord.id : 'report-legacy',
    deckId: typeof reportRecord.deckId === 'string' ? reportRecord.deckId : '',
    title: typeof reportRecord.title === 'string' ? reportRecord.title : 'Generated report',
    reportType,
    generatedAt:
      typeof reportRecord.generatedAt === 'string'
        ? reportRecord.generatedAt
        : new Date().toISOString(),
    executiveSummary:
      typeof reportRecord.executiveSummary === 'string'
        ? reportRecord.executiveSummary
        : '',
    keyPoints: Array.isArray(reportRecord.keyPoints)
      ? (reportRecord.keyPoints as GeneratedDeckReport['keyPoints'])
      : [],
    metrics: Array.isArray(reportRecord.metrics)
      ? (reportRecord.metrics as GeneratedDeckReport['metrics'])
      : [],
    decisions: Array.isArray(reportRecord.decisions)
      ? (reportRecord.decisions as GeneratedDeckReport['decisions'])
      : [],
    sourceReferences: Array.isArray(reportRecord.sourceReferences)
      ? (reportRecord.sourceReferences as GeneratedDeckReport['sourceReferences'])
      : [],
    plainText:
      typeof reportRecord.plainText === 'string' ? reportRecord.plainText : '',
  }
}

export function normalizeWorkspaceState(state: WorkspaceState | RawWorkspaceState): WorkspaceState {
  const rawFileAssets = Array.isArray(state.fileAssets) ? state.fileAssets : []
  const fileAssets = rawFileAssets.map((rawAsset) =>
    createMockFileAsset({
      id: typeof rawAsset.id === 'string' ? rawAsset.id : 'file-legacy',
      deckId: typeof rawAsset.deckId === 'string' ? rawAsset.deckId : '',
      name: typeof rawAsset.name === 'string' ? rawAsset.name : 'legacy-source.txt',
      kind: normalizeFileAssetKind(rawAsset.kind),
      status:
        (rawAsset.status as 'uploaded' | 'extracting' | 'parsed') ?? 'parsed',
      sizeBytes: typeof rawAsset.sizeBytes === 'number' ? rawAsset.sizeBytes : 0,
      sizeLabel: typeof rawAsset.sizeLabel === 'string' ? rawAsset.sizeLabel : undefined,
      summary: typeof rawAsset.summary === 'string' ? rawAsset.summary : undefined,
      uploadedAt:
        typeof rawAsset.uploadedAt === 'string'
          ? rawAsset.uploadedAt
          : new Date().toISOString(),
      uploadedByRole:
        rawAsset.uploadedByRole === 'collaborator' ? 'collaborator' : 'owner',
      uploadedByUserId:
        typeof rawAsset.uploadedByUserId === 'string'
          ? rawAsset.uploadedByUserId
          : undefined,
      highlightForOwnerReview:
        typeof rawAsset.highlightForOwnerReview === 'boolean'
          ? rawAsset.highlightForOwnerReview
          : undefined,
      extractedTextPreview:
        typeof rawAsset.extractedTextPreview === 'string'
          ? rawAsset.extractedTextPreview
          : undefined,
      extractedMetadata:
        typeof rawAsset.extractedMetadata === 'object' && rawAsset.extractedMetadata
          ? (rawAsset.extractedMetadata as Record<string, string | number | boolean>)
          : undefined,
      possibleAudience:
        typeof rawAsset.possibleAudience === 'string' ? rawAsset.possibleAudience : undefined,
      possibleGoal:
        typeof rawAsset.possibleGoal === 'string' ? rawAsset.possibleGoal : undefined,
      possibleSections: Array.isArray(rawAsset.possibleSections)
        ? rawAsset.possibleSections.filter(
            (section): section is string => typeof section === 'string',
          )
        : undefined,
      possibleTone:
        typeof rawAsset.possibleTone === 'string' ? rawAsset.possibleTone : undefined,
      sourceTrace: Array.isArray(rawAsset.sourceTrace)
        ? rawAsset.sourceTrace.map((trace, index) =>
            normalizeSourceTrace(
              trace as string | Parameters<typeof normalizeSourceTrace>[0],
              index,
              {
                fileId:
                  typeof rawAsset.id === 'string' ? rawAsset.id : 'file-legacy-source',
                fileName:
                  typeof rawAsset.name === 'string' ? rawAsset.name : 'legacy-source.txt',
                sourceType: 'uploaded-file',
                addedByUserId:
                  typeof rawAsset.uploadedByUserId === 'string'
                    ? rawAsset.uploadedByUserId
                    : 'user-owner-1',
              },
            ),
          )
        : undefined,
      report: normalizeGeneratedReport(rawAsset.report),
    }),
  )

  return {
    activeDeckId: typeof state.activeDeckId === 'string' ? state.activeDeckId : '',
    projects: Array.isArray(state.projects) ? state.projects : [],
    decks: Array.isArray(state.decks)
      ? state.decks.map((deck) => normalizeDeck(deck as Deck | Record<string, unknown>))
      : [],
    slides: Array.isArray(state.slides)
      ? state.slides.map((slide) => normalizeSlide(slide as Slide | Record<string, unknown>))
      : [],
    fileAssets,
    chartSuggestions: normalizeChartSuggestions(state.chartSuggestions, fileAssets),
    comments: normalizeComments(state.comments),
    deckVersions: Array.isArray(state.deckVersions)
      ? state.deckVersions.map((version) =>
          normalizeDeckVersion(version as DeckVersion | Record<string, unknown>),
        )
      : [],
  }
}
