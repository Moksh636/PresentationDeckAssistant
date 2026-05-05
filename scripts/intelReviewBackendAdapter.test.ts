import assert from 'node:assert/strict'
import {
  buildIntelReviewResponse,
  sanitizeIntelReviewRequest,
  sanitizeSourceTraces,
} from '../supabase/functions/_shared/intelReviewShared.ts'

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

const response = buildIntelReviewResponse({
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
assert.equal(response.intel.citations.length, 1)
assert.equal(response.warnings.length, 1)

console.log('intelReviewBackendAdapter tests passed')
