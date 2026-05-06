import assert from 'node:assert/strict'
import {
  collectSourceTracesFromAssets,
  generateIntelDraftFromSources,
  mergeIntelDraftWithExisting,
} from '../src/data/intelReview.ts'
import { SOURCE_CITATION_REVIEW_MODE } from '../src/data/sourceCitationReview.ts'
import type { DeckSetup, FileAsset } from '../src/types/models.ts'

const minimalSetup = (): DeckSetup => ({
  goal: 'Close expansion',
  audience: 'VP Ops',
  tone: 'Direct',
  presentationType: 'Sales proposal deck',
  requiredSections: [],
  notes: '',
  webResearch: false,
  usePreviousDeckContext: false,
  shareSetupInputs: false,
})

const setupWithAccount: DeckSetup = {
  ...minimalSetup(),
  targetCompany: 'Acme Logistics',
  buyerPersona: 'CFO',
  offeringSummary: 'Fleet analytics suite',
  meetingGoal: 'Secure pilot budget',
  knownPainPoints: ['Fuel variance', 'Manual spreadsheets'],
}
const strictSetupWithAccount: DeckSetup = {
  ...setupWithAccount,
  citationReviewMode: 'strict-approved-only',
}

const draft = generateIntelDraftFromSources(setupWithAccount, [])
assert.ok(draft.companySummary?.includes('Acme Logistics'))
assert.ok(draft.painPoints?.includes('Fuel variance'))
assert.equal(draft.citations, undefined)

const asset: FileAsset = {
  id: 'f1',
  deckId: 'd1',
  name: 'notes.pdf',
  kind: 'pdf',
  status: 'parsed',
  uploadedByUserId: 'u1',
  uploadedByRole: 'owner',
  highlightForOwnerReview: false,
  sizeBytes: 100,
  sizeLabel: '100 B',
  summary: 'Summary text',
  uploadedAt: '2026-01-01',
  extractedTextPreview: 'Preview line',
  extractedMetadata: {},
  possibleAudience: '',
  possibleGoal: 'Reduce cost',
  possibleSections: [],
  possibleTone: '',
  sourceTrace: [
    {
      fileId: 'f1',
      fileName: 'notes.pdf',
      sourceType: 'uploaded-file',
      confidence: 0.8,
      extractedSnippet: 'Snippet A',
      addedByUserId: 'u1',
    },
  ],
}

const withTraces = generateIntelDraftFromSources(setupWithAccount, [asset])
assert.ok(withTraces.citations && withTraces.citations.length === 1)
assert.equal(withTraces.citations?.[0].extractedSnippet, 'Snippet A')

const collected = collectSourceTracesFromAssets([asset, { ...asset, id: 'f2', sourceTrace: asset.sourceTrace }])
assert.equal(collected.length, 1)

const excludedAsset: FileAsset = {
  ...asset,
  id: 'excluded-1',
  sourceReview: { status: 'excluded' },
}
assert.equal(collectSourceTracesFromAssets([excludedAsset]).length, 0)
assert.equal(
  generateIntelDraftFromSources(setupWithAccount, [excludedAsset]).citations,
  undefined,
)

const disabledSnippetAsset: FileAsset = {
  ...asset,
  id: 'disabled-snippet-1',
  sourceReview: {
    status: 'approved',
    snippetReviews: {
      'f1::Snippet A': {
        enabled: false,
      },
    },
  },
}
assert.equal(collectSourceTracesFromAssets([disabledSnippetAsset]).length, 0)

const approvedAsset: FileAsset = {
  ...asset,
  id: 'approved-1',
  sourceReview: { status: 'approved' },
}
assert.equal(collectSourceTracesFromAssets([approvedAsset]).length, 1)
assert.equal(SOURCE_CITATION_REVIEW_MODE, 'permissive')
assert.equal(collectSourceTracesFromAssets([asset], 12, 'strict-approved-only').length, 0)
assert.equal(
  generateIntelDraftFromSources(strictSetupWithAccount, [asset]).citations,
  undefined,
)

const merged = mergeIntelDraftWithExisting(
  { companySummary: 'Keep me' },
  generateIntelDraftFromSources(minimalSetup(), []),
)
assert.equal(merged.companySummary, 'Keep me')
assert.ok(merged.inferredPriorities && merged.inferredPriorities.length > 0)
