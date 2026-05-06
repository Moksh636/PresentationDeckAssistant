import { getActorByUserId, getRoleLabel } from './collaboration'
import type { Slide, SlideBlock, SourceTrace, SourceTraceType } from '../types/models'

export interface SourceTraceItem {
  key: string
  trace: SourceTrace
  relatedBlockId?: string
  relatedBlockLabel?: string
  sourceTypeLabel: string
  addedByLabel: string
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function getSourceTraceKey(trace: SourceTrace) {
  return [
    trace.fileId,
    trace.fileName,
    trace.sourceType,
    trace.extractedSnippet,
    trace.addedByUserId,
  ].join('|')
}

export function getSourceTypeLabel(sourceType: SourceTraceType) {
  const labels: Record<SourceTraceType, string> = {
    'deck-input': 'Pitch setup input',
    'uploaded-file': 'Uploaded source',
    'generated-summary': 'Research summary',
    'previous-deck': 'Prior deck context',
    'web-research': 'Web research',
  }

  return labels[sourceType]
}

function getBlockLabel(block: SlideBlock, index: number) {
  return `${capitalize(block.type.replace(/-/g, ' '))} block ${index + 1}`
}

export function getAddedByLabel(trace: SourceTrace) {
  const actor = getActorByUserId(trace.addedByUserId)

  if (!actor) {
    return trace.addedByUserId
  }

  return `${actor.name} | ${getRoleLabel(actor.role)}`
}

/** Editor chip styling: distinguishes uploaded citations vs pitch setup vs generated summaries. */
export type SlideSourceChipVariant =
  | 'citation'
  | 'generated'
  | 'brief'
  | 'research'
  | 'prior-deck'
  | 'mixed'

export function getSlideBlockSourceChipPresentation(traces: SourceTrace[]): {
  variant: SlideSourceChipVariant
  chipLabel: string
} {
  if (traces.length === 0) {
    return { variant: 'mixed', chipLabel: 'Sources' }
  }

  const types = new Set(traces.map((t) => t.sourceType))

  if (types.has('uploaded-file')) {
    return { variant: 'citation', chipLabel: 'Citation' }
  }

  if (types.has('generated-summary')) {
    return { variant: 'generated', chipLabel: 'AI summary' }
  }

  if (types.size === 1 && types.has('deck-input')) {
    return { variant: 'brief', chipLabel: 'Pitch input' }
  }

  if (types.has('web-research')) {
    return { variant: 'research', chipLabel: 'Research' }
  }

  if (types.has('previous-deck')) {
    return { variant: 'prior-deck', chipLabel: 'Prior deck' }
  }

  return { variant: 'mixed', chipLabel: 'Sources' }
}

function findRelatedBlock(slide: Slide, trace: SourceTrace) {
  const traceKey = getSourceTraceKey(trace)
  const blockIndex = slide.blocks.findIndex((block) =>
    block.sourceTrace.some((candidate) => getSourceTraceKey(candidate) === traceKey),
  )

  if (blockIndex === -1) {
    return undefined
  }

  const block = slide.blocks[blockIndex]

  return {
    id: block.id,
    label: getBlockLabel(block, blockIndex),
  }
}

export function buildSourceTraceItems(slide: Slide, selectedBlockId?: string): SourceTraceItem[] {
  const selectedBlock = slide.blocks.find((block) => block.id === selectedBlockId)
  const traceSource = selectedBlock ? selectedBlock.sourceTrace : slide.sourceTrace
  const seen = new Set<string>()

  return traceSource.flatMap((trace) => {
    const key = getSourceTraceKey(trace)

    if (seen.has(key)) {
      return []
    }

    seen.add(key)
    const relatedBlock = selectedBlock
      ? {
          id: selectedBlock.id,
          label: getBlockLabel(
            selectedBlock,
            slide.blocks.findIndex((block) => block.id === selectedBlock.id),
          ),
        }
      : findRelatedBlock(slide, trace)

    return [
      {
        key,
        trace,
        relatedBlockId: relatedBlock?.id,
        relatedBlockLabel: relatedBlock?.label,
        sourceTypeLabel: getSourceTypeLabel(trace.sourceType),
        addedByLabel: getAddedByLabel(trace),
      },
    ]
  })
}
