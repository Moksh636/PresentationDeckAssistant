import assert from 'node:assert/strict'
import {
  clampEditorZoom,
  getFitEditorZoom,
  getNextEditorZoom,
} from '../src/data/editorZoom.ts'

assert.equal(clampEditorZoom(20), 60)
assert.equal(clampEditorZoom(180), 160)
assert.equal(clampEditorZoom(110), 110)

assert.equal(getNextEditorZoom(100, 'in'), 110)
assert.equal(getNextEditorZoom(100, 'out'), 90)
assert.equal(getNextEditorZoom(156, 'in'), 160)
assert.equal(getNextEditorZoom(64, 'out'), 60)

assert.equal(
  getFitEditorZoom({
    workspaceWidth: 1200,
    workspaceHeight: 720,
    slideAspectRatio: 16 / 9,
    padding: 96,
  }),
  100,
)
assert.equal(
  getFitEditorZoom({
    workspaceWidth: 760,
    workspaceHeight: 460,
    slideAspectRatio: 16 / 9,
    padding: 96,
  }),
  67,
)

console.log('editorZoom tests passed')
