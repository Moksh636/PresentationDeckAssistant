import type { ComponentProps, Dispatch, RefObject, SetStateAction } from 'react'
import { AuthControls } from '../auth/AuthControls'
import { AnchoredMenu } from '../ui/AnchoredMenu'
import { FormattingToolbar } from './FormattingToolbar'
import type { EditorSidePanelMode } from './EditorSidePanel'
import type { ManualBlockKind } from '../../data/slideLayout'
import { normalizeBlockTextStyle } from '../../data/slideLayout'
import { SLIDE_LAYOUT_PRESETS, type SlideLayoutPreset } from '../../data/slideLayoutPresets'
import type { ObjectAlignment } from '../../data/slideObjectTools'
import type { SlideBlock, SlideTextStyle } from '../../types/models'

export type ChromeMenuId =
  | 'file'
  | 'edit'
  | 'view'
  | 'insert'
  | 'format'
  | 'slide'
  | 'arrange'
  | 'tools'
  | 'help'
  | 'present'

const objectAlignments: Array<{ label: string; value: ObjectAlignment }> = [
  { label: 'L', value: 'left' },
  { label: 'C', value: 'center' },
  { label: 'R', value: 'right' },
  { label: 'T', value: 'top' },
  { label: 'M', value: 'middle' },
  { label: 'B', value: 'bottom' },
]

const menuFontFamilies = [
  'Inter',
  'Arial',
  'Calibri',
  'Georgia',
  'Times New Roman',
  'Helvetica',
  'Verdana',
] as const

export type ArrangeLayerDirection = 'forward' | 'backward' | 'front' | 'back'

type FormattingProps = Omit<ComponentProps<typeof FormattingToolbar>, 'variant'>

export interface EditorMainChromeProps {
  activeDeckTitle: string
  slideCount: number
  canUndo: boolean
  canRedo: boolean
  undoWorkspace: () => void
  redoWorkspace: () => void
  onShare: () => void
  startPresentationFromSlide: (slideId?: string) => void
  startPresentation: () => void
  firstSlideId?: string
  isExportingPptx: boolean
  onExportPptx: () => void
  onOpenReport: () => void
  onPrintReport: () => void
  onAlternateVersion: () => void
  openChromeMenu: ChromeMenuId | undefined
  setOpenChromeMenu: Dispatch<SetStateAction<ChromeMenuId | undefined>>
  fileMenuRef: RefObject<HTMLButtonElement | null>
  editMenuRef: RefObject<HTMLButtonElement | null>
  viewMenuRef: RefObject<HTMLButtonElement | null>
  insertMenuRef: RefObject<HTMLButtonElement | null>
  formatMenuRef: RefObject<HTMLButtonElement | null>
  slideMenuRef: RefObject<HTMLButtonElement | null>
  arrangeMenuRef: RefObject<HTMLButtonElement | null>
  toolsMenuRef: RefObject<HTMLButtonElement | null>
  helpMenuRef: RefObject<HTMLButtonElement | null>
  presentMenuTriggerRef: RefObject<HTMLButtonElement | null>
  onPointerTool: () => void
  copySelectedBlocks: () => void
  cutSelectedBlocks: () => void
  pasteClipboardBlocks: () => void
  canPasteClipboard: boolean
  deleteSelectedUnlockedBlocks: () => void
  handleZoom: (direction: 'in' | 'out') => void
  handleFitToWindow: () => void
  zoomPercent: number
  showSources: boolean
  setShowSources: Dispatch<SetStateAction<boolean>>
  onOpenAiPanel: () => void
  onOpenCommentsPanel: () => void
  commentThreadCount: number
  activeSidePanel?: EditorSidePanelMode
  handleAddBlock: (kind: ManualBlockKind) => void
  handleAddSlide: () => void
  handleDuplicateSlide: () => void
  handleDeleteSlide: () => void
  handleAddSlideWithLayout: (preset: SlideLayoutPreset) => void
  alignSelectedBlocks: (alignment: ObjectAlignment) => void
  distributeSelectedBlocks: (distribution: 'horizontal' | 'vertical') => void
  onArrangeLayer: (direction: ArrangeLayerDirection) => void
  canArrangeLayer: boolean
  selectedBlockCount: number
  canDistribute: boolean
  selectedSlide?: { id: string }
  selectedBlock?: SlideBlock
  canApplyMenuTextFormat: boolean
  onMenuTextStyleChange: (style: Partial<SlideTextStyle>) => void
  showToast: (message: string, variant?: 'success' | 'error' | 'info') => void
  formattingToolbarProps: FormattingProps
}

