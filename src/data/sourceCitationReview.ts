import type { FileAsset, SourceTrace } from '../types/models.ts'

/** Permissive mode: include all sources unless explicitly excluded. */
export const SOURCE_CITATION_REVIEW_MODE = 'permissive'

export function snippetReviewKey(trace: SourceTrace): string {
  return `${trace.fileId}::${trace.extractedSnippet}`
}

export function isSourceExcluded(asset: FileAsset): boolean {
  return asset.sourceReview?.status === 'excluded'
}

export function isSourceApproved(asset: FileAsset): boolean {
  return asset.sourceReview?.status === 'approved'
}

export function isSourceIncludedForCitations(asset: FileAsset): boolean {
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

export function filterAssetSourceTraces(asset: FileAsset): SourceTrace[] {
  if (!isSourceIncludedForCitations(asset)) {
    return []
  }
  return asset.sourceTrace.filter((trace) => isSnippetEnabled(asset, trace))
}

export function filterAssetsForCitationUse(assets: FileAsset[]): FileAsset[] {
  return assets.filter((asset) => isSourceIncludedForCitations(asset))
}
