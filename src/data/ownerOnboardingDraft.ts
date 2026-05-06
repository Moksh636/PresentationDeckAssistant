import type { KnowledgeOrgPreferenceMode } from '../types/models'

export const OWNER_ONBOARDING_STORAGE_KEY = 'deckspace-owner-onboarding-draft:v1'

export interface OwnerOnboardingDraft {
  companyName: string
  website: string
  ownerDisplayName: string
  /** Short positioning note — optional, session only until Company Brain captures richer fields. */
  tagline?: string
  /** Mock file labels only — File refs stay local to the wizard session. */
  mockDocumentLabels: string[]
  knowledgeOrgPreference: KnowledgeOrgPreferenceMode | ''
}

export function defaultOwnerOnboardingDraft(): OwnerOnboardingDraft {
  return {
    companyName: '',
    website: '',
    ownerDisplayName: '',
    mockDocumentLabels: [],
    knowledgeOrgPreference: '',
  }
}

export function loadOwnerOnboardingDraft(): OwnerOnboardingDraft {
  if (typeof window === 'undefined') {
    return defaultOwnerOnboardingDraft()
  }
  try {
    const raw = window.sessionStorage.getItem(OWNER_ONBOARDING_STORAGE_KEY)
    if (!raw) {
      return defaultOwnerOnboardingDraft()
    }
    const parsed = JSON.parse(raw) as Partial<OwnerOnboardingDraft>
    return {
      ...defaultOwnerOnboardingDraft(),
      ...parsed,
      tagline: typeof parsed.tagline === 'string' ? parsed.tagline : undefined,
      mockDocumentLabels: Array.isArray(parsed.mockDocumentLabels)
        ? parsed.mockDocumentLabels.filter((x): x is string => typeof x === 'string')
        : [],
    }
  } catch {
    return defaultOwnerOnboardingDraft()
  }
}

export function saveOwnerOnboardingDraft(next: OwnerOnboardingDraft) {
  if (typeof window === 'undefined') {
    return
  }
  window.sessionStorage.setItem(OWNER_ONBOARDING_STORAGE_KEY, JSON.stringify(next))
}

export function clearOwnerOnboardingDraft() {
  if (typeof window === 'undefined') {
    return
  }
  window.sessionStorage.removeItem(OWNER_ONBOARDING_STORAGE_KEY)
}
