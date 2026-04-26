import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiChatPanel, type AiChatMessage } from '../components/editor/AiChatPanel'
import { ShareProjectModal } from '../components/collaboration/ShareProjectModal'
import { DeckReportModal } from '../components/editor/DeckReportModal'
import { EditorCommentsPanel } from '../components/editor/EditorCommentsPanel'
import { EditorSidePanel, type EditorSidePanelMode } from '../components/editor/EditorSidePanel'
import { FormattingToolbar } from '../components/editor/FormattingToolbar'
import { PresentMode } from '../components/editor/PresentMode'
import { SlideCanvas } from '../components/editor/SlideCanvas'
import { SlideThumbnailRail } from '../components/editor/SlideThumbnailRail'
import { useWorkspace } from '../context/useWorkspace'
import { buildMockAiEditPlan, type AiEditPlan, type AiEditScope } from '../data/aiEditor'
import {
  alignBlockLayouts,
  distributeBlockLayouts,
  type ObjectAlignment,
  type ObjectDistribution,
} from '../data/slideObjectTools'
import {
  normalizeBlockLayout,
  normalizeBlockTextStyle,
  type ManualBlockKind,
} from '../data/slideLayout'
import type { FileContributorRole, ReportType, SlideBlock } from '../types/models'
import { createId } from '../utils/ids'

const initialMessages: AiChatMessage[] = [
  {
    id: 'message-1',
    role: 'assistant',
    kind: 'message',
    content: 'I can help tighten a single slide or propose a deck-wide rewrite from the current JSON blocks.',
  },
  {
    id: 'message-2',
    role: 'assistant',
    kind: 'message',
    content: 'Ask for a more formal tone, a shorter narrative, or a whole-deck rewrite. Review stays on by default.',
  },
]

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest('textarea, input, select, [contenteditable="true"]'))
    : false
}

function isSideUiTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(
        target.closest(
          '.editor-side-panel, .editor-notes-bar, .modal-card, .modal-backdrop, [role="dialog"]',
        ),
      )
    : false
}

function isCanvasCommandTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (
    isTypingTarget(target) ||
    target.closest('button, input, select, .editor-topbar') ||
    isSideUiTarget(target)
  ) {
    return false
  }

  return Boolean(target.closest('.slide-surface, .slide-object'))
}

function isEditorShortcutContext(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (isSideUiTarget(target)) {
    return false
  }

  if (isTypingTarget(target) && !target.closest('.slide-object textarea')) {
    return false
  }

  return Boolean(target.closest('.editor-workspace, .slide-object, .slide-surface'))
}

function getSlideSurfaceSize() {
  const surface = document.querySelector<HTMLElement>('.slide-surface')

  return {
    width: surface?.clientWidth || 960,
    height: surface?.clientHeight || 540,
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Unable to read image file.'))
      }
    })
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Unable to read image file.')))
    reader.readAsDataURL(file)
  })
}

function cloneBlockForClipboard(block: SlideBlock): SlideBlock {
  return {
    ...block,
    content: Array.isArray(block.content) ? [...block.content] : block.content,
    style: { ...block.style },
    textStyle: block.textStyle ? { ...block.textStyle } : undefined,
    visualStyle: block.visualStyle ? { ...block.visualStyle } : undefined,
    imageAsset: block.imageAsset ? { ...block.imageAsset } : undefined,
    layout: block.layout ? { ...block.layout } : undefined,
    sourceTrace: block.sourceTrace.map((trace) => ({ ...trace })),
  }
}

