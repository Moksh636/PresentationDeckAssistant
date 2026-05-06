import assert from 'node:assert/strict'
import {
  buildAssetTraceMapFromRawBundles,
  buildIntelReviewResponse,
  sanitizeCompanyKnowledgeItems,
  sanitizeIntelReviewRequest,
  sanitizeSourceTraces,
} from '../supabase/functions/_shared/intelReviewShared.ts'
import {
  type GenerateIntelReviewRequest,
  generateIntelReviewWithFallback,
} from '../src/data/intelReviewBackendFallback.ts'

const minimalSetupPayload = {
  goal: 'Win the deal',
  audience: 'Buyer',
  tone: 'Direct',
  presentationType: 'Pitch',
  requiredSections: [] as string[],
  notes: '',
  webResearch: false,
  usePreviousDeckContext: false,
  shareSetupInputs: false,
}

assert.throws(() => sanitizeIntelReviewRequest({}), /setup is required/i)

const traces = sanitizeSourceTraces([
  {
    fileId: 'f1',
    fileName: 'source.pdf',
    sourceType: 'uploaded-file',
    confidence: 0.9,
    extractedSnippet: 'Revenue expansion initiative',
    addedByUserId: 'u1',
  },
  {
    fileId: 'f1',
    fileName: 'source.pdf',
    sourceType: 'uploaded-file',
    confidence: 0.9,
    extractedSnippet: 'Revenue expansion initiative',
    addedByUserId: 'u1',
  },
  { fileId: '', fileName: 'bad', extractedSnippet: 'x' },
])
assert.equal(traces.length, 1)

const reqMinimal = sanitizeIntelReviewRequest({
  setup: {
    goal: '  Expand ACV ',
    audience: '',
    tone: '',
    presentationType: '',
    requiredSections: [],
    notes: '',
    webResearch: false,
    usePreviousDeckContext: false,
    shareSetupInputs: false,
  },
  sourceTraces: traces,
  webResearchEnabled: true,
})
const response = buildIntelReviewResponse(reqMinimal)
assert.equal(response.intel.citations.length, 1)
assert.equal(response.warnings.length, 1)
assert.equal(response.companyBrainSourcesUsed.length, 0)

const malformedItems = sanitizeCompanyKnowledgeItems([
  null,
  {},
  { id: '', title: 'x' },
  {
    id: 'ok',
    title: 'Keep',
    description: 'desc',
    sourceType: 'notes',
    approvalStatus: 'approved',
    tags: [],
  },
])
assert.equal(malformedItems.length, 1)
assert.equal(malformedItems[0]?.id, 'ok')

const memOnly = buildIntelReviewResponse(
  sanitizeIntelReviewRequest({
    setup: minimalSetupPayload,
    companyKnowledgeItems: [
      {
        id: 'kb1',
        title: 'Internal notes',
        description: 'No file link',
        sourceType: 'notes',
        approvalStatus: 'needs-review',
        tags: ['a'],
      },
    ],
  }),
)
assert.equal(memOnly.companyBrainSourcesUsed.length, 1)
const row0 = memOnly.companyBrainSourcesUsed[0]
assert.equal(row0?.citationBacked, false)
assert.equal(row0?.memoryOnly, true)
assert.equal(row0?.citationCount, 0)

const cited = buildIntelReviewResponse(
  sanitizeIntelReviewRequest({
    setup: minimalSetupPayload,
    workspaceFileAssets: [
      {
        id: 'lib-file-1',
        sourceTrace: [
          {
            fileId: 'lib-file-1',
            fileName: 'Proof.pdf',
            sourceType: 'uploaded-file',
            confidence: 1,
            extractedSnippet: 'Verified margin data',
            addedByUserId: 'u1',
          },
        ],
      },
    ],
    companyKnowledgeItems: [
      {
        id: 'kb2',
        title: 'Case attachment',
        description: 'Linked to library file',
        fileAssetId: 'lib-file-1',
        sourceType: 'case-study',
        approvalStatus: 'approved',
        tags: [],
      },
    ],
  }),
)
const citedRow = cited.companyBrainSourcesUsed[0]
assert.equal(citedRow?.citationBacked, true)
assert.equal(citedRow?.citationCount, 1)
assert.equal(citedRow?.memoryOnly, false)
assert.equal(cited.intel.citations.length >= 1, true)

