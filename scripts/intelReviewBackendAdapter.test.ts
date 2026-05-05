import assert from 'node:assert/strict'
import {
  buildIntelReviewResponse,
  sanitizeIntelReviewRequest,
  sanitizeSourceTraces,
} from '../supabase/functions/_shared/intelReviewShared.ts'
import {
  type GenerateIntelReviewRequest,
  generateIntelReviewWithFallback,
} from '../src/data/intelReviewBackendFallback.ts'

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

// --- aiClient fallback behavior (local mock) ---
// Node tests don't populate `import.meta.env`, so `aiClient` should read the flag from `process.env`
// and still return a validated local intel draft if the backend is enabled but unavailable.
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

process.env.VITE_AI_BACKEND_ENABLED = previousFlag

console.log('intelReviewBackendAdapter tests passed')
