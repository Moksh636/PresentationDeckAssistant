import { useState } from 'react'
import { normalizeBlockLayout } from '../../data/slideLayout'
import { getBlockLayoutBounds, type BlockLayoutEntry, type SnapGuide } from '../../data/slideObjectTools'
import type { Slide, SlideBlockLayout } from '../../types/models'
import { EditableSlideBlock } from './EditableSlideBlock'

interface SlideCanvasProps {
  slide?: Slide
  selectedBlockIds: string[]
  primarySelectedBlockId?: string
  commentCount: number
  blockCommentCounts: Record<string, number>
  blockCommentThreadIds: Record<string, string>
  selectedCommentThreadId?: string
  highlightedBlockIds: string[]
  showSources: boolean
  zoomPercent: number
  onSelectBlock: (
    blockId: string,
    options?: { addToSelection?: boolean; preserveSelection?: boolean },
  ) => void
  onClearSelectedBlocks: () => void
  onOpenComments: () => void
  onOpenBlockComments: (blockId: string) => void
  onBlockContentChange: (blockId: string, content: string | string[]) => void
  onBlockLayoutChange: (blockId: string, layout: ReturnType<typeof normalizeBlockLayout>) => void
  onBlockLayoutsChange: (updates: Array<{ blockId: string; layout: SlideBlockLayout }>) => void
  onDeleteBlock: (blockId: string) => void
  onDuplicateBlock: (blockId: string) => void
  onArrangeBlock: (
    blockId: string,
    direction: 'forward' | 'backward' | 'front' | 'back',
  ) => void
  onLockBlock: (blockId: string, locked: boolean) => void
  onOpenBlockContextMenu: (blockId: string, x: number, y: number) => void
}

export function SlideCanvas({
  slide,
  selectedBlockIds,
  primarySelectedBlockId,
  commentCount,
  blockCommentCounts,
  blockCommentThreadIds,
  selectedCommentThreadId,
  highlightedBlockIds,
  showSources,
  zoomPercent,
  onSelectBlock,
  onClearSelectedBlocks,
  onOpenComments,
  onOpenBlockComments,
  onBlockContentChange,
  onBlockLayoutChange,
  onBlockLayoutsChange,
  onDeleteBlock,
  onDuplicateBlock,
  onArrangeBlock,
  onLockBlock,
  onOpenBlockContextMenu,
}: SlideCanvasProps) {
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
  const [draftLayouts, setDraftLayouts] = useState<Record<string, SlideBlockLayout>>({})

  if (!slide) {
    return (
      <section className="canvas-empty panel-card">
        <h3>No slide selected</h3>
        <p>Generate slides or choose a slide from the rail to start editing.</p>
      </section>
    )
  }

  const renderedBlocks = slide.blocks
    .map((block, index) => ({
      block,
      layout: normalizeBlockLayout(block, index),
    }))
    .sort((left, right) => left.layout.zIndex - right.layout.zIndex)
  const selectedBlockIdSet = new Set(selectedBlockIds)
  const highlightedBlockIdSet = new Set(highlightedBlockIds)
  const selectedLayoutEntries: BlockLayoutEntry[] = renderedBlocks
    .filter(({ block }) => selectedBlockIdSet.has(block.id))
    .map(({ block, layout }) => ({
      blockId: block.id,
      layout: draftLayouts[block.id] ?? layout,
    }))
  const groupBounds =
    selectedLayoutEntries.length > 1 ? getBlockLayoutBounds(selectedLayoutEntries) : undefined

  return (
    <section
      className="canvas-stage"
      style={{
        width: `${zoomPercent}%`,
        maxWidth: `${Math.round(1160 * (zoomPercent / 100))}px`,
      }}
    >
      <div className="slide-frame">
        {commentCount > 0 ? (
          <button
            type="button"
            className="slide-comment-marker"
            onClick={onOpenComments}
            aria-label={`${commentCount} slide comment${commentCount === 1 ? '' : 's'}`}
          >
            {commentCount}
          </button>
        ) : null}
        <div
          className="slide-surface"
          tabIndex={0}
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true })

            if (event.target === event.currentTarget) {
              onClearSelectedBlocks()
            }
          }}
        >
          {groupBounds ? (
            <span
              className="selection-group-box"
              style={{
                left: `${groupBounds.x}%`,
                top: `${groupBounds.y}%`,
                width: `${groupBounds.width}%`,
                height: `${groupBounds.height}%`,
              }}
            />
          ) : null}

          {renderedBlocks.map(({ block, layout }) => (
              <EditableSlideBlock
                key={block.id}
                block={block}
                layout={layout}
                draftLayout={draftLayouts[block.id]}
                selectedLayouts={selectedLayoutEntries}
                isSelected={selectedBlockIdSet.has(block.id)}
                isPrimarySelected={primarySelectedBlockId === block.id}
                isReviewHighlighted={highlightedBlockIdSet.has(block.id)}
                isCommentSelected={blockCommentThreadIds[block.id] === selectedCommentThreadId}
                commentCount={blockCommentCounts[block.id] ?? 0}
                showSources={showSources}
                onSelect={(options) => onSelectBlock(block.id, options)}
                onOpenComments={() => onOpenBlockComments(block.id)}
                onContentChange={(content) => onBlockContentChange(block.id, content)}
                onLayoutChange={(nextLayout) => onBlockLayoutChange(block.id, nextLayout)}
                onGroupLayoutDraftChange={(layouts, guides) => {
                  setDraftLayouts(layouts)
                  setSnapGuides(guides)
                }}
                onGroupLayoutCommit={onBlockLayoutsChange}
                onDelete={() => onDeleteBlock(block.id)}
                onDuplicate={() => onDuplicateBlock(block.id)}
                onArrange={(direction) => onArrangeBlock(block.id, direction)}
                onLockChange={(locked) => onLockBlock(block.id, locked)}
                onContextMenu={(x, y) => onOpenBlockContextMenu(block.id, x, y)}
                onSnapGuidesChange={setSnapGuides}
              />
            ))}

          {snapGuides.map((guide) => (
            <span
              key={guide.id}
              className={`snap-guide snap-guide--${guide.orientation}`}
              style={
                guide.orientation === 'vertical'
                  ? { left: `${guide.position}%` }
                  : { top: `${guide.position}%` }
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}
