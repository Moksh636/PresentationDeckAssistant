import assert from 'node:assert/strict'
import {
  normalizeDeckPersistedSurface,
  normalizeDeckSetup,
} from '../src/data/deckSetupNormalize.ts'

const legacySetup = {
  goal: 'Grow ACV',
  audience: 'CFO',
  tone: 'Formal',
  presentationType: 'Board update',
  requiredSections: ['Summary'],
  notes: '',
  webResearch: false,
  usePreviousDeckContext: false,
  shareSetupInputs: false,
}

const legacy = normalizeDeckSetup(legacySetup)

assert.equal(legacy.goal, 'Grow ACV')
assert.equal(legacy.audience, 'CFO')
assert.equal(legacy.presentationType, 'Board update')
assert.equal(legacy.targetCompany, undefined)
assert.equal(legacy.intel, undefined)

const rich = normalizeDeckSetup({
  ...legacySetup,
  targetCompany: ' Contoso ',
  meetingGoal: 'Book QBR',
  knownPainPoints: ['Latency', 42, null, 'Cost'] as unknown as string[],
  deckType: 'Account pitch deck',
  brandKitId: 'brand-1',
  approvedMessagingIds: ['m1', '', 'm2'],
  caseStudyIds: ['c1'],
  intel: {
    companySummary: 'Enterprise SaaS',
    inferredPriorities: ['Speed', 1, 'Security'],
    painPoints: 'not-an-array' as unknown as string[],
    citations: [
      { notA: 'trace' },
      'Plain-text citation',
      {
        fileId: 'f1',
        fileName: 'doc.pdf',
        sourceType: 'uploaded-file',
        confidence: 0.7,
        extractedSnippet: 'hello',
        addedByUserId: 'user-owner-1',
      },
    ],
  },
})

assert.equal(rich.targetCompany, ' Contoso ')
assert.equal(rich.meetingGoal, 'Book QBR')
assert.equal(rich.deckType, 'Account pitch deck')
assert.equal(rich.brandKitId, 'brand-1')
assert.deepEqual(rich.knownPainPoints, ['Latency', 'Cost'])
assert.deepEqual(rich.approvedMessagingIds, ['m1', 'm2'])
assert.deepEqual(rich.caseStudyIds, ['c1'])
assert.ok(rich.intel)
assert.equal(rich.intel.companySummary, 'Enterprise SaaS')
assert.deepEqual(rich.intel.inferredPriorities, ['Speed', 'Security'])
assert.equal(rich.intel.painPoints, undefined)
assert.equal(rich.intel.citations?.length, 2)
assert.equal(rich.intel.citations?.[0].extractedSnippet, 'Plain-text citation')
assert.equal(rich.intel.citations?.[1].fileId, 'f1')

const intelOnlyInvalid = normalizeDeckSetup({
  ...legacySetup,
  intel: {
    citations: [{}, 99, null],
    painPoints: ['x'],
  },
})

assert.equal(intelOnlyInvalid.intel?.citations, undefined)
assert.deepEqual(intelOnlyInvalid.intel?.painPoints, ['x'])

const deckSurface = normalizeDeckPersistedSurface({
  setup: legacySetup,
  screenshotAssetIds: ['shot-1', 1, 'shot-2', '', 'shot-3'] as unknown as string[],
})

assert.deepEqual(deckSurface.screenshotAssetIds, ['shot-1', 'shot-2', 'shot-3'])
assert.equal(deckSurface.setup.goal, 'Grow ACV')
