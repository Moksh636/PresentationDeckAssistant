import type {
  CompanyKnowledgeItem,
  DeckReportCompanyBrainEntry,
  FileAsset,
  SourceTrace,
} from '../types/models'
import type { RankedCompanyKnowledgeEntry } from './companyKnowledgeRetrieval.ts'

/** Intel Review / Brief groupings derived from knowledge source types (+ light tag cues). */
export type CompanyBrainIntelBucketId =
  | 'case-studies'
  | 'product-docs'
  | 'proposals-decks'
  | 'contracts-legal'
  | 'notes-transcripts'
  | 'other'

const BUCKET_ORDER: CompanyBrainIntelBucketId[] = [
  'case-studies',
  'product-docs',
  'proposals-decks',
  'contracts-legal',
  'notes-transcripts',
  'other',
]

export const INTEL_REVIEW_COMPANY_BRAIN_BUCKET_ORDER: readonly CompanyBrainIntelBucketId[] = BUCKET_ORDER

export function companyBrainIntelBucketLabel(id: CompanyBrainIntelBucketId): string {
  switch (id) {
    case 'case-studies':
      return 'Case studies'
    case 'product-docs':
      return 'Product docs'
    case 'proposals-decks':
      return 'Proposals & decks'
    case 'contracts-legal':
      return 'Contracts & legal'
    case 'notes-transcripts':
      return 'Notes & transcripts'
    default:
      return 'Other'
  }
}

function tagsHaystack(tags: string[] | undefined): string {
  return (tags ?? []).map((t) => t.toLowerCase()).join(' ')
}

/** Map item → review bucket using `sourceType` first, then tag heuristics for `other`. */
export function resolveCompanyKnowledgeIntelBucket(item: CompanyKnowledgeItem): CompanyBrainIntelBucketId {
  const st = item.sourceType
  if (st === 'case-study') {
    return 'case-studies'
  }
  if (st === 'product-doc') {
    return 'product-docs'
  }
  if (st === 'proposal' || st === 'deck') {
    return 'proposals-decks'
  }
  if (st === 'contract' || st === 'policy') {
    return 'contracts-legal'
  }
  if (st === 'notes' || st === 'transcript') {
    return 'notes-transcripts'
  }

  const tags = tagsHaystack(item.tags)
  if (/\bcase[\s_-]?stud/.test(tags) || tags.includes('customer story')) {
    return 'case-studies'
  }
  if (/\bproduct\b/.test(tags) || /\bdocs?\b/.test(tags) || tags.includes('documentation')) {
    return 'product-docs'
  }
  if (/\bproposal\b|\bpricing\b|\bpitch deck\b|\bdecks?\b/.test(tags)) {
    return 'proposals-decks'
  }
  if (/\blegal\b|\bmsa\b|\bddp\b|\bdpa\b|\bcontract\b|\bcompliance\b|\bpolicy\b/.test(tags)) {
    return 'contracts-legal'
  }
  if (/\bnotes?\b|\btranscript\b|\bmeeting\b|\brecap\b/.test(tags)) {
    return 'notes-transcripts'
  }

  return 'other'
}

export function groupCompanyKnowledgeByIntelBucket(
  items: CompanyKnowledgeItem[],
): Map<CompanyBrainIntelBucketId, CompanyKnowledgeItem[]> {
  const map = new Map<CompanyBrainIntelBucketId, CompanyKnowledgeItem[]>()
  for (const id of BUCKET_ORDER) {
    map.set(id, [])
  }
  for (const item of items) {
    const bucket = resolveCompanyKnowledgeIntelBucket(item)
    map.get(bucket)!.push(item)
  }
  return map
}

export function buildFileAssetsById(assets: FileAsset[]): Map<string, FileAsset> {
  return new Map(assets.map((a) => [a.id, a]))
}

/** Deck assets win on id collision so freshly cloned generation files stay canonical. */
export function mergeAssetsForKnowledgeTraceLookup(
  deckAssets: FileAsset[],
  workspaceAssets: FileAsset[],
): Map<string, FileAsset> {
  const merged = buildFileAssetsById(workspaceAssets)
  for (const asset of deckAssets) {
    merged.set(asset.id, asset)
  }
  return merged
}

export function knowledgeItemHasCitationBackedTraces(
  item: CompanyKnowledgeItem,
  assetsById: Map<string, FileAsset>,
): boolean {
  return collectSourceTracesForKnowledgeItem(item, assetsById).length > 0
}

/** Real traces only — from the linked workspace `FileAsset`, when present. */
export function collectSourceTracesForKnowledgeItem(
  item: CompanyKnowledgeItem,
  assetsById: Map<string, FileAsset>,
): SourceTrace[] {
  if (!item.fileAssetId) {
    return []
  }
  return assetsById.get(item.fileAssetId)?.sourceTrace ?? []
}

