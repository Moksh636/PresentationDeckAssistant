import type { DeckSetup, FileAsset, SourceCitationReviewMode, SourceTrace } from '../types/models.ts'

/** Permissive mode: include all sources unless explicitly excluded. */
export const SOURCE_CITATION_REVIEW_MODE: SourceCitationReviewMode = 'permissive'

export function resolveCitationReviewMode(
  setup: Pick<DeckSetup, 'citationReviewMode'> | undefined,
): SourceCitationReviewMode {
  return setup?.citationReviewMode === 'strict-approved-only'
    ? 'strict-approved-only'
    : SOURCE_CITATION_REVIEW_MODE
}

export function snippetReviewKey(trace: SourceTrace): string {
  return `${trace.fileId}::${trace.extractedSnippet}`
}

export function isSourceExcluded(asset: FileAsset): boolean {
  return asset.sourceReview?.status === 'excluded'
}

export function isSourceApproved(asset: FileAsset): boolean {
  return asset.sourceReview?.status === 'approved'
}

export function isSourceIncludedForCitations(
  asset: FileAsset,
  mode: SourceCitationReviewMode = SOURCE_CITATION_REVIEW_MODE,
): boolean {
  if (mode === 'strict-approved-only') {
    return isSourceApproved(asset)
  }
  if (isSourceExcluded(asset)) {
    return false
  }
  return true
}

export function isSnippetEnabled(asset: FileAsset, trace: SourceTrace): boolean {
  const key = snippetReviewKey(trace)
  return asset.sourceReview?.snippetReviews?.[key]?.enabled !== false
}

export function snippetLabel(asset: FileAsset, trace: SourceTrace): string {
  const key = snippetReviewKey(trace)
  return asset.sourceReview?.snippetReviews?.[key]?.labelOverride?.trim() || trace.fileName
}

export function filterAssetSourceTraces(
  asset: FileAsset,
  mode: SourceCitationReviewMode = SOURCE_CITATION_REVIEW_MODE,
): SourceTrace[] {
  if (!isSourceIncludedForCitations(asset, mode)) {
    return []
  }
  return asset.sourceTrace.filter((trace) => isSnippetEnabled(asset, trace))
}

export function filterAssetsForCitationUse(
  assets: FileAsset[],
  mode: SourceCitationReviewMode = SOURCE_CITATION_REVIEW_MODE,
): FileAsset[] {
  return assets.filter((asset) => isSourceIncludedForCitations(asset, mode))
}

/** Aggregate QA counts for builder UI (matches Source QA panel metrics). */
export function computeCitationQAStats(assets: FileAsset[]) {
  let approved = 0
  let excluded = 0
  let snippetsEnabled = 0

  for (const asset of assets) {
    if (isSourceApproved(asset)) {
      approved++
    }
    if (isSourceExcluded(asset)) {
      excluded++
    }
    for (const trace of asset.sourceTrace) {
      if (isSnippetEnabled(asset, trace)) {
        snippetsEnabled++
      }
    }
  }

  return {
    files: assets.length,
    approved,
    excluded,
    snippetsEnabled,
  }
}
