import { clampBlockLayout, getOffsetLayout, normalizeBlockLayout, normalizeSlideBlock } from './slideLayout'
import type { SlideBlock, SlideBlockLayout } from '../types/models'
import { createId } from '../utils/ids'

export type ObjectAlignment =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'

export type ObjectDistribution = 'horizontal' | 'vertical'

export type SnapGuide = {
  id: string
  orientation: 'vertical' | 'horizontal'
  position: number
}

export type BlockLayoutEntry = {
  blockId: string
  layout: SlideBlockLayout
}

interface SnapInput {
  layout: SlideBlockLayout
  surfaceWidthPx: number
  surfaceHeightPx: number
  thresholdPx?: number
}

interface SnapCandidate {
  distance: number
  adjustment: number
  guide: SnapGuide
}

const DEFAULT_SNAP_THRESHOLD_PX = 8

function getNearestSnapCandidate(
  points: Array<{ value: number; snapTo: number; guide: SnapGuide }>,
  threshold: number,
) {
  return points.reduce<SnapCandidate | undefined>((nearest, point) => {
    const distance = Math.abs(point.value - point.snapTo)

    if (distance > threshold) {
      return nearest
    }

    if (nearest && nearest.distance <= distance) {
      return nearest
    }

    return {
      distance,
      adjustment: point.snapTo - point.value,
      guide: point.guide,
    }
  }, undefined)
}

export function cloneBlockForPaste(block: SlideBlock, index: number, offset = 3) {
  return normalizeSlideBlock(
    {
      ...block,
      id: createId(`block-${block.type}`),
      layout: getOffsetLayout(normalizeBlockLayout(block, index), offset),
      sourceTrace: block.sourceTrace.map((trace) => ({ ...trace })),
      textStyle: block.textStyle ? { ...block.textStyle } : undefined,
      visualStyle: block.visualStyle ? { ...block.visualStyle } : undefined,
      imageAsset: block.imageAsset ? { ...block.imageAsset } : undefined,
    },
    index,
  )
}

export function alignBlockLayout(layout: SlideBlockLayout, alignment: ObjectAlignment) {
  switch (alignment) {
    case 'left':
      return clampBlockLayout({ ...layout, x: 0 })
    case 'center':
      return clampBlockLayout({ ...layout, x: (100 - layout.width) / 2 })
    case 'right':
      return clampBlockLayout({ ...layout, x: 100 - layout.width })
    case 'top':
      return clampBlockLayout({ ...layout, y: 0 })
    case 'middle':
      return clampBlockLayout({ ...layout, y: (100 - layout.height) / 2 })
    case 'bottom':
      return clampBlockLayout({ ...layout, y: 100 - layout.height })
    default:
      return layout
  }
}

export function getBlockLayoutBounds(entries: BlockLayoutEntry[]): SlideBlockLayout | undefined {
  if (entries.length === 0) {
    return undefined
  }

  const left = Math.min(...entries.map((entry) => entry.layout.x))
  const top = Math.min(...entries.map((entry) => entry.layout.y))
  const right = Math.max(...entries.map((entry) => entry.layout.x + entry.layout.width))
  const bottom = Math.max(...entries.map((entry) => entry.layout.y + entry.layout.height))

  return clampBlockLayout({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    zIndex: Math.max(...entries.map((entry) => entry.layout.zIndex)),
  })
}

export function alignBlockLayouts(
  entries: BlockLayoutEntry[],
  alignment: ObjectAlignment,
): BlockLayoutEntry[] {
  if (entries.length <= 1) {
    return entries.map((entry) => ({
      ...entry,
      layout: alignBlockLayout(entry.layout, alignment),
    }))
  }

  const bounds = getBlockLayoutBounds(entries)

  if (!bounds) {
    return entries
  }

  return entries.map((entry) => {
    const layout = entry.layout
    const nextLayout =
      alignment === 'left'
        ? { ...layout, x: bounds.x }
        : alignment === 'center'
          ? { ...layout, x: bounds.x + bounds.width / 2 - layout.width / 2 }
          : alignment === 'right'
            ? { ...layout, x: bounds.x + bounds.width - layout.width }
            : alignment === 'top'
              ? { ...layout, y: bounds.y }
              : alignment === 'middle'
                ? { ...layout, y: bounds.y + bounds.height / 2 - layout.height / 2 }
                : { ...layout, y: bounds.y + bounds.height - layout.height }

    return {
      ...entry,
      layout: clampBlockLayout(nextLayout),
    }
  })
}

