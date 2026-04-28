import { normalizeBlockTextStyle } from './slideLayout.ts'
import type { SlideBlock, SlideTextStyle } from '../types/models.ts'

export type ParagraphListStyle = NonNullable<SlideTextStyle['listStyle']>
export type ParagraphVerticalAlignment = NonNullable<SlideTextStyle['verticalAlign']>

const MIN_LINE_SPACING = 0.8
const MAX_LINE_SPACING = 2
const DEFAULT_LINE_SPACING = 1.18

function normalizeLines(content: SlideBlock['content']) {
  const rawLines = Array.isArray(content) ? content : content.split('\n')
  const lines = rawLines.map((line) => line.trim()).filter(Boolean)

  return lines.length > 0 ? lines : ['List item']
}

export function getLineSpacingValue(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_LINE_SPACING
  }

  return Math.min(MAX_LINE_SPACING, Math.max(MIN_LINE_SPACING, Math.round(value * 10) / 10))
}

export function getVerticalAlignmentValue(value: unknown): ParagraphVerticalAlignment {
  return value === 'middle' || value === 'bottom' ? value : 'top'
}

export function applyListStyle(
  block: SlideBlock,
  targetStyle: Exclude<ParagraphListStyle, 'none'>,
): { content: SlideBlock['content']; textStyle: SlideTextStyle } {
  const currentTextStyle = normalizeBlockTextStyle(block)
  const isSameListStyle =
    Array.isArray(block.content) && (currentTextStyle.listStyle ?? 'bullet') === targetStyle

  if (isSameListStyle) {
    return {
      content: normalizeLines(block.content).join('\n'),
      textStyle: {
        ...currentTextStyle,
        listStyle: 'none',
      },
    }
  }

  return {
    content: normalizeLines(block.content),
    textStyle: {
      ...currentTextStyle,
      listStyle: targetStyle,
    },
  }
}
