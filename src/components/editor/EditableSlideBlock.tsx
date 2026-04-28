import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  clampBlockLayout,
  normalizeBlockTextStyle,
  normalizeBlockVisualStyle,
  resizeBlockLayout,
} from '../../data/slideLayout'
import { getMiniToolbarPlacement } from '../../data/editorGeometry'
import { snapBlockLayout, type BlockLayoutEntry, type SnapGuide } from '../../data/slideObjectTools'
import { getAddedByLabel, getSourceTypeLabel } from '../../data/sourceTrace'
import type { SlideBlock, SlideBlockLayout } from '../../types/models'
import { formatConfidence } from '../../utils/formatters'

interface EditableSlideBlockProps {
  block: SlideBlock
  layout: SlideBlockLayout
  draftLayout?: SlideBlockLayout
  selectedLayouts: BlockLayoutEntry[]
  isSelected: boolean
  isPrimarySelected: boolean
  isReviewHighlighted: boolean
  isCommentSelected: boolean
  commentCount: number
  showSources: boolean
  onSelect: (options?: { addToSelection?: boolean; preserveSelection?: boolean }) => void
  onOpenComments: () => void
  onContentChange: (content: string | string[]) => void
  onLayoutChange: (layout: SlideBlockLayout) => void
  onGroupLayoutDraftChange: (layouts: Record<string, SlideBlockLayout>, guides: SnapGuide[]) => void
  onGroupLayoutCommit: (updates: Array<{ blockId: string; layout: SlideBlockLayout }>) => void
  onDelete: () => void
  onDuplicate: () => void
  onArrange: (direction: 'forward' | 'backward' | 'front' | 'back') => void
  onLockChange: (locked: boolean) => void
  onContextMenu: (x: number, y: number) => void
  onSnapGuidesChange: (guides: SnapGuide[]) => void
}

const resizeHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function isTextEditableBlock(block: SlideBlock) {
  return (
    block.type !== 'shape' &&
    !(block.type === 'visual-placeholder' && block.imageAsset) &&
    (typeof block.content === 'string' || Array.isArray(block.content))
  )
}

function getEditableText(block: SlideBlock) {
  return Array.isArray(block.content) ? block.content.join('\n') : block.content
}

function getNextContent(block: SlideBlock, value: string) {
  return Array.isArray(block.content) ? value.split('\n') : value
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest('button, textarea, input, select, [data-resize-handle]'))
    : false
}

function getSlideSurface(element: HTMLElement) {
  return element.closest<HTMLElement>('.slide-surface')
}

function didLayoutChange(left: SlideBlockLayout, right: SlideBlockLayout) {
  return (
    left.x !== right.x ||
    left.y !== right.y ||
    left.width !== right.width ||
    left.height !== right.height ||
    left.zIndex !== right.zIndex
  )
}

function didGroupLayoutChange(
  left: BlockLayoutEntry[],
  right: Record<string, SlideBlockLayout>,
) {
  return left.some((entry) => {
    const nextLayout = right[entry.blockId]

    return Boolean(nextLayout && didLayoutChange(entry.layout, nextLayout))
  })
}

