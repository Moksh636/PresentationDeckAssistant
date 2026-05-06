import type { CompanyKnowledgeItem, CompanyKnowledgeSourceType } from '../types/models'

export interface SuggestedFolderPlan {
  /** Stable key so UI can merge duplicates before creating folders. */
  key: string
  name: string
  parentFolderId?: string
  description?: string
}

export interface KnowledgeItemFolderSuggestion {
  itemId: string
  /** Matches `SuggestedFolderPlan.key` — item should live under the folder once created. */
  suggestedFolderKey: string
  rationale: string
}

export interface CompanyKnowledgeOrganizationPlan {
  folders: SuggestedFolderPlan[]
  items: KnowledgeItemFolderSuggestion[]
}

const SOURCE_BUCKET: Record<
  CompanyKnowledgeSourceType,
  { key: string; name: string; rationale: string }
> = {
  contract: {
    key: 'legal-contracts',
    name: 'Legal & contracts',
    rationale: 'Contracts and agreements typically belong under legal governance.',
  },
  deck: {
    key: 'sales-collateral',
    name: 'Sales collateral',
    rationale: 'Pitch decks are filed alongside outbound sales assets.',
  },
  proposal: {
    key: 'sales-collateral',
    name: 'Sales collateral',
    rationale: 'Proposals belong with revenue-facing collateral.',
  },
  notes: {
    key: 'notes-capture',
    name: 'Notes & capture',
    rationale: 'Free-form notes stay grouped for fast retrieval.',
  },
  'case-study': {
    key: 'marketing-proof',
    name: 'Marketing proof',
    rationale: 'Case studies reinforce positioning—keep them with proof assets.',
  },
  'product-doc': {
    key: 'product-knowledge',
    name: 'Product knowledge',
    rationale: 'Product sheets belong with roadmap and offering context.',
  },
  policy: {
    key: 'policies',
    name: 'Policies & guardrails',
    rationale: 'Policies should be easy for Ops & Legal to audit.',
  },
  transcript: {
    key: 'notes-capture',
    name: 'Notes & capture',
    rationale: 'Transcripts pair with working notes until summarized elsewhere.',
  },
  other: {
    key: 'general-reference',
    name: 'General reference',
    rationale: 'Catch-all until an owner re-files with a sharper label.',
  },
}

function titleHints(title: string): string | undefined {
  const t = title.toLowerCase()
  if (/\bpricing\b|\brate\s*card\b|\bcpq\b/.test(t)) {
    return 'pricing-playbooks'
  }
  if (/\bsecurity\b|\bsoc\b|\bcompliance\b|\bgdpr\b/.test(t)) {
    return 'trust-security'
  }
  if (/\bbrand\b|\bmessaging\b|\bpositioning\b/.test(t)) {
    return 'brand-messaging'
  }
  return undefined
}

const EXTRA_FOLDERS: Record<string, SuggestedFolderPlan> = {
  'pricing-playbooks': {
    key: 'pricing-playbooks',
    name: 'Pricing & packaging',
    description: 'Guardrails for quotes, CPQ screenshots, and discount policy.',
  },
  'trust-security': {
    key: 'trust-security',
    name: 'Trust & security',
    description: 'Compliance artifacts, security reviews, and assurance docs.',
  },
  'brand-messaging': {
    key: 'brand-messaging',
    name: 'Brand & messaging',
    description: 'Voice guidelines and narrative snippets.',
  },
}

/**
 * Deterministic, offline “AI organization” planner — maps knowledge items to suggested folders using
 * source type + light keyword cues. No external APIs.
 */
export function suggestCompanyKnowledgeOrganization(items: CompanyKnowledgeItem[]): CompanyKnowledgeOrganizationPlan {
  const folderMap = new Map<string, SuggestedFolderPlan>()
  const itemSuggestions: KnowledgeItemFolderSuggestion[] = []

  for (const item of items) {
    const bucket = SOURCE_BUCKET[item.sourceType] ?? SOURCE_BUCKET.other
    let folderKey = bucket.key

    const hint = titleHints(item.title)
    if (hint && EXTRA_FOLDERS[hint]) {
      folderKey = hint
    }

    if (!folderMap.has(folderKey)) {
      const extra = EXTRA_FOLDERS[folderKey]
      if (extra) {
        folderMap.set(folderKey, extra)
      } else {
        folderMap.set(folderKey, {
          key: folderKey,
          name: bucket.name,
          description: `Suggested from ${item.sourceType} items.`,
        })
      }
    }

    itemSuggestions.push({
      itemId: item.id,
      suggestedFolderKey: folderKey,
      rationale:
        folderKey === bucket.key
          ? bucket.rationale
          : `Title cues (${item.title.slice(0, 48)}…) suggest this bucket.`,
    })
  }

  return {
    folders: [...folderMap.values()],
    items: itemSuggestions,
  }
}
