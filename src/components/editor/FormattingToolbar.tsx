import { useEffect, useRef, useState } from 'react'
import { applyListStyle, getLineSpacingValue, getVerticalAlignmentValue } from '../../data/paragraphControls'
import type { ManualBlockKind } from '../../data/slideLayout'
import {
  normalizeBlockLayout,
  normalizeBlockTextStyle,
  normalizeBlockVisualStyle,
} from '../../data/slideLayout'
import type { ObjectAlignment, ObjectDistribution } from '../../data/slideObjectTools'
import type {
  SlideBlock,
  SlideBlockVisualStyle,
  SlideImageAsset,
  SlideTextStyle,
} from '../../types/models'

interface FormattingToolbarProps {
  selectedBlock?: SlideBlock
  onTextStyleChange: (style: Partial<SlideTextStyle>) => void
  onTextBlockContentChange: (content: SlideBlock['content']) => void
  onVisualStyleChange: (style: Partial<SlideBlockVisualStyle>) => void
  onImageAssetChange: (imageAsset: SlideImageAsset) => void
  onResetImage: () => void
  onReplaceImage: (file: File) => void
  onAddBlock: (kind: ManualBlockKind) => void
  onCopyBlock: () => void
  onCutBlock: () => void
  onPasteBlock: () => void
  onAlignBlock: (alignment: ObjectAlignment) => void
  onDistributeBlocks: (distribution: ObjectDistribution) => void
  canPasteBlock: boolean
  selectedBlockCount: number
}

const fontFamilies = [
  'Inter',
  'Arial',
  'Calibri',
  'Georgia',
  'Times New Roman',
  'Helvetica',
  'Verdana',
]

const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56]

const alignments: Array<{ label: string; value: SlideTextStyle['alignment'] }> = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
]

const objectAlignments: Array<{ label: string; value: ObjectAlignment }> = [
  { label: 'L', value: 'left' },
  { label: 'C', value: 'center' },
  { label: 'R', value: 'right' },
  { label: 'T', value: 'top' },
  { label: 'M', value: 'middle' },
  { label: 'B', value: 'bottom' },
]

function canFormatText(block?: SlideBlock) {
  return Boolean(block && block.type !== 'shape' && block.type !== 'visual-placeholder')
}

