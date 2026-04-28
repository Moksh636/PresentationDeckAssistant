import type { AiEditPlan } from './aiEditor.ts'
import type { Slide, SlideBlock } from '../types/models.ts'

export interface AiProposalBlockDiff {
  slideId: string
  slideTitle: string
  blockId: string
  before: string
  after: string
}

function getBlockText(block: SlideBlock) {
  return Array.isArray(block.content) ? block.content.join('\n') : block.content
}

export function getAiProposalBlockDiffs(
  currentSlides: Slide[],
  plan: AiEditPlan,
): AiProposalBlockDiff[] {
  const currentSlideById = new Map(currentSlides.map((slide) => [slide.id, slide]))

  return plan.updatedSlides.flatMap((updatedSlide) => {
    const currentSlide = currentSlideById.get(updatedSlide.id)

    if (!currentSlide) {
      return []
    }

    const currentBlockById = new Map(currentSlide.blocks.map((block) => [block.id, block]))

    return updatedSlide.blocks.flatMap((updatedBlock) => {
      const currentBlock = currentBlockById.get(updatedBlock.id)

      if (!currentBlock) {
        return []
      }

      const before = getBlockText(currentBlock)
      const after = getBlockText(updatedBlock)

      if (before === after) {
        return []
      }

      return [
        {
          slideId: updatedSlide.id,
          slideTitle: updatedSlide.title,
          blockId: updatedBlock.id,
          before,
          after,
        },
      ]
    })
  })
}
