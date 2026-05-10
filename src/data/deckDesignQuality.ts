import type { Deck, Slide, SlideBlock, SlideRole } from '../types/models.ts'

export type DeckDesignQualitySeverity = 'info' | 'warning' | 'error'

export interface DeckDesignQualityFinding {
  slideId?: string
  slideTitle?: string
  severity: DeckDesignQualitySeverity
  code: string
  message: string
}

export interface DeckDesignQualityReport {
  overall: 'pass' | 'warn' | 'fail'
  score: number
  findings: DeckDesignQualityFinding[]
}

const MAX_BULLETS_PER_SLIDE = 8
const MAX_TITLE_CHARS = 120
const MAX_BODY_CHARS_PER_BLOCK = 600
const OVERCROWDING_BLOCK_COUNT = 9

const CTA_ROLES: SlideRole[] = ['next-step', 'closing', 'proposal']
const PROOF_ROLES: SlideRole[] = ['proof', 'case-study']

function totalBulletCount(block: SlideBlock) {
  if (block.type !== 'bullet-list') {
    return 0
  }
  if (Array.isArray(block.content)) {
    return block.content.filter((line) => typeof line === 'string' && line.trim()).length
  }
  return 0
}

function blockTextLength(block: SlideBlock) {
  if (Array.isArray(block.content)) {
    return block.content.reduce((sum, line) => sum + (line?.length ?? 0), 0)
  }
  if (typeof block.content === 'string') {
    return block.content.length
  }
  return 0
}

function uniqueFontFamilies(slides: Slide[]) {
  const fontFamilies = new Set<string>()
  for (const slide of slides) {
    for (const block of slide.blocks) {
      const font = block.textStyle?.fontFamily?.trim()
      if (font) {
        fontFamilies.add(font)
      }
    }
  }
  return fontFamilies
}

function hasCitations(slide: Slide): boolean {
  if (slide.sourceTrace.some((trace) => trace.sourceType === 'uploaded-file' || trace.sourceType === 'company-brain')) {
    return true
  }
  return slide.blocks.some((block) =>
    block.sourceTrace?.some(
      (trace) => trace.sourceType === 'uploaded-file' || trace.sourceType === 'company-brain',
    ),
  )
}

function hasSourceNotes(slide: Slide): boolean {
  return /Sources used|Citation-backed sources|Company knowledge sources|Memory-only sources/i.test(
    slide.notes,
  )
}

/**
 * Local-only quality checker for generated decks.
 * Used by tests and (optionally) by future builder UI to flag obvious issues.
 */
export function scoreGeneratedDeckDesign(
  deck: Deck,
  slides: Slide[],
): DeckDesignQualityReport {
  const findings: DeckDesignQualityFinding[] = []

  if (slides.length === 0) {
    findings.push({
      severity: 'error',
      code: 'empty-deck',
      message: 'Deck has no slides.',
    })
  }

  for (const slide of slides) {
    const titleBlock = slide.blocks.find((block) => block.type === 'title')
    const titleText =
      typeof titleBlock?.content === 'string'
        ? titleBlock.content
        : slide.title

    if (titleText && titleText.length > MAX_TITLE_CHARS) {
      findings.push({
        slideId: slide.id,
        slideTitle: slide.title,
        severity: 'warning',
        code: 'title-too-long',
        message: `Slide title is ${titleText.length} characters (max ${MAX_TITLE_CHARS}).`,
      })
    }

    const bulletCount = slide.blocks.reduce((sum, block) => sum + totalBulletCount(block), 0)

    if (bulletCount > MAX_BULLETS_PER_SLIDE) {
      findings.push({
        slideId: slide.id,
        slideTitle: slide.title,
        severity: 'warning',
        code: 'too-many-bullets',
        message: `Slide has ${bulletCount} bullets (max ${MAX_BULLETS_PER_SLIDE}).`,
      })
    }

    if (slide.blocks.length >= OVERCROWDING_BLOCK_COUNT) {
      findings.push({
        slideId: slide.id,
        slideTitle: slide.title,
        severity: 'warning',
        code: 'overcrowded-slide',
        message: `Slide has ${slide.blocks.length} blocks — consider splitting.`,
      })
    }

    for (const block of slide.blocks) {
      if (
        (block.type === 'body' || block.type === 'quote') &&
        blockTextLength(block) > MAX_BODY_CHARS_PER_BLOCK
      ) {
        findings.push({
          slideId: slide.id,
          slideTitle: slide.title,
          severity: 'warning',
          code: 'body-block-too-long',
          message: `Block ${block.type} on slide "${slide.title}" exceeds ${MAX_BODY_CHARS_PER_BLOCK} characters.`,
        })
      }
    }

    if (hasCitations(slide) && !hasSourceNotes(slide)) {
      findings.push({
        slideId: slide.id,
        slideTitle: slide.title,
        severity: 'info',
        code: 'missing-source-notes',
        message: 'Slide has citation traces but no source notes block in speaker notes.',
      })
    }
  }

  const fontFamilies = uniqueFontFamilies(slides)
  if (fontFamilies.size > 2) {
    findings.push({
      severity: 'warning',
      code: 'too-many-fonts',
      message: `Deck uses ${fontFamilies.size} font families — consider consolidating.`,
    })
  }

  const roles = new Set(slides.map((slide) => slide.designIntent?.role).filter(Boolean))
  if (slides.length > 2) {
    if (!hasAnyRole(roles, CTA_ROLES)) {
      findings.push({
        severity: 'info',
        code: 'missing-cta-slide',
        message: 'Deck does not include a clear CTA / next-step / closing slide.',
      })
    }
    if (!hasAnyRole(roles, PROOF_ROLES)) {
      findings.push({
        severity: 'info',
        code: 'missing-proof-slide',
        message: 'Deck does not include a proof or case-study slide.',
      })
    }
  }

  void deck

  const score = computeScore(findings)
  const overall: DeckDesignQualityReport['overall'] =
    findings.some((finding) => finding.severity === 'error')
      ? 'fail'
      : findings.some((finding) => finding.severity === 'warning')
        ? 'warn'
        : 'pass'

  return {
    overall,
    score,
    findings,
  }
}

function hasAnyRole(roles: Set<SlideRole | undefined>, candidates: SlideRole[]) {
  return candidates.some((role) => roles.has(role))
}

function computeScore(findings: DeckDesignQualityFinding[]) {
  let score = 100
  for (const finding of findings) {
    if (finding.severity === 'error') {
      score -= 30
    } else if (finding.severity === 'warning') {
      score -= 10
    } else {
      score -= 3
    }
  }
  return Math.max(0, Math.min(100, score))
}
