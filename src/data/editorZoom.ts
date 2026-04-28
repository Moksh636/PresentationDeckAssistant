const MIN_EDITOR_ZOOM = 60
const MAX_EDITOR_ZOOM = 160
const EDITOR_ZOOM_STEP = 10
const BASE_SLIDE_WIDTH = 960

export interface EditorFitZoomInput {
  workspaceWidth: number
  workspaceHeight: number
  slideAspectRatio: number
  padding: number
}

export function clampEditorZoom(value: number) {
  if (!Number.isFinite(value)) {
    return 100
  }

  return Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, Math.round(value)))
}

export function getNextEditorZoom(currentZoom: number, direction: 'in' | 'out') {
  const delta = direction === 'in' ? EDITOR_ZOOM_STEP : -EDITOR_ZOOM_STEP

  return clampEditorZoom(currentZoom + delta)
}

export function getFitEditorZoom({
  workspaceWidth,
  workspaceHeight,
  slideAspectRatio,
  padding,
}: EditorFitZoomInput) {
  const usableWidth = Math.max(320, workspaceWidth - padding)
  const usableHeight = Math.max(220, workspaceHeight - padding)
  const fitByWidth = usableWidth / BASE_SLIDE_WIDTH
  const fitByHeight = usableHeight / (BASE_SLIDE_WIDTH / slideAspectRatio)
  const fitScale = Math.min(1, fitByWidth, fitByHeight)

  return clampEditorZoom(fitScale * 100)
}
