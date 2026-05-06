import assert from 'node:assert/strict'
import {
  buildCitationSnippetsFromParsed,
  parseUploadedSourceFile,
} from '../src/data/parseUploadedSourceFile.ts'
import {
  createMockFileAsset,
  finalizeLocalFileAssetIngest,
  OWNER_USER_ID,
} from '../src/data/sourceIngestion.ts'

async function testPlainText() {
  const file = new File(['alpha\n\nbeta'], 'note.txt', { type: 'text/plain' })
  const parsed = await parseUploadedSourceFile(file)

  assert.equal(parsed.detectedSourceType, 'plaintext')
  assert.ok(parsed.textPreview.includes('alpha'))
  assert.ok(parsed.sections.length >= 1)

  const traces = buildCitationSnippetsFromParsed(parsed, 'asset-1', file.name, OWNER_USER_ID)

  assert.ok(traces.length >= 1)
  assert.equal(traces[0]?.sourceType, 'uploaded-file')
  assert.ok(traces[0]?.fileId.startsWith('src-'))
}

async function testCsv() {
  const csv = 'name,qty\nfoo,1\nbar,2\n'
  const file = new File([csv], 'rows.csv', { type: 'text/csv' })
  const parsed = await parseUploadedSourceFile(file)

  assert.equal(parsed.detectedSourceType, 'csv')
  assert.ok(parsed.sections.some((s) => s.text.includes('foo')))

  const traces = buildCitationSnippetsFromParsed(parsed, 'asset-csv', file.name, OWNER_USER_ID)

  assert.ok(traces.length >= 2)
}

async function testJson() {
  const file = new File([JSON.stringify({ title: 'Hi', nested: { a: 1 } })], 'data.json', {
    type: 'application/json',
  })
  const parsed = await parseUploadedSourceFile(file)

  assert.equal(parsed.detectedSourceType, 'json')
  assert.ok(parsed.sections.some((s) => s.label === 'title'))
  assert.equal(buildCitationSnippetsFromParsed(parsed, 'j1', file.name, OWNER_USER_ID).length >= 2, true)
}

async function testJsonInvalidFallsBackToParagraphs() {
  const junk = '{"broken": '
  const file = new File([junk], 'bad.json', { type: 'application/json' })
  const parsed = await parseUploadedSourceFile(file)

  assert.ok(parsed.warnings.some((w) => /JSON parse failed/u.test(w)))
  assert.ok(parsed.sections.length >= 1)
}

async function testPdfPlaceholderNoCitations() {
  const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'paper.pdf', {
    type: 'application/pdf',
  })
  const parsed = await parseUploadedSourceFile(file)

  assert.equal(parsed.detectedSourceType, 'pdf')
  assert.ok(parsed.warnings.some((w) => /failed/u.test(w)))
  assert.deepEqual(parsed.sections, [])
  assert.deepEqual(buildCitationSnippetsFromParsed(parsed, 'p1', file.name, OWNER_USER_ID), [])
}

async function testDocxFallbackNoCitationsOnInvalidData() {
  const file = new File([new Uint8Array([0x50, 0x4b, 0x03])], 'brief.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  const parsed = await parseUploadedSourceFile(file)

  assert.equal(parsed.detectedSourceType, 'docx')
  assert.ok(parsed.warnings.some((w) => /failed/u.test(w)))
  assert.deepEqual(parsed.sections, [])
  assert.deepEqual(buildCitationSnippetsFromParsed(parsed, 'd1', file.name, OWNER_USER_ID), [])
}

async function testFinalizeFallbackKeepsMockTracesWhenReaderFails() {
  const unreadableFile = new File(['should-not-read'], 'blocked.txt', { type: 'text/plain' })

  Object.defineProperty(unreadableFile, 'slice', {
    value() {
      throw new Error('slice blocked')
    },
    configurable: true,
  })

  const base = createMockFileAsset({
    id: 'file-read-fail',
    deckId: 'd1',
    name: unreadableFile.name,
    kind: 'doc',
    sizeBytes: unreadableFile.size,
    uploadedAt: new Date().toISOString(),
  })

  const priorTraceId = base.sourceTrace[0]?.fileId
  const out = await finalizeLocalFileAssetIngest(base, unreadableFile)

  assert.equal(out.status, 'parsed')
  assert.equal(out.extractedTextPreview, base.extractedTextPreview)
  assert.equal(out.sourceTrace[0]?.fileId, priorTraceId)
}

void testPlainText()
  .then(() => testCsv())
  .then(() => testJson())
  .then(() => testJsonInvalidFallsBackToParagraphs())
  .then(() => testPdfPlaceholderNoCitations())
  .then(() => testDocxFallbackNoCitationsOnInvalidData())
  .then(() => testFinalizeFallbackKeepsMockTracesWhenReaderFails())
  .then(() => console.log('parseUploadedSourceFile tests passed'))
  .catch((error) => {
    console.error(error)

    throw error
  })