export function formatCompanyKnowledgeVisibilityBrief(item: CompanyKnowledgeItem): string {
  switch (item.visibility) {
    case 'company':
      return 'Organization-wide'
    case 'department': {
      const d = item.allowedDepartments?.filter(Boolean).join(', ')
      return d ? `Departments: ${d}` : 'Department-scoped'
    }
    case 'role': {
      const r = item.allowedRoleTitles?.filter(Boolean).join(', ')
      return r ? `Role titles: ${r}` : 'Role-scoped'
    }
    case 'private':
      return 'Private'
    default:
      return String(item.visibility)
  }
}

export type KnowledgeDeckGenerationRole = 'proof' | 'solution' | 'value' | 'legal' | 'context'

export function deckGenerationRoleForKnowledgeItem(item: CompanyKnowledgeItem): KnowledgeDeckGenerationRole {
  const bucket = resolveCompanyKnowledgeIntelBucket(item)
  switch (bucket) {
    case 'case-studies':
      return 'proof'
    case 'product-docs':
      return 'solution'
    case 'proposals-decks':
      return 'value'
    case 'contracts-legal':
      return 'legal'
    default:
      return 'context'
  }
}

export interface KnowledgeDeckInfluencePayload {
  proofLines: string[]
  solutionLines: string[]
  valueLines: string[]
  legalTitles: string[]
  contextLines: string[]
  citedTraces: SourceTrace[]
  memoryOnlyTitles: string[]
}

function clip(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export function buildCompanyKnowledgeDeckInfluence(
  items: CompanyKnowledgeItem[],
  assetsById: Map<string, FileAsset>,
): KnowledgeDeckInfluencePayload {
  const proofLines: string[] = []
  const solutionLines: string[] = []
  const valueLines: string[] = []
  const legalTitles: string[] = []
  const contextLines: string[] = []
  const citedTraces: SourceTrace[] = []
  const memoryOnlyTitles: string[] = []

  const seenTrace = new Set<string>()

  for (const item of items) {
    const excerpt = clip(item.description || item.tags.join(', ') || item.title, 180)
    const role = deckGenerationRoleForKnowledgeItem(item)
    const traces = collectSourceTracesForKnowledgeItem(item, assetsById)
    if (traces.length === 0) {
      memoryOnlyTitles.push(item.title)
    } else {
      for (const tr of traces) {
        const key = [tr.fileId, tr.fileName, tr.extractedSnippet, tr.addedByUserId].join('|')
        if (!seenTrace.has(key)) {
          seenTrace.add(key)
          citedTraces.push(tr)
        }
      }
    }

    const line = `${item.title} — ${excerpt}`

    switch (role) {
      case 'proof':
        proofLines.push(line)
        break
      case 'solution':
        solutionLines.push(line)
        break
      case 'value':
        valueLines.push(line)
        break
      case 'legal':
        legalTitles.push(item.title)
        break
      default:
        contextLines.push(line)
        break
    }
  }

  return {
    proofLines,
    solutionLines,
    valueLines,
    legalTitles,
    contextLines,
    citedTraces,
    memoryOnlyTitles,
  }
}

export function filterRankedKnowledgeBySelection(
  ranked: RankedCompanyKnowledgeEntry[],
  selectedIds: string[],
): RankedCompanyKnowledgeEntry[] {
  if (selectedIds.length === 0) {
    return []
  }
  const wanted = new Set(selectedIds)
  return ranked.filter((entry) => wanted.has(entry.item.id))
}

export function buildDeckReportCompanyBrainEntries(
  rankedSelected: RankedCompanyKnowledgeEntry[],
  assetsById: Map<string, FileAsset>,
): DeckReportCompanyBrainEntry[] {
  return rankedSelected.map((entry) => {
    const { item, band, score } = entry
    const backed = knowledgeItemHasCitationBackedTraces(item, assetsById)

    return {
      title: item.title,
      sourceType: item.sourceType,
      approvalStatus: item.approvalStatus,
      visibilityLabel: formatCompanyKnowledgeVisibilityBrief(item),
      backing: backed ? 'citation-backed' : 'memory-only',
      relevanceBand: band,
      relevanceScore: score,
    }
  })
}

export function buildDeckReportCompanyBrainEntriesFromItems(
  items: CompanyKnowledgeItem[],
  assetsById: Map<string, FileAsset>,
): DeckReportCompanyBrainEntry[] {
  return items.map((item) => ({
    title: item.title,
    sourceType: item.sourceType,
    approvalStatus: item.approvalStatus,
    visibilityLabel: formatCompanyKnowledgeVisibilityBrief(item),
    backing: knowledgeItemHasCitationBackedTraces(item, assetsById) ? 'citation-backed' : 'memory-only',
  }))
}
