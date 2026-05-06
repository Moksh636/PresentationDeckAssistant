import assert from 'node:assert/strict'
import { generateDeckReport } from '../src/data/reportGenerator.ts'
import { OWNER_USER_ID } from '../src/data/sourceIngestion.ts'
import type { Deck, FileAsset, Slide } from '../src/types/models.ts'

const baseDeck: Deck = {
  id: 'deck-rpt',
  projectId: 'proj-rpt',
  title: 'Source fidelity deck',
  status: 'draft',
  updatedAt: '2026-05-06',
  slideIds: ['s1'],
  fileAssetIds: ['f1'],
  setup: {
    goal: 'Win the opportunity',
    audience: 'VP Sales',
    tone: 'Confident',
    presentationType: 'Pitch deck',
    requiredSections: ['Executive summary'],
    notes: '',
    webResearch: false,
    usePreviousDeckContext: false,
    shareSetupInputs: false,
    citationReviewMode: 'strict-approved-only',
  },
  collaboration: {
    isShared: false,
    access: 'comment-only',
    allowCollaboratorUploads: false,
  },
}

const traces = {
  upload: {
    fileId: 'f1',
    fileName: 'customer-proof.pdf',
    sourceType: 'uploaded-file' as const,
    confidence: 0.93,
    extractedSnippet: '42% faster close cycle after onboarding update.',
    addedByUserId: OWNER_USER_ID,
  },
  pitchInput: {
    fileId: 'brief-goal',
    fileName: 'Presentation goal',
    sourceType: 'deck-input' as const,
    confidence: 0.97,
    extractedSnippet: 'Emphasize speed to value for enterprise buyers.',
    addedByUserId: OWNER_USER_ID,
  },
}

const slides: Slide[] = [
  {
    id: 's1',
    deckId: 'deck-rpt',
    index: 1,
    title: 'Executive summary',
    notes: 'Base note',
    sourceTrace: [traces.upload, traces.pitchInput],
    blocks: [],
  },
]

const fileAssets: FileAsset[] = [
  {
    id: 'f1',
    deckId: 'deck-rpt',
    name: 'customer-proof.pdf',
    kind: 'pdf',
    status: 'parsed',
    uploadedByUserId: OWNER_USER_ID,
    uploadedByRole: 'owner',
    highlightForOwnerReview: false,
    sizeBytes: 1000,
    sizeLabel: '1 KB',
    summary: 'Customer proof',
    uploadedAt: '2026-05-06',
    extractedTextPreview: 'proof',
    extractedMetadata: {},
    possibleAudience: '',
    possibleGoal: '',
    possibleSections: [],
    possibleTone: '',
    sourceTrace: [traces.upload],
  },
]

const report = generateDeckReport({
  deck: baseDeck,
  slides,
  fileAssets,
  reportType: 'concise',
  companyBrainSources: [
    {
      title: 'Acme renewal notes',
      sourceType: 'notes',
      approvalStatus: 'approved',
      visibilityLabel: 'Organization-wide',
      backing: 'citation-backed',
      citationCount: 2,
    },
    {
      title: 'Leadership talking points',
      sourceType: 'other',
      approvalStatus: 'needs-review',
      visibilityLabel: 'Organization-wide',
      backing: 'memory-only',
    },
  ],
})

assert.equal(report.citationReviewMode, 'strict-approved-only')
assert.equal(report.bibliography.citationBackedUploads.length, 1)
assert.equal(report.bibliography.userPitchInputs.length, 1)
assert.equal(report.bibliography.companyKnowledge.length, 1)
assert.equal(report.bibliography.memoryOnlyCompanyKnowledge.length, 1)
assert.ok(
  report.plainText.includes('Company knowledge, not citation-backed.'),
  'memory-only label must be explicit and non-fabricated',
)

console.info('reportGeneratorBibliography OK')