type MenuTriggerProps = {
  id: ChromeMenuId
  label: string
  menuRef: RefObject<HTMLButtonElement | null>
  openChromeMenu: ChromeMenuId | undefined
  setOpenChromeMenu: EditorMainChromeProps['setOpenChromeMenu']
}

function MenuTrigger({ id, label, menuRef, openChromeMenu, setOpenChromeMenu }: MenuTriggerProps) {
  const isOpen = openChromeMenu === id

  return (
    <button
      ref={menuRef}
      type="button"
      className={`editor-menu-bar__trigger ${isOpen ? 'is-open' : ''}`}
      aria-expanded={isOpen}
      aria-haspopup="menu"
      onClick={() => setOpenChromeMenu((current) => (current === id ? undefined : id))}
    >
      {label}
    </button>
  )
}

export function EditorMainChrome({
  activeDeckTitle,
  slideCount,
  canUndo,
  canRedo,
  undoWorkspace,
  redoWorkspace,
  onShare,
  startPresentationFromSlide,
  startPresentation,
  firstSlideId,
  isExportingPptx,
  onExportPptx,
  onOpenReport,
  onPrintReport,
  onAlternateVersion,
  openChromeMenu,
  setOpenChromeMenu,
  fileMenuRef,
  editMenuRef,
  viewMenuRef,
  insertMenuRef,
  formatMenuRef,
  slideMenuRef,
  arrangeMenuRef,
  toolsMenuRef,
  helpMenuRef,
  presentMenuTriggerRef,
  onPointerTool,
  copySelectedBlocks,
  cutSelectedBlocks,
  pasteClipboardBlocks,
  canPasteClipboard,
  deleteSelectedUnlockedBlocks,
  handleZoom,
  handleFitToWindow,
  zoomPercent,
  showSources,
  setShowSources,
  onOpenAiPanel,
  onOpenCommentsPanel,
  commentThreadCount,
  activeSidePanel,
  handleAddBlock,
  handleAddSlide,
  handleDuplicateSlide,
  handleDeleteSlide,
  handleAddSlideWithLayout,
  alignSelectedBlocks,
  distributeSelectedBlocks,
  onArrangeLayer,
  canArrangeLayer,
  selectedBlockCount,
  canDistribute,
  selectedSlide,
  selectedBlock,
  canApplyMenuTextFormat,
  onMenuTextStyleChange,
  showToast,
  formattingToolbarProps,
}: EditorMainChromeProps) {
  const textStyle = selectedBlock ? normalizeBlockTextStyle(selectedBlock) : undefined
  const closeMenu = () => setOpenChromeMenu(undefined)

  return (
    <div className="editor-chrome">
      <header className="editor-doc-bar">
        <div className="editor-doc-bar__brand">
          <span className="editor-doc-bar__product">Studio</span>
        </div>
        <div className="editor-doc-bar__title-block">
          <strong className="editor-doc-bar__deck-title" title={activeDeckTitle}>
            {activeDeckTitle}
          </strong>
          <span className="editor-doc-bar__status">
            Saved locally · {slideCount} {slideCount === 1 ? 'slide' : 'slides'}
          </span>
        </div>
        <div className="editor-doc-bar__history">
          <button
            type="button"
            className="editor-icon-btn"
            title="Undo (Ctrl/Cmd+Z)"
            disabled={!canUndo}
            onClick={() => {
              closeMenu()
              undoWorkspace()
            }}
          >
            Undo
          </button>
          <button
            type="button"
            className="editor-icon-btn"
            title="Redo (Ctrl/Cmd+Y)"
            disabled={!canRedo}
            onClick={() => {
              closeMenu()
              redoWorkspace()
            }}
          >
            Redo
          </button>
        </div>
        <div className="editor-doc-bar__collab">
          <button
            type="button"
            className="editor-doc-bar__primary"
            title="Share deck"
            onClick={() => {
              closeMenu()
              onShare()
            }}
          >
            Share
          </button>
          <div className="editor-overflow-menu">
            <button
              ref={presentMenuTriggerRef}
              type="button"
              className="editor-doc-bar__primary"
              title="Present slideshow"
              aria-expanded={openChromeMenu === 'present'}
              onClick={() =>
                setOpenChromeMenu((current) => (current === 'present' ? undefined : 'present'))
              }
            >
              Present
            </button>
            <AnchoredMenu isOpen={openChromeMenu === 'present'} triggerRef={presentMenuTriggerRef} align="end">
              <div className="editor-overflow-menu__popover editor-overflow-menu__popover--portal">
                <button
                  type="button"
                  onClick={() => {
                    closeMenu()
                    startPresentationFromSlide(firstSlideId)
                  }}
                >
                  From beginning
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu()
                    startPresentation()
                  }}
                >
                  From current slide
                </button>
              </div>
            </AnchoredMenu>
          </div>
        </div>
        <div className="editor-doc-bar__account">
          <AuthControls variant="compact" />
        </div>
      </header>

      <nav className="editor-menu-bar" aria-label="Main menu">
        <MenuTrigger
          id="file"
          label="File"
          menuRef={fileMenuRef}
          openChromeMenu={openChromeMenu}
          setOpenChromeMenu={setOpenChromeMenu}
        />
        <AnchoredMenu isOpen={openChromeMenu === 'file'} triggerRef={fileMenuRef} align="start">
          <div className="editor-overflow-menu__popover editor-overflow-menu__popover--portal">
            <button
              type="button"
              disabled={isExportingPptx}
              onClick={() => {
                closeMenu()
                void onExportPptx()
              }}
            >
              {isExportingPptx ? 'Exporting PPTX...' : 'Export PPTX'}
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                onOpenReport()
              }}
            >
              Generate report
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                onPrintReport()
              }}
            >
              Print / Save report
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                onAlternateVersion()
              }}
            >
              Alternate version
            </button>
          </div>
        </AnchoredMenu>

        <MenuTrigger
          id="edit"
          label="Edit"
          menuRef={editMenuRef}
          openChromeMenu={openChromeMenu}
          setOpenChromeMenu={setOpenChromeMenu}
        />
        <AnchoredMenu isOpen={openChromeMenu === 'edit'} triggerRef={editMenuRef} align="start">
          <div className="editor-overflow-menu__popover editor-overflow-menu__popover--portal">
            <button
              type="button"
              disabled={!canUndo}
              onClick={() => {
                closeMenu()
                undoWorkspace()
              }}
            >
              Undo
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={() => {
                closeMenu()
                redoWorkspace()
              }}
            >
              Redo
            </button>
            <button
              type="button"
              disabled={selectedBlockCount === 0}
              onClick={() => {
                closeMenu()
                cutSelectedBlocks()
              }}
            >
              Cut
            </button>
            <button
              type="button"
              disabled={selectedBlockCount === 0}
              onClick={() => {
                closeMenu()
                copySelectedBlocks()
              }}
            >
              Copy
            </button>
            <button
              type="button"
              disabled={!canPasteClipboard}
              onClick={() => {
                closeMenu()
                pasteClipboardBlocks()
              }}
            >
              Paste
            </button>
            <button
              type="button"
              disabled={selectedBlockCount === 0}
              onClick={() => {
                closeMenu()
                deleteSelectedUnlockedBlocks()
              }}
            >
              Delete
            </button>
          </div>
        </AnchoredMenu>

        <MenuTrigger
          id="view"
          label="View"
          menuRef={viewMenuRef}
          openChromeMenu={openChromeMenu}
          setOpenChromeMenu={setOpenChromeMenu}
        />
        <AnchoredMenu isOpen={openChromeMenu === 'view'} triggerRef={viewMenuRef} align="start">
          <div className="editor-overflow-menu__popover editor-overflow-menu__popover--portal">
            <button
              type="button"
              onClick={() => {
                closeMenu()
                handleZoom('in')
              }}
            >
              Zoom in
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                handleZoom('out')
              }}
            >
              Zoom out
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                handleFitToWindow()
              }}
            >
              Fit to window
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                setShowSources((current) => !current)
              }}
            >
              {showSources ? 'Hide sources' : 'Show sources'}
            </button>
          </div>
        </AnchoredMenu>

        <MenuTrigger
          id="insert"
          label="Insert"
          menuRef={insertMenuRef}
          openChromeMenu={openChromeMenu}
          setOpenChromeMenu={setOpenChromeMenu}
        />
        <AnchoredMenu isOpen={openChromeMenu === 'insert'} triggerRef={insertMenuRef} align="start">
          <div className="editor-overflow-menu__popover editor-overflow-menu__popover--portal">
            <button
              type="button"
              onClick={() => {
                closeMenu()
                handleAddBlock('text-box')
              }}
            >
              Text box
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                handleAddBlock('heading')
              }}
            >
              Heading
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                handleAddBlock('image-placeholder')
              }}
            >
              Image
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                handleAddBlock('shape')
              }}
            >
              Shape
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                handleAddBlock('chart-placeholder')
              }}
            >
              Chart
            </button>
          </div>
        </AnchoredMenu>

        <MenuTrigger
          id="format"
          label="Format"
          menuRef={formatMenuRef}
          openChromeMenu={openChromeMenu}
          setOpenChromeMenu={setOpenChromeMenu}
        />
        <AnchoredMenu isOpen={openChromeMenu === 'format'} triggerRef={formatMenuRef} align="start">
          <div className="editor-overflow-menu__popover editor-overflow-menu__popover--portal editor-overflow-menu__popover--wide">
            <div className="editor-menu-bar__font-row">
              <label className="editor-menu-bar__font-field">
                <span>Font</span>
                <select
                  aria-label="Font family"
                  disabled={!canApplyMenuTextFormat}
                  value={textStyle?.fontFamily ?? menuFontFamilies[0]}
                  onChange={(event) => {
                    onMenuTextStyleChange({ fontFamily: event.target.value })
                  }}
                >
                  {menuFontFamilies.map((fontFamily) => (
                    <option key={fontFamily} value={fontFamily}>
                      {fontFamily}
                    </option>
                  ))}
                </select>
              </label>
              <label className="editor-menu-bar__font-field editor-menu-bar__font-field--size">
                <span>Size</span>
                <input
                  aria-label="Font size in pixels"
                  type="number"
                  min={8}
                  max={160}
                  step={1}
                  disabled={!canApplyMenuTextFormat}
                  value={textStyle?.fontSizePx ?? 18}
                  onChange={(event) => {
                    const nextSize = Number(event.target.value)

                    if (Number.isFinite(nextSize)) {
                      onMenuTextStyleChange({ fontSizePx: nextSize })
                    }
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!canApplyMenuTextFormat}
              onClick={() => {
                closeMenu()
                onMenuTextStyleChange({ bold: !textStyle?.bold })
              }}
            >
              Bold
            </button>
            <button
              type="button"
              disabled={!canApplyMenuTextFormat}
              onClick={() => {
                closeMenu()
                onMenuTextStyleChange({ italic: !textStyle?.italic })
              }}
            >
              Italic
            </button>
            <button
              type="button"
              disabled={!canApplyMenuTextFormat}
              onClick={() => {
                closeMenu()
                onMenuTextStyleChange({ underline: !textStyle?.underline })
              }}
            >
              Underline
            </button>
            <button
              type="button"
              disabled={!canApplyMenuTextFormat}
              onClick={() => {
                closeMenu()
                onMenuTextStyleChange({ alignment: 'left' })
              }}
            >
              Align left
            </button>
            <button
              type="button"
              disabled={!canApplyMenuTextFormat}
              onClick={() => {
                closeMenu()
                onMenuTextStyleChange({ alignment: 'center' })
              }}
            >
              Align center
            </button>
            <button
              type="button"
              disabled={!canApplyMenuTextFormat}
              onClick={() => {
                closeMenu()
                onMenuTextStyleChange({ alignment: 'right' })
              }}
            >
              Align right
            </button>
            <label className="editor-menu-bar__color-row">
              Text color
              <input
                aria-label="Text color"
                type="color"
                disabled={!canApplyMenuTextFormat}
                value={textStyle?.color ?? '#172033'}
                onChange={(event) => {
                  onMenuTextStyleChange({ color: event.target.value })
                }}
              />
            </label>
          </div>
        </AnchoredMenu>

        <MenuTrigger
          id="slide"
          label="Slide"
          menuRef={slideMenuRef}
          openChromeMenu={openChromeMenu}
          setOpenChromeMenu={setOpenChromeMenu}
        />
        <AnchoredMenu isOpen={openChromeMenu === 'slide'} triggerRef={slideMenuRef} align="start">
          <div className="editor-overflow-menu__popover editor-overflow-menu__popover--portal">
            <button
              type="button"
              onClick={() => {
                closeMenu()
                handleAddSlide()
              }}
            >
              New slide
            </button>
            <button
              type="button"
              disabled={!selectedSlide}
              onClick={() => {
                closeMenu()
                handleDuplicateSlide()
              }}
            >
              Duplicate slide
            </button>
            <button
              type="button"
              disabled={!selectedSlide}
              onClick={() => {
                closeMenu()
                handleDeleteSlide()
              }}
            >
              Delete slide
            </button>
            <div className="editor-menu-bar__subheading">New slide from layout</div>
            {SLIDE_LAYOUT_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  closeMenu()
                  handleAddSlideWithLayout(preset.value)
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </AnchoredMenu>

        <MenuTrigger
          id="arrange"
          label="Arrange"
          menuRef={arrangeMenuRef}
          openChromeMenu={openChromeMenu}
          setOpenChromeMenu={setOpenChromeMenu}
        />
        <AnchoredMenu isOpen={openChromeMenu === 'arrange'} triggerRef={arrangeMenuRef} align="start">
          <div className="editor-overflow-menu__popover editor-overflow-menu__popover--portal">
            {objectAlignments.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={selectedBlockCount === 0}
                onClick={() => {
                  closeMenu()
                  alignSelectedBlocks(option.value)
                }}
              >
                Align {option.value}
              </button>
            ))}
            <button
              type="button"
              disabled={!canDistribute}
              onClick={() => {
                closeMenu()
                distributeSelectedBlocks('horizontal')
              }}
            >
              Distribute horizontally
            </button>
            <button
              type="button"
              disabled={!canDistribute}
              onClick={() => {
                closeMenu()
                distributeSelectedBlocks('vertical')
              }}
            >
              Distribute vertically
            </button>
            <div className="editor-menu-bar__subheading">Layer order</div>
            <button
              type="button"
              disabled={!canArrangeLayer}
              onClick={() => {
                closeMenu()
                onArrangeLayer('forward')
              }}
            >
              Bring forward
            </button>
            <button
              type="button"
              disabled={!canArrangeLayer}
              onClick={() => {
                closeMenu()
                onArrangeLayer('backward')
              }}
            >
              Send backward
            </button>
            <button
              type="button"
              disabled={!canArrangeLayer}
              onClick={() => {
                closeMenu()
                onArrangeLayer('front')
              }}
            >
              Bring to front
            </button>
            <button
              type="button"
              disabled={!canArrangeLayer}
              onClick={() => {
                closeMenu()
                onArrangeLayer('back')
              }}
            >
              Send to back
            </button>
          </div>
        </AnchoredMenu>

        <MenuTrigger
          id="tools"
          label="Tools"
          menuRef={toolsMenuRef}
          openChromeMenu={openChromeMenu}
          setOpenChromeMenu={setOpenChromeMenu}
        />
        <AnchoredMenu isOpen={openChromeMenu === 'tools'} triggerRef={toolsMenuRef} align="start">
          <div className="editor-overflow-menu__popover editor-overflow-menu__popover--portal">
            <button
              type="button"
              onClick={() => {
                closeMenu()
                onOpenAiPanel()
              }}
            >
              AI assistant
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                onOpenCommentsPanel()
              }}
            >
              Comments{commentThreadCount > 0 ? ` (${commentThreadCount})` : ''}
            </button>
          </div>
        </AnchoredMenu>

        <MenuTrigger
          id="help"
          label="Help"
          menuRef={helpMenuRef}
          openChromeMenu={openChromeMenu}
          setOpenChromeMenu={setOpenChromeMenu}
        />
        <AnchoredMenu isOpen={openChromeMenu === 'help'} triggerRef={helpMenuRef} align="start">
          <div className="editor-overflow-menu__popover editor-overflow-menu__popover--portal">
            <button
              type="button"
              onClick={() => {
                closeMenu()
                showToast(
                  'Shortcuts: Undo Ctrl+Z · Redo Ctrl+Y or Ctrl+Shift+Z · Cut/Copy/Paste Ctrl+X/C/V · Bold/Italic/Underline Ctrl+B/I/U · Duplicate Ctrl+D · Delete Backspace.',
                  'info',
                )
              }}
            >
              Keyboard shortcuts
            </button>
          </div>
        </AnchoredMenu>
      </nav>

      <div className="editor-toolstrip">
        <div className="editor-toolstrip__group">
          <button
            type="button"
            className="editor-toolstrip__icon-btn"
            title="Select — click slide objects"
            onClick={() => {
              closeMenu()
              onPointerTool()
            }}
          >
            ◇
          </button>
        </div>
        <span className="editor-toolstrip__sep" aria-hidden />
        <div className="editor-toolstrip__group editor-toolstrip__group--zoom">
          <button type="button" title="Zoom out" onClick={() => handleZoom('out')}>
            −
          </button>
          <span className="editor-toolstrip__zoom-label">{zoomPercent}%</span>
          <button type="button" title="Zoom in" onClick={() => handleZoom('in')}>
            +
          </button>
          <button type="button" title="Fit slide to window" onClick={handleFitToWindow}>
            Fit
          </button>
        </div>
        <span className="editor-toolstrip__sep" aria-hidden />
        <FormattingToolbar {...formattingToolbarProps} variant="flat" />
        <span className="editor-toolstrip__sep" aria-hidden />
        <div className="editor-toolstrip__group editor-toolstrip__group--sources">
          <button
            type="button"
            title="Toggle source chips"
            className={showSources ? 'is-active' : ''}
            onClick={() => setShowSources((current) => !current)}
          >
            Sources
          </button>
          <button
            type="button"
            title="AI assistant"
            className={activeSidePanel === 'assistant' ? 'is-active' : ''}
            onClick={() => {
              closeMenu()
              onOpenAiPanel()
            }}
          >
            AI
          </button>
          <button
            type="button"
            title="Comments"
            className={activeSidePanel === 'comments' ? 'is-active' : ''}
            onClick={() => {
              closeMenu()
              onOpenCommentsPanel()
            }}
          >
            Comments
            {commentThreadCount > 0 ? (
              <span className="editor-toolstrip__pill">{commentThreadCount}</span>
            ) : null}
          </button>
        </div>
      </div>
    </div>
  )
}
