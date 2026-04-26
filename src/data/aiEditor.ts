import type { Deck, Slide, SlideBlock, SourceTrace } from '../types/models'
import { OWNER_USER_ID, createSourceTrace } from './sourceIngestion'

export type AiEditScope = 'slide' | 'deck'
export type AiEditIntent =
  | 'shorten'
  | 'formal'
  | 'persuasive'
  | 'rewrite'
  | 'change-tone'
  | 'revise'

export interface AiEditExample {
  before: string
  after: string
}

export interface AiEditPlan {
  request: string
  scope: AiEditScope
  intent: AiEditIntent
  requestedTone?: string
  summary: string
  affectedSlides: number
  affectedBlocks: number
  updatedSlides: Slide[]
  examples: AiEditExample[]
}

interface BuildMockAiEditPlanArgs {
  deck: Deck
  slides: Slide[]
  scope: AiEditScope
  request: string
  activeSlideId?: string
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function ensureSentence(value: string) {
  const normalized = normalizeWhitespace(value)

  if (!normalized) {
    return normalized
  }

  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1)

  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
}

function clipWords(value: string, maxWords: number) {
  const words = normalizeWhitespace(value).split(' ').filter(Boolean)

  if (words.length <= maxWords) {
    return ensureSentence(words.join(' '))
  }

  return `${words.slice(0, maxWords).join(' ')}...`
}

function replaceCommonPhrases(value: string, replacements: Array<[RegExp, string]>) {
  return replacements.reduce(
    (currentValue, [pattern, replacement]) => currentValue.replace(pattern, replacement),
    value,
  )
}

function detectRequestedTone(request: string) {
  const match = request.match(/tone(?:\s+to|\s+for|\s*:\s*|\s+as)?\s+([a-z][a-z\s-]+)/i)
  return match?.[1]?.trim()
}

function detectIntent(request: string): { intent: AiEditIntent; requestedTone?: string } {
  const lowerRequest = request.toLowerCase()
  const requestedTone = detectRequestedTone(request)

  if (lowerRequest.includes('change tone') || lowerRequest.includes('tone to')) {
    return {
      intent: 'change-tone',
      requestedTone,
    }
  }

  if (lowerRequest.includes('shorten') || lowerRequest.includes('concise')) {
    return { intent: 'shorten' }
  }

  if (lowerRequest.includes('formal')) {
    return { intent: 'formal' }
  }

  if (lowerRequest.includes('persuasive') || lowerRequest.includes('audience-focused')) {
    return { intent: 'persuasive' }
  }

  if (lowerRequest.includes('rewrite') || lowerRequest.includes('redraft')) {
    return { intent: 'rewrite' }
  }

  return {
    intent: 'revise',
    requestedTone,
  }
}

function shortenText(value: string) {
  const withoutFillers = replaceCommonPhrases(value, [
    [/\b(really|very|quite|basically|actually)\b/gi, ''],
    [/\bin order to\b/gi, 'to'],
    [/\bit is important to\b/gi, 'prioritize'],
  ])

  return clipWords(withoutFillers, 16)
}

