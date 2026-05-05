import { collectSourceTracesFromAssets, generateIntelDraftFromSources } from './intelReview.ts'
import type { DeckIntel, DeckSetup, FileAsset, SourceTrace } from '../types/models.ts'
import { isAiBackendEnabled } from './aiBackendFlags.ts'

export interface GenerateIntelReviewRequest {
  setup: DeckSetup
  fileAssets: FileAsset[]
  sourceTraces?: SourceTrace[]
  webResearchEnabled?: boolean
}

export interface GenerateIntelReviewResponse {
  intel: DeckIntel
  warnings: string[]
}

function createLocalIntelReviewResponse(
  request: GenerateIntelReviewRequest,
  warnings: string[] = [],
): GenerateIntelReviewResponse {
  return {
    intel: generateIntelDraftFromSources(request.setup, request.fileAssets),
    warnings,
  }
}

export interface GenerateIntelReviewWithFallbackOptions {
  backendEnabled?: boolean
  invokeBackend?: (
    request: GenerateIntelReviewRequest,
  ) => Promise<GenerateIntelReviewResponse>
}

export async function generateIntelReviewWithFallback(
  request: GenerateIntelReviewRequest,
  options: GenerateIntelReviewWithFallbackOptions = {},
): Promise<GenerateIntelReviewResponse> {
  const preparedRequest: GenerateIntelReviewRequest = {
    ...request,
    sourceTraces: request.sourceTraces ?? collectSourceTracesFromAssets(request.fileAssets),
    webResearchEnabled: request.webResearchEnabled ?? false,
  }

  const backendEnabled = options.backendEnabled ?? isAiBackendEnabled()
  const invokeBackend =
    options.invokeBackend ??
    (async () => {
      throw new Error('invokeBackend is required when backendEnabled=true')
    })

  if (!backendEnabled) {
    return createLocalIntelReviewResponse(preparedRequest)
  }

  try {
    return await invokeBackend(preparedRequest)
  } catch {
    return createLocalIntelReviewResponse(preparedRequest, [
      'AI backend unavailable; used local intel draft fallback.',
    ])
  }
}

