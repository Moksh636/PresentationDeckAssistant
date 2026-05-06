import {
  createChartSuggestionsFromFiles,
  createChartSlideFromSuggestion,
} from './chartSuggestions.ts'
import type { DeckBrandGenerationContext } from './brandKitResolve.ts'
import { resolveBrandGenerationContext } from './brandKitResolve.ts'
import {
  createAlternateSlides,
  createSlidesFromDeck,
  runMockDeckGenerationPipeline,
} from './deckGenerator.ts'
import { buildMockAiEditPlan, type AiEditPlan, type AiEditScope } from './aiEditor.ts'
import {
  autoFillPresentationFieldsFromFiles,
  createMockFileAsset,
  finalizeLocalFileAssetIngest,
} from './sourceIngestion.ts'
import { generateDeckReport } from './reportGenerator.ts'
import { supabase } from './supabaseClient.ts'
import { generateIntelReviewWithFallback as generateIntelReviewWithFallbackBase } from './intelReviewBackendFallback.ts'
import type {
  ChartSuggestion,
  CompanyBrainSourceUsed,
  CompanyBrainWorkspaceSlice,
  CompanyKnowledgeItem,
  CompanyBrandKit,
  Deck,
  DeckIntel,
  DeckSetup,
  DeckVersion,
  FileAsset,
  FileContributorRole,
  GeneratedDeckReport,
  KnowledgeApprovalStatus,
  ReportType,
  Slide,
  SourceTrace,
  CompanyKnowledgeSourceType,
} from '../types/models.ts'
import { createId } from '../utils/ids.ts'
import { isAiRestRoutesEnabled } from './aiBackendFlags.ts'

/**
 * AI routing:
 * - Intel Review → `supabase.functions.invoke('generate-intel-review')` only (see `generateIntelReviewWithFallback`).
 * - Placeholder REST routes below are **not** deployed in this MVP; they only run when `VITE_AI_REST_ROUTES_ENABLED=true`.
 */
export const AI_BACKEND_ENDPOINTS = {
  generateIntelReview: 'generate-intel-review',
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
  brand?: DeckBrandGenerationContext
  companyKnowledgeItems?: CompanyKnowledgeItem[]
  workspaceFileAssets?: FileAsset[]
}

export interface GenerateIntelReviewRequest {
  setup: DeckSetup
  fileAssets: FileAsset[]
  sourceTraces?: SourceTrace[]
  webResearchEnabled?: boolean
  companyKnowledgeItems?: CompanyKnowledgeItem[]
  /** When set, Edge filters brain rows (mirrors client selection). Omit or empty = use all `companyKnowledgeItems`. */
  selectedCompanyKnowledgeItemIds?: string[]
  /** Workspace library files for resolving `CompanyKnowledgeItem.fileAssetId` → real `SourceTrace` rows. */
  workspaceFileAssets?: FileAsset[]
}

export interface GenerateIntelReviewResponse {
  intel: DeckIntel
  warnings: string[]
  companyBrainSourcesUsed: CompanyBrainSourceUsed[]
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
  intelBriefBrandKit?: CompanyBrandKit
  companyBrainSources?: GeneratedDeckReport['companyBrainSources']
}

export type GenerateReportResponse = GeneratedDeckReport

export interface CreateAlternateVersionRequest {
  deck: Deck
  currentSlides: Slide[]
  fileAssets?: FileAsset[]
  companyBrain?: Pick<
    CompanyBrainWorkspaceSlice,
    'brandKits' | 'activeOrganizationId' | 'organizations'
  >
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
  generateIntelReview: (
    request: GenerateIntelReviewRequest,
  ) => Promise<GenerateIntelReviewResponse>
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
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  const viteFlag = env?.VITE_AI_BACKEND_ENABLED
  if (viteFlag !== undefined) {
    return viteFlag === 'true'
  }

  // Node-based unit tests don't have `import.meta.env` populated by Vite.
  // This keeps `VITE_AI_BACKEND_ENABLED=true` working in test environments.
  const nodeFlag = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.VITE_AI_BACKEND_ENABLED
  return nodeFlag === 'true'
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

async function invokeSupabaseFunction<Response>(
  functionName: string,
  payload: string | File | Blob | ArrayBuffer | FormData | Record<string, unknown>,
): Promise<Response> {
  if (!supabase) {
    throw new Error('Supabase client not configured.')
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  })

  if (error) {
    throw error
  }

