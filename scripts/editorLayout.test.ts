import assert from 'node:assert/strict'
import {
  DEFAULT_THUMBNAIL_RAIL_WIDTH,
  clampThumbnailRailWidth,
  getThumbnailRailPresentation,
  shouldAutoFitCanvas,
} from '../src/data/editorLayout.ts'

assert.equal(DEFAULT_THUMBNAIL_RAIL_WIDTH, 206)
assert.equal(clampThumbnailRailWidth(90), 132)
assert.equal(clampThumbnailRailWidth(208), 208)
assert.equal(clampThumbnailRailWidth(340), 280)

assert.deepEqual(
  getThumbnailRailPresentation({ collapsed: true, compact: false, width: 220 }),
  { compact: true, width: 48 },
)
assert.deepEqual(
  getThumbnailRailPresentation({ collapsed: false, compact: false, width: 150 }),
  { compact: true, width: 150 },
)
assert.deepEqual(
  getThumbnailRailPresentation({ collapsed: false, compact: false, width: 220 }),
  { compact: false, width: 220 },
)
assert.deepEqual(
  getThumbnailRailPresentation({ collapsed: false, compact: true, width: 220 }),
  { compact: true, width: 220 },
)

assert.equal(
  shouldAutoFitCanvas({
    drawerChanged: false,
    railCollapsedChanged: true,
    viewportChanged: false,
  }),
  true,
)
assert.equal(
  shouldAutoFitCanvas({
    drawerChanged: false,
    railCollapsedChanged: false,
    viewportChanged: false,
  }),
  false,
)

console.log('editor layout helpers passed')
