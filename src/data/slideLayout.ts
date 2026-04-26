import type {
  SlideBlock,
  SlideBlockLayout,
  SlideBlockType,
  SlideBlockVisualStyle,
  SlideTextStyle,
} from '../types/models'
import { createId } from '../utils/ids'

export type ManualBlockKind =
  | 'text-box'
  | 'heading'
  | 'image-placeholder'
  | 'shape'
  | 'chart-placeholder'

const MIN_WIDTH = 8
const MIN_HEIGHT = 6
const MIN_VISIBLE = 5
const DEFAULT_FONT_FAMILY = 'Inter'
const DEFAULT_VISUAL_STYLE: SlideBlockVisualStyle = {
  fillColor: '#2457e0',
  borderColor: '#2457e0',
  borderWidthPx: 1,
  opacity: 0.14,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getDefaultSize(type: SlideBlockType) {
  switch (type) {
    case 'eyebrow':
      return { width: 34, height: 7 }
    case 'title':
      return { width: 78, height: 16 }
    case 'bullet-list':
      return { width: 74, height: 26 }
    case 'stat':
      return { width: 30, height: 16 }
    case 'quote':
      return { width: 68, height: 18 }
    case 'visual-placeholder':
    case 'chart-placeholder':
      return { width: 58, height: 36 }
    case 'shape':
      return { width: 30, height: 20 }
    default:
      return { width: 70, height: 18 }
  }
}

function getFontSizePx(block: SlideBlock) {
  switch (block.style.fontSize) {
    case 'sm':
      return block.type === 'eyebrow' ? 13 : 14
    case 'lg':
      return block.type === 'title' ? 30 : 24
    case 'xl':
      return 48
    default:
      return block.type === 'title' ? 24 : 18
  }
}

export function normalizeBlockTextStyle(block: SlideBlock): SlideTextStyle {
  return {
    fontFamily:
      typeof block.textStyle?.fontFamily === 'string' && block.textStyle.fontFamily.trim()
        ? block.textStyle.fontFamily
        : DEFAULT_FONT_FAMILY,
    fontSizePx:
      typeof block.textStyle?.fontSizePx === 'number'
        ? clamp(block.textStyle.fontSizePx, 8, 160)
        : getFontSizePx(block),
    bold:
      typeof block.textStyle?.bold === 'boolean'
        ? block.textStyle.bold
        : block.style.bold === true,
    italic:
      typeof block.textStyle?.italic === 'boolean'
        ? block.textStyle.italic
        : block.style.italic === true,
    underline: block.textStyle?.underline === true,
    alignment: block.textStyle?.alignment ?? block.style.align,
    color:
      typeof block.textStyle?.color === 'string' && block.textStyle.color.trim()
        ? block.textStyle.color
        : undefined,
  }
}

function getSafeHexColor(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim()
    : fallback
}

export function normalizeBlockVisualStyle(block: SlideBlock): SlideBlockVisualStyle {
  const visualStyle = block.visualStyle

  return {
    fillColor: getSafeHexColor(visualStyle?.fillColor, DEFAULT_VISUAL_STYLE.fillColor),
    borderColor: getSafeHexColor(visualStyle?.borderColor, DEFAULT_VISUAL_STYLE.borderColor),
    borderWidthPx:
      typeof visualStyle?.borderWidthPx === 'number'
        ? clamp(visualStyle.borderWidthPx, 0, 24)
        : DEFAULT_VISUAL_STYLE.borderWidthPx,
    opacity:
      typeof visualStyle?.opacity === 'number'
        ? clamp(visualStyle.opacity, 0, 1)
        : DEFAULT_VISUAL_STYLE.opacity,
  }
}

function getDefaultPosition(type: SlideBlockType, index: number, size: { width: number; height: number }) {
  if (type === 'visual-placeholder' || type === 'chart-placeholder') {
    return { x: 21, y: 28 }
  }

  if (type === 'stat') {
    return { x: 8, y: 70 }
  }

  if (type === 'shape') {
    return { x: 35, y: 38 }
  }

  const y = 8 + index * 14

  return {
    x: 8,
    y: clamp(y, 8, 92 - size.height),
  }
}

export function clampBlockLayout(layout: SlideBlockLayout): SlideBlockLayout {
  const width = clamp(layout.width, MIN_WIDTH, 100)
  const height = clamp(layout.height, MIN_HEIGHT, 100)

  return {
    ...layout,
    width,
    height,
    x: clamp(layout.x, -width + MIN_VISIBLE, 100 - MIN_VISIBLE),
    y: clamp(layout.y, -height + MIN_VISIBLE, 100 - MIN_VISIBLE),
    zIndex: Math.max(1, Math.round(layout.zIndex || 1)),
  }
}

export function normalizeBlockLayout(block: SlideBlock, index: number): SlideBlockLayout {
  if (block.layout) {
    return clampBlockLayout(block.layout)
  }

  const size = getDefaultSize(block.type)
  const position = getDefaultPosition(block.type, index, size)

  return clampBlockLayout({
    ...position,
    ...size,
    zIndex: index + 1,
  })
}

export function normalizeSlideBlock(block: SlideBlock, index: number): SlideBlock {
  return {
    ...block,
    textStyle: normalizeBlockTextStyle(block),
    visualStyle: block.type === 'shape' ? normalizeBlockVisualStyle(block) : block.visualStyle,
    layout: normalizeBlockLayout(block, index),
  }
}

export function getOffsetLayout(layout: SlideBlockLayout, offset = 3): SlideBlockLayout {
  return clampBlockLayout({
    ...layout,
    x: layout.x + offset,
    y: layout.y + offset,
    zIndex: layout.zIndex + 1,
  })
}

function getManualBlockType(kind: ManualBlockKind): SlideBlockType {
  switch (kind) {
    case 'heading':
      return 'title'
    case 'image-placeholder':
      return 'visual-placeholder'
    case 'shape':
      return 'shape'
    case 'chart-placeholder':
      return 'chart-placeholder'
    default:
      return 'body'
  }
}

function getManualContent(kind: ManualBlockKind) {
  switch (kind) {
    case 'heading':
      return 'New heading'
    case 'image-placeholder':
      return 'Image placeholder'
    case 'shape':
      return ''
    case 'chart-placeholder':
      return 'Chart placeholder'
    default:
      return 'New text box'
  }
}

function getManualStyle(kind: ManualBlockKind): SlideBlock['style'] {
  if (kind === 'heading') {
    return { align: 'left', fontSize: 'lg', bold: true }
  }

  if (kind === 'shape') {
    return { align: 'center', fontSize: 'md' }
  }

  return { align: 'left', fontSize: 'md' }
}

function getManualTextStyle(kind: ManualBlockKind): SlideTextStyle {
  if (kind === 'heading') {
    return {
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSizePx: 32,
      bold: true,
      italic: false,
      underline: false,
      alignment: 'left',
    }
  }

  return {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSizePx: 18,
    bold: false,
    italic: false,
    underline: false,
    alignment: kind === 'shape' ? 'center' : 'left',
  }
}

function getManualLayout(kind: ManualBlockKind, index: number, anchor?: SlideBlockLayout) {
  const type = getManualBlockType(kind)
  const size = getDefaultSize(type)
  const base = anchor
    ? {
        x: anchor.x + 3,
        y: anchor.y + anchor.height + 3,
      }
    : {
        x: (100 - size.width) / 2,
        y: (100 - size.height) / 2,
      }

  return clampBlockLayout({
    ...base,
    ...size,
    zIndex: index + 1,
  })
}

export function createManualSlideBlock(
  kind: ManualBlockKind,
  index: number,
  anchor?: SlideBlockLayout,
): SlideBlock {
  const type = getManualBlockType(kind)

  return {
    id: createId(`block-${type}`),
    type,
    content: getManualContent(kind),
    placeholder: kind === 'text-box' ? 'Type text' : undefined,
    style: getManualStyle(kind),
    textStyle: getManualTextStyle(kind),
    visualStyle: kind === 'shape' ? DEFAULT_VISUAL_STYLE : undefined,
    layout: getManualLayout(kind, index, anchor),
    sourceTrace: [],
  }
}

export function resizeBlockLayout(
  layout: SlideBlockLayout,
  handle: string,
  deltaX: number,
  deltaY: number,
) {
  let { x, y, width, height } = layout

  if (handle.includes('e')) {
    width += deltaX
  }

  if (handle.includes('s')) {
    height += deltaY
  }

  if (handle.includes('w')) {
    x += deltaX
    width -= deltaX
  }

  if (handle.includes('n')) {
    y += deltaY
    height -= deltaY
  }

  if (width < MIN_WIDTH) {
    if (handle.includes('w')) {
      x -= MIN_WIDTH - width
    }

    width = MIN_WIDTH
  }

  if (height < MIN_HEIGHT) {
    if (handle.includes('n')) {
      y -= MIN_HEIGHT - height
    }

    height = MIN_HEIGHT
  }

  return clampBlockLayout({
    ...layout,
    x,
    y,
    width,
    height,
  })
}
