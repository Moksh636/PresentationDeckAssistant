import pptxgen from 'pptxgenjs'
import type { CompanyBrandKit, Deck, Slide, SlideAlignment, SlideBlock, SlideBlockLayout } from '../types/models'
import {
  normalizeBlockLayout,
  normalizeBlockTextStyle,
  normalizeBlockVisualStyle,
  normalizePlaceholderVisualStyle,
} from './slideLayout'

const SLIDE_WIDTH_IN = 13.333
const SLIDE_HEIGHT_IN = 7.5
const PX_TO_PT = 0.75
const MIN_SIZE_IN = 0.05
const DEFAULT_TEXT_COLOR = '172033'

type PresentationSlide = ReturnType<InstanceType<typeof pptxgen>['addSlide']>
type TextOptions = NonNullable<Parameters<PresentationSlide['addText']>[1]>

interface ExportDeckAsPptxInput {
  deck: Deck
  slides: Slide[]
  /** Resolved brand for fonts and placeholder chrome (optional). */
  exportBrand?: {
    kit: CompanyBrandKit
    organizationName: string
  }
}

function isSvgDataUrl(dataUrl: string) {
  return dataUrl.includes('image/svg+xml') || dataUrl.includes('svg%3C')
}

interface InchRect {
  x: number
  y: number
  w: number
  h: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getSafeFileName(title: string) {
  const safeTitle = title
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return `${safeTitle || 'pitch-deck'}.pptx`
}

function normalizeHexColor(color: string | undefined, fallback = DEFAULT_TEXT_COLOR) {
  const normalized = color?.trim().replace(/^#/, '')

  if (normalized && /^[0-9a-f]{6}$/i.test(normalized)) {
    return normalized.toUpperCase()
  }

  return fallback
}

function alignmentToPptxAlign(alignment: SlideAlignment): TextOptions['align'] {
  return alignment
}

function layoutToInches(layout: SlideBlockLayout): InchRect {
  const x = (layout.x / 100) * SLIDE_WIDTH_IN
  const y = (layout.y / 100) * SLIDE_HEIGHT_IN
  const w = (layout.width / 100) * SLIDE_WIDTH_IN
  const h = (layout.height / 100) * SLIDE_HEIGHT_IN

  return {
    x: clamp(x, 0, SLIDE_WIDTH_IN - MIN_SIZE_IN),
    y: clamp(y, 0, SLIDE_HEIGHT_IN - MIN_SIZE_IN),
    w: Math.max(MIN_SIZE_IN, Math.min(w, SLIDE_WIDTH_IN - Math.max(0, x))),
    h: Math.max(MIN_SIZE_IN, Math.min(h, SLIDE_HEIGHT_IN - Math.max(0, y))),
  }
}

function getBlockText(block: SlideBlock) {
  if (Array.isArray(block.content)) {
    return block.content.filter(Boolean).join('\n')
  }

  return block.content || block.placeholder || ''
}

function getBaseTextOptions(block: SlideBlock, rect: InchRect): TextOptions {
  const textStyle = normalizeBlockTextStyle(block)

  return {
    ...rect,
    fontFace: textStyle.fontFamily,
    fontSize: Math.max(6, Math.round(textStyle.fontSizePx * PX_TO_PT)),
    bold: textStyle.bold,
    italic: textStyle.italic,
    underline: textStyle.underline ? { style: 'sng' } : undefined,
    align: alignmentToPptxAlign(textStyle.alignment),
    valign:
      block.type === 'visual-placeholder' || block.type === 'chart-placeholder'
        ? 'middle'
        : textStyle.verticalAlign,
    color: normalizeHexColor(textStyle.color),
    margin: 0.08,
    fit: 'shrink',
    breakLine: false,
    isTextBox: true,
  }
}

function addTextBlock(pptxSlide: PresentationSlide, block: SlideBlock, rect: InchRect) {
  const text = getBlockText(block)

  if (!text.trim()) {
    return
  }

  pptxSlide.addText(text, getBaseTextOptions(block, rect))
}

function addShapeBlock(
  pptxSlide: PresentationSlide,
  pptx: pptxgen,
  block: SlideBlock,
  rect: InchRect,
) {
  const visualStyle = normalizeBlockVisualStyle(block)
  const borderWidthPt = Math.max(0, visualStyle.borderWidthPx * PX_TO_PT)
  const transparency = Math.round((1 - visualStyle.opacity) * 100)

  pptxSlide.addShape(pptx.ShapeType.rect, {
    ...rect,
    fill: {
      color: normalizeHexColor(visualStyle.fillColor, '2457E0'),
      transparency,
    },
    line:
      borderWidthPt > 0
        ? {
            color: normalizeHexColor(visualStyle.borderColor, '2457E0'),
            transparency,
            width: borderWidthPt,
          }
        : { color: normalizeHexColor(visualStyle.borderColor, '2457E0'), transparency: 100, width: 0 },
  })
}

function addPlaceholderBlock(
  pptxSlide: PresentationSlide,
  pptx: pptxgen,
  block: SlideBlock,
  rect: InchRect,
  placeholderCtx: { fallbackLabel: string; accentHex: string },
) {
  if (block.type === 'visual-placeholder' && block.imageAsset) {
    const dataUrl = block.imageAsset.dataUrl

    if (isSvgDataUrl(dataUrl)) {
      pptxSlide.addText(placeholderCtx.fallbackLabel, {
        ...getBaseTextOptions(block, rect),
        bold: true,
        align: 'center',
        valign: 'middle',
        color: placeholderCtx.accentHex,
      })
      return
    }

    pptxSlide.addImage({
      data: dataUrl,
      altText: block.imageAsset.altText ?? block.imageAsset.name,
      ...rect,
    })
    return
  }

  const label =
    getBlockText(block) ||
    (block.type === 'chart-placeholder' ? 'Chart placeholder' : 'Image placeholder')

  const vs = normalizePlaceholderVisualStyle(block)
  const fillHex = normalizeHexColor(vs.fillColor, 'F4F7FF')
  const lineHex = normalizeHexColor(vs.borderColor, '2457E0')
  const fillTransparency = Math.round((1 - Math.min(0.22, vs.opacity + 0.04)) * 100)

  pptxSlide.addShape(pptx.ShapeType.rect, {
    ...rect,
    fill: { color: fillHex, transparency: fillTransparency },
    line: { color: lineHex, transparency: 28, width: Math.max(1, vs.borderWidthPx), dashType: 'dash' },
  })

  const textStyle = normalizeBlockTextStyle(block)

  pptxSlide.addText(label, {
    ...getBaseTextOptions(block, rect),
    bold: block.type === 'chart-placeholder',
    align: 'center',
    valign: 'middle',
    color: normalizeHexColor(textStyle.color, placeholderCtx.accentHex),
  })
}

function addSlideBlock(
  pptxSlide: PresentationSlide,
  pptx: pptxgen,
  block: SlideBlock,
  index: number,
  placeholderCtx: { fallbackLabel: string; accentHex: string },
) {
  const layout = normalizeBlockLayout(block, index)
  const rect = layoutToInches(layout)

  if (block.type === 'shape') {
    addShapeBlock(pptxSlide, pptx, block, rect)
    return
  }

  if (block.type === 'visual-placeholder' || block.type === 'chart-placeholder') {
    addPlaceholderBlock(pptxSlide, pptx, block, rect, placeholderCtx)
    return
  }

  addTextBlock(pptxSlide, block, rect)
}

export async function exportDeckAsPptx({ deck, slides, exportBrand }: ExportDeckAsPptxInput) {
  const pptx = new pptxgen()
  const kit = exportBrand?.kit
  const themeFont = kit?.fontFamily?.trim() || 'Inter'
  const accentHex = normalizeHexColor(kit?.accentColor, '2457E0')
  const fallbackLabel = (exportBrand?.organizationName || deck.title || 'Brand').trim()

  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'Deckspace sales deck intelligence'
  pptx.company = 'Deckspace MVP'
  pptx.subject = deck.setup.goal || deck.title
  pptx.title = deck.title
  pptx.theme = {
    headFontFace: themeFont,
    bodyFontFace: themeFont,
  }

  slides
    .slice()
    .sort((left, right) => left.index - right.index)
    .forEach((slide) => {
      const pptxSlide = pptx.addSlide()
      pptxSlide.background = { color: 'FFFFFF' }

      slide.blocks
        .map((block, index) => ({
          block,
          index,
          layout: normalizeBlockLayout(block, index),
        }))
        .sort((left, right) => left.layout.zIndex - right.layout.zIndex)
        .forEach(({ block, index }) =>
          addSlideBlock(pptxSlide, pptx, block, index, {
            fallbackLabel,
            accentHex,
          }),
        )

      if (slide.notes.trim()) {
        pptxSlide.addNotes(slide.notes)
      }
    })

  await pptx.writeFile({
    fileName: getSafeFileName(deck.title),
    compression: true,
  })
}
