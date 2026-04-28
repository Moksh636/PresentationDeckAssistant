import assert from 'node:assert/strict'
import { getAiProposalBlockDiffs } from '../src/data/aiProposalReview.ts'
import { getNormalizedImageAsset } from '../src/data/imageControls.ts'
import type { AiEditPlan } from '../src/data/aiEditor.ts'
import type { Slide } from '../src/types/models.ts'

const currentSlides: Slide[] = [
  {
    id: 'slide-1',
    deckId: 'deck-1',
    index: 1,
    title: 'Slide',
    notes: '',
    sourceTrace: [],
    blocks: [
      {
        id: 'block-1',
        type: 'body',
        content: 'Original copy',
        style: { align: 'left', fontSize: 'md' },
        sourceTrace: [],
      },
      {
        id: 'block-2',
        type: 'bullet-list',
        content: ['A', 'B'],
        style: { align: 'left', fontSize: 'md' },
        sourceTrace: [],
      },
    ],
  },
]

const plan: AiEditPlan = {
  request: 'shorten',
  scope: 'slide',
  intent: 'shorten',
  summary: 'Proposal',
  affectedSlides: 1,
  affectedBlocks: 2,
  examples: [],
  updatedSlides: [
    {
      ...currentSlides[0],
      blocks: [
        {
          ...currentSlides[0].blocks[0],
          content: 'Short copy',
        },
        {
          ...currentSlides[0].blocks[1],
          content: ['A tighter', 'B tighter'],
        },
      ],
    },
  ],
}

const diffs = getAiProposalBlockDiffs(currentSlides, plan)
assert.equal(diffs.length, 2)
assert.deepEqual(diffs.map((diff) => diff.blockId), ['block-1', 'block-2'])
assert.equal(diffs[0].before, 'Original copy')
assert.equal(diffs[0].after, 'Short copy')
assert.equal(diffs[1].before, 'A\nB')
assert.equal(diffs[1].after, 'A tighter\nB tighter')

const imageAsset = getNormalizedImageAsset({
  name: 'image.png',
  mimeType: 'image/png',
  sizeBytes: 12,
  dataUrl: 'data:image/png;base64,abc',
})

assert.equal(imageAsset.fit, 'fill')
assert.equal(imageAsset.altText, 'image.png')
assert.equal(getNormalizedImageAsset({ ...imageAsset, fit: 'fit', altText: 'Chart' }).fit, 'fit')
assert.equal(getNormalizedImageAsset({ ...imageAsset, fit: 'bad' }).fit, 'fill')

console.log('editor batch 3 helpers passed')
