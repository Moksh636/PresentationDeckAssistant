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
  DeckVersion,
  FileAsset,
  FileContributorRole,
  GeneratedDeckReport,
  ReportType,
  Slide,
} from '../types/models'
import { createId } from '../utils/ids'

export const AI_BACKEND_ENDPOINTS = {
  generateDeck: '/api/ai/decks/generate',
  proposeEditorEdit: '/api/ai/editor/propose',
  autofillSetupFromFiles: '/api/ai/setup/autofill',
  ingestFile: '/api/ai/files/ingest',
  suggestCharts: '/api/ai/charts/suggest',
  generateReport: '/api/ai/reports/generate',
  createAlternateVersion: '/api/ai/decks/alternate-version',
} as const

export interface GenerateDeckRequest {
  sourceDeck: Deck
  sourceFiles: FileAsset[]
  previousDeck?: Deck
}

export interface GenerateDeckResponse {
  generatedDeck: Deck
  generatedFiles: FileAsset[]
  generatedSlides: Slide[]
  generatedVersion: DeckVersion
}

export interface ProposeEditorEditRequest {
  deck: Deck
  slides: Slide[]
  scope: AiEditScope
  request: string
  activeSlideId?: string
}

export type ProposeEditorEditResponse = AiEditPlan

export interface AutofillSetupFromFilesRequest {
  fileAssets: FileAsset[]
  currentSetup: DeckSetup
}

export type AutofillSetupFromFilesResponse = Partial<DeckSetup>

export interface IngestFileRequest {
  deckId: string
  file: File
  uploadedByRole?: FileContributorRole
  uploadedByUserId?: string
}

export type IngestFileResponse = FileAsset

export interface SuggestChartsRequest {
  files: FileAsset[]
  existingSuggestions?: ChartSuggestion[]
}

export type SuggestChartsResponse = ChartSuggestion[]

export interface GenerateReportRequest {
  deck: Deck
  slides: Slide[]
  fileAssets: FileAsset[]
  reportType: ReportType
}

export type GenerateReportResponse = GeneratedDeckReport

export interface CreateAlternateVersionRequest {
  deck: Deck
  currentSlides: Slide[]
  fileAssets?: FileAsset[]
}

export type CreateAlternateVersionResponse = Slide[]

export interface CreateChartSlideRequest {
  deckId: string
  slideIndex: number
  suggestion: ChartSuggestion
  file?: FileAsset
}

export type CreateChartSlideResponse = Slide

export interface AiBackendClient {
  generateDeck: (request: GenerateDeckRequest) => Promise<GenerateDeckResponse>
  proposeEditorEdit: (
    request: ProposeEditorEditRequest,
  ) => Promise<ProposeEditorEditResponse>
  autofillSetupFromFiles: (
    request: AutofillSetupFromFilesRequest,
  ) => Promise<AutofillSetupFromFilesResponse>
  ingestFile: (request: IngestFileRequest) => Promise<IngestFileResponse>
  suggestCharts: (request: SuggestChartsRequest) => Promise<SuggestChartsResponse>
  generateReport: (request: GenerateReportRequest) => Promise<GenerateReportResponse>
  createAlternateVersion: (
    request: CreateAlternateVersionRequest,
  ) => Promise<CreateAlternateVersionResponse>
}

function isAiBackendEnabled() {
  return import.meta.env.VITE_AI_BACKEND_ENABLED === 'true'
}

function warnAndUseMock(flowName: string, error: unknown) {
  console.warn(
    `[aiClient] ${flowName} backend endpoint failed; using mock/local fallback.`,
    error,
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

async function postJson<Response>(endpoint: string, payload: unknown): Promise<Response> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}`)
  }

  return response.json() as Promise<Response>
}

async function postFile<Response>(
  endpoint: string,
  request: IngestFileRequest,
): Promise<Response> {
  const formData = new FormData()

  formData.set('file', request.file)
  formData.set(
    'metadata',
    JSON.stringify({
      deckId: request.deckId,
      uploadedByRole: request.uploadedByRole,
      uploadedByUserId: request.uploadedByUserId,
    }),
  )

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}`)
  }

  return response.json() as Promise<Response>
}

