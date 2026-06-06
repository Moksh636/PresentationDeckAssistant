import assert from 'node:assert/strict'
import { buildReadyToGenerateChecklist, deriveBuildWorkflowSteps } from '../src/data/buildWorkflowProgress.ts'
import { OWNER_USER_ID } from '../src/data/sourceIngestion.ts'
import type { DeckSetup, FileAsset } from '../src/types/models.ts'

const deckSetup: DeckSetup = {
  goal: 'Pilot',
  audience: 'CFO',
  tone: 'Direct',
  presentationType: 'Account pitch deck',
  requiredSections: [],
  notes: '',
  webResearch: false,
  usePreviousDeckContext: false,
  shareSetupInputs: false,
  citationReviewMode: 'permissive',
  targetCompany: 'Acme',
  offeringSummary: 'Widget',
  meetingGoal: 'Pilot',
  buyerPersona: 'CFO',
  deckType: 'Account pitch deck',
  selectedCompanyKnowledgeItemIds: ['k1'],
  brandKitId: 'brand-1',
  intel: {
    companySummary: 'Summary',
    inferredPriorities: ['Cut spend'],
    painPoints: ['Manual ops'],
  },
}

const deckAsset: FileAsset = {
  id: 'a1',
  deckId: 'd1',
  name: 'x.pdf',
  kind: 'pdf',
  status: 'parsed',
  uploadedByUserId: OWNER_USER_ID,
  uploadedByRole: 'owner',
  highlightForOwnerReview: false,
  sizeBytes: 1,
  sizeLabel: '1b',
  summary: '',
  uploadedAt: '2026-01-01',
  extractedTextPreview: 't',
  extractedMetadata: {},
  possibleAudience: '',
  possibleGoal: '',
  possibleTone: '',
  possibleSections: [],
  sourceTrace: [
    {
      fileId: 'a1',
      fileName: 'x.pdf',
      sourceType: 'uploaded-file',
      confidence: 0.9,
      extractedSnippet: 'hello world',
      addedByUserId: OWNER_USER_ID,
    },
  ],
  parseWarnings: [],
  sourceReview: {
    status: 'approved',
    snippetReviews: {
      'a1::hello world': { enabled: true },
    },
  },
}

const steps = deriveBuildWorkflowSteps({
  setup: deckSetup,
  deckAssets: [deckAsset],
  companyKnowledgeSuggestionCount: 0,
  userReachedEditor: true,
})

assert.equal(steps.find((s) => s.id === 'sources')?.complete, true)
assert.equal(steps.find((s) => s.id === 'brief')?.complete, true)
assert.equal(steps.find((s) => s.id === 'generate')?.complete, true)

const checklist = buildReadyToGenerateChecklist({
  setup: deckSetup,
  deckAssets: [deckAsset],
  companyKnowledgeSuggestionCount: 0,
})

assert.equal(checklist.every((item) => item.ok), true)