export function EditPresentationPage() {
  const navigate = useNavigate()
  const {
    workspace,
    canUndo,
    canRedo,
    undoWorkspace,
    redoWorkspace,
    generateSlides,
    generateReport,
    createAlternateVersion,
    applyAiEditPlan,
    updateDeckCollaboration,
    addComment,
    resolveComment,
    addSlide,
    deleteSlide,
    duplicateSlide,
    reorderSlides,
    addSlideBlock,
    deleteSlideBlocks,
    duplicateSlideBlock,
    updateSlideBlockContent,
    updateSlideBlockTextStyle,
    updateSlideBlockVisualStyle,
    replaceSlideBlockImage,
    updateSlideBlockLayout,
    updateSlideBlocksLayout,
    pasteSlideBlocks,
    arrangeSlideBlock,
    updateSlideNotes,
  } = useWorkspace()
  const [scope, setScope] = useState<AiEditScope>('slide')
  const [askBeforeApplying, setAskBeforeApplying] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [reportType, setReportType] = useState<ReportType>('concise')
  const [activeReportAssetId, setActiveReportAssetId] = useState<string>()
  const [commentRole, setCommentRole] = useState<FileContributorRole>('owner')
  const [selectedCommentTarget, setSelectedCommentTarget] = useState('current-slide')
  const [selectedCommentThreadId, setSelectedCommentThreadId] = useState<string>()
  const [activeSidePanel, setActiveSidePanel] = useState<EditorSidePanelMode>()
  const [selectedSlideIdState, setSelectedSlideId] = useState<string>()
  const [selectedBlockIdState, setSelectedBlockId] = useState<string>()
  const [selectedBlockIdsState, setSelectedBlockIds] = useState<string[]>([])
  const [isPresenting, setIsPresenting] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const [presentationSlideId, setPresentationSlideId] = useState<string>()
  const [messages, setMessages] = useState<AiChatMessage[]>(initialMessages)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExportingPptx, setIsExportingPptx] = useState(false)
  const [clipboardBlocks, setClipboardBlocks] = useState<SlideBlock[]>([])
  const [pasteOffsetCount, setPasteOffsetCount] = useState(0)
  const presentationRootRef = useRef<HTMLDivElement | null>(null)

  const activeDeck =
    workspace.decks.find((deck) => deck.id === workspace.activeDeckId) ?? workspace.decks[0]
  const slides = workspace.slides
    .filter((slide) => slide.deckId === activeDeck?.id)
    .sort((left, right) => left.index - right.index)
  const versions = workspace.deckVersions.filter((version) => version.deckId === activeDeck?.id)
  const reportAssets = workspace.fileAssets
    .filter((asset) => asset.deckId === activeDeck?.id && asset.kind === 'report')
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
  const activeReportAsset =
    reportAssets.find((asset) => asset.id === activeReportAssetId) ?? reportAssets[0]
  const selectedSlideId = slides.some((slide) => slide.id === selectedSlideIdState)
    ? selectedSlideIdState
    : slides[0]?.id
  const selectedSlide = slides.find((slide) => slide.id === selectedSlideId)
  const selectedBlockIds =
    selectedSlide && selectedBlockIdsState.length > 0
      ? selectedBlockIdsState.filter((blockId) =>
          selectedSlide.blocks.some((block) => block.id === blockId),
        )
      : []
  const selectedBlockId = selectedSlide?.blocks.some((block) => block.id === selectedBlockIdState)
    ? selectedBlockIdState
    : selectedBlockIds[0]
  const activeSelectedBlockIds = selectedBlockId
    ? [selectedBlockId, ...selectedBlockIds.filter((blockId) => blockId !== selectedBlockId)]
    : []
  const selectedBlock = selectedSlide?.blocks.find((block) => block.id === selectedBlockId)
  const selectedBlocks =
    selectedSlide && activeSelectedBlockIds.length > 0
      ? activeSelectedBlockIds
          .map((blockId) => selectedSlide.blocks.find((block) => block.id === blockId))
          .filter((block): block is SlideBlock => Boolean(block))
      : []
  const selectedBlockLayouts =
    selectedSlide && selectedBlocks.length > 0
      ? selectedBlocks.map((block) => ({
          blockId: block.id,
          layout: normalizeBlockLayout(
            block,
            selectedSlide.blocks.findIndex((slideBlock) => slideBlock.id === block.id),
          ),
        }))
      : []
  const slideCommentThreads = workspace.comments
    .filter(
      (thread) =>
        thread.deckId === activeDeck?.id &&
        thread.slideId === selectedSlide?.id &&
        !thread.inputFieldKey,
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const deckCommentThreads = workspace.comments
    .filter(
      (thread) =>
        thread.deckId === activeDeck?.id &&
        !thread.slideId &&
        !thread.inputFieldKey,
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const visibleCommentThreads = [...slideCommentThreads, ...deckCommentThreads]
  const selectedSlideCommentCount = workspace.comments.filter(
    (thread) =>
      thread.deckId === activeDeck?.id &&
      thread.slideId === selectedSlide?.id &&
      !thread.blockId &&
      !thread.inputFieldKey,
  ).length
  const blockCommentCounts =
    selectedSlide?.blocks.reduce<Record<string, number>>((counts, block) => {
      counts[block.id] = workspace.comments.filter(
        (thread) =>
          thread.deckId === activeDeck?.id &&
          thread.slideId === selectedSlide.id &&
          thread.blockId === block.id &&
          !thread.inputFieldKey,
      ).length

      return counts
    }, {}) ?? {}
  const hasPendingProposal = messages.some(
    (message) => message.kind === 'proposal' && message.status === 'pending',
  )
  const resolvedCommentTarget =
    selectedCommentTarget === 'selected-block' && !selectedBlock ? 'current-slide' : selectedCommentTarget
  const commentTargetOptions = [
    {
      value: 'current-slide',
      label: selectedSlide ? `Slide ${selectedSlide.index}` : 'Current slide',
    },
    ...(selectedBlock
      ? [
          {
            value: 'selected-block',
            label: 'Selected block',
          },
        ]
      : []),
    { value: 'general', label: 'Deck note' },
  ]
  const noteRows = Math.min(6, Math.max(1, selectedSlide?.notes.split('\n').length ?? 1))
  const activePresentationSlideId = slides.some((slide) => slide.id === presentationSlideId)
    ? presentationSlideId
    : selectedSlide?.id

  const updateProposalStatus = (
    messageId: string,
    status: Extract<AiChatMessage['status'], 'accepted' | 'rejected' | 'applied'>,
  ) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              status,
            }
          : message,
      ),
    )
  }

  const getProposalMessage = (messageId: string) =>
    messages.find(
      (message): message is AiChatMessage & { kind: 'proposal'; plan: AiEditPlan } =>
        message.id === messageId &&
        message.kind === 'proposal' &&
        message.status === 'pending' &&
        Boolean(message.plan),
    )

  const clearSelectedBlocks = () => {
    setSelectedBlockId(undefined)
    setSelectedBlockIds([])
  }

  const selectSingleBlock = (blockId: string) => {
    setSelectedBlockId(blockId)
    setSelectedBlockIds([blockId])
  }

  const selectBlock = (
    blockId: string,
    options?: { addToSelection?: boolean; preserveSelection?: boolean },
  ) => {
    if (options?.preserveSelection && activeSelectedBlockIds.includes(blockId)) {
      const nextSelectedIds = [
        blockId,
        ...activeSelectedBlockIds.filter((selectedId) => selectedId !== blockId),
      ]

      setSelectedBlockId(blockId)
      setSelectedBlockIds(nextSelectedIds)
      return
    }

    if (options?.addToSelection) {
      const nextSelectedIds = activeSelectedBlockIds.includes(blockId)
        ? activeSelectedBlockIds.filter((selectedId) => selectedId !== blockId)
        : [...activeSelectedBlockIds, blockId]

      setSelectedBlockId(nextSelectedIds[0])
      setSelectedBlockIds(nextSelectedIds)
      return
    }

    selectSingleBlock(blockId)
  }

  const copySelectedBlocks = () => {
    if (selectedBlocks.length === 0) {
      return
    }

    setClipboardBlocks(selectedBlocks.map(cloneBlockForClipboard))
    setPasteOffsetCount(0)
  }

  const cutSelectedBlocks = () => {
    if (!selectedSlide || selectedBlocks.length === 0) {
      return
    }

    setClipboardBlocks(selectedBlocks.map(cloneBlockForClipboard))
    setPasteOffsetCount(0)
    deleteSlideBlocks(selectedSlide.id, selectedBlocks.map((block) => block.id))
    clearSelectedBlocks()
  }

  const pasteClipboardBlocks = () => {
    if (!selectedSlide || clipboardBlocks.length === 0) {
      return
    }

    const nextBlockIds = pasteSlideBlocks(
      selectedSlide.id,
      clipboardBlocks,
      3 + pasteOffsetCount * 3,
    )

    if (nextBlockIds.length > 0) {
      setSelectedBlockId(nextBlockIds[0])
      setSelectedBlockIds(nextBlockIds)
      setPasteOffsetCount((current) => current + 1)
    }
  }

  const duplicateSelectedBlocks = () => {
    if (!selectedSlide || selectedBlocks.length === 0) {
      return
    }

    const nextBlockIds = pasteSlideBlocks(selectedSlide.id, selectedBlocks, 3)

    if (nextBlockIds.length > 0) {
      setSelectedBlockId(nextBlockIds[0])
      setSelectedBlockIds(nextBlockIds)
    }
  }

  const alignSelectedBlocks = (alignment: ObjectAlignment) => {
    if (!selectedSlide || selectedBlockLayouts.length === 0) {
      return
    }

    updateSlideBlocksLayout(selectedSlide.id, alignBlockLayouts(selectedBlockLayouts, alignment))
  }

  const distributeSelectedBlocks = (distribution: ObjectDistribution) => {
    if (!selectedSlide || selectedBlockLayouts.length < 3) {
      return
    }

    updateSlideBlocksLayout(
      selectedSlide.id,
      distributeBlockLayouts(selectedBlockLayouts, distribution),
    )
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isEditorShortcutContext(event.target) || !selectedSlide) {
        return
      }

      const isModifierShortcut = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (isModifierShortcut && key === 'z') {
        event.preventDefault()

        if (event.shiftKey) {
          redoWorkspace()
        } else {
          undoWorkspace()
        }

        return
      }

      if (isModifierShortcut && key === 'y') {
        event.preventDefault()
        redoWorkspace()
        return
      }

      if (
        isModifierShortcut &&
        ['c', 'x', 'v'].includes(key) &&
        isCanvasCommandTarget(event.target) &&
        !isTypingTarget(event.target)
      ) {
        if (key === 'v') {
          if (clipboardBlocks.length > 0) {
            event.preventDefault()
            const nextBlockIds = pasteSlideBlocks(
              selectedSlide.id,
              clipboardBlocks,
              3 + pasteOffsetCount * 3,
            )

            if (nextBlockIds.length > 0) {
              setSelectedBlockId(nextBlockIds[0])
              setSelectedBlockIds(nextBlockIds)
              setPasteOffsetCount((current) => current + 1)
            }
          }

          return
        }

        if (selectedBlocks.length > 0) {
          event.preventDefault()

          if (key === 'c') {
            setClipboardBlocks(selectedBlocks.map(cloneBlockForClipboard))
            setPasteOffsetCount(0)
          } else {
            setClipboardBlocks(selectedBlocks.map(cloneBlockForClipboard))
            setPasteOffsetCount(0)
            deleteSlideBlocks(selectedSlide.id, selectedBlocks.map((block) => block.id))
            clearSelectedBlocks()
          }
        }

        return
      }

      if (!selectedBlock) {
        return
      }

      if (isModifierShortcut && ['b', 'i', 'u'].includes(key) && selectedBlock.type !== 'shape') {
        event.preventDefault()

        const textStyle = normalizeBlockTextStyle(selectedBlock)
        const styleUpdate =
          key === 'b'
            ? { bold: !textStyle.bold }
            : key === 'i'
              ? { italic: !textStyle.italic }
              : { underline: !textStyle.underline }

        updateSlideBlockTextStyle(selectedSlide.id, selectedBlock.id, styleUpdate)
        return
      }

      if (isModifierShortcut && key === 'd' && isCanvasCommandTarget(event.target)) {
        event.preventDefault()

        if (selectedBlocks.length > 1) {
          const nextBlockIds = pasteSlideBlocks(selectedSlide.id, selectedBlocks, 3)

          if (nextBlockIds.length > 0) {
            setSelectedBlockId(nextBlockIds[0])
            setSelectedBlockIds(nextBlockIds)
          }
        } else {
          const nextBlockId = duplicateSlideBlock(selectedSlide.id, selectedBlock.id)

          if (nextBlockId) {
            selectSingleBlock(nextBlockId)
          }
        }

        return
      }

      if (
        (event.key === 'Backspace' || event.key === 'Delete') &&
        isCanvasCommandTarget(event.target)
      ) {
        event.preventDefault()
        deleteSlideBlocks(selectedSlide.id, selectedBlocks.map((block) => block.id))
        clearSelectedBlocks()
        return
      }

      if (event.key.startsWith('Arrow') && isCanvasCommandTarget(event.target)) {
        event.preventDefault()

        const nudgeAmount = event.shiftKey ? 10 : 1
        const slideSize = getSlideSurfaceSize()
        const deltaX =
          event.key === 'ArrowRight' ? nudgeAmount : event.key === 'ArrowLeft' ? -nudgeAmount : 0
        const deltaY =
          event.key === 'ArrowDown' ? nudgeAmount : event.key === 'ArrowUp' ? -nudgeAmount : 0

        updateSlideBlocksLayout(
          selectedSlide.id,
          selectedBlockLayouts.map((entry) => ({
            blockId: entry.blockId,
            layout: {
              x: entry.layout.x + (deltaX / slideSize.width) * 100,
              y: entry.layout.y + (deltaY / slideSize.height) * 100,
            },
          })),
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const handleAddBlock = (kind: ManualBlockKind) => {
    if (!selectedSlide) {
      return
    }

    const nextBlockId = addSlideBlock(selectedSlide.id, kind, selectedBlock?.id)

    if (nextBlockId) {
      selectSingleBlock(nextBlockId)
    }
  }

  const handleAddSlide = () => {
    if (!activeDeck) {
      return
    }

    const nextSlideId = addSlide(activeDeck.id, selectedSlide?.id)

    if (nextSlideId) {
      setSelectedSlideId(nextSlideId)
      clearSelectedBlocks()
      setSelectedCommentThreadId(undefined)
    }
  }

  const handleDuplicateSlide = () => {
    if (!activeDeck || !selectedSlide) {
      return
    }

    const nextSlideId = duplicateSlide(activeDeck.id, selectedSlide.id)

    if (nextSlideId) {
      setSelectedSlideId(nextSlideId)
      clearSelectedBlocks()
      setSelectedCommentThreadId(undefined)
    }
  }

  const handleDeleteSlide = () => {
    if (!activeDeck || !selectedSlide) {
      return
    }

    const slideHasContent =
      selectedSlide.blocks.length > 0 ||
      selectedSlide.notes.trim().length > 0 ||
      selectedSlide.sourceTrace.length > 0 ||
      slideCommentThreads.length > 0
    const needsConfirmation = slides.length === 1 || slideHasContent

    if (needsConfirmation) {
      const message =
        slides.length === 1
          ? 'This is the only slide in the deck. Delete it and leave the deck empty?'
          : 'Delete this slide and its content, notes, and slide comments?'

      if (!window.confirm(message)) {
        return
      }
    }

    const nextSlideId = deleteSlide(activeDeck.id, selectedSlide.id)
    setSelectedSlideId(nextSlideId)
    clearSelectedBlocks()
    setSelectedCommentThreadId(undefined)
  }

  const handleReorderSlides = (orderedSlideIds: string[]) => {
    if (!activeDeck) {
      return
    }

    reorderSlides(activeDeck.id, orderedSlideIds)
  }

  const handleGenerateReport = () => {
    if (!activeDeck) {
      return
    }

    const assetId = generateReport(activeDeck.id, reportType)

    if (assetId) {
      setActiveReportAssetId(assetId)
    }
  }

  const handleExportPptx = async () => {
    if (!activeDeck || isExportingPptx) {
      return
    }

    setIsExportingPptx(true)

    try {
      const { exportDeckAsPptx } = await import('../data/pptxExport')

      await exportDeckAsPptx({ deck: activeDeck, slides })
    } finally {
      setIsExportingPptx(false)
    }
  }

  const handleReplaceImage = async (file: File) => {
    if (!selectedSlide || !selectedBlock || selectedBlock.type !== 'visual-placeholder') {
      return
    }

    if (!file.type.startsWith('image/')) {
      window.alert('Choose a PNG, JPG, SVG, GIF, or other browser-supported image file.')
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)

      replaceSlideBlockImage(selectedSlide.id, selectedBlock.id, {
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataUrl,
      })
    } catch {
      window.alert('The selected image could not be read. Try a different image file.')
    }
  }

  const goToNextPresentationSlide = () => {
    setPresentationSlideId((currentSlideId) => {
      const currentIndex = slides.findIndex(
        (slide) => slide.id === (currentSlideId ?? activePresentationSlideId),
      )
      const nextIndex = Math.min(slides.length - 1, Math.max(0, currentIndex) + 1)

      return slides[nextIndex]?.id ?? currentSlideId
    })
  }

  const goToPreviousPresentationSlide = () => {
    setPresentationSlideId((currentSlideId) => {
      const currentIndex = slides.findIndex(
        (slide) => slide.id === (currentSlideId ?? activePresentationSlideId),
      )
      const nextIndex = Math.max(0, Math.max(0, currentIndex) - 1)

      return slides[nextIndex]?.id ?? currentSlideId
    })
  }

  const exitPresentation = () => {
    setIsPresenting(false)

    if (document.fullscreenElement === presentationRootRef.current) {
      void document.exitFullscreen().catch(() => undefined)
    }
  }

  const startPresentation = () => {
    if (!selectedSlide) {
      return
    }

    setPresentationSlideId(selectedSlide.id)
    setIsPresenting(true)
    setActiveSidePanel(undefined)

    if (presentationRootRef.current?.requestFullscreen) {
      void presentationRootRef.current.requestFullscreen().catch(() => undefined)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (
        isPresenting &&
        presentationRootRef.current &&
        document.fullscreenElement !== presentationRootRef.current
      ) {
        setIsPresenting(false)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [isPresenting])

  if (!activeDeck) {
    return (
      <section className="page">
        <div className="page-header">
          <div>
            <span className="section-label">Edit presentation</span>
            <h2>No active deck</h2>
          </div>
        </div>
      </section>
    )
  }

  if (slides.length === 0) {
    return (
      <section className="page">
        <div className="page-header">
          <div>
            <span className="section-label">Edit presentation</span>
            <h2>{activeDeck.title}</h2>
            <p>Generate a structured slide JSON set before using the editor.</p>
          </div>

          <button
            type="button"
            className="primary-button"
            disabled={isGenerating}
            onClick={async () => {
              if (isGenerating) {
                return
              }

              setIsGenerating(true)

              try {
                const generatedDeckId = await generateSlides(activeDeck.id)

                if (generatedDeckId) {
                  navigate('/edit')
                }
              } finally {
                setIsGenerating(false)
              }
            }}
          >
            {isGenerating ? 'Generating...' : 'Generate Slides'}
          </button>
          <button type="button" className="secondary-button" onClick={handleAddSlide}>
            Add blank slide
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="page page--editor">
      <div className="editor-shell">
        <SlideThumbnailRail
          slides={slides}
          selectedSlideId={selectedSlide?.id}
          onSelectSlide={(slideId) => {
            setSelectedSlideId(slideId)
            clearSelectedBlocks()
          }}
          onAddSlide={handleAddSlide}
          onDuplicateSlide={handleDuplicateSlide}
          onDeleteSlide={handleDeleteSlide}
          onReorderSlides={handleReorderSlides}
        />

        <div className="editor-workspace">
          <div className="editor-topbar">
            <div className="editor-topbar__title">
              <span className="section-label">Editing</span>
              <strong>{activeDeck.title}</strong>
              <span>{slides.length} slides</span>
            </div>

            <FormattingToolbar
              selectedBlock={selectedBlock}
              onAddBlock={handleAddBlock}
              onTextStyleChange={(style) => {
                if (selectedSlide && selectedBlock) {
                  updateSlideBlockTextStyle(selectedSlide.id, selectedBlock.id, style)
                }
              }}
              onVisualStyleChange={(style) => {
                if (selectedSlide && selectedBlock) {
                  updateSlideBlockVisualStyle(selectedSlide.id, selectedBlock.id, style)
                }
              }}
              onReplaceImage={handleReplaceImage}
              onCopyBlock={copySelectedBlocks}
              onCutBlock={cutSelectedBlocks}
              onPasteBlock={pasteClipboardBlocks}
              onAlignBlock={alignSelectedBlocks}
              onDistributeBlocks={distributeSelectedBlocks}
              canPasteBlock={clipboardBlocks.length > 0}
              selectedBlockCount={activeSelectedBlockIds.length}
            />

            <div className="editor-topbar__actions">
              <button
                type="button"
                className="ghost-button"
                disabled={!canUndo}
                onClick={undoWorkspace}
              >
                Undo
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={!canRedo}
                onClick={redoWorkspace}
              >
                Redo
              </button>
              <button
                type="button"
                className={`secondary-button ${showSources ? 'is-active' : ''}`}
                onClick={() => setShowSources((current) => !current)}
              >
                Show sources
              </button>
              <button
                type="button"
                className={`secondary-button ${activeSidePanel === 'assistant' ? 'is-active' : ''}`}
                onClick={() =>
                  setActiveSidePanel((current) => (current === 'assistant' ? undefined : 'assistant'))
                }
              >
                AI Assistant
              </button>
              <button
                type="button"
                className={`secondary-button ${activeSidePanel === 'comments' ? 'is-active' : ''}`}
                onClick={() =>
                  setActiveSidePanel((current) => (current === 'comments' ? undefined : 'comments'))
                }
              >
                Comments
                <span>Slide {slideCommentThreads.length}</span>
                <span>Deck {deckCommentThreads.length}</span>
              </button>
              <button type="button" className="secondary-button" onClick={startPresentation}>
                Present
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={isExportingPptx}
                onClick={handleExportPptx}
              >
                {isExportingPptx ? 'Exporting...' : 'Export PPTX'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsReportOpen(true)}
              >
                Generate Report
              </button>
              <button type="button" className="secondary-button" onClick={() => setIsShareOpen(true)}>
                Share
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => createAlternateVersion(activeDeck.id)}
              >
                Create alternate version
              </button>
            </div>
          </div>

          <div className={`editor-body ${activeSidePanel ? 'has-side-panel' : ''}`}>
            <div className="editor-canvas-workspace">
              <SlideCanvas
                slide={selectedSlide}
                selectedBlockIds={activeSelectedBlockIds}
                primarySelectedBlockId={selectedBlock?.id}
                commentCount={selectedSlideCommentCount}
                blockCommentCounts={blockCommentCounts}
                showSources={showSources}
                onSelectBlock={(blockId, options) => {
                  selectBlock(blockId, options)
                  if (selectedCommentTarget === 'selected-block') {
                    setSelectedCommentThreadId(undefined)
                  }
                }}
                onClearSelectedBlocks={clearSelectedBlocks}
                onOpenComments={() => {
                  setSelectedCommentTarget('current-slide')
                  setActiveSidePanel('comments')
                  setSelectedCommentThreadId(
                    workspace.comments.find(
                      (thread) =>
                        thread.deckId === activeDeck.id &&
                        thread.slideId === selectedSlide?.id &&
                        !thread.blockId,
                    )?.id,
                  )
                }}
                onOpenBlockComments={(blockId) => {
                  selectSingleBlock(blockId)
                  setSelectedCommentTarget('selected-block')
                  setActiveSidePanel('comments')
                  setSelectedCommentThreadId(
                    workspace.comments.find(
                      (thread) =>
                        thread.deckId === activeDeck.id &&
                        thread.slideId === selectedSlide?.id &&
                        thread.blockId === blockId,
                    )?.id,
                  )
                }}
                onBlockContentChange={(blockId, content) => {
                  if (selectedSlide) {
                    updateSlideBlockContent(selectedSlide.id, blockId, content)
                  }
                }}
                onBlockLayoutChange={(blockId, layout) => {
                  if (selectedSlide) {
                    updateSlideBlockLayout(selectedSlide.id, blockId, layout)
                  }
                }}
                onBlockLayoutsChange={(updates) => {
                  if (selectedSlide) {
                    updateSlideBlocksLayout(selectedSlide.id, updates)
                  }
                }}
                onDeleteBlock={(blockId) => {
                  if (selectedSlide) {
                    const blockIdsToDelete = activeSelectedBlockIds.includes(blockId)
                      ? activeSelectedBlockIds
                      : [blockId]

                    deleteSlideBlocks(selectedSlide.id, blockIdsToDelete)
                    clearSelectedBlocks()
                  }
                }}
                onDuplicateBlock={(blockId) => {
                  if (selectedSlide) {
                    if (activeSelectedBlockIds.includes(blockId) && selectedBlocks.length > 1) {
                      duplicateSelectedBlocks()
                    } else {
                      const nextBlockId = duplicateSlideBlock(selectedSlide.id, blockId)

                      if (nextBlockId) {
                        selectSingleBlock(nextBlockId)
                      }
                    }
                  }
                }}
                onArrangeBlock={(blockId, direction) => {
                  if (selectedSlide) {
                    arrangeSlideBlock(selectedSlide.id, blockId, direction)
                  }
                }}
              />
            </div>

            {activeSidePanel ? (
              <EditorSidePanel
                mode={activeSidePanel}
                commentCount={visibleCommentThreads.length}
                onClose={() => setActiveSidePanel(undefined)}
              >
                {activeSidePanel === 'comments' ? (
                  <EditorCommentsPanel
                    slideThreads={slideCommentThreads}
                    deckThreads={deckCommentThreads}
                    actorRole={commentRole}
                    canCommentAsCollaborator={activeDeck.collaboration.isShared}
                    targetOptions={commentTargetOptions}
                    selectedTarget={resolvedCommentTarget}
                    selectedThreadId={selectedCommentThreadId}
                    onActorRoleChange={setCommentRole}
                    onTargetChange={(target) => {
                      setSelectedCommentTarget(target)
                      setSelectedCommentThreadId(undefined)
                    }}
                    onSelectThread={(thread) => {
                      setSelectedCommentThreadId(thread.id)

                      if (thread.slideId) {
                        setSelectedSlideId(thread.slideId)
                      }

                      if (thread.blockId) {
                        selectSingleBlock(thread.blockId)
                        setSelectedCommentTarget('selected-block')
                      } else if (thread.slideId) {
                        clearSelectedBlocks()
                        setSelectedCommentTarget('current-slide')
                      } else {
                        setSelectedCommentTarget('general')
                      }
                    }}
                    onResolveThread={resolveComment}
                    onSubmit={({ message, authorRole, target }) =>
                      addComment({
                        projectId: activeDeck.projectId,
                        deckId: activeDeck.id,
                        slideId:
                          target === 'current-slide' || target === 'selected-block'
                            ? selectedSlide?.id
                            : undefined,
                        blockId: target === 'selected-block' ? selectedBlock?.id : undefined,
                        message,
                        authorRole,
                      })
                    }
                  />
                ) : (
                  <AiChatPanel
                    scope={scope}
                    askBeforeApplying={askBeforeApplying}
                    hasPendingProposal={hasPendingProposal}
                    onScopeChange={setScope}
                    onAskBeforeApplyingChange={setAskBeforeApplying}
                    onAcceptProposal={(messageId) => {
                      const proposal = getProposalMessage(messageId)

                      if (!proposal?.plan) {
                        return
                      }

                      applyAiEditPlan(activeDeck.id, proposal.plan)
                      updateProposalStatus(messageId, 'accepted')
                    }}
                    onRejectProposal={(messageId) => updateProposalStatus(messageId, 'rejected')}
                    versionLabels={versions.slice(0, 4).map((version) => version.label)}
                    messages={messages}
                    onSendMessage={(message) => {
                      const plan = buildMockAiEditPlan({
                        deck: activeDeck,
                        slides,
                        scope,
                        request: message,
                        activeSlideId: selectedSlide?.id,
                      })
                      const userMessage: AiChatMessage = {
                        id: createId('message'),
                        role: 'user',
                        kind: 'message',
                        content: message,
                      }
                      const proposalMessage: AiChatMessage = {
                        id: createId('message'),
                        role: 'assistant',
                        kind: 'proposal',
                        content: plan.summary,
                        status: askBeforeApplying ? 'pending' : 'applied',
                        plan,
                      }

                      if (!askBeforeApplying) {
                        applyAiEditPlan(activeDeck.id, plan)
                      }

                      setMessages((current) => [...current, userMessage, proposalMessage])
                    }}
                  />
                )}
              </EditorSidePanel>
            ) : null}
          </div>

          <label className="editor-notes-bar">
            <span>Notes</span>
            <textarea
              rows={noteRows}
              value={selectedSlide?.notes ?? ''}
              placeholder="Click to add speaker notes"
              onChange={(event) => {
                if (selectedSlide) {
                  updateSlideNotes(selectedSlide.id, event.target.value)
                }
              }}
            />
          </label>
        </div>
      </div>

      {isShareOpen ? (
        <ShareProjectModal
          isOpen={isShareOpen}
          title={`Share ${activeDeck.title}`}
          description="Allow comment-only deck collaboration, optional setup comments, and collaborator uploads."
          initialSettings={{
            isShared: activeDeck.collaboration.isShared,
            shareSetupInputs: activeDeck.setup.shareSetupInputs,
            allowCollaboratorUploads: activeDeck.collaboration.allowCollaboratorUploads,
          }}
          onClose={() => setIsShareOpen(false)}
          onSave={(settings) => updateDeckCollaboration(activeDeck.id, settings)}
        />
      ) : null}

      <DeckReportModal
        isOpen={isReportOpen}
        reportType={reportType}
        reportAsset={activeReportAsset}
        onReportTypeChange={setReportType}
        onGenerate={handleGenerateReport}
        onClose={() => setIsReportOpen(false)}
      />

      <PresentMode
        slides={slides}
        activeSlideId={activePresentationSlideId}
        isActive={isPresenting}
        containerRef={presentationRootRef}
        onNext={goToNextPresentationSlide}
        onPrevious={goToPreviousPresentationSlide}
        onExit={exitPresentation}
      />
    </section>
  )
}
