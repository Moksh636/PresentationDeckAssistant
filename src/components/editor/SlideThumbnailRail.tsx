import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { clampThumbnailRailWidth } from '../../data/editorLayout'
import { SLIDE_LAYOUT_PRESETS, type SlideLayoutPreset } from '../../data/slideLayoutPresets'
import {
  normalizeBlockLayout,
  normalizeBlockTextStyle,
  normalizeBlockVisualStyle,
} from '../../data/slideLayout'
import type { Slide } from '../../types/models'

interface SlideThumbnailRailProps {
  slides: Slide[]
  selectedSlideId?: string
  onSelectSlide: (slideId: string) => void
  onAddSlide: () => void
  onAddSlideWithLayout: (preset: SlideLayoutPreset) => void
  onDuplicateSlide: () => void
  onDeleteSlide: () => void
  onReorderSlides: (orderedSlideIds: string[]) => void
  onOpenSlideContextMenu: (slideId: string, x: number, y: number) => void
  isCollapsed: boolean
  isCompact: boolean
  railWidth: number
  onToggleCollapsed: () => void
  onToggleCompact: () => void
  onResizeRail: (width: number) => void
}

function getReorderedSlideIds(slides: Slide[], sourceSlideId: string, targetSlideId: string) {
  const orderedSlides = [...slides]
  const sourceIndex = orderedSlides.findIndex((slide) => slide.id === sourceSlideId)
  const targetIndex = orderedSlides.findIndex((slide) => slide.id === targetSlideId)

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return slides.map((slide) => slide.id)
  }

  const [movedSlide] = orderedSlides.splice(sourceIndex, 1)
  const adjustedTargetIndex =
    sourceIndex < targetIndex ? Math.max(0, targetIndex - 1) : targetIndex

  orderedSlides.splice(adjustedTargetIndex, 0, movedSlide)

  return orderedSlides.map((slide) => slide.id)
}

