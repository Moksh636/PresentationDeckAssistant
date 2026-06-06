import type { DeckIntel, DeckSetup, FileAsset } from '../types/models.ts'
import { computeCitationQAStats } from './sourceCitationReview.ts'

export type BuildWorkflowStepId = 'sources' | 'brief' | 'review' | 'generate' | 'edit'

export interface BuildWorkflowStepState {
  id: BuildWorkflowStepId
  label: string
  complete: boolean
}

export interface BuildWorkflowContextInput {
  setup: DeckSetup
  deckAssets: FileAsset[]
  companyKnowledgeSuggestionCount: number
  /** True once slides exist for this deck (generated deck replaces setup deck id — use navigated for edit step). */
  hasGeneratedDeckElsewhere?: boolean
  /** User reached edit route after generation this session (best-effort). */
  userReachedEditor?: boolean
}

function briefLooksComplete(setup: DeckSetup): boolean {
  const target = setup.targetCompany?.trim()
  const offering = setup.offeringSummary?.trim()
  const goal = (setup.meetingGoal ?? setup.goal)?.trim()
  const persona = (setup.buyerPersona ?? setup.audience)?.trim()
  const deckType = (setup.deckType ?? setup.presentationType)?.trim()
  return Boolean(target && offering && goal && persona && deckType)
}

function intelHasMinimumFields(intel: DeckIntel | undefined): boolean {
  if (!intel || Object.keys(intel).length === 0) {
    return false
  }
  const summary = intel.companySummary?.trim()
  const angle = intel.recommendedPitchAngle?.trim()
  const priorities = (intel.inferredPriorities ?? []).some((p) => p.trim())
  const pains = (intel.painPoints ?? []).some((p) => p.trim())
  return Boolean(summary || angle || priorities || pains)
}

/**
 * Derives Build flow steps for UI progress indicators.
 * Rules are heuristic and non-blocking by design.
 */
export function deriveBuildWorkflowSteps(ctx: BuildWorkflowContextInput): BuildWorkflowStepState[] {
  const { setup, deckAssets, companyKnowledgeSuggestionCount } = ctx
  const stats = computeCitationQAStats(deckAssets)
  const hasSources = deckAssets.length > 0
  const briefDone = briefLooksComplete(setup)
  const knowledgeConsidered =
    (setup.selectedCompanyKnowledgeItemIds?.length ?? 0) > 0 || companyKnowledgeSuggestionCount === 0
  const intelReady = intelHasMinimumFields(setup.intel)
  const qaTouched = stats.approved > 0 || stats.excluded > 0 || stats.snippetsEnabled > 0

  const reviewDone = hasSources ? qaTouched || intelReady || stats.files === 0 : intelReady

  const generateDone = ctx.userReachedEditor || ctx.hasGeneratedDeckElsewhere === true

  return [
    { id: 'sources', label: 'Sources', complete: hasSources },
    { id: 'brief', label: 'Brief', complete: briefDone },
    { id: 'review', label: 'Review', complete: Boolean(knowledgeConsidered && reviewDone) },
    { id: 'generate', label: 'Generate', complete: generateDone },
    { id: 'edit', label: 'Edit', complete: ctx.userReachedEditor === true },
  ]
}

export interface ReadyToGenerateCheckItem {
  id: string
  label: string
  ok: boolean
  hint?: string
  /** When true and not ok, UI shows a neutral skip state instead of a blocking gap. */
  optional?: boolean
}

export function buildReadyToGenerateChecklist(ctx: BuildWorkflowContextInput): ReadyToGenerateCheckItem[] {
  const setup = ctx.setup
  const stats = computeCitationQAStats(ctx.deckAssets)
  const intel = setup.intel

  return [
    {
      id: 'sources-or-intel',
      label: 'Required: At least one source file or usable intel',
      ok: ctx.deckAssets.length > 0 || intelHasMinimumFields(intel),
      hint: 'Upload research files or run Intel Review.',
    },
    {
      id: 'brief-target',
      label: 'Required: Target company filled in',
      ok: Boolean(setup.targetCompany?.trim()),
    },
    {
      id: 'brief-offering',
      label: 'Required: Product / service being pitched',
      ok: Boolean(setup.offeringSummary?.trim()),
    },
    {
      id: 'brief-goal',
      label: 'Required: Meeting goal',
      ok: Boolean((setup.meetingGoal ?? setup.goal)?.trim()),
    },
    {
      id: 'brief-persona',
      label: 'Required: Buyer persona / audience',
      ok: Boolean((setup.buyerPersona ?? setup.audience)?.trim()),
    },
    {
      id: 'deck-type',
      label: 'Required: Deck type selected',
      ok: Boolean((setup.deckType ?? setup.presentationType)?.trim()),
    },
    {
      id: 'knowledge',
      label: 'Required: Company knowledge reviewed or intentionally skipped',
      ok:
        (setup.selectedCompanyKnowledgeItemIds?.length ?? 0) > 0 ||
        ctx.companyKnowledgeSuggestionCount === 0,
      hint:
        ctx.companyKnowledgeSuggestionCount > 0
          ? 'Pick suggestions or confirm none apply.'
          : undefined,
    },
    {
      id: 'qa-snippet',
      label: 'Optional: Source QA snippets enabled where you want citations',
      optional: true,
      ok: ctx.deckAssets.length === 0 || stats.snippetsEnabled > 0 || stats.files === 0,
      hint: 'Open Source QA and enable snippets for citation-backed text.',
    },
    {
      id: 'intel',
      label: 'Optional: Intel Review populated or explicitly skipped',
      optional: true,
      ok: intelHasMinimumFields(intel),
      hint: 'Skip Intel Review if your sources and brief already cover the account.',
    },
    {
      id: 'brand',
      label: 'Optional: Brand Kit applied',
      optional: true,
      ok: setup.brandKitId !== undefined && setup.brandKitId.trim() !== '',
      hint: 'Improves colors and logo in generated output.',
    },
  ]
}
