import { normalizeSlideBlock } from './slideLayout.ts'
import type { Slide, SlideBlock, SlideBlockLayout, SlideTextStyle } from '../types/models.ts'
import { createId } from '../utils/ids.ts'

export type SlideLayoutPreset =
  | 'title-slide'
  | 'title-bullets'
  | 'two-column'
  | 'image-text'
  | 'chart-insight'
  | 'closing-next-steps'

export const SLIDE_LAYOUT_PRESETS: Array<{ value: SlideLayoutPreset; label: string }> = [
  { value: 'title-slide', label: 'Title slide' },
  { value: 'title-bullets', label: 'Title + bullets' },
  { value: 'two-column', label: 'Two column' },
  { value: 'image-text', label: 'Image + text' },
  { value: 'chart-insight', label: 'Chart + insight' },
  { value: 'closing-next-steps', label: 'Closing / next steps' },
]

const BASE_TEXT_STYLE: SlideTextStyle = {
  fontFamily: 'Inter',
  fontSizePx: 18,
  bold: false,
  italic: false,
  underline: false,
  alignment: 'left',
  listStyle: 'none',
  lineHeight: 1.18,
  verticalAlign: 'top',
}

function createBlock(
  type: SlideBlock['type'],
  content: SlideBlock['content'],
  layout: SlideBlockLayout,
  textStyle?: Partial<SlideTextStyle>,
): SlideBlock {
  return {
    id: createId(`block-${type}`),
    type,
    content,
    style: {
      align: textStyle?.alignment ?? 'left',
      fontSize: type === 'title' ? 'lg' : 'md',
      bold: textStyle?.bold,
      italic: textStyle?.italic,
    },
    textStyle: {
      ...BASE_TEXT_STYLE,
      ...textStyle,
    },
    visualStyle:
      type === 'shape'
        ? {
            fillColor: '#2457e0',
            borderColor: '#2457e0',
            borderWidthPx: 1,
            opacity: 0.14,
          }
        : undefined,
    layout,
    sourceTrace: [],
  }
}

function createBlocksForPreset(preset: SlideLayoutPreset): SlideBlock[] {
  switch (preset) {
    case 'title-slide':
      return [
        createBlock('eyebrow', 'Presentation', { x: 10, y: 17, width: 34, height: 6, zIndex: 1 }, {
          fontSizePx: 13,
          bold: true,
        }),
        createBlock('title', 'Add presentation title', { x: 10, y: 30, width: 78, height: 18, zIndex: 2 }, {
          fontSizePx: 44,
          bold: true,
        }),
        createBlock('body', 'Add subtitle, date, or presenter', { x: 10, y: 54, width: 58, height: 10, zIndex: 3 }, {
          fontSizePx: 20,
        }),
      ]
    case 'two-column':
      return [
        createBlock('title', 'Two-column comparison', { x: 8, y: 7, width: 84, height: 11, zIndex: 1 }, {
          fontSizePx: 30,
          bold: true,
        }),
        createBlock('bullet-list', ['Left-side point', 'Supporting detail'], { x: 8, y: 26, width: 38, height: 52, zIndex: 2 }, {
          listStyle: 'bullet',
          lineHeight: 1.25,
        }),
        createBlock('bullet-list', ['Right-side point', 'Supporting detail'], { x: 54, y: 26, width: 38, height: 52, zIndex: 3 }, {
          listStyle: 'bullet',
          lineHeight: 1.25,
        }),
      ]
    case 'image-text':
      return [
        createBlock('title', 'Image plus narrative', { x: 8, y: 7, width: 84, height: 11, zIndex: 1 }, {
          fontSizePx: 30,
          bold: true,
        }),
        createBlock('visual-placeholder', 'Image placeholder', { x: 8, y: 25, width: 43, height: 52, zIndex: 2 }, {
          alignment: 'center',
          verticalAlign: 'middle',
        }),
        createBlock('body', 'Explain why the visual matters and what decision it supports.', { x: 57, y: 29, width: 34, height: 42, zIndex: 3 }, {
          fontSizePx: 20,
          lineHeight: 1.3,
        }),
      ]
    case 'chart-insight':
      return [
        createBlock('title', 'Metric trend and implication', { x: 8, y: 7, width: 84, height: 11, zIndex: 1 }, {
          fontSizePx: 30,
          bold: true,
        }),
        createBlock('chart-placeholder', 'Chart placeholder', { x: 8, y: 25, width: 54, height: 48, zIndex: 2 }, {
          alignment: 'center',
          verticalAlign: 'middle',
        }),
        createBlock('body', 'Insight: add the key takeaway and recommended action.', { x: 67, y: 29, width: 24, height: 38, zIndex: 3 }, {
          fontSizePx: 20,
          bold: true,
          lineHeight: 1.26,
        }),
      ]
    case 'closing-next-steps':
      return [
        createBlock('title', 'Next steps', { x: 9, y: 10, width: 80, height: 14, zIndex: 1 }, {
          fontSizePx: 36,
          bold: true,
        }),
        createBlock('bullet-list', ['Decision needed', 'Owner and timeline', 'Follow-up action'], { x: 12, y: 33, width: 72, height: 36, zIndex: 2 }, {
          listStyle: 'bullet',
          fontSizePx: 22,
          lineHeight: 1.35,
        }),
      ]
    default:
      return [
        createBlock('title', 'Slide title', { x: 8, y: 7, width: 84, height: 11, zIndex: 1 }, {
          fontSizePx: 30,
          bold: true,
        }),
        createBlock('bullet-list', ['Key point', 'Supporting point', 'Implication'], { x: 10, y: 25, width: 78, height: 48, zIndex: 2 }, {
          listStyle: 'bullet',
          lineHeight: 1.25,
        }),
      ]
  }
}

export function createSlideFromLayoutPreset(
  deckId: string,
  index: number,
  preset: SlideLayoutPreset,
): Slide {
  const presetLabel = SLIDE_LAYOUT_PRESETS.find((layout) => layout.value === preset)?.label ?? 'Slide'
  const blocks = createBlocksForPreset(preset).map((block, blockIndex) =>
    normalizeSlideBlock(block, blockIndex),
  )

  return {
    id: createId('slide'),
    deckId,
    index,
    title: presetLabel,
    notes: '',
    sourceTrace: [],
    blocks,
  }
}