export function SlideThumbnailRail({
  slides,
  selectedSlideId,
  onSelectSlide,
  onAddSlide,
  onAddSlideWithLayout,
  onDuplicateSlide,
  onDeleteSlide,
  onReorderSlides,
  onOpenSlideContextMenu,
  isCollapsed,
  isCompact,
  railWidth,
  onToggleCollapsed,
  onToggleCompact,
  onResizeRail,
}: SlideThumbnailRailProps) {
  const [draggedSlideId, setDraggedSlideId] = useState<string>()
  const [dropTargetSlideId, setDropTargetSlideId] = useState<string>()

  const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (isCollapsed) {
      return
    }

    const startX = event.clientX
    const startWidth = railWidth
    const resizeHandle = event.currentTarget

    resizeHandle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      onResizeRail(clampThumbnailRailWidth(startWidth + moveEvent.clientX - startX))
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  if (isCollapsed) {
    return (
      <aside className="thumbnail-rail thumbnail-rail--collapsed" aria-label="Collapsed slide rail">
        <button
          type="button"
          className="thumbnail-rail__collapsed-button"
          title="Show slide thumbnails"
          onClick={onToggleCollapsed}
        >
          <span>Slides</span>
          <strong>{slides.length}</strong>
        </button>
      </aside>
    )
  }

  return (
    <aside className={`thumbnail-rail ${isCompact ? 'thumbnail-rail--compact' : ''}`}>
      <div className="thumbnail-rail__header">
        <div>
          <span className="section-label">Slides</span>
          <strong>{slides.length}</strong>
        </div>
        <div className="thumbnail-rail__controls" aria-label="Slide controls">
          <button type="button" title="Hide thumbnail rail" onClick={onToggleCollapsed}>
            Hide
          </button>
          <button
            type="button"
            className={isCompact ? 'is-active' : ''}
            title="Toggle compact thumbnails"
            onClick={onToggleCompact}
          >
            Compact
          </button>
          <button type="button" title="Add slide" onClick={onAddSlide}>
            Add
          </button>
          <select
            className="thumbnail-rail__layout-select"
            aria-label="Add slide with layout"
            title="Add slide with layout"
            defaultValue=""
            onChange={(event) => {
              const preset = event.target.value as SlideLayoutPreset

              if (preset) {
                onAddSlideWithLayout(preset)
                event.currentTarget.value = ''
              }
            }}
          >
            <option value="">Layout</option>
            {SLIDE_LAYOUT_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            title="Duplicate slide"
            disabled={!selectedSlideId}
            onClick={onDuplicateSlide}
          >
            Dup
          </button>
          <button type="button" title="Delete slide" disabled={!selectedSlideId} onClick={onDeleteSlide}>
            Del
          </button>
        </div>
      </div>

      <div className="thumbnail-rail__list">
        {slides.map((slide) => (
          <button
            key={slide.id}
            type="button"
            draggable
            aria-grabbed={draggedSlideId === slide.id}
            className={`thumbnail-card ${selectedSlideId === slide.id ? 'is-selected' : ''} ${
              draggedSlideId === slide.id ? 'is-dragging' : ''
            } ${dropTargetSlideId === slide.id && draggedSlideId !== slide.id ? 'is-drop-target' : ''}`}
            onClick={() => onSelectSlide(slide.id)}
            onContextMenu={(event) => {
              event.preventDefault()
              onSelectSlide(slide.id)
              onOpenSlideContextMenu(slide.id, event.clientX, event.clientY)
            }}
            onDragStart={(event) => {
              setDraggedSlideId(slide.id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', slide.id)
            }}
            onDragOver={(event) => {
              if (!draggedSlideId || draggedSlideId === slide.id) {
                return
              }

              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDropTargetSlideId(slide.id)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropTargetSlideId(undefined)
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              const sourceSlideId = draggedSlideId ?? event.dataTransfer.getData('text/plain')

              if (sourceSlideId && sourceSlideId !== slide.id) {
                onReorderSlides(getReorderedSlideIds(slides, sourceSlideId, slide.id))
              }

              setDraggedSlideId(undefined)
              setDropTargetSlideId(undefined)
            }}
            onDragEnd={() => {
              setDraggedSlideId(undefined)
              setDropTargetSlideId(undefined)
            }}
          >
            <span className="thumbnail-card__index">{slide.index}</span>
            <span className="thumbnail-card__preview" aria-label={`Slide ${slide.index} preview`}>
              {slide.blocks
                .map((block, index) => ({
                  block,
                  layout: normalizeBlockLayout(block, index),
                  textStyle: normalizeBlockTextStyle(block),
                }))
                .sort((left, right) => left.layout.zIndex - right.layout.zIndex)
                .map(({ block, layout, textStyle }) => (
                  <span
                    key={block.id}
                    className={`thumbnail-slide-object thumbnail-slide-object--${block.type} ${
                      block.imageAsset ? 'has-image' : ''
                    }`}
                    style={{
                      left: `${layout.x}%`,
                      top: `${layout.y}%`,
                      width: `${layout.width}%`,
                      height: `${layout.height}%`,
                      zIndex: layout.zIndex,
                      fontFamily: textStyle.fontFamily,
                      fontSize: `${Math.max(3.5, textStyle.fontSizePx * 0.16)}px`,
                      fontWeight: textStyle.bold ? 800 : 400,
                      fontStyle: textStyle.italic ? 'italic' : 'normal',
                      textDecoration: textStyle.underline ? 'underline' : 'none',
                      textAlign: textStyle.alignment,
                      color: textStyle.color,
                    }}
                  >
                    <ThumbnailBlockContent block={block} />
                  </span>
                ))}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="thumbnail-rail__resize-handle"
        aria-label="Resize thumbnail rail"
        title="Drag to resize thumbnail rail"
        onPointerDown={handleResizeStart}
      />
    </aside>
  )
}

function ThumbnailBlockContent({ block }: { block: Slide['blocks'][number] }) {
  if (block.type === 'shape') {
    const visualStyle = normalizeBlockVisualStyle(block)

    return (
      <span
        className="thumbnail-slide-object__shape"
        style={{
          backgroundColor: visualStyle.fillColor,
          borderColor: visualStyle.borderColor,
          borderWidth: `${Math.max(0.5, visualStyle.borderWidthPx * 0.2)}px`,
          opacity: visualStyle.opacity,
        }}
      />
    )
  }

  if (block.type === 'visual-placeholder' && block.imageAsset) {
    return (
      <img
        className="thumbnail-slide-object__image"
        src={block.imageAsset.dataUrl}
        alt={block.imageAsset.altText ?? block.imageAsset.name}
        style={{
          objectFit: block.imageAsset.fit === 'fit' ? 'contain' : 'cover',
        }}
      />
    )
  }

  if (Array.isArray(block.content)) {
    return (
      <span className="thumbnail-slide-object__bullets">
        {block.content.slice(0, 4).map((item, index) => (
          <span key={`${block.id}-${index}`}>{item}</span>
        ))}
      </span>
    )
  }

  return <span className="thumbnail-slide-object__text">{block.content || block.placeholder}</span>
}
