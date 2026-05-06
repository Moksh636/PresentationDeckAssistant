import type { SourceTrace } from '../types/models.ts'

const MAX_INGEST_BYTES = 512 * 1024
const PREVIEW_CHARS = 4000
const MAX_SECTIONS = 24
const MAX_SNIPPET_CHARS = 1200

/** Deterministic snippet id — works in browsers and Node without crypto imports. */
function stableSnippetId(parts: string[]): string {
  let hash = 0x811c_9dc5

  const input = parts.join('\0')

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x0100_0193)
    hash >>>= 0
  }

  const hex32 = hash.toString(16).padStart(8, '0')
  const len = `${input.length.toString(16)}`

  return `src-${hex32}-${len}`
}

export interface ParsedSourceSection {
  id: string
  label: string
  text: string
}

export interface ParsedSourceDocument {
  title: string
  mimeType: string
  textPreview: string
  sections: ParsedSourceSection[]
  detectedSourceType?: string
  warnings: string[]
}

function basenameTitle(name: string) {
  return name.replace(/\.[^/.]+$/, '').trim() || name
}

function extensionOf(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function effectiveMime(file: File) {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type
  }

  const ext = extensionOf(file.name)

  switch (ext) {
    case 'csv':
      return 'text/csv'
    case 'json':
      return 'application/json'
    case 'txt':
    case 'md':
      return 'text/plain'
    case 'pdf':
      return 'application/pdf'
    case 'doc':
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'ppt':
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    default:
      return 'application/octet-stream'
  }
}

function truncateText(value: string, max: number) {
  if (value.length <= max) {
    return value
  }

  return `${value.slice(0, max)}…`
}

async function readFileBytesUpTo(file: File, maxBytes: number): Promise<ArrayBuffer> {
  const capped = Math.min(maxBytes, file.size)
  return file.slice(0, capped).arrayBuffer()
}

function decodeUtf8(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
}

function looksBinarySample(text: string) {
  if (text.includes('\u0000')) {
    return true
  }

  const sample = text.slice(0, 2048)
  let controlCount = 0

  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i)

    if (code < 9 || (code > 13 && code < 32 && code !== 27)) {
      controlCount++

      if (controlCount > 8) {
        return true
      }
    }
  }

  return false
}

function buildParagraphSections(text: string, idPrefix: string): ParsedSourceSection[] {
  const chunks = text
    .split(/\n\s*\n/gu)
    .map((part) => part.trim())
    .filter(Boolean)

  const limited =
    chunks.length > 1
      ? chunks.slice(0, MAX_SECTIONS)
      : truncateText(text, PREVIEW_CHARS)
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, MAX_SECTIONS)

  return limited.map((chunk, index) => ({
    id: `${idPrefix}-${index}`,
    label: `Section ${index + 1}`,
    text: truncateText(chunk, MAX_SNIPPET_CHARS),
  }))
}

function buildCsvSections(text: string): ParsedSourceSection[] {
  const rows = text
    .replace(/\uFEFF/u, '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_SECTIONS)

  return rows.map((row, index) => ({
    id: `csv-row-${index}`,
    label: `Row ${index + 1}`,
    text: truncateText(row, MAX_SNIPPET_CHARS),
  }))
}

function buildJsonSections(text: string, warnings: string[]): ParsedSourceSection[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    warnings.push('JSON parse failed — stored content shown as plain text sections instead.')
    return buildParagraphSections(text, 'json-fallback')
  }

  if (parsed === null || typeof parsed !== 'object') {
    return [
      {
        id: 'json-root',
        label: 'Value',
        text: truncateText(JSON.stringify(parsed, null, 2), MAX_SNIPPET_CHARS),
      },
    ]
  }

  if (Array.isArray(parsed)) {
    const items = parsed.slice(0, MAX_SECTIONS)

    return items.map((item, index) => ({
      id: `json-item-${index}`,
      label: `Item ${index + 1}`,
      text: truncateText(
        typeof item === 'string' ? item : JSON.stringify(item, null, 2),
        MAX_SNIPPET_CHARS,
      ),
    }))
  }

  const entries = Object.entries(parsed as Record<string, unknown>).slice(0, MAX_SECTIONS)

  return entries.map(([key, value], index) => ({
    id: `json-field-${index}`,
    label: key,
    text: truncateText(
      typeof value === 'string'
        ? value
        : JSON.stringify(value as unknown, null, 2),
      MAX_SNIPPET_CHARS,
    ),
  }))
}

function binaryFormatPlaceholder(kind: string, file: File): ParsedSourceDocument {
  const mime = effectiveMime(file)
  const warnings: string[] = [
    `${kind} text extraction is not enabled in this build (no bundled free parser dependency). Showing filename-only placeholder.`,
  ]

  return {
    title: basenameTitle(file.name),
    mimeType: mime,
    textPreview: `No text extracted for "${file.name}" (${kind}). Add a lightweight client parser dependency to unlock previews.`,
    sections: [],
    detectedSourceType: kind,
    warnings,
  }
}

