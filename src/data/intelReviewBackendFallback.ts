import { mergeAssetsForKnowledgeTraceLookup } from './companyBrainDeckPipeline.ts'
import {
  buildCompanyBrainMapContextUsed,
  buildCompanyBrainSourcesUsed,
  collectSourceTracesFromAssets,
  generateIntelDraftFromSources,
} from './intelReview.ts'
import { filterAssetsForCitationUse, resolveCitationReviewMode } from './sourceCitationReview.ts'
import type {
  CompanyBrainMapContextUsed,
  CompanyBrainPolicy,
  CompanyBrainProcess,
  CompanyBrainSkillFile,
  CompanyBrainSourceUsed,
  CompanyKnowledgeItem,
  DeckIntel,
  DeckSetup,
  FileAsset,
  SourceTrace,
} from '../types/models.ts'
import { isAiBackendEnabled } from './aiBackendFlags.ts'

export interface GenerateIntelReviewRequest {
  setup: DeckSetup
  fileAssets: FileAsset[]
  sourceTraces?: SourceTrace[]
  webResearchEnabled?: boolean
  companyKnowledgeItems?: CompanyKnowledgeItem[]
  selectedCompanyKnowledgeItemIds?: string[]
  workspaceFileAssets?: FileAsset[]
  brainProcesses?: CompanyBrainProcess[]
  brainPolicies?: CompanyBrainPolicy[]
  brainSkillFiles?: CompanyBrainSkillFile[]
}

export interface GenerateIntelReviewResponse {
  intel: DeckIntel
  warnings: string[]
  companyBrainSourcesUsed: CompanyBrainSourceUsed[]
  companyBrainMapContextUsed?: CompanyBrainMapContextUsed[]
}

function createLocalIntelReviewResponse(
  request: GenerateIntelReviewRequest,
  warnings: string[] = [],
): GenerateIntelReviewResponse {
  const assetLookup = mergeAssetsForKnowledgeTraceLookup(
    request.fileAssets,
    request.workspaceFileAssets ?? [],
  )
  const brainItems = request.companyKnowledgeItems ?? []
  const selectedRaw = request.selectedCompanyKnowledgeItemIds
  const selectedIds =
    selectedRaw && selectedRaw.length > 0 ? selectedRaw : brainItems.map((item) => item.id)
  const companyBrainMapContextUsed = buildCompanyBrainMapContextUsed(
    selectedIds,
    brainItems,
    assetLookup,
    request.brainProcesses ?? [],
    request.brainPolicies ?? [],
    request.brainSkillFiles ?? [],
  )
  return {
    intel: generateIntelDraftFromSources(request.setup, request.fileAssets, {
      companyKnowledgeItems: brainItems,
    }),
    warnings,
    companyBrainSourcesUsed: buildCompanyBrainSourcesUsed(brainItems, assetLookup),
    ...(companyBrainMapContextUsed.length > 0 ? { companyBrainMapContextUsed } : {}),
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
  const citationReviewMode = resolveCitationReviewMode(request.setup)
  const preparedRequest: GenerateIntelReviewRequest = {
    ...request,
    fileAssets: filterAssetsForCitationUse(request.fileAssets, citationReviewMode),
    sourceTraces:
      request.sourceTraces ??
      collectSourceTracesFromAssets(
        filterAssetsForCitationUse(request.fileAssets, citationReviewMode),
      ),
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

