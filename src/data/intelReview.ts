import { collectSourceTracesForKnowledgeItem } from './companyBrainDeckPipeline.ts'
import type {
  CompanyBrainSourceUsed,
  CompanyKnowledgeItem,
  DeckIntel,
  DeckSetup,
  FileAsset,
  SourceTrace,
} from '../types/models'
import {
  filterAssetSourceTraces,
  isSourceIncludedForCitations,
  snippetLabel,
} from './sourceCitationReview.ts'

function meetingGoalText(setup: DeckSetup): string {
  const m = setup.meetingGoal?.trim()
  if (m) {
    return m
  }

  return setup.goal.trim()
}

function traceDedupeKey(trace: SourceTrace) {
  return [trace.fileId, trace.fileName, trace.extractedSnippet, trace.addedByUserId].join('|')
}

/** Per-item citation honesty for Intel Review responses (local + Edge parity). */
export function buildCompanyBrainSourcesUsed(
  items: CompanyKnowledgeItem[],
  assetsById: Map<string, FileAsset>,
): CompanyBrainSourceUsed[] {
  return items.map((item) => {
    const linked = collectSourceTracesForKnowledgeItem(item, assetsById)
    const citationCount = linked.length
    const citationBacked = citationCount > 0
    return {
      id: item.id,
      title: item.title,
      sourceType: item.sourceType,
      approvalStatus: item.approvalStatus,
      citationBacked,
      citationCount,
      memoryOnly: !citationBacked,
    }
  })
}

/** Collects real `SourceTrace` rows from uploaded assets only (no fabrication). */
export function collectSourceTracesFromAssets(assets: FileAsset[], max = 12): SourceTrace[] {
  const seen = new Set<string>()
  const out: SourceTrace[] = []

  for (const asset of assets) {
    if (!isSourceIncludedForCitations(asset)) {
      continue
    }
    for (const trace of filterAssetSourceTraces(asset)) {
      const normalized = { ...trace, fileName: snippetLabel(asset, trace) }
      const key = traceDedupeKey(normalized)
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      out.push(normalized)
      if (out.length >= max) {
        return out
      }
    }
  }

  return out
}
export interface IntelDraftGenerationOptions {
  /** Company Brain items included for this pitch; only file-linked items can add citations. */
  companyKnowledgeItems?: CompanyKnowledgeItem[]
}

/**
 * Mock/local intel draft from pitch brief + file metadata (no web scrape, no AI).
 * Citations are only populated when real traces exist on assets.
 */
