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
    sourceReview: {
      status: 'approved',
    },
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
      approvalStatus: 'approved',
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

// Strict-approved-only mode must exclude non-approved uploads from citations/bibliography.
const strictDeck = {
  ...baseDeck,
  id: 'deck-strict',
  fileAssetIds: ['fa', 'fb', 'fc'],
}

const strictSlides: Slide[] = [
  {
    id: 's1-strict',
    deckId: 'deck-strict',
    index: 1,
    title: 'Exec summary',
    notes: '',
    sourceTrace: [],
    blocks: [],
  },
]

const strictFileAssets: FileAsset[] = [
  {
    id: 'fa',
    deckId: 'deck-strict',
    name: 'approved.pdf',
    kind: 'pdf',
    status: 'parsed',
    uploadedByUserId: OWNER_USER_ID,
    uploadedByRole: 'owner',
    highlightForOwnerReview: false,
    sizeBytes: 1000,
    sizeLabel: '1 KB',
    summary: 'Approved asset',
    uploadedAt: '2026-05-06',
    extractedTextPreview: 'approved',
    extractedMetadata: {},
    possibleAudience: '',
    possibleGoal: '',
    possibleSections: [],
    possibleTone: '',
    sourceTrace: [
      {
        fileId: 'fa',
        fileName: 'approved.pdf',
        sourceType: 'uploaded-file',
        confidence: 0.9,
        extractedSnippet: 'Approved snippet',
        addedByUserId: OWNER_USER_ID,
      },
    ],
    sourceReview: {
      status: 'approved',
    },
  },
  {
    id: 'fb',
    deckId: 'deck-strict',
    name: 'pending.pdf',
    kind: 'pdf',
    status: 'parsed',
    uploadedByUserId: OWNER_USER_ID,
    uploadedByRole: 'owner',
    highlightForOwnerReview: false,
    sizeBytes: 1000,
    sizeLabel: '1 KB',
    summary: 'Pending asset',
    uploadedAt: '2026-05-06',
    extractedTextPreview: 'pending',
    extractedMetadata: {},
    possibleAudience: '',
    possibleGoal: '',
    possibleSections: [],
    possibleTone: '',
    sourceTrace: [
      {
        fileId: 'fb',
        fileName: 'pending.pdf',
        sourceType: 'uploaded-file',
        confidence: 0.9,
        extractedSnippet: 'Pending snippet',
        addedByUserId: OWNER_USER_ID,
      },
    ],
    sourceReview: {
      status: 'pending',
    },
  },
  {
    id: 'fc',
    deckId: 'deck-strict',
    name: 'excluded.pdf',
    kind: 'pdf',
    status: 'parsed',
    uploadedByUserId: OWNER_USER_ID,
    uploadedByRole: 'owner',
    highlightForOwnerReview: false,
    sizeBytes: 1000,
    sizeLabel: '1 KB',
    summary: 'Excluded asset',
    uploadedAt: '2026-05-06',
    extractedTextPreview: 'excluded',
    extractedMetadata: {},
    possibleAudience: '',
    possibleGoal: '',
    possibleSections: [],
    possibleTone: '',
    sourceTrace: [
      {
        fileId: 'fc',
        fileName: 'excluded.pdf',
        sourceType: 'uploaded-file',
        confidence: 0.9,
        extractedSnippet: 'Excluded snippet',
        addedByUserId: OWNER_USER_ID,
      },
    ],
    sourceReview: {
      status: 'excluded',
    },
  },
]

const strictReport = generateDeckReport({
  deck: strictDeck,
  slides: strictSlides,
  fileAssets: strictFileAssets,
  reportType: 'concise',
  companyBrainSources: [
    {
      title: 'Approved note',
      sourceType: 'notes',
      approvalStatus: 'approved',
      visibilityLabel: 'Organization-wide',
      backing: 'citation-backed',
      citationCount: 1,
    },
    {
      title: 'Needs review case study',
      sourceType: 'case-study',
      approvalStatus: 'needs-review',
      visibilityLabel: 'Organization-wide',
      backing: 'citation-backed',
      citationCount: 3,
    },
  ],
})

assert.equal(strictReport.citationReviewMode, 'strict-approved-only')
assert.ok(
  strictReport.sourceReferences.every((trace) => trace.fileId === 'fa'),
  'Strict mode must only include approved upload traces in sourceReferences.',
)
assert.equal(
  strictReport.bibliography.citationBackedUploads.length,
  1,
  'Only approved uploads should appear in citationBackedUploads.',
)
assert.ok(
  strictReport.bibliography.citationBackedUploads.every((trace) => trace.fileId === 'fa'),
  'Citation-backed uploads must come only from approved assets.',
)
assert.equal(
  strictReport.bibliography.companyKnowledge.length,
  1,
  'Only approved Company Brain entries should appear in companyKnowledge under strict mode.',
)
assert.ok(
  strictReport.bibliography.companyKnowledge.every((row) => row.approvalStatus === 'approved'),
  'companyKnowledge rows must be approval-backed in strict mode.',
)

console.info('reportGeneratorBibliography OK')
