import type { SlideBlockLayout } from '../types/models.ts'

export type MiniToolbarPlacement = 'above' | 'below' | 'left' | 'right'

export function getMiniToolbarPlacement(layout: SlideBlockLayout): MiniToolbarPlacement {
  if (layout.y < 9) {
    return 'below'
  }

  if (layout.x + layout.width > 88) {
    return 'left'
  }

  if (layout.x < 5) {
    return 'right'
  }

  return 'above'
}
