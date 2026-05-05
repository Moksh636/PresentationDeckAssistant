import assert from 'node:assert/strict'
import {
  collectSourceTracesFromAssets,
  generateIntelDraftFromSources,
  mergeIntelDraftWithExisting,
} from '../src/data/intelReview.ts'
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

const merged = mergeIntelDraftWithExisting(
  { companySummary: 'Keep me' },
  generateIntelDraftFromSources(minimalSetup(), []),
)
assert.equal(merged.companySummary, 'Keep me')
assert.ok(merged.inferredPriorities && merged.inferredPriorities.length > 0)
