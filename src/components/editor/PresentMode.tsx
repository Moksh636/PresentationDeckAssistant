import { useEffect } from 'react'
import type { RefObject } from 'react'
import {
  normalizeBlockLayout,
  normalizeBlockTextStyle,
  normalizeBlockVisualStyle,
} from '../../data/slideLayout'
import type { Slide, SlideBlock } from '../../types/models'

interface PresentModeProps {
  slides: Slide[]
  activeSlideId?: string
  isActive: boolean
  containerRef: RefObject<HTMLDivElement | null>
  onNext: () => void
  onPrevious: () => void
  onExit: () => void
}

function getSlidePosition(slides: Slide[], activeSlideId?: string) {
  const index = Math.max(
    0,
    slides.findIndex((slide) => slide.id === activeSlideId),
  )

  return {
    index,
    slide: slides[index],
  }
}

function ReadOnlySlideBlock({ block, index }: { block: SlideBlock; index: number }) {
  const layout = normalizeBlockLayout(block, index)
  const textStyle = normalizeBlockTextStyle(block)
  const visualStyle = block.type === 'shape' ? normalizeBlockVisualStyle(block) : undefined

  return (
    <div
      className={`present-slide-object present-slide-object--${block.type} ${
        block.imageAsset ? 'has-image' : ''
      }`}
      style={{
        left: `${layout.x}%`,
        top: `${layout.y}%`,
        width: `${layout.width}%`,
        height: `${layout.height}%`,
        zIndex: layout.zIndex,
        fontFamily: textStyle.fontFamily,
        fontSize: `${textStyle.fontSizePx}px`,
        fontWeight: textStyle.bold ? 800 : 400,
        fontStyle: textStyle.italic ? 'italic' : 'normal',
        textDecoration: textStyle.underline ? 'underline' : 'none',
        textAlign: textStyle.alignment,
        color: textStyle.color,
      }}
    >
      {block.type === 'shape' && visualStyle ? (
        <div
          className="present-slide-object__shape"
          style={{
            backgroundColor: visualStyle.fillColor,
            borderColor: visualStyle.borderColor,
            borderWidth: `${visualStyle.borderWidthPx}px`,
            opacity: visualStyle.opacity,
          }}
        />
      ) : null}

      {block.type === 'visual-placeholder' && block.imageAsset ? (
        <img
          className="present-slide-object__image"
          src={block.imageAsset.dataUrl}
          alt={block.imageAsset.name}
        />
      ) : null}

      {block.type !== 'shape' && !block.imageAsset && Array.isArray(block.content) ? (
        <ul className="present-slide-object__bullets">
          {block.content.map((item, itemIndex) => (
            <li key={`${block.id}-${itemIndex}`}>{item}</li>
          ))}
        </ul>
      ) : null}

      {block.type !== 'shape' && !block.imageAsset && typeof block.content === 'string' ? (
        <div className="present-slide-object__text">
          {block.content || block.placeholder || ' '}
        </div>
      ) : null}
    </div>
  )
}

export function PresentMode({
  slides,
  activeSlideId,
  isActive,
  containerRef,
  onNext,
  onPrevious,
  onExit,
}: PresentModeProps) {
  const { index, slide } = getSlidePosition(slides, activeSlideId)

  useEffect(() => {
    if (!isActive) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        onNext()
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onPrevious()
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, onExit, onNext, onPrevious])

  return (
    <div
      ref={containerRef}
      className={`present-mode ${isActive ? 'is-active' : ''}`}
      aria-hidden={!isActive}
    >
      {slide ? (
        <div className="present-mode__stage">
          <div className="present-mode__slide" aria-label={`Slide ${index + 1}: ${slide.title}`}>
            {slide.blocks
              .map((block, blockIndex) => ({
                block,
                layout: normalizeBlockLayout(block, blockIndex),
                index: blockIndex,
              }))
              .sort((left, right) => left.layout.zIndex - right.layout.zIndex)
              .map(({ block, index: blockIndex }) => (
                <ReadOnlySlideBlock key={block.id} block={block} index={blockIndex} />
              ))}
          </div>

          <div className="present-mode__controls" aria-label="Presentation controls">
            <button type="button" onClick={onPrevious} disabled={index === 0}>
              Previous
            </button>
            <span>
              {index + 1} / {slides.length}
            </span>
            <button type="button" onClick={onNext} disabled={index >= slides.length - 1}>
              Next
            </button>
            <button type="button" onClick={onExit}>
              Exit
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
