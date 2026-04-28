import assert from 'node:assert/strict'
import { getMiniToolbarPlacement } from '../src/data/editorGeometry.ts'
import {
  applyListStyle,
  getLineSpacingValue,
  getVerticalAlignmentValue,
} from '../src/data/paragraphControls.ts'
import {
  SLIDE_LAYOUT_PRESETS,
  createSlideFromLayoutPreset,
} from '../src/data/slideLayoutPresets.ts'
import type { SlideBlock } from '../src/types/models.ts'

const baseBlock: SlideBlock = {
  id: 'block-1',
  type: 'body',
  content: 'First point\nSecond point',
  style: { align: 'left', fontSize: 'md' },
  textStyle: {
    fontFamily: 'Inter',
    fontSizePx: 18,
    bold: false,
    italic: false,
    underline: false,
    alignment: 'left',
  },
  sourceTrace: [],
}

const bulletResult = applyListStyle(baseBlock, 'bullet')
assert.deepEqual(bulletResult.content, ['First point', 'Second point'])
assert.equal(bulletResult.textStyle.listStyle, 'bullet')

const plainResult = applyListStyle(
  {
    ...baseBlock,
    content: ['First point', 'Second point'],
    textStyle: { ...baseBlock.textStyle, listStyle: 'bullet' },
  },
  'bullet',
)
assert.equal(plainResult.content, 'First point\nSecond point')
assert.equal(plainResult.textStyle.listStyle, 'none')

assert.equal(getLineSpacingValue(1.42), 1.4)
assert.equal(getLineSpacingValue(3), 2)
assert.equal(getVerticalAlignmentValue('middle'), 'middle')
assert.equal(getVerticalAlignmentValue('bad-value'), 'top')

assert.equal(getMiniToolbarPlacement({ x: 8, y: 4, width: 30, height: 20, zIndex: 1 }), 'below')
assert.equal(getMiniToolbarPlacement({ x: 82, y: 30, width: 15, height: 20, zIndex: 1 }), 'left')
assert.equal(getMiniToolbarPlacement({ x: 1, y: 30, width: 15, height: 20, zIndex: 1 }), 'right')
assert.equal(getMiniToolbarPlacement({ x: 20, y: 30, width: 30, height: 20, zIndex: 1 }), 'above')

assert.equal(SLIDE_LAYOUT_PRESETS.length, 6)
const twoColumnSlide = createSlideFromLayoutPreset('deck-1', 3, 'two-column')
assert.equal(twoColumnSlide.index, 3)
assert.equal(twoColumnSlide.blocks.filter((block) => block.type === 'bullet-list').length, 2)

const chartSlide = createSlideFromLayoutPreset('deck-1', 4, 'chart-insight')
assert.equal(chartSlide.blocks.some((block) => block.type === 'chart-placeholder'), true)
assert.equal(chartSlide.blocks.some((block) => block.type === 'body'), true)

console.log('editor batch 2 helpers passed')
