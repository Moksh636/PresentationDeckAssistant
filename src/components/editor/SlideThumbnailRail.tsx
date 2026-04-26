import { useState } from 'react'
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
  onDuplicateSlide: () => void
  onDeleteSlide: () => void
  onReorderSlides: (orderedSlideIds: string[]) => void
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
  onDuplicateSlide,
  onDeleteSlide,
  onReorderSlides,
}: SlideThumbnailRailProps) {
  const [draggedSlideId, setDraggedSlideId] = useState<string>()
  const [dropTargetSlideId, setDropTargetSlideId] = useState<string>()

  return (
    <aside className="thumbnail-rail">
      <div className="thumbnail-rail__header">
        <div>
          <span className="section-label">Slides</span>
          <strong>{slides.length}</strong>
        </div>
        <div className="thumbnail-rail__controls" aria-label="Slide controls">
          <button type="button" onClick={onAddSlide}>
            Add
          </button>
          <button type="button" disabled={!selectedSlideId} onClick={onDuplicateSlide}>
            Duplicate
          </button>
          <button type="button" disabled={!selectedSlideId} onClick={onDeleteSlide}>
            Delete
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
        alt={block.imageAsset.name}
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
