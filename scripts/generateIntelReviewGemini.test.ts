import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildIntelCitationFileIdAllowlist,
  buildIntelReviewResponse,
  sanitizeIntelReviewRequest,
} from '../supabase/functions/_shared/intelReviewShared.ts'
import {
  DEFAULT_GEMINI_INTEL_MODEL,
  generateIntelReviewWithOptionalGemini,
  parseIntelJsonObject,
  shouldAttemptGeminiApi,
} from '../supabase/functions/_shared/geminiIntelReview.ts'
import { validateDeckIntelShapeEdge } from '../supabase/functions/_shared/intelAiResponseValidationEdge.ts'

const dir = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function collectTsFiles(root: string): string[] {
  const acc: string[] = []
  const skip = new Set(['node_modules', 'dist', '.git'])
  const walk = (r: string) => {
    let entries: string[]
    try {
      entries = readdirSync(r)
    } catch {
      return
    }
    for (const name of entries) {
      if (skip.has(name)) {
        continue
      }
      const p = join(r, name)
      let st: ReturnType<typeof statSync>
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        walk(p)
      } else if (/\.(tsx?|jsx?)$/.test(name)) {
        acc.push(p)
      }
    }
  }
  walk(root)
  return acc
}

const minimalSetup = {
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

const sanitizedBase = sanitizeIntelReviewRequest({
  setup: minimalSetup,
  sourceTraces: [
    {
      fileId: 'f-upload',
      fileName: 'a.pdf',
      sourceType: 'uploaded-file',
      confidence: 0.9,
      extractedSnippet: 'fact from upload',
      addedByUserId: 'u1',
    },
  ],
  webResearchEnabled: false,
})

const mockBaseline = buildIntelReviewResponse(sanitizedBase)

assert.equal(shouldAttemptGeminiApi(() => undefined), false)
assert.equal(
  shouldAttemptGeminiApi((k) => (k === 'GEMINI_API_KEY' ? 'secret' : k === 'AI_PROVIDER' ? 'gemini' : undefined)),
  true,
)
assert.equal(
  shouldAttemptGeminiApi((k) =>
    k === 'GEMINI_API_KEY' ? 'secret' : k === 'AI_PROVIDER' ? 'openai' : undefined,
  ),
  false,
)
assert.equal(
  shouldAttemptGeminiApi((k) =>
    k === 'SUPABASE_TEST' ? 'true' : k === 'GEMINI_API_KEY' ? 'secret' : k === 'AI_PROVIDER' ? 'gemini' : undefined,
  ),
  false,
)

const missingKey = await generateIntelReviewWithOptionalGemini(sanitizedBase, {
  envGet: () => undefined,
})
assert.deepEqual(missingKey.intel, mockBaseline.intel)
assert.deepEqual(missingKey.warnings, mockBaseline.warnings)

const httpFail = await generateIntelReviewWithOptionalGemini(sanitizedBase, {
  envGet: (k) => (k === 'GEMINI_API_KEY' ? 'k' : k === 'AI_PROVIDER' ? 'gemini' : undefined),
  fetchFn: async () => new Response('', { status: 503 }),
})
assert.ok(httpFail.warnings.some((w) => /real ai was unavailable/i.test(w)))
assert.deepEqual(httpFail.intel, mockBaseline.intel)

const malformedBody = await generateIntelReviewWithOptionalGemini(sanitizedBase, {
  envGet: (k) => (k === 'GEMINI_API_KEY' ? 'k' : k === 'AI_PROVIDER' ? 'gemini' : undefined),
  fetchFn: async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{{{' }] } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
})
assert.ok(malformedBody.warnings.some((w) => /real ai was unavailable/i.test(w)))
assert.ok(malformedBody.warnings.some((w) => /not valid json/i.test(w)))

const modelIntel = {
  companySummary:
    'Synthetic account summary that is certainly long enough to pass the usable-intel gate without fallback.',
  inferredPriorities: ['Grow revenue'],
  citations: [
    {
      fileId: 'f-upload',
      fileName: 'a.pdf',
      sourceType: 'uploaded-file',
      confidence: 0.88,
      extractedSnippet: 'grounded excerpt text here',
      addedByUserId: 'u1',
    },
    {
      fileId: 'fabricated-never-allowed',
      fileName: 'ghost.pdf',
      sourceType: 'uploaded-file',
      confidence: 1,
      extractedSnippet: 'should be dropped by allowlist',
      addedByUserId: 'u1',
    },
  ],
}

const goodAi = await generateIntelReviewWithOptionalGemini(sanitizedBase, {
  envGet: (k) =>
    k === 'GEMINI_API_KEY'
      ? 'k'
      : k === 'AI_PROVIDER'
        ? 'gemini'
        : k === 'AI_MODEL'
          ? DEFAULT_GEMINI_INTEL_MODEL
          : undefined,
  fetchFn: async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(modelIntel) }] } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
})

assert.equal(goodAi.intel.citations?.length, 1)
assert.equal(goodAi.intel.citations?.[0]?.fileId, 'f-upload')
assert.ok(goodAi.warnings.some((w) => /allowlist|dropped/i.test(w)))
assert.equal(goodAi.intel.companySummary, modelIntel.companySummary)

const reqMemoryOnly = sanitizeIntelReviewRequest({
  setup: minimalSetup,
  sourceTraces: [],
  companyKnowledgeItems: [
    {
      id: 'kb-m',
      title: 'Memory',
      description: 'internal',
      sourceType: 'notes',
      approvalStatus: 'approved',
      tags: [],
    },
  ],
  selectedCompanyKnowledgeItemIds: ['kb-m'],
})
const allowMem = buildIntelCitationFileIdAllowlist(reqMemoryOnly)
const memAttempt = validateDeckIntelShapeEdge(
  {
    citations: [
      {
        fileId: 'memory-only-kb-row',
        fileName: 'x',
        sourceType: 'uploaded-file',
        confidence: 1,
        extractedSnippet: 'should not cite',
        addedByUserId: 'u1',
      },
    ],
  },
  { allowedCitationFileIds: allowMem },
)
assert.deepEqual(memAttempt.intel.citations ?? [], [])
assert.ok(memAttempt.warnings.length > 0)

assert.equal(parseIntelJsonObject('not json'), undefined)
assert.ok(
  typeof parseIntelJsonObject(JSON.stringify({ companySummary: 'x'.repeat(50) })) === 'object',
)

const srcRoot = join(dir, 'src')
for (const file of collectTsFiles(srcRoot)) {
  const text = readFileSync(file, 'utf8')
  assert.ok(
    !text.includes('GEMINI_API_KEY'),
    `Frontend/source must not reference GEMINI_API_KEY (${file})`,
  )
  assert.ok(
    !/VITE_\w*GEMINI|GEMINI_\w*VITE/i.test(text),
    `Frontend must not define VITE_* Gemini vars (${file})`,
  )
  assert.ok(
    !text.includes('generativelanguage.googleapis.com'),
    `Gemini HTTP API must not appear in browser bundle (${file})`,
  )
}

console.log('generateIntelReviewGemini tests passed')