export function FormattingToolbar({
  selectedBlock,
  onTextStyleChange,
  onTextBlockContentChange,
  onVisualStyleChange,
  onImageAssetChange,
  onResetImage,
  onReplaceImage,
  onAddBlock,
  onCopyBlock,
  onCutBlock,
  onPasteBlock,
  onAlignBlock,
  onDistributeBlocks,
  canPasteBlock,
  selectedBlockCount,
}: FormattingToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const arrangeMenuRef = useRef<HTMLDivElement | null>(null)
  const [isArrangeMenuOpen, setIsArrangeMenuOpen] = useState(false)
  const selectedBlockLocked = selectedBlock ? normalizeBlockLayout(selectedBlock, 0).locked === true : false
  const disabled = !canFormatText(selectedBlock) || selectedBlockLocked
  const textStyle = selectedBlock ? normalizeBlockTextStyle(selectedBlock) : undefined
  const visualStyle = selectedBlock?.type === 'shape' ? normalizeBlockVisualStyle(selectedBlock) : undefined
  const canReplaceImage = selectedBlock?.type === 'visual-placeholder'
  const selectedImageAsset = selectedBlock?.imageAsset
  const hasSelectedObjects = selectedBlockCount > 0
  const canArrangeObjects = hasSelectedObjects && !selectedBlockLocked
  const canDistributeObjects = selectedBlockCount >= 3 && !selectedBlockLocked

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && arrangeMenuRef.current?.contains(target)) {
        return
      }

      setIsArrangeMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsArrangeMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="toolbar">
      <div className="toolbar__group toolbar__group--insert">
        <span className="toolbar__group-label">Insert</span>
        <button type="button" title="Add text box" onClick={() => onAddBlock('text-box')}>
          T
        </button>
        <button type="button" title="Add heading" onClick={() => onAddBlock('heading')}>
          H1
        </button>
        <button type="button" title="Add image placeholder" onClick={() => onAddBlock('image-placeholder')}>
          Img
        </button>
        <button type="button" title="Add rectangle" onClick={() => onAddBlock('shape')}>
          Rect
        </button>
        <button type="button" title="Add chart placeholder" onClick={() => onAddBlock('chart-placeholder')}>
          Chart
        </button>
      </div>

      <div className="toolbar__group toolbar__group--object">
        <span className="toolbar__group-label">Edit</span>
        <button type="button" title="Copy selected object (Ctrl/Cmd+C)" disabled={!hasSelectedObjects} onClick={onCopyBlock}>
          Copy
        </button>
        <button type="button" title="Cut selected object (Ctrl/Cmd+X)" disabled={!hasSelectedObjects} onClick={onCutBlock}>
          Cut
        </button>
        <button type="button" title="Paste copied object (Ctrl/Cmd+V)" disabled={!canPasteBlock} onClick={onPasteBlock}>
          Paste
        </button>
      </div>

      <div className="toolbar__group toolbar__group--font">
        <span className="toolbar__group-label">Text</span>
        <select
          aria-label="Font family"
          title="Font family"
          disabled={disabled}
          value={textStyle?.fontFamily ?? fontFamilies[0]}
          onChange={(event) => onTextStyleChange({ fontFamily: event.target.value })}
        >
          {fontFamilies.map((fontFamily) => (
            <option key={fontFamily} value={fontFamily}>
              {fontFamily}
            </option>
          ))}
        </select>

        <input
          aria-label="Font size in pixels"
          title="Font size in pixels"
          type="number"
          min={8}
          max={160}
          step={1}
          list="editor-font-size-options"
          disabled={disabled}
          value={textStyle?.fontSizePx ?? 18}
          onChange={(event) => {
            const nextSize = Number(event.target.value)

            if (Number.isFinite(nextSize)) {
              onTextStyleChange({ fontSizePx: nextSize })
            }
          }}
        />
        <datalist id="editor-font-size-options">
          {fontSizes.map((fontSize) => (
            <option key={fontSize} value={fontSize} />
          ))}
        </datalist>

        <label className="toolbar__color-control">
          <span>Color</span>
          <input
            aria-label="Text color"
            type="color"
            disabled={disabled}
            value={textStyle?.color ?? '#172033'}
            onChange={(event) => onTextStyleChange({ color: event.target.value })}
          />
        </label>
        <button
          type="button"
          className={textStyle?.bold ? 'is-active' : ''}
          title="Bold (Ctrl/Cmd+B)"
          disabled={disabled}
          onClick={() => onTextStyleChange({ bold: !textStyle?.bold })}
        >
          B
        </button>
        <button
          type="button"
          className={textStyle?.italic ? 'is-active' : ''}
          title="Italic (Ctrl/Cmd+I)"
          disabled={disabled}
          onClick={() => onTextStyleChange({ italic: !textStyle?.italic })}
        >
          I
        </button>
        <button
          type="button"
          className={textStyle?.underline ? 'is-active' : ''}
          title="Underline (Ctrl/Cmd+U)"
          disabled={disabled}
          onClick={() => onTextStyleChange({ underline: !textStyle?.underline })}
        >
          U
        </button>
        {alignments.map((option) => (
          <button
            key={option.value}
            type="button"
            className={textStyle?.alignment === option.value ? 'is-active' : ''}
            title={`Align ${option.label.toLowerCase()}`}
            disabled={disabled}
            onClick={() => onTextStyleChange({ alignment: option.value })}
          >
            {option.label.slice(0, 1)}
          </button>
        ))}
        <button
          type="button"
          className={textStyle?.listStyle === 'bullet' ? 'is-active' : ''}
          title="Toggle bullets"
          disabled={disabled || !selectedBlock}
          onClick={() => {
            if (!selectedBlock) {
              return
            }

            const update = applyListStyle(selectedBlock, 'bullet')
            onTextBlockContentChange(update.content)
            onTextStyleChange(update.textStyle)
          }}
        >
          Bul
        </button>
        <button
          type="button"
          className={textStyle?.listStyle === 'number' ? 'is-active' : ''}
          title="Toggle numbered list"
          disabled={disabled || !selectedBlock}
          onClick={() => {
            if (!selectedBlock) {
              return
            }

            const update = applyListStyle(selectedBlock, 'number')
            onTextBlockContentChange(update.content)
            onTextStyleChange(update.textStyle)
          }}
        >
          1.
        </button>
        <select
          aria-label="Line spacing"
          title="Line spacing"
          disabled={disabled}
          value={String(textStyle?.lineHeight ?? 1.18)}
          onChange={(event) => onTextStyleChange({ lineHeight: getLineSpacingValue(Number(event.target.value)) })}
        >
          <option value="1">1.0</option>
          <option value="1.2">1.2</option>
          <option value="1.4">1.4</option>
          <option value="1.6">1.6</option>
          <option value="2">2.0</option>
        </select>
        <select
          aria-label="Vertical alignment"
          title="Vertical alignment"
          disabled={disabled}
          value={textStyle?.verticalAlign ?? 'top'}
          onChange={(event) =>
            onTextStyleChange({ verticalAlign: getVerticalAlignmentValue(event.target.value) })
          }
        >
          <option value="top">Top</option>
          <option value="middle">Mid</option>
          <option value="bottom">Bot</option>
        </select>
      </div>

      <div className="toolbar__group toolbar__group--object-align" ref={arrangeMenuRef}>
        <span className="toolbar__group-label">Arrange</span>
        <button
          type="button"
          title="Open object alignment menu"
          aria-expanded={isArrangeMenuOpen}
          disabled={!canArrangeObjects}
          onClick={() => setIsArrangeMenuOpen((current) => !current)}
        >
          Align
        </button>
        {isArrangeMenuOpen ? (
          <div className="toolbar-menu__popover">
            {objectAlignments.map((option) => (
              <button
                key={option.value}
                type="button"
                title={`Align object ${option.value}`}
                disabled={!canArrangeObjects}
                onClick={() => {
                  setIsArrangeMenuOpen(false)
                  onAlignBlock(option.value)
                }}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              disabled={!canDistributeObjects}
              title={canDistributeObjects ? 'Distribute selected objects horizontally' : 'Select 3+ objects'}
              onClick={() => {
                setIsArrangeMenuOpen(false)
                onDistributeBlocks('horizontal')
              }}
            >
              Dist X
            </button>
            <button
              type="button"
              disabled={!canDistributeObjects}
              title={canDistributeObjects ? 'Distribute selected objects vertically' : 'Select 3+ objects'}
              onClick={() => {
                setIsArrangeMenuOpen(false)
                onDistributeBlocks('vertical')
              }}
            >
              Dist Y
            </button>
          </div>
        ) : null}
        {objectAlignments.slice(0, 3).map((option) => (
          <button
            key={option.value}
            type="button"
            title={`Align object ${option.value}`}
          disabled={!canArrangeObjects}
            onClick={() => onAlignBlock(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visualStyle ? (
        <div className="toolbar__group toolbar__group--visual">
          <span className="toolbar__group-label">Shape/Image</span>
          <label className="toolbar__color-control">
            <span>Fill</span>
            <input
              aria-label="Shape fill color"
              type="color"
              disabled={selectedBlockLocked}
              value={visualStyle.fillColor}
              onChange={(event) => onVisualStyleChange({ fillColor: event.target.value })}
            />
          </label>

          <label className="toolbar__color-control">
            <span>Border</span>
            <input
              aria-label="Shape border color"
              type="color"
              disabled={selectedBlockLocked}
              value={visualStyle.borderColor}
              onChange={(event) => onVisualStyleChange({ borderColor: event.target.value })}
            />
          </label>

          <label className="toolbar__number-control">
            <span>Border px</span>
            <input
              aria-label="Shape border width"
              type="number"
              disabled={selectedBlockLocked}
              min={0}
              max={24}
              step={1}
              value={visualStyle.borderWidthPx}
              onChange={(event) => {
                const nextWidth = Number(event.target.value)

                if (Number.isFinite(nextWidth)) {
                  onVisualStyleChange({ borderWidthPx: nextWidth })
                }
              }}
            />
          </label>

          <label className="toolbar__number-control">
            <span>Opacity</span>
            <input
              aria-label="Shape opacity"
              type="number"
              disabled={selectedBlockLocked}
              min={0}
              max={1}
              step={0.05}
              value={visualStyle.opacity}
              onChange={(event) => {
                const nextOpacity = Number(event.target.value)

                if (Number.isFinite(nextOpacity)) {
                  onVisualStyleChange({ opacity: nextOpacity })
                }
              }}
            />
          </label>
        </div>
      ) : null}

      {canReplaceImage ? (
        <div className="toolbar__group toolbar__group--visual">
          <span className="toolbar__group-label">Shape/Image</span>
          <button
            type="button"
            title="Replace image"
            disabled={selectedBlockLocked}
            onClick={() => imageInputRef.current?.click()}
          >
            Replace
          </button>
          {selectedImageAsset ? (
            <>
              <button
                type="button"
                className={selectedImageAsset.fit !== 'fit' ? 'is-active' : ''}
                title="Fill image frame"
                disabled={selectedBlockLocked}
                onClick={() => onImageAssetChange({ ...selectedImageAsset, fit: 'fill' })}
              >
                Fill
              </button>
              <button
                type="button"
                className={selectedImageAsset.fit === 'fit' ? 'is-active' : ''}
                title="Fit image inside frame"
                disabled={selectedBlockLocked}
                onClick={() => onImageAssetChange({ ...selectedImageAsset, fit: 'fit' })}
              >
                Fit
              </button>
              <button
                type="button"
                title="Reset image placeholder"
                disabled={selectedBlockLocked}
                onClick={onResetImage}
              >
                Reset
              </button>
              <label className="toolbar__text-control">
                <span>Alt</span>
                <input
                  aria-label="Image alt text"
                  type="text"
                  disabled={selectedBlockLocked}
                  value={selectedImageAsset.altText ?? selectedImageAsset.name}
                  onChange={(event) =>
                    onImageAssetChange({ ...selectedImageAsset, altText: event.target.value })
                  }
                />
              </label>
            </>
          ) : null}
          <input
            ref={imageInputRef}
            className="toolbar__file-input"
            type="file"
            accept="image/*"
            aria-label="Choose replacement image"
            onChange={(event) => {
              const file = event.target.files?.[0]

              if (file) {
                onReplaceImage(file)
                event.target.value = ''
              }
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
