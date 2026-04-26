import { useRef } from 'react'
import type { ManualBlockKind } from '../../data/slideLayout'
import { normalizeBlockTextStyle, normalizeBlockVisualStyle } from '../../data/slideLayout'
import type { ObjectAlignment, ObjectDistribution } from '../../data/slideObjectTools'
import type { SlideBlock, SlideBlockVisualStyle, SlideTextStyle } from '../../types/models'

interface FormattingToolbarProps {
  selectedBlock?: SlideBlock
  onTextStyleChange: (style: Partial<SlideTextStyle>) => void
  onVisualStyleChange: (style: Partial<SlideBlockVisualStyle>) => void
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
  { label: 'Obj L', value: 'left' },
  { label: 'Obj C', value: 'center' },
  { label: 'Obj R', value: 'right' },
  { label: 'Obj T', value: 'top' },
  { label: 'Obj M', value: 'middle' },
  { label: 'Obj B', value: 'bottom' },
]

function canFormatText(block?: SlideBlock) {
  return Boolean(block && block.type !== 'shape' && block.type !== 'visual-placeholder')
}

export function FormattingToolbar({
  selectedBlock,
  onTextStyleChange,
  onVisualStyleChange,
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
  const disabled = !canFormatText(selectedBlock)
  const textStyle = selectedBlock ? normalizeBlockTextStyle(selectedBlock) : undefined
  const visualStyle = selectedBlock?.type === 'shape' ? normalizeBlockVisualStyle(selectedBlock) : undefined
  const canReplaceImage = selectedBlock?.type === 'visual-placeholder'
  const hasSelectedObjects = selectedBlockCount > 0
  const canDistributeObjects = selectedBlockCount >= 3

  return (
    <div className="toolbar">
      <div className="toolbar__group toolbar__group--insert">
        <button type="button" onClick={() => onAddBlock('text-box')}>
          Text box
        </button>
        <button type="button" onClick={() => onAddBlock('heading')}>
          Heading
        </button>
        <button type="button" onClick={() => onAddBlock('image-placeholder')}>
          Image
        </button>
        <button type="button" onClick={() => onAddBlock('shape')}>
          Rectangle
        </button>
        <button type="button" onClick={() => onAddBlock('chart-placeholder')}>
          Chart
        </button>
      </div>

      <div className="toolbar__group toolbar__group--object">
        <button type="button" disabled={!hasSelectedObjects} onClick={onCopyBlock}>
          Copy
        </button>
        <button type="button" disabled={!hasSelectedObjects} onClick={onCutBlock}>
          Cut
        </button>
        <button type="button" disabled={!canPasteBlock} onClick={onPasteBlock}>
          Paste
        </button>
      </div>

      <div className="toolbar__group toolbar__group--font">
        <select
          aria-label="Font family"
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
          <span>Text</span>
          <input
            aria-label="Text color"
            type="color"
            disabled={disabled}
            value={textStyle?.color ?? '#172033'}
            onChange={(event) => onTextStyleChange({ color: event.target.value })}
          />
        </label>
      </div>

      <div className="toolbar__group">
        <button
          type="button"
          className={textStyle?.bold ? 'is-active' : ''}
          disabled={disabled}
          onClick={() => onTextStyleChange({ bold: !textStyle?.bold })}
        >
          Bold
        </button>
        <button
          type="button"
          className={textStyle?.italic ? 'is-active' : ''}
          disabled={disabled}
          onClick={() => onTextStyleChange({ italic: !textStyle?.italic })}
        >
          Italic
        </button>
        <button
          type="button"
          className={textStyle?.underline ? 'is-active' : ''}
          disabled={disabled}
          onClick={() => onTextStyleChange({ underline: !textStyle?.underline })}
        >
          Underline
        </button>
      </div>

      <div className="toolbar__group">
        {alignments.map((option) => (
          <button
            key={option.value}
            type="button"
            className={textStyle?.alignment === option.value ? 'is-active' : ''}
            disabled={disabled}
            onClick={() => onTextStyleChange({ alignment: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="toolbar__group toolbar__group--object-align">
        {objectAlignments.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={!hasSelectedObjects}
            onClick={() => onAlignBlock(option.value)}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          disabled={!canDistributeObjects}
          title={canDistributeObjects ? 'Distribute selected objects horizontally' : 'Select 3+ objects'}
          onClick={() => onDistributeBlocks('horizontal')}
        >
          Dist H
        </button>
        <button
          type="button"
          disabled={!canDistributeObjects}
          title={canDistributeObjects ? 'Distribute selected objects vertically' : 'Select 3+ objects'}
          onClick={() => onDistributeBlocks('vertical')}
        >
          Dist V
        </button>
      </div>

      {visualStyle ? (
        <div className="toolbar__group toolbar__group--visual">
          <label className="toolbar__color-control">
            <span>Fill</span>
            <input
              aria-label="Shape fill color"
              type="color"
              value={visualStyle.fillColor}
              onChange={(event) => onVisualStyleChange({ fillColor: event.target.value })}
            />
          </label>

          <label className="toolbar__color-control">
            <span>Border</span>
            <input
              aria-label="Shape border color"
              type="color"
              value={visualStyle.borderColor}
              onChange={(event) => onVisualStyleChange({ borderColor: event.target.value })}
            />
          </label>

          <label className="toolbar__number-control">
            <span>Border px</span>
            <input
              aria-label="Shape border width"
              type="number"
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
          <button type="button" onClick={() => imageInputRef.current?.click()}>
            Replace Image
          </button>
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