  return data as Response
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
  const isPlaceholderRestRoute = endpoint.startsWith('/api/ai')
  if (isPlaceholderRestRoute && !isAiRestRoutesEnabled()) {
    return getFallback()
  }

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

const APPROVAL_STATUS_SET = new Set<KnowledgeApprovalStatus>([
  'approved',
  'needs-review',
  'rejected',
  'archived',
])

const SOURCE_TYPE_SET = new Set<CompanyKnowledgeSourceType>([
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

function normalizeCompanyBrainSourcesUsed(raw: unknown): CompanyBrainSourceUsed[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const out: CompanyBrainSourceUsed[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      continue
    }
    const o = row as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id.trim() : ''
    if (!id) {
      continue
    }
    const title = typeof o.title === 'string' ? o.title : ''
    const st = typeof o.sourceType === 'string' ? o.sourceType : 'other'
    const sourceType = SOURCE_TYPE_SET.has(st as CompanyKnowledgeSourceType)
      ? (st as CompanyKnowledgeSourceType)
      : 'other'
    const ap = typeof o.approvalStatus === 'string' ? o.approvalStatus : 'needs-review'
    const approvalStatus = APPROVAL_STATUS_SET.has(ap as KnowledgeApprovalStatus)
      ? (ap as KnowledgeApprovalStatus)
      : 'needs-review'
    const citationCount =
      typeof o.citationCount === 'number' && Number.isFinite(o.citationCount)
        ? Math.max(0, Math.floor(o.citationCount))
        : 0
    const citationBacked = o.citationBacked === true && citationCount > 0
    const memoryOnly = !citationBacked
    out.push({
      id,
      title,
      sourceType,
      approvalStatus,
      citationBacked,
      citationCount,
      memoryOnly,
    })
  }
  return out
}

function normalizeGenerateIntelReviewResponse(raw: unknown): GenerateIntelReviewResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Intel Review backend returned an invalid payload.')
  }

  const r = raw as Record<string, unknown>
  if (!r.intel || typeof r.intel !== 'object') {
    throw new Error('Intel Review backend response missing intel.')
  }

  const warnings = Array.isArray(r.warnings)
    ? r.warnings.filter((w): w is string => typeof w === 'string')
    : []

  return {
    intel: r.intel as DeckIntel,
    warnings,
    companyBrainSourcesUsed: normalizeCompanyBrainSourcesUsed(r.companyBrainSourcesUsed),
  }
}

async function createMockIngestedFile(request: IngestFileRequest): Promise<FileAsset> {
  const uploadedByRole = request.uploadedByRole ?? 'owner'

  const seed = createMockFileAsset({
    id: createId('file'),
    deckId: request.deckId,
    name: request.file.name,
    kind: inferFileKind(request.file.name),
    status: 'extracting',
    sizeBytes: request.file.size,
    uploadedAt: new Date().toISOString(),
    uploadedByRole,
    uploadedByUserId: request.uploadedByUserId,
    highlightForOwnerReview: uploadedByRole === 'collaborator',
  })

  return finalizeLocalFileAssetIngest(seed, request.file)
}

interface GenerateIntelReviewOptions {
  backendEnabled?: boolean
  invokeBackend?: (
    request: GenerateIntelReviewRequest,
  ) => Promise<GenerateIntelReviewResponse>
}

export async function generateIntelReviewWithFallback(
  request: GenerateIntelReviewRequest,
  options: GenerateIntelReviewOptions = {},
): Promise<GenerateIntelReviewResponse> {
  const backendEnabled = options.backendEnabled ?? isAiBackendEnabled()

  const invokeBackend =
    options.invokeBackend ??
    (async (payload: GenerateIntelReviewRequest) => {
      try {
        const data = await invokeSupabaseFunction<unknown>(
          AI_BACKEND_ENDPOINTS.generateIntelReview,
          payload as unknown as Record<string, unknown>,
        )
        return normalizeGenerateIntelReviewResponse(data)
      } catch (error) {
        warnAndUseMock('Intel Review generation', error)
        throw error
      }
    })

  return generateIntelReviewWithFallbackBase(request, { backendEnabled, invokeBackend })
}

export const aiClient: AiBackendClient = {
  async generateIntelReview(request) {
    return generateIntelReviewWithFallback(request)
  },

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
      'Intel Brief generation',
      AI_BACKEND_ENDPOINTS.generateReport,
      request,
      postJson<GenerateReportResponse>,
      () =>
        generateDeckReport({
          deck: request.deck,
          slides: request.slides,
          fileAssets: request.fileAssets,
          reportType: request.reportType,
          intelBriefBrandKit: request.intelBriefBrandKit,
          ...(request.companyBrainSources !== undefined ? { companyBrainSources: request.companyBrainSources } : {}),
        }),
    )
  },

  async createAlternateVersion(request) {
    return maybeUseBackend(
      'Alternate version generation',
      AI_BACKEND_ENDPOINTS.createAlternateVersion,
      request,
      postJson<CreateAlternateVersionResponse>,
      () => {
        const brand =
          request.companyBrain &&
          resolveBrandGenerationContext(
            request.deck.setup,
            request.companyBrain,
            request.fileAssets ?? [],
          )
        const sourceSlides =
          request.currentSlides.length > 0
            ? request.currentSlides
            : createSlidesFromDeck(request.deck, request.fileAssets ?? [], brand ?? undefined)

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
export type GenerateIntelReviewInput = GenerateIntelReviewRequest
export type ProposeEditorEditInput = ProposeEditorEditRequest
export type IngestFileInput = IngestFileRequest
export type SuggestChartsInput = SuggestChartsRequest
export type GenerateReportInput = GenerateReportRequest
export type CreateAlternateVersionInput = CreateAlternateVersionRequest
export type CreateChartSlideInput = CreateChartSlideRequest