export function distributeBlockLayouts(
  entries: BlockLayoutEntry[],
  distribution: ObjectDistribution,
): BlockLayoutEntry[] {
  if (entries.length < 3) {
    return entries
  }

  const sortedEntries = [...entries].sort((left, right) =>
    distribution === 'horizontal'
      ? left.layout.x + left.layout.width / 2 - (right.layout.x + right.layout.width / 2)
      : left.layout.y + left.layout.height / 2 - (right.layout.y + right.layout.height / 2),
  )
  const first = sortedEntries[0]
  const last = sortedEntries[sortedEntries.length - 1]
  const firstCenter =
    distribution === 'horizontal'
      ? first.layout.x + first.layout.width / 2
      : first.layout.y + first.layout.height / 2
  const lastCenter =
    distribution === 'horizontal'
      ? last.layout.x + last.layout.width / 2
      : last.layout.y + last.layout.height / 2
  const gap = (lastCenter - firstCenter) / (sortedEntries.length - 1)
  const distributed = new Map<string, SlideBlockLayout>()

  sortedEntries.forEach((entry, index) => {
    const targetCenter = firstCenter + gap * index
    const nextLayout =
      distribution === 'horizontal'
        ? { ...entry.layout, x: targetCenter - entry.layout.width / 2 }
        : { ...entry.layout, y: targetCenter - entry.layout.height / 2 }

    distributed.set(entry.blockId, clampBlockLayout(nextLayout))
  })

  return entries.map((entry) => ({
    ...entry,
    layout: distributed.get(entry.blockId) ?? entry.layout,
  }))
}

export function snapBlockLayout({
  layout,
  surfaceWidthPx,
  surfaceHeightPx,
  thresholdPx = DEFAULT_SNAP_THRESHOLD_PX,
}: SnapInput): { layout: SlideBlockLayout; guides: SnapGuide[] } {
  const horizontalThreshold = (thresholdPx / surfaceWidthPx) * 100
  const verticalThreshold = (thresholdPx / surfaceHeightPx) * 100
  const verticalCandidate = getNearestSnapCandidate(
    [
      { value: layout.x, snapTo: 0, guide: { id: 'v-left', orientation: 'vertical', position: 0 } },
      {
        value: layout.x + layout.width / 2,
        snapTo: 50,
        guide: { id: 'v-center', orientation: 'vertical', position: 50 },
      },
      {
        value: layout.x + layout.width,
        snapTo: 100,
        guide: { id: 'v-right', orientation: 'vertical', position: 100 },
      },
    ],
    horizontalThreshold,
  )
  const horizontalCandidate = getNearestSnapCandidate(
    [
      { value: layout.y, snapTo: 0, guide: { id: 'h-top', orientation: 'horizontal', position: 0 } },
      {
        value: layout.y + layout.height / 2,
        snapTo: 50,
        guide: { id: 'h-middle', orientation: 'horizontal', position: 50 },
      },
      {
        value: layout.y + layout.height,
        snapTo: 100,
        guide: { id: 'h-bottom', orientation: 'horizontal', position: 100 },
      },
    ],
    verticalThreshold,
  )
  const snappedLayout = clampBlockLayout({
    ...layout,
    x: layout.x + (verticalCandidate?.adjustment ?? 0),
    y: layout.y + (horizontalCandidate?.adjustment ?? 0),
  })

  return {
    layout: snappedLayout,
    guides: [verticalCandidate?.guide, horizontalCandidate?.guide].filter(
      (guide): guide is SnapGuide => Boolean(guide),
    ),
  }
}
