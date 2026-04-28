export const MIN_THUMBNAIL_RAIL_WIDTH = 132
export const MAX_THUMBNAIL_RAIL_WIDTH = 280
export const DEFAULT_THUMBNAIL_RAIL_WIDTH = 206
export const COLLAPSED_THUMBNAIL_RAIL_WIDTH = 48
export const COMPACT_THUMBNAIL_RAIL_WIDTH = 168

interface ThumbnailRailInput {
  collapsed: boolean
  compact: boolean
  width: number
}

interface AutoFitInput {
  railCollapsedChanged: boolean
  drawerChanged: boolean
  viewportChanged: boolean
}

export function clampThumbnailRailWidth(width: number) {
  return Math.min(MAX_THUMBNAIL_RAIL_WIDTH, Math.max(MIN_THUMBNAIL_RAIL_WIDTH, Math.round(width)))
}

export function getThumbnailRailPresentation({ collapsed, compact, width }: ThumbnailRailInput) {
  if (collapsed) {
    return {
      compact: true,
      width: COLLAPSED_THUMBNAIL_RAIL_WIDTH,
    }
  }

  const clampedWidth = clampThumbnailRailWidth(width)

  return {
    compact: compact || clampedWidth <= COMPACT_THUMBNAIL_RAIL_WIDTH,
    width: clampedWidth,
  }
}

export function shouldAutoFitCanvas({
  railCollapsedChanged,
  drawerChanged,
  viewportChanged,
}: AutoFitInput) {
  return railCollapsedChanged || drawerChanged || viewportChanged
}
