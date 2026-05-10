import type {
  CompanyBrainPolicy,
  CompanyBrainProcess,
  CompanyBrainSkillFile,
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
  return (assetsById.get(item.fileAssetId)?.sourceTrace ?? []).map((trace) => ({
    ...trace,
    sourceType: 'company-brain',
  }))
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
    const citationCount = collectSourceTracesForKnowledgeItem(item, assetsById).length
    const backed = citationCount > 0

    return {
      title: item.title,
      sourceType: item.sourceType,
      approvalStatus: item.approvalStatus,
      visibilityLabel: formatCompanyKnowledgeVisibilityBrief(item),
      backing: backed ? 'citation-backed' : 'memory-only',
      ...(citationCount > 0 ? { citationCount } : {}),
      relevanceBand: band,
      relevanceScore: score,
    }
  })
}

export function buildDeckReportCompanyBrainEntriesFromItems(
  items: CompanyKnowledgeItem[],
  assetsById: Map<string, FileAsset>,
): DeckReportCompanyBrainEntry[] {
  return items.map((item) => {
    const citationCount = collectSourceTracesForKnowledgeItem(item, assetsById).length
    return {
      title: item.title,
      sourceType: item.sourceType,
      approvalStatus: item.approvalStatus,
      visibilityLabel: formatCompanyKnowledgeVisibilityBrief(item),
      backing: citationCount > 0 ? 'citation-backed' : 'memory-only',
      ...(citationCount > 0 ? { citationCount } : {}),
    }
  })
}

function selectedKnowledgeIdSet(items: CompanyKnowledgeItem[]): Set<string> {
  return new Set(items.map((i) => i.id))
}

function intersectsSelection(relatedIds: string[], selected: Set<string>): boolean {
  return relatedIds.some((id) => selected.has(id))
}

function clipLine(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** Mock deck: approved Brain Map rows scoped to selected knowledge; citations only via linked files. */
export interface BrainMapDeckInfluence {
  structureSectionHints: string[]
  objectionLines: string[]
  pricingValueLines: string[]
  processSpeakerNoteLines: string[]
  linkedKnowledgeTraces: SourceTrace[]
}

export function buildBrainMapDeckInfluence(
  selectedKnowledgeItems: CompanyKnowledgeItem[],
  assetsById: Map<string, FileAsset>,
  brainProcesses: CompanyBrainProcess[],
  brainPolicies: CompanyBrainPolicy[],
  brainSkillFiles: CompanyBrainSkillFile[],
): BrainMapDeckInfluence {
  const selected = selectedKnowledgeIdSet(selectedKnowledgeItems)
  const knowledgeById = new Map(selectedKnowledgeItems.map((item) => [item.id, item]))

  const structureSectionHints: string[] = []
  const objectionLines: string[] = []
  const pricingValueLines: string[] = []
  const processSpeakerNoteLines: string[] = []
  const linkedKnowledgeTraces: SourceTrace[] = []
  const seenTrace = new Set<string>()

  const pushTracesForKnowledgeIds = (ids: string[]) => {
    for (const kid of ids) {
      if (!selected.has(kid)) continue
      const item = knowledgeById.get(kid)
      if (!item) continue
      for (const tr of collectSourceTracesForKnowledgeItem(item, assetsById)) {
        const key = [tr.fileId, tr.fileName, tr.extractedSnippet, tr.addedByUserId].join('|')
        if (seenTrace.has(key)) continue
        seenTrace.add(key)
        linkedKnowledgeTraces.push(tr)
      }
    }
  }

  for (const proc of brainProcesses) {
    if (proc.approvalStatus !== 'approved') continue
    if (!intersectsSelection(proc.relatedKnowledgeItemIds, selected)) continue
    pushTracesForKnowledgeIds(proc.relatedKnowledgeItemIds)
    const stepBrief = proc.steps.slice(0, 4).filter(Boolean).join(' → ')
    const body = stepBrief || proc.description.trim()
    if (body) {
      processSpeakerNoteLines.push(
        `Process “${proc.title}”: ${clipLine(body, 220)}`,
      )
    }
  }

  for (const pol of brainPolicies) {
    if (pol.approvalStatus !== 'approved' || pol.policyType !== 'pricing') continue
    if (!intersectsSelection(pol.relatedKnowledgeItemIds, selected)) continue
    pushTracesForKnowledgeIds(pol.relatedKnowledgeItemIds)
    const ruleBrief = pol.rules.slice(0, 3).filter(Boolean).join('; ')
    const line = [pol.summary.trim(), ruleBrief].filter(Boolean).join(' — ')
    if (line) {
      pricingValueLines.push(`Pricing policy “${pol.title}”: ${clipLine(line, 220)}`)
    }
  }

  for (const skill of brainSkillFiles) {
    if (skill.approvalStatus !== 'approved') continue
    if (!intersectsSelection(skill.relatedKnowledgeItemIds, selected)) continue
    pushTracesForKnowledgeIds(skill.relatedKnowledgeItemIds)

    if (skill.skillType === 'sales-deck') {
      const hint =
        skill.instructions.find((x) => x.trim())?.trim() ||
        skill.outputFormat.trim() ||
        skill.description.trim()
      if (hint) {
        structureSectionHints.push(`Sales deck skill “${skill.title}”: ${clipLine(hint, 180)}`)
      }
    }

    if (skill.skillType === 'objection-handling') {
      for (const line of skill.instructions.slice(0, 4)) {
        const t = line.trim()
        if (t) objectionLines.push(clipLine(t, 200))
      }
      if (skill.description.trim()) {
        objectionLines.push(clipLine(skill.description.trim(), 200))
      }
    }
  }

  return {
    structureSectionHints,
    objectionLines,
    pricingValueLines,
    processSpeakerNoteLines,
    linkedKnowledgeTraces,
  }
}