interface ParseTextOptions {
  sourceLabel: string
  sectionStrategy: 'paragraphs' | 'csv' | 'json'
  prependWarnings?: string[]
}

function parseTextContent(
  file: File,
  rawText: string,
  options: ParseTextOptions,
): ParsedSourceDocument {
  const warnings = [...(options.prependWarnings ?? [])]
  const mime = effectiveMime(file)
  let text = rawText.replace(/^\uFEFF/u, '')

  if (looksBinarySample(text)) {
    warnings.push('Decoded content resembles binary data; preview may be garbled.')

    text = truncateText(text, PREVIEW_CHARS)
  }

  const textPreview = truncateText(text, PREVIEW_CHARS)
  let sections: ParsedSourceSection[]

  switch (options.sectionStrategy) {
    case 'csv':
      sections = buildCsvSections(text)
      break

    case 'json':
      sections = buildJsonSections(text, warnings)

      break

    default:
      sections = buildParagraphSections(text, 'txt')

      break
  }

  return {
    title: basenameTitle(file.name),
    mimeType: mime,
    textPreview,
    sections,
    detectedSourceType: options.sourceLabel,
    warnings,
  }
}

/**
 * Parses a user-selected `File` in the browser (or compatible runtime) without AI APIs.
 * Returns structured preview text and citation-oriented sections when the format allows.
 */
export async function parseUploadedSourceFile(file: File): Promise<ParsedSourceDocument> {
  const ext = extensionOf(file.name)
  const mime = effectiveMime(file)

  const isPdfLike = mime === 'application/pdf' || ext === 'pdf'
  const isDocLike =
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'doc' ||
    ext === 'docx'
  const isPptLike =
    mime === 'application/vnd.ms-powerpoint' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    ext === 'ppt' ||
    ext === 'pptx'

  if (isPdfLike) {
    return binaryFormatPlaceholder('pdf', file)
  }

  if (isDocLike) {
    return binaryFormatPlaceholder('docx', file)
  }

  if (isPptLike) {
    return binaryFormatPlaceholder('pptx', file)
  }

  const warnings: string[] = []

  if (file.size > MAX_INGEST_BYTES) {
    warnings.push(
      `File exceeds local preview limit (${MAX_INGEST_BYTES} bytes); only the first chunk is read.`,
    )
  }

  const buffer = await readFileBytesUpTo(file, MAX_INGEST_BYTES)
  const decoded = decodeUtf8(buffer)

  const treatAsCsv = ext === 'csv' || mime === 'text/csv' || mime === 'application/csv'

  const treatAsJson =
    ext === 'json' || mime.includes('json') || (ext === '' && decoded.trimStart().startsWith('{'))

  const sizeWarnings = warnings

  if (treatAsCsv) {
    return parseTextContent(file, decoded, {
      sourceLabel: 'csv',
      sectionStrategy: 'csv',
      prependWarnings: sizeWarnings,
    })
  }

  if (treatAsJson) {
    return parseTextContent(file, decoded, {
      sourceLabel: 'json',
      sectionStrategy: 'json',
      prependWarnings: sizeWarnings,
    })
  }

  return parseTextContent(file, decoded, {
    sourceLabel: 'plaintext',
    sectionStrategy: 'paragraphs',
    prependWarnings: sizeWarnings,
  })
}

const PLACEHOLDER_FORMATS_NO_DEPS = new Set(['pdf', 'docx', 'pptx'])

export function buildCitationSnippetsFromParsed(
  parsed: ParsedSourceDocument,
  fileAssetId: string,
  fileName: string,
  addedByUserId: string,
): SourceTrace[] {
  const isDepStub =
    Boolean(parsed.detectedSourceType && PLACEHOLDER_FORMATS_NO_DEPS.has(parsed.detectedSourceType)) &&
    parsed.sections.length === 0

  if (isDepStub) {
    return []
  }

  const baseConfidence =
    parsed.detectedSourceType === 'json'
      ? 0.92
      : parsed.detectedSourceType === 'csv'
        ? 0.88
        : parsed.detectedSourceType === 'plaintext'
          ? 0.84
          : parsed.sections.length > 0
            ? 0.78
            : 0.55

  if (parsed.sections.length === 0) {
    if (!parsed.textPreview.trim()) {
      return []
    }

    const id = stableSnippetId([fileAssetId, fileName, 'preview-root'])

    return [
      {
        fileId: id,
        fileName,
        sourceType: 'uploaded-file',
        confidence: baseConfidence,
        extractedSnippet: truncateText(parsed.textPreview, MAX_SNIPPET_CHARS),
        addedByUserId,
      },
    ]
  }

  return parsed.sections.map((section) => ({
    fileId: stableSnippetId([fileAssetId, fileName, section.id, section.label]),
    fileName,
    sourceType: 'uploaded-file' as const,
    confidence: baseConfidence,
    extractedSnippet: `${section.label ? `${section.label}: ` : ''}${section.text}`,
    addedByUserId,
  }))
}