async function maybeUseBackend<Request, Response>(
  flowName: string,
  endpoint: string,
  request: Request,
  callBackend: (endpoint: string, request: Request) => Promise<Response>,
  getFallback: () => Promise<Response> | Response,
) {
  if (!isAiBackendEnabled()) {
    return getFallback()
  }

  try {
    return await callBackend(endpoint, request)
  } catch (error) {
    warnAndUseMock(flowName, error)
    return getFallback()
  }
}

function createMockIngestedFile(request: IngestFileRequest): FileAsset {
  const uploadedByRole = request.uploadedByRole ?? 'owner'

  return createMockFileAsset({
    id: createId('file'),
    deckId: request.deckId,
    name: request.file.name,
    kind: inferFileKind(request.file.name),
    status: 'parsed',
    sizeBytes: request.file.size,
    uploadedAt: new Date().toISOString(),
    uploadedByRole,
    uploadedByUserId: request.uploadedByUserId,
    highlightForOwnerReview: uploadedByRole === 'collaborator',
  })
}

export const aiClient: AiBackendClient = {
  async generateDeck(request) {
    return maybeUseBackend(
      'Deck generation',
      AI_BACKEND_ENDPOINTS.generateDeck,
      request,
      postJson<GenerateDeckResponse>,
      () => runMockDeckGenerationPipeline(request),
    )
  },

  async proposeEditorEdit(request) {
    return maybeUseBackend(
      'Editor AI proposal',
      AI_BACKEND_ENDPOINTS.proposeEditorEdit,
      request,
      postJson<ProposeEditorEditResponse>,
      () => buildMockAiEditPlan(request),
    )
  },

  async autofillSetupFromFiles(request) {
    return maybeUseBackend(
      'Setup autofill',
      AI_BACKEND_ENDPOINTS.autofillSetupFromFiles,
      request,
      postJson<AutofillSetupFromFilesResponse>,
      () =>
        autoFillPresentationFieldsFromFiles(request.fileAssets, request.currentSetup),
    )
  },

  async ingestFile(request) {
    return maybeUseBackend(
      'File ingestion',
      AI_BACKEND_ENDPOINTS.ingestFile,
      request,
      postFile<IngestFileResponse>,
      () => createMockIngestedFile(request),
    )
  },

  async suggestCharts(request) {
    return maybeUseBackend(
      'Chart suggestions',
      AI_BACKEND_ENDPOINTS.suggestCharts,
      request,
      postJson<SuggestChartsResponse>,
      () => createChartSuggestionsFromFiles(request.files, request.existingSuggestions),
    )
  },

  async generateReport(request) {
    return maybeUseBackend(
      'Report generation',
      AI_BACKEND_ENDPOINTS.generateReport,
      request,
      postJson<GenerateReportResponse>,
      () => generateDeckReport(request),
    )
  },

  async createAlternateVersion(request) {
    return maybeUseBackend(
      'Alternate version generation',
      AI_BACKEND_ENDPOINTS.createAlternateVersion,
      request,
      postJson<CreateAlternateVersionResponse>,
      () => {
        const sourceSlides =
          request.currentSlides.length > 0
            ? request.currentSlides
            : createSlidesFromDeck(request.deck, request.fileAssets ?? [])

        return createAlternateSlides(request.deck, sourceSlides)
      },
    )
  },
}

export async function createChartSlide(
  request: CreateChartSlideRequest,
): Promise<CreateChartSlideResponse> {
  return createChartSlideFromSuggestion(
    request.deckId,
    request.slideIndex,
    request.suggestion,
    request.file,
  )
}

export type GenerateDeckInput = GenerateDeckRequest
export type GenerateDeckResult = GenerateDeckResponse
export type ProposeEditorEditInput = ProposeEditorEditRequest
export type IngestFileInput = IngestFileRequest
export type SuggestChartsInput = SuggestChartsRequest
export type GenerateReportInput = GenerateReportRequest
export type CreateAlternateVersionInput = CreateAlternateVersionRequest
export type CreateChartSlideInput = CreateChartSlideRequest