function formalizeText(value: string) {
  const updated = replaceCommonPhrases(value, [
    [/\bcan't\b/gi, 'cannot'],
    [/\bwon't\b/gi, 'will not'],
    [/\bdon't\b/gi, 'do not'],
    [/\bdoesn't\b/gi, 'does not'],
    [/\bneed to\b/gi, 'should'],
    [/\bbig\b/gi, 'significant'],
    [/\ba lot of\b/gi, 'substantial'],
  ])

  return ensureSentence(updated)
}

function makePersuasive(value: string, audience: string) {
  const normalizedAudience = audience || 'the audience'
  const sentence = ensureSentence(value).replace(/\.$/, '')
  return `For ${normalizedAudience}, ${sentence.toLowerCase()} so the recommendation feels immediate and credible.`
}

function rewriteText(value: string) {
  const normalized = ensureSentence(value).replace(/\.$/, '')
  return `Reframe the point around a clearer outcome: ${normalized.toLowerCase()}.`
}

function applyTone(value: string, requestedTone: string | undefined) {
  const tone = requestedTone?.trim()

  if (!tone) {
    return ensureSentence(value)
  }

  const lowerTone = tone.toLowerCase()

  if (lowerTone.includes('formal') || lowerTone.includes('executive')) {
    return formalizeText(value)
  }

  if (lowerTone.includes('persuasive') || lowerTone.includes('confident')) {
    return `State the point with ${lowerTone} language: ${ensureSentence(value).toLowerCase()}`
  }

  if (lowerTone.includes('concise') || lowerTone.includes('short')) {
    return shortenText(value)
  }

  return `Adjust the wording to feel ${lowerTone}: ${ensureSentence(value).toLowerCase()}`
}

function lightlyReviseText(value: string) {
  return `Refined wording: ${ensureSentence(value).toLowerCase()}`
}

function transformText(
  value: string,
  intent: AiEditIntent,
  audience: string,
  requestedTone?: string,
) {
  switch (intent) {
    case 'shorten':
      return shortenText(value)
    case 'formal':
      return formalizeText(value)
    case 'persuasive':
      return makePersuasive(value, audience)
    case 'rewrite':
      return rewriteText(value)
    case 'change-tone':
      return applyTone(value, requestedTone)
    default:
      return lightlyReviseText(value)
  }
}

function getEditTrace(request: string): SourceTrace {
  return createSourceTrace({
    fileId: `ai-edit:${request.slice(0, 24).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    fileName: 'AI editor',
    sourceType: 'generated-summary',
    confidence: 0.73,
    extractedSnippet: request,
    addedByUserId: OWNER_USER_ID,
  })
}

function dedupeTrace(traces: SourceTrace[]) {
  const seen = new Set<string>()

  return traces.filter((trace) => {
    const key = [
      trace.fileId,
      trace.fileName,
      trace.sourceType,
      trace.extractedSnippet,
      trace.addedByUserId,
    ].join('|')

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function updateBlockContent(
  block: SlideBlock,
  intent: AiEditIntent,
  request: string,
  audience: string,
  requestedTone?: string,
): { nextBlock: SlideBlock; changed: boolean; example?: AiEditExample } {
  const editTrace = getEditTrace(request)

  if (Array.isArray(block.content)) {
    const nextItems = block.content.map((item) =>
      transformText(item, intent, audience, requestedTone),
    )
    const changed = nextItems.some((item, index) => item !== block.content[index])

    return {
      nextBlock: changed
        ? {
            ...block,
            content: nextItems,
            sourceTrace: dedupeTrace([...block.sourceTrace, editTrace]),
          }
        : block,
      changed,
      example: changed
        ? {
            before: block.content[0] ?? '',
            after: nextItems[0] ?? '',
          }
        : undefined,
    }
  }

  const nextText = transformText(block.content, intent, audience, requestedTone)
  const changed = nextText !== block.content

  return {
    nextBlock: changed
      ? {
          ...block,
          content: nextText,
          sourceTrace: dedupeTrace([...block.sourceTrace, editTrace]),
        }
      : block,
    changed,
    example: changed
      ? {
          before: block.content,
          after: nextText,
        }
      : undefined,
  }
}

function isEditableBlock(block: SlideBlock) {
  return typeof block.content === 'string' || Array.isArray(block.content)
}

function getScopeSummary(scope: AiEditScope, slideTitle?: string) {
  return scope === 'slide' ? `current slide${slideTitle ? ` (${slideTitle})` : ''}` : 'whole deck'
}

export function buildMockAiEditPlan({
  deck,
  slides,
  scope,
  request,
  activeSlideId,
}: BuildMockAiEditPlanArgs): AiEditPlan {
  const { intent, requestedTone } = detectIntent(request)
  const targetSlides =
    scope === 'slide'
      ? slides.filter((slide) => slide.id === activeSlideId).slice(0, 1)
      : slides
  const fallbackSlide = scope === 'slide' && targetSlides.length === 0 ? slides.slice(0, 1) : []
  const resolvedSlides = targetSlides.length > 0 ? targetSlides : fallbackSlide
  const audience = deck.setup.audience || 'the audience'
  const examples: AiEditExample[] = []
  let affectedBlocks = 0

  const updatedSlides = resolvedSlides.map((slide) => {
    let slideChanged = false

    const nextBlocks = slide.blocks.map((block) => {
      if (!isEditableBlock(block)) {
        return block
      }

      const result = updateBlockContent(block, intent, request, audience, requestedTone)

      if (result.changed) {
        slideChanged = true
        affectedBlocks += 1

        if (result.example && examples.length < 3) {
          examples.push(result.example)
        }
      }

      return result.nextBlock
    })

    if (!slideChanged) {
      return slide
    }

    return {
      ...slide,
      blocks: nextBlocks,
      sourceTrace: dedupeTrace([...slide.sourceTrace, getEditTrace(request)]),
    }
  })

  const affectedSlides = updatedSlides.filter((slide, index) => slide !== resolvedSlides[index]).length
  const scopeSummary = getScopeSummary(scope, resolvedSlides[0]?.title)
  const intentLabel =
    intent === 'change-tone' && requestedTone
      ? `change tone to ${requestedTone}`
      : intent

  return {
    request,
    scope,
    intent,
    requestedTone,
    summary: `Proposed ${intentLabel} edit for the ${scopeSummary} across ${Math.max(
      affectedBlocks,
      1,
    )} block${Math.max(affectedBlocks, 1) === 1 ? '' : 's'}.`,
    affectedSlides: Math.max(affectedSlides, resolvedSlides.length > 0 ? 1 : 0),
    affectedBlocks: Math.max(affectedBlocks, 1),
    updatedSlides,
    examples,
  }
}
