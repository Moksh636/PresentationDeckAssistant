import type { DeckSetup, FileAsset } from '../types/models.ts'
import { computeCitationQAStats } from './sourceCitationReview.ts'

export interface PreflightIssue {
  id: string
  severity: 'warning' | 'info'
  message: string
  fixHref?: string
}

export function collectBuildPreflightIssues(
  setup: DeckSetup,
  deckAssets: FileAsset[],
): PreflightIssue[] {
  const issues: PreflightIssue[] = []

  if (!setup.targetCompany?.trim()) {
    issues.push({
      id: 'target-company',
      severity: 'warning',
      message: 'Add a target company so slides stay account-specific.',
      fixHref: '#brief',
    })
  }

  if (!setup.offeringSummary?.trim()) {
    issues.push({
      id: 'offering',
      severity: 'warning',
      message: 'Describe what you are pitching (product or service).',
      fixHref: '#brief',
    })
  }

  if (!(setup.meetingGoal ?? setup.goal)?.trim()) {
    issues.push({
      id: 'goal',
      severity: 'warning',
      message: 'Add a meeting goal so the narrative has an outcome.',
      fixHref: '#brief',
    })
  }

  if (!(setup.buyerPersona ?? setup.audience)?.trim()) {
    issues.push({
      id: 'persona',
      severity: 'warning',
      message: 'Name the buyer persona or stakeholder context.',
      fixHref: '#brief',
    })
  }

  if (!(setup.deckType ?? setup.presentationType)?.trim()) {
    issues.push({
      id: 'deck-type',
      severity: 'warning',
      message: 'Pick a deck type for structural defaults.',
      fixHref: '#brief',
    })
  }

  if (deckAssets.length === 0) {
    issues.push({
      id: 'no-sources',
      severity: 'info',
      message: 'No sources uploaded — generation will lean on pitch brief and Brain selections only.',
      fixHref: '#sources',
    })
  }

  const stats = computeCitationQAStats(deckAssets)
  if (deckAssets.length > 0 && stats.snippetsEnabled === 0) {
    issues.push({
      id: 'no-snippets',
      severity: 'info',
      message: 'No citation snippets enabled yet — citations may be sparse.',
      fixHref: '#qa',
    })
  }

  const intel = setup.intel
  const intelEmpty =
    !intel ||
    (!intel.companySummary?.trim() &&
      !(intel.inferredPriorities ?? []).some(Boolean) &&
      !(intel.painPoints ?? []).some(Boolean))

  if (deckAssets.length > 0 && intelEmpty) {
    issues.push({
      id: 'intel-empty',
      severity: 'info',
      message: 'Intel Review is empty — consider generating intel before deck creation.',
      fixHref: '#intel',
    })
  }

  return issues
}
