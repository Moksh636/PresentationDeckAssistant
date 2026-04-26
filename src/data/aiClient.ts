import {
  createChartSuggestionsFromFiles,
  createChartSlideFromSuggestion,
} from './chartSuggestions'
import {
  createAlternateSlides,
  createSlidesFromDeck,
  runMockDeckGenerationPipeline,
} from './deckGenerator'
import { buildMockAiEditPlan, type AiEditPlan, type AiEditScope } from './aiEditor'
import { autoFillPresentationFieldsFromFiles, createMockFileAsset } from './sourceIngestion'
import { generateDeckReport } from './reportGenerator'
import type {
  ChartSuggestion,
  Deck,
  DeckSetup,
  FileAsset,
  FileContributorRole,
  GeneratedDeckReport,
  ReportType,
  Slide,
} from '../types/models'
import { createId } from '../utils/ids'

export type GenerateDeckResult = Awaited<ReturnType<typeof runMockDeckGenerationPipeline>>

export interface GenerateDeckInput {
  sourceDeck: Deck
  sourceFiles: FileAsset[]
  previousDeck?: Deck
}

export interface ProposeEditorEditInput {
  deck: Deck
  slides: Slide[]
  scope: AiEditScope
  request: string
  activeSlideId?: string
}

export interface IngestFileInput {
  deckId: string
  file: File
  uploadedByRole?: FileContributorRole
  uploadedByUserId?: string
}

export interface SuggestChartsInput {
  files: FileAsset[]
  existingSuggestions?: ChartSuggestion[]
}

export interface GenerateReportInput {
  deck: Deck
  slides: Slide[]
  fileAssets: FileAsset[]
  reportType: ReportType
}

export interface CreateAlternateVersionInput {
  deck: Deck
  currentSlides: Slide[]
  fileAssets?: FileAsset[]
}

export interface CreateChartSlideInput {
  deckId: string
  slideIndex: number
  suggestion: ChartSuggestion
  file?: FileAsset
}

function isAiBackendEnabled() {
  return import.meta.env.VITE_AI_BACKEND_ENABLED === 'true'
}

function backendNotConnected(flowName: string): never {
  throw new Error(
    `${flowName} is configured for a backend AI call, but no AI backend/proxy route is connected yet. Disable VITE_AI_BACKEND_ENABLED or wire this method to a server route.`,
  )
}

function inferFileKind(name: string): FileAsset['kind'] {
  const extension = name.split('.').pop()?.toLowerCase()

  if (extension === 'pdf') {
    return 'pdf'
  }

  if (['doc', 'docx', 'txt', 'md'].includes(extension ?? '')) {
    return 'doc'
  }

  if (['xls', 'xlsx', 'csv'].includes(extension ?? '')) {
    return 'sheet'
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension ?? '')) {
    return 'image'
  }

  return 'other'
}

export const aiClient = {
  async generateDeck(input: GenerateDeckInput): Promise<GenerateDeckResult> {
    if (isAiBackendEnabled()) {
      backendNotConnected('Deck generation')
    }

    return runMockDeckGenerationPipeline(input)
  },

  async proposeEditorEdit(input: ProposeEditorEditInput): Promise<AiEditPlan> {
    if (isAiBackendEnabled()) {
      backendNotConnected('Editor AI proposal')
    }

    return buildMockAiEditPlan(input)
  },

  async autofillSetupFromFiles(
    fileAssets: FileAsset[],
    currentSetup: DeckSetup,
  ): Promise<Partial<DeckSetup>> {
    if (isAiBackendEnabled()) {
      backendNotConnected('Setup autofill')
    }

    return autoFillPresentationFieldsFromFiles(fileAssets, currentSetup)
  },

  async ingestFile(input: IngestFileInput): Promise<FileAsset> {
    if (isAiBackendEnabled()) {
      backendNotConnected('File ingestion')
    }

    const uploadedByRole = input.uploadedByRole ?? 'owner'

    return createMockFileAsset({
      id: createId('file'),
      deckId: input.deckId,
      name: input.file.name,
      kind: inferFileKind(input.file.name),
      status: 'parsed',
      sizeBytes: input.file.size,
      uploadedAt: new Date().toISOString(),
      uploadedByRole,
      uploadedByUserId: input.uploadedByUserId,
      highlightForOwnerReview: uploadedByRole === 'collaborator',
    })
  },

  async suggestCharts(input: SuggestChartsInput): Promise<ChartSuggestion[]> {
    if (isAiBackendEnabled()) {
      backendNotConnected('Chart suggestions')
    }

    return createChartSuggestionsFromFiles(input.files, input.existingSuggestions)
  },

  async generateReport(input: GenerateReportInput): Promise<GeneratedDeckReport> {
    if (isAiBackendEnabled()) {
      backendNotConnected('Report generation')
    }

    return generateDeckReport(input)
  },

  async createAlternateVersion(input: CreateAlternateVersionInput): Promise<Slide[]> {
    if (isAiBackendEnabled()) {
      backendNotConnected('Alternate version generation')
    }

    const sourceSlides =
      input.currentSlides.length > 0
        ? input.currentSlides
        : createSlidesFromDeck(input.deck, input.fileAssets ?? [])

    return createAlternateSlides(input.deck, sourceSlides)
  },

  async createChartSlide(input: CreateChartSlideInput): Promise<Slide> {
    if (isAiBackendEnabled()) {
      backendNotConnected('Chart slide creation')
    }

    return createChartSlideFromSuggestion(
      input.deckId,
      input.slideIndex,
      input.suggestion,
      input.file,
    )
  },
}