export function EditableSlideBlock({
  block,
  layout,
  draftLayout,
  selectedLayouts,
  isSelected,
  isPrimarySelected,
  isReviewHighlighted,
  isCommentSelected,
  commentCount,
  showSources,
  onSelect,
  onOpenComments,
  onContentChange,
  onLayoutChange,
  onGroupLayoutDraftChange,
  onGroupLayoutCommit,
  onDelete,
  onDuplicate,
  onArrange,
  onLockChange,
  onContextMenu,
  onSnapGuidesChange,
}: EditableSlideBlockProps) {
  const [isEditingText, setIsEditingText] = useState(false)
  const [isSourceOpen, setIsSourceOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [localDraftLayout, setLocalDraftLayout] = useState<SlideBlockLayout>()
  const blockRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const didDragRef = useRef(false)
  const traceCount = block.sourceTrace.length
  const editable = isTextEditableBlock(block)
  const isTextEditingActive = isSelected && isEditingText
  const textStyle = normalizeBlockTextStyle(block)
  const activeLayout = draftLayout ?? localDraftLayout ?? layout
  const isLocked = activeLayout.locked === true
  const miniToolbarPlacement = getMiniToolbarPlacement(activeLayout)
  const shouldShowSourceChip = traceCount > 0 && (showSources || isSelected || isHovered || isSourceOpen)

  useEffect(() => {
    if (isTextEditingActive) {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }
  }, [isTextEditingActive])

  const startMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      event.shiftKey ||
      isLocked ||
      isTextEditingActive ||
      isInteractiveTarget(event.target)
    ) {
      return
    }

    const surface = getSlideSurface(event.currentTarget)
    const surfaceRect = surface?.getBoundingClientRect()

    if (!surfaceRect) {
      return
    }

    event.preventDefault()
    onSelect(isSelected ? { preserveSelection: true } : undefined)
    event.currentTarget.focus({ preventScroll: true })

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is a progressive enhancement for smoother object drags.
    }

    const startX = event.clientX
    const startY = event.clientY
    const startLayout = activeLayout
    const startGroupLayouts =
      isSelected && selectedLayouts.length > 1
        ? selectedLayouts
            .filter((entry) => !entry.layout.locked)
            .map((entry) => ({ ...entry, layout: { ...entry.layout } }))
        : []
    const startActiveGroupLayout =
      startGroupLayouts.find((entry) => entry.blockId === block.id)?.layout ?? startLayout
    const isGroupMove = startGroupLayouts.length > 1
    let nextLayout = startLayout
    let nextGroupLayouts: Record<string, SlideBlockLayout> = {}

    const handlePointerMove = (moveEvent: PointerEvent) => {
      didDragRef.current = true
      const deltaX = ((moveEvent.clientX - startX) / surfaceRect.width) * 100
      const deltaY = ((moveEvent.clientY - startY) / surfaceRect.height) * 100

      const rawLayout = clampBlockLayout({
        ...startActiveGroupLayout,
        x: startActiveGroupLayout.x + deltaX,
        y: startActiveGroupLayout.y + deltaY,
      })
      const snapped = snapBlockLayout({
        layout: rawLayout,
        surfaceWidthPx: surfaceRect.width,
        surfaceHeightPx: surfaceRect.height,
      })
      const snapDeltaX = snapped.layout.x - rawLayout.x
      const snapDeltaY = snapped.layout.y - rawLayout.y

      onSnapGuidesChange(snapped.guides)

      if (isGroupMove) {
        nextGroupLayouts = Object.fromEntries(
          startGroupLayouts.map((entry) => [
            entry.blockId,
            clampBlockLayout({
              ...entry.layout,
              x: entry.layout.x + deltaX + snapDeltaX,
              y: entry.layout.y + deltaY + snapDeltaY,
            }),
          ]),
        )
        onGroupLayoutDraftChange(nextGroupLayouts, snapped.guides)
      } else {
        nextLayout = snapped.layout
        setLocalDraftLayout(nextLayout)
      }
    }

    const stopMove = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      setLocalDraftLayout(undefined)
      onSnapGuidesChange([])
      onGroupLayoutDraftChange({}, [])

      if (isGroupMove && didGroupLayoutChange(startGroupLayouts, nextGroupLayouts)) {
        onGroupLayoutCommit(
          startGroupLayouts
            .map((entry) => ({
              blockId: entry.blockId,
              layout: nextGroupLayouts[entry.blockId],
            }))
            .filter((entry): entry is { blockId: string; layout: SlideBlockLayout } =>
              Boolean(entry.layout),
            ),
        )
      } else if (!isGroupMove && didLayoutChange(nextLayout, startLayout)) {
        onLayoutChange(nextLayout)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopMove, { once: true })
  }

  const startResize = (handle: string, event: React.PointerEvent<HTMLButtonElement>) => {
    if (isLocked) {
      return
    }

    const surface = getSlideSurface(event.currentTarget)
    const surfaceRect = surface?.getBoundingClientRect()

    if (!surfaceRect) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onSelect({ preserveSelection: true })
    blockRef.current?.focus({ preventScroll: true })

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is a progressive enhancement for smoother resize handles.
    }

    const startX = event.clientX
    const startY = event.clientY
    const startLayout = activeLayout
    let nextLayout = startLayout

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / surfaceRect.width) * 100
      const deltaY = ((moveEvent.clientY - startY) / surfaceRect.height) * 100

      nextLayout = resizeBlockLayout(startLayout, handle, deltaX, deltaY)
      setLocalDraftLayout(nextLayout)
    }

    const stopResize = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      setLocalDraftLayout(undefined)

      if (didLayoutChange(nextLayout, startLayout)) {
        onLayoutChange(nextLayout)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize, { once: true })
  }

  return (
    <div
      ref={blockRef}
      tabIndex={0}
      className={`slide-object slide-block--${block.type} ${
        isSelected ? 'is-selected' : ''
      } ${isReviewHighlighted ? 'is-review-highlighted' : ''} ${
        isTextEditingActive ? 'is-editing' : ''
      } ${isLocked ? 'is-locked' : ''} ${
        block.imageAsset ? 'has-image' : ''
      }`}
      style={{
        left: `${activeLayout.x}%`,
        top: `${activeLayout.y}%`,
        width: `${activeLayout.width}%`,
        height: `${activeLayout.height}%`,
        zIndex: activeLayout.zIndex,
        fontFamily: textStyle.fontFamily,
        fontSize: `${textStyle.fontSizePx}px`,
        fontWeight: textStyle.bold ? 800 : 400,
        fontStyle: textStyle.italic ? 'italic' : 'normal',
        textDecoration: textStyle.underline ? 'underline' : 'none',
        textAlign: textStyle.alignment,
        lineHeight: textStyle.lineHeight,
        justifyContent:
          textStyle.verticalAlign === 'middle'
            ? 'center'
            : textStyle.verticalAlign === 'bottom'
              ? 'flex-end'
              : 'flex-start',
        color: textStyle.color,
      }}
      onClick={(event) => {
        if (didDragRef.current) {
          didDragRef.current = false
          return
        }

        event.currentTarget.focus({ preventScroll: true })
        onSelect({ addToSelection: event.shiftKey })
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={() => {
        onSelect()
        if (editable && !isLocked) {
          setIsEditingText(true)
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
        onSelect(isSelected ? { preserveSelection: true } : undefined)
        onContextMenu(event.clientX, event.clientY)
      }}
      onPointerDown={startMove}
    >
      {isLocked ? <span className="slide-object__lock-badge">Locked</span> : null}

      {shouldShowSourceChip ? (
        <SourceChip
          block={block}
          isOpen={isSourceOpen}
          onOpen={() => setIsSourceOpen(true)}
          onClose={() => setIsSourceOpen(false)}
        />
      ) : null}

      {commentCount > 0 ? (
        <CommentMarker
          count={commentCount}
          isSelected={isCommentSelected}
          onOpenComments={onOpenComments}
        />
      ) : null}

      <ObjectContent
        block={block}
        editable={editable}
        isEditingText={isTextEditingActive}
        textStyle={textStyle}
        textareaRef={textareaRef}
        onChange={(value) => onContentChange(getNextContent(block, value))}
        onExitEditing={() => setIsEditingText(false)}
      />

      {isPrimarySelected ? (
        <>
          <div
            className={`object-mini-toolbar object-mini-toolbar--${miniToolbarPlacement}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={onOpenComments}>
              Comment
            </button>
            <button type="button" onClick={onDuplicate}>
              Duplicate
            </button>
            <button type="button" disabled={isLocked} onClick={() => onArrange('forward')}>
              Forward
            </button>
            <button type="button" disabled={isLocked} onClick={() => onArrange('backward')}>
              Back
            </button>
            <button type="button" onClick={() => onLockChange(!isLocked)}>
              {isLocked ? 'Unlock' : 'Lock'}
            </button>
            <button
              type="button"
              className="object-mini-toolbar__danger"
              disabled={isLocked}
              onClick={onDelete}
            >
              Delete
            </button>
          </div>

          {!isLocked ? resizeHandles.map((handle) => (
            <button
              key={handle}
              type="button"
              className={`resize-handle resize-handle--${handle}`}
              data-resize-handle
              aria-label={`Resize ${handle}`}
              onPointerDown={(event) => startResize(handle, event)}
            />
          )) : null}
        </>
      ) : null}
    </div>
  )
}

function ObjectContent({
  block,
  editable,
  isEditingText,
  textStyle,
  textareaRef,
  onChange,
  onExitEditing,
}: {
  block: SlideBlock
  editable: boolean
  isEditingText: boolean
  textStyle: ReturnType<typeof normalizeBlockTextStyle>
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
  onExitEditing: () => void
}) {
  if (block.type === 'shape') {
    const visualStyle = normalizeBlockVisualStyle(block)

    return (
      <div
        className="slide-object__shape"
        aria-label="Rectangle shape"
        style={{
          backgroundColor: visualStyle.fillColor,
          borderColor: visualStyle.borderColor,
          borderWidth: `${visualStyle.borderWidthPx}px`,
          opacity: visualStyle.opacity,
        }}
      />
    )
  }

  if (block.type === 'visual-placeholder' && block.imageAsset) {
    return (
      <img
        className="slide-object__image"
        src={block.imageAsset.dataUrl}
        alt={block.imageAsset.altText ?? block.imageAsset.name}
        style={{
          objectFit: block.imageAsset.fit === 'fit' ? 'contain' : 'cover',
        }}
      />
    )
  }

  if (isEditingText && editable) {
    return (
      <textarea
        ref={textareaRef}
        value={getEditableText(block)}
        placeholder={block.placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onExitEditing()
            event.currentTarget.blur()
          }
        }}
      />
    )
  }

  if (Array.isArray(block.content)) {
    const ListTag = textStyle.listStyle === 'number' ? 'ol' : 'ul'

    return (
      <ListTag className="slide-object__bullets">
        {block.content.map((item, index) => (
          <li key={`${block.id}-${index}`}>{item || block.placeholder || 'Bullet'}</li>
        ))}
      </ListTag>
    )
  }

  return (
    <div className="slide-object__text">
      {block.content || block.placeholder || (block.type === 'visual-placeholder' ? 'Image placeholder' : 'Text')}
    </div>
  )
}

function CommentMarker({
  count,
  isSelected,
  onOpenComments,
}: {
  count: number
  isSelected: boolean
  onOpenComments: () => void
}) {
  return (
    <button
      type="button"
      className={`slide-block__comment-marker ${isSelected ? 'is-selected' : ''}`}
      aria-label={`${count} block comment${count === 1 ? '' : 's'}`}
      onClick={(event) => {
        event.stopPropagation()
        onOpenComments()
      }}
    >
      {count}
    </button>
  )
}

function SourceChip({
  block,
  isOpen,
  onOpen,
  onClose,
}: {
  block: SlideBlock
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}) {
  const traceCount = block.sourceTrace.length

  return (
    <div
      className="slide-block__source"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        className="slide-block__trace-indicator"
        aria-label={`${traceCount} source trace${traceCount === 1 ? '' : 's'}`}
        onClick={(event) => {
          event.stopPropagation()
          onOpen()
        }}
      >
        +{traceCount}
      </button>

      {isOpen ? (
        <div className="source-popover" onClick={(event) => event.stopPropagation()}>
          {block.sourceTrace.map((trace, index) => (
            <article
              key={`${trace.fileId}-${trace.sourceType}-${index}`}
              className="source-popover__item"
            >
              <div className="source-popover__header">
                <strong>{trace.fileName}</strong>
                <span>{formatConfidence(trace.confidence)}</span>
              </div>
              <div className="source-popover__meta">
                <span className={`trace-source-badge trace-source-badge--${trace.sourceType}`}>
                  {getSourceTypeLabel(trace.sourceType)}
                </span>
                <span>{getAddedByLabel(trace)}</span>
              </div>
              <p>{trace.extractedSnippet}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}
