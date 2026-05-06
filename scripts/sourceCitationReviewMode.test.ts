import assert from 'node:assert/strict'
import { normalizeDeckSetup } from '../src/data/deckSetupNormalize.ts'
import { collectSourceTracesFromAssets } from '../src/data/intelReview.ts'
import {
  filterAssetsForCitationUse,
  resolveCitationReviewMode,
} from '../src/data/sourceCitationReview.ts'
import type { FileAsset } from '../src/types/models.ts'

const baseAsset: FileAsset = {
  id: 'asset-1',
  deckId: 'deck-1',
  name: 'source.pdf',
  kind: 'pdf',
  status: 'parsed',
  uploadedByUserId: 'owner-1',
  uploadedByRole: 'owner',
  highlightForOwnerReview: false,
  sizeBytes: 100,
  sizeLabel: '100 B',
  summary: 'summary',
  uploadedAt: '2026-01-01',
  extractedTextPreview: 'preview',
  extractedMetadata: {},
  possibleAudience: '',
  possibleGoal: '',
  possibleSections: [],
  possibleTone: '',
  sourceTrace: [
    {
      fileId: 'asset-1',
      fileName: 'source.pdf',
      sourceType: 'uploaded-file',
      confidence: 0.9,
      extractedSnippet: 'Snippet A',
      addedByUserId: 'owner-1',
    },
  ],
}

const pendingAsset: FileAsset = {
  ...baseAsset,
  id: 'asset-pending',
  sourceReview: { status: 'pending' },
}

const excludedAsset: FileAsset = {
  ...baseAsset,
  id: 'asset-excluded',
  sourceReview: { status: 'excluded' },
}

const approvedAsset: FileAsset = {
  ...baseAsset,
  id: 'asset-approved',
  sourceReview: { status: 'approved' },
}

assert.equal(
  resolveCitationReviewMode(
    normalizeDeckSetup({
      goal: '',
      audience: '',
      tone: '',
      presentationType: 'Pitch',
      requiredSections: [],
      notes: '',
      webResearch: false,
      usePreviousDeckContext: false,
      shareSetupInputs: false,
    }),
  ),
  'permissive',
)

assert.equal(
  resolveCitationReviewMode(
    normalizeDeckSetup({
      goal: '',
      audience: '',
      tone: '',
      presentationType: 'Pitch',
      requiredSections: [],
      notes: '',
      webResearch: false,
      usePreviousDeckContext: false,
      shareSetupInputs: false,
      citationReviewMode: 'strict-approved-only',
    }),
  ),
  'strict-approved-only',
)

assert.deepEqual(
  filterAssetsForCitationUse([pendingAsset, excludedAsset, approvedAsset], 'permissive').map(
    (asset) => asset.id,
  ),
  ['asset-pending', 'asset-approved'],
)

assert.deepEqual(
  filterAssetsForCitationUse([pendingAsset, excludedAsset, approvedAsset], 'strict-approved-only').map(
    (asset) => asset.id,
  ),
  ['asset-approved'],
)

assert.equal(collectSourceTracesFromAssets([pendingAsset], 12, 'strict-approved-only').length, 0)
assert.equal(collectSourceTracesFromAssets([approvedAsset], 12, 'strict-approved-only').length, 1)