const filtered = buildIntelReviewResponse(
  sanitizeIntelReviewRequest({
    setup: minimalSetupPayload,
    companyKnowledgeItems: [
      {
        id: 'a',
        title: 'A',
        description: '',
        sourceType: 'notes',
        approvalStatus: 'approved',
        tags: [],
      },
      {
        id: 'b',
        title: 'B',
        description: '',
        sourceType: 'notes',
        approvalStatus: 'approved',
        tags: [],
      },
    ],
    selectedCompanyKnowledgeItemIds: ['b'],
  }),
)
assert.equal(filtered.companyBrainSourcesUsed.length, 1)
assert.equal(filtered.companyBrainSourcesUsed[0]?.id, 'b')

const mapMerge = buildAssetTraceMapFromRawBundles(
  [{ id: 'w1', sourceTrace: traces }],
  [{ id: 'w2', sourceTrace: sanitizeSourceTraces([]) }],
)
assert.equal(mapMerge.get('w1')?.length, 1)
assert.equal(mapMerge.get('w2')?.length, 0)

const mapDeckWins = buildAssetTraceMapFromRawBundles(
  [{ id: 'w1', sourceTrace: traces }],
  [{ id: 'w1', sourceTrace: sanitizeSourceTraces([]) }],
)
assert.equal(mapDeckWins.get('w1')?.length, 0)

const webOnly = buildIntelReviewResponse(
  sanitizeIntelReviewRequest({
    setup: minimalSetupPayload,
    webResearchEnabled: true,
  }),
)
assert.equal(webOnly.warnings.length, 1)
assert.ok(webOnly.warnings[0]?.includes('Web research'))

// --- aiClient fallback behavior (local mock) ---
const baseSetup = {
  goal: 'Close expansion',
  audience: 'VP Ops',
  tone: 'Direct',
  presentationType: 'Sales proposal deck',
  requiredSections: [],
  notes: '',
  webResearch: false,
  usePreviousDeckContext: false,
  shareSetupInputs: false,
  targetCompany: 'Acme Logistics',
  buyerPersona: 'CFO',
  knownPainPoints: ['Fuel variance'],
}

const request: GenerateIntelReviewRequest = { setup: baseSetup, fileAssets: [] }
const previousFlag = process.env.VITE_AI_BACKEND_ENABLED

const invokeBackendThrows = async () => {
  throw new Error('backend unavailable')
}

process.env.VITE_AI_BACKEND_ENABLED = 'false'
const disabled = await generateIntelReviewWithFallback(request, { invokeBackend: invokeBackendThrows })
assert.equal(disabled.warnings.length, 0)
assert.ok(Array.isArray(disabled.companyBrainSourcesUsed))

process.env.VITE_AI_BACKEND_ENABLED = 'true'
const enabledAndMissingSupabase = await generateIntelReviewWithFallback(request, {
  invokeBackend: invokeBackendThrows,
})
assert.equal(enabledAndMissingSupabase.warnings.length, 1)
assert.equal(
  enabledAndMissingSupabase.warnings[0],
  'AI backend unavailable; used local intel draft fallback.',
)
assert.ok(enabledAndMissingSupabase.intel?.companySummary)
assert.ok(Array.isArray(enabledAndMissingSupabase.companyBrainSourcesUsed))

process.env.VITE_AI_BACKEND_ENABLED = previousFlag

console.log('intelReviewBackendAdapter tests passed')
