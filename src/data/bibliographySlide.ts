import type { Slide, SourceTrace } from '../types/models.ts'

function traceKey(trace: SourceTrace) {
  return [trace.fileId, trace.fileName, trace.sourceType, trace.extractedSnippet.slice(0, 80)].join('|')
}

export function dedupeSourceTraces(traces: SourceTrace[]): SourceTrace[] {
  const seen = new Set<string>()
  return traces.filter((t) => {
    const key = traceKey(t)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Collect citation-like traces from slide-level and block-level metadata without mutating slides.
 */
export function aggregateCitationTracesFromSlides(slides: Slide[]): SourceTrace[] {
  const out: SourceTrace[] = []
  for (const slide of slides) {
    out.push(...slide.sourceTrace)
    for (const block of slide.blocks) {
      out.push(...block.sourceTrace)
    }
  }
  return dedupeSourceTraces(out)
}

export function formatBibliographyLines(traces: SourceTrace[], maxLines = 24): string[] {
  const lines = traces.map((t) => {
    const snippet = t.extractedSnippet.trim().replace(/\s+/g, ' ')
    const short = snippet.length > 120 ? `${snippet.slice(0, 117)}…` : snippet
    return `${t.fileName} · ${t.sourceType}${short ? ` — ${short}` : ''}`
  })
  if (lines.length <= maxLines) {
    return lines
  }
  return [
    ...lines.slice(0, maxLines - 1),
    `…and ${lines.length - (maxLines - 1)} additional reference(s) (trim sources to shorten).`,
  ]
}

export function bibliographySlideHasContent(slides: Slide[]): boolean {
  return aggregateCitationTracesFromSlides(slides).length > 0
}

const BIBLIOGRAPHY_SLIDE_TITLE = 'Sources & references'

export function deckHasBibliographySlide(slides: Slide[]): boolean {
  return slides.some((slide) => slide.title.trim().toLowerCase() === BIBLIOGRAPHY_SLIDE_TITLE.toLowerCase())
}