export function generateIntelDraftFromSources(
  setup: DeckSetup,
  assets: FileAsset[],
  options: IntelDraftGenerationOptions = {},
): DeckIntel {
  const company = setup.targetCompany?.trim()
  const buyer = (setup.buyerPersona ?? setup.audience).trim()
  const offering = setup.offeringSummary?.trim()
  const goal = meetingGoalText(setup)
  const pains = (setup.knownPainPoints ?? []).map((p) => p.trim()).filter(Boolean)

  const summaryLines = [
    company ? `Account: ${company}` : undefined,
    buyer ? `Buyer lens: ${buyer}` : undefined,
    offering ? `Offering: ${offering}` : undefined,
    goal ? `Meeting goal: ${goal}` : undefined,
  ].filter(Boolean) as string[]

  const topSummary = assets.find((a) => a.summary?.trim())?.summary?.trim()

  const companySummary =
    summaryLines.length > 0
      ? summaryLines.join('\n')
      : topSummary
        ? `Working note from latest source summary: ${topSummary}`
        : 'Add target company, buyer, offering, and meeting goal in the brief—then generate a draft or type intel manually.'

  const inferredPriorities: string[] = []
  const lowerGoal = goal.toLowerCase()

  if (lowerGoal.includes('renew') || lowerGoal.includes('expansion')) {
    inferredPriorities.push('Quantify renewal risk and expansion upside')
  }

  if (offering) {
    inferredPriorities.push(`Tie ${offering} to measurable outcomes the buyer already tracks`)
  }

  inferredPriorities.push('Confirm economic buyer vs. champion and decision timeline')

  if (inferredPriorities.length < 3) {
    inferredPriorities.push('Land a crisp next step aligned to the desired CTA')
  }

  const painPoints =
    pains.length > 0
      ? [...pains]
      : ['Validate top pains with the buyer—placeholder until discovery confirms wording.']

  const proofPoints: string[] = []
  for (const asset of assets.slice(0, 5)) {
    const snippet =
      asset.possibleGoal?.trim() ||
      asset.extractedTextPreview?.trim() ||
      asset.summary?.trim()
    if (snippet) {
      const clipped = snippet.length > 220 ? `${snippet.slice(0, 220)}…` : snippet
      proofPoints.push(`${asset.name}: ${clipped}`)
    }
  }

  const knowledgeItems = options.companyKnowledgeItems ?? []
  for (const item of knowledgeItems.slice(0, 8)) {
    const excerpt = item.description?.trim() || item.tags.join(', ')
    if (excerpt) {
      const clipped = excerpt.length > 220 ? `${excerpt.slice(0, 220)}…` : excerpt
      proofPoints.push(`[Company Brain] ${item.title}: ${clipped}`)
    } else {
      proofPoints.push(`[Company Brain] ${item.title} (${item.sourceType})`)
    }
  }

  if (proofPoints.length === 0) {
    proofPoints.push('Upload parsed sources to surface proof-ready snippets here.')
  }

  const objections = [
    'Procurement / security review may slow signature timing.',
    'Competitive bake-off or “do nothing” inertia.',
  ]

  const recommendedPitchAngle =
    company && offering
      ? `Position ${offering} as the fastest path for ${company} to make progress on: ${goal || 'their stated initiative'}.`
      : goal
        ? `Anchor the narrative on the meeting goal: ${goal}`
        : 'Open with account-specific context, then align proof to the buyer’s top initiative.'

  const linkedAssetIds = new Set(
    knowledgeItems.map((item) => item.fileAssetId).filter((id): id is string => Boolean(id)),
  )
  const linkedAssets = linkedAssetIds.size > 0 ? assets.filter((a) => linkedAssetIds.has(a.id)) : []

  const tracesFromUploads = collectSourceTracesFromAssets(assets)
  const tracesFromLinkedKnowledge =
    linkedAssets.length > 0 ? collectSourceTracesFromAssets(linkedAssets) : []
  const mergedTraces = [...tracesFromUploads]
  const seenKeys = new Set(tracesFromUploads.map(traceDedupeKey))
  for (const trace of tracesFromLinkedKnowledge) {
    const key = traceDedupeKey(trace)
    if (seenKeys.has(key)) {
      continue
    }
    seenKeys.add(key)
    mergedTraces.push(trace)
  }

  const traces = mergedTraces
  const intel: DeckIntel = {
    companySummary,
    inferredPriorities,
    painPoints,
    proofPoints,
    objections,
    recommendedPitchAngle,
  }

  if (traces.length > 0) {
    intel.citations = traces
  }

  return intel
}

/** Fills only empty intel slots so manual edits are preserved. */
export function mergeIntelDraftWithExisting(existing: DeckIntel | undefined, draft: DeckIntel): DeckIntel {
  const next: DeckIntel = { ...existing }

  if (!(next.companySummary?.trim()) && draft.companySummary?.trim()) {
    next.companySummary = draft.companySummary
  }

  if (!(next.recommendedPitchAngle?.trim()) && draft.recommendedPitchAngle?.trim()) {
    next.recommendedPitchAngle = draft.recommendedPitchAngle
  }

  if (!(next.inferredPriorities?.length) && draft.inferredPriorities?.length) {
    next.inferredPriorities = draft.inferredPriorities
  }

  if (!(next.painPoints?.length) && draft.painPoints?.length) {
    next.painPoints = draft.painPoints
  }

  if (!(next.proofPoints?.length) && draft.proofPoints?.length) {
    next.proofPoints = draft.proofPoints
  }

  if (!(next.objections?.length) && draft.objections?.length) {
    next.objections = draft.objections
  }

  if (!(next.citations?.length) && draft.citations?.length) {
    next.citations = draft.citations
  }

  return next
}
