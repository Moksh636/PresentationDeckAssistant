import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiChatPanel, type AiChatMessage } from '../components/editor/AiChatPanel'
import { ShareProjectModal } from '../components/collaboration/ShareProjectModal'
import { DeckReportModal } from '../components/editor/DeckReportModal'
import { EditorContextMenu, type EditorContextMenuItem } from '../components/editor/EditorContextMenu'
import { EditorCommentsPanel } from '../components/editor/EditorCommentsPanel'
import { EditorSidePanel, type EditorSidePanelMode } from '../components/editor/EditorSidePanel'
import { FormattingToolbar } from '../components/editor/FormattingToolbar'
import { PresentMode } from '../components/editor/PresentMode'
import { SlideCanvas } from '../components/editor/SlideCanvas'
import { SlideThumbnailRail } from '../components/editor/SlideThumbnailRail'
import { useToast } from '../components/feedback/toastContext'
import { useWorkspace } from '../context/useWorkspace'
import { buildMockAiEditPlan, type AiEditPlan, type AiEditScope } from '../data/aiEditor'
import { getAiProposalBlockDiffs } from '../data/aiProposalReview'
import {
  DEFAULT_THUMBNAIL_RAIL_WIDTH,
  getThumbnailRailPresentation,
} from '../data/editorLayout'
import { getFitEditorZoom, getNextEditorZoom } from '../data/editorZoom'
import { getNormalizedImageAsset } from '../data/imageControls'
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
import type { SlideLayoutPreset } from '../data/slideLayoutPresets'
import type { FileContributorRole, ReportType, Slide, SlideBlock } from '../types/models'
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

function isBlockLocked(block: SlideBlock, index = 0) {
  return normalizeBlockLayout(block, index).locked === true
}

type EditorContextMenuState =
  | { kind: 'object'; blockId: string; x: number; y: number }
  | { kind: 'slide'; slideId: string; x: number; y: number }

export function EditPresentationPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
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
    reopenComment,
    addSlide,
    addSlideWithLayout,
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
    resetSlideBlockImage,
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
  const [zoomPercent, setZoomPercent] = useState(100)
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false)
  const [isPresentMenuOpen, setIsPresentMenuOpen] = useState(false)
  const [isThumbnailRailCollapsed, setIsThumbnailRailCollapsed] = useState(false)
  const [isThumbnailRailCompact, setIsThumbnailRailCompact] = useState(false)
  const [thumbnailRailWidth, setThumbnailRailWidth] = useState(DEFAULT_THUMBNAIL_RAIL_WIDTH)
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState>()
  const presentationRootRef = useRef<HTMLDivElement | null>(null)
  const canvasWorkspaceRef = useRef<HTMLDivElement | null>(null)

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
  const selectedUnlockedBlocks =
    selectedSlide && selectedBlocks.length > 0
      ? selectedBlocks.filter((block) =>
          !isBlockLocked(
            block,
            selectedSlide.blocks.findIndex((slideBlock) => slideBlock.id === block.id),
          ),
        )
      : []
  const selectedUnlockedBlockLayouts =
    selectedSlide && selectedBlockLayouts.length > 0
      ? selectedBlockLayouts.filter((entry) => {
          const block = selectedSlide.blocks.find((candidate) => candidate.id === entry.blockId)

          return block ? !entry.layout.locked : false
        })
      : []
  const selectedBlockLocked = selectedBlock
    ? isBlockLocked(
        selectedBlock,
        selectedSlide?.blocks.findIndex((block) => block.id === selectedBlock.id) ?? 0,
      )
    : false
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
  const blockCommentThreadIds =
    selectedSlide?.blocks.reduce<Record<string, string>>((ids, block) => {
      const thread = workspace.comments.find(
        (candidate) =>
          candidate.deckId === activeDeck?.id &&
          candidate.slideId === selectedSlide.id &&
          candidate.blockId === block.id &&
          !candidate.inputFieldKey,
      )

      if (thread) {
        ids[block.id] = thread.id
      }

      return ids
    }, {}) ?? {}
  const hasPendingProposal = messages.some(
    (message) => message.kind === 'proposal' && message.status === 'pending',
  )
  const pendingProposal = messages.find(
    (message): message is AiChatMessage & { kind: 'proposal'; plan: AiEditPlan } =>
      message.kind === 'proposal' && message.status === 'pending' && Boolean(message.plan),
  )
  const pendingProposalDiffs =
    pendingProposal?.diffs ??
    (pendingProposal?.plan ? getAiProposalBlockDiffs(slides, pendingProposal.plan) : [])
  const selectedCommentThread = workspace.comments.find((thread) => thread.id === selectedCommentThreadId)
  const selectedCommentBlockId =
    selectedCommentThread &&
    selectedCommentThread.slideId === selectedSlide?.id &&
    selectedCommentThread.blockId
      ? selectedCommentThread.blockId
      : undefined
  const highlightedBlockIds = [
    ...pendingProposalDiffs
      .filter((diff) => diff.slideId === selectedSlide?.id)
      .map((diff) => diff.blockId),
    ...(selectedCommentBlockId ? [selectedCommentBlockId] : []),
  ]
  const aiContextChips = [
    selectedBlock ? 'Selected object' : 'No object selected',
    selectedSlide ? `Slide ${selectedSlide.index}` : 'No slide selected',
    scope === 'deck' ? 'Whole deck' : 'Current slide',
  ]
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
  const thumbnailRailPresentation = getThumbnailRailPresentation({
    collapsed: isThumbnailRailCollapsed,
    compact: isThumbnailRailCompact,
    width: thumbnailRailWidth,
  })
  const editorShellStyle = {
    '--thumbnail-rail-width': `${thumbnailRailPresentation.width}px`,
  } as CSSProperties

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

  const closeContextMenu = () => setContextMenu(undefined)

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
    if (!selectedSlide || selectedUnlockedBlocks.length === 0) {
      return
    }

    setClipboardBlocks(selectedUnlockedBlocks.map(cloneBlockForClipboard))
    setPasteOffsetCount(0)
    deleteSlideBlocks(selectedSlide.id, selectedUnlockedBlocks.map((block) => block.id))
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
    if (!selectedSlide || selectedUnlockedBlockLayouts.length === 0) {
      return
    }

    updateSlideBlocksLayout(
      selectedSlide.id,
      alignBlockLayouts(selectedUnlockedBlockLayouts, alignment),
    )
  }

  const distributeSelectedBlocks = (distribution: ObjectDistribution) => {
    if (!selectedSlide || selectedUnlockedBlockLayouts.length < 3) {
      return
    }

    updateSlideBlocksLayout(
      selectedSlide.id,
      distributeBlockLayouts(selectedUnlockedBlockLayouts, distribution),
    )
  }

  const deleteSelectedUnlockedBlocks = () => {
    if (!selectedSlide || selectedUnlockedBlocks.length === 0) {
      return
    }

    deleteSlideBlocks(selectedSlide.id, selectedUnlockedBlocks.map((block) => block.id))
    clearSelectedBlocks()
  }

  const setLockForBlocks = (blockIds: string[], locked: boolean) => {
    if (!selectedSlide || blockIds.length === 0) {
      return
    }

    updateSlideBlocksLayout(
      selectedSlide.id,
      blockIds.map((blockId) => ({
        blockId,
        layout: { locked },
      })),
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

      if (
        isModifierShortcut &&
        ['b', 'i', 'u'].includes(key) &&
        selectedBlock.type !== 'shape' &&
        !selectedBlockLocked
      ) {
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
        deleteSelectedUnlockedBlocks()
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
          selectedUnlockedBlockLayouts.map((entry) => ({
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

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof HTMLElement && target.closest('.editor-overflow-menu')) {
        return
      }

      setIsFileMenuOpen(false)
      setIsPresentMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      setIsFileMenuOpen(false)
      setIsPresentMenuOpen(false)
      setActiveSidePanel(undefined)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

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
    handleAddSlideAfter(selectedSlide?.id)
  }

  const handleAddSlideAfter = (afterSlideId?: string) => {
    if (!activeDeck) {
      return
    }

    const nextSlideId = addSlide(activeDeck.id, afterSlideId)

    if (nextSlideId) {
      setSelectedSlideId(nextSlideId)
      clearSelectedBlocks()
      setSelectedCommentThreadId(undefined)
    }
  }

  const handleAddSlideWithLayout = (preset: SlideLayoutPreset, afterSlideId?: string) => {
    if (!activeDeck) {
      return
    }

    const nextSlideId = addSlideWithLayout(activeDeck.id, afterSlideId ?? selectedSlide?.id, preset)

    if (nextSlideId) {
      setSelectedSlideId(nextSlideId)
      clearSelectedBlocks()
      setSelectedCommentThreadId(undefined)
    }
  }

  const handleDuplicateSlide = () => {
    handleDuplicateSlideById(selectedSlide?.id)
  }

  const handleDuplicateSlideById = (slideId?: string) => {
    if (!activeDeck || !slideId) {
      return
    }

    const nextSlideId = duplicateSlide(activeDeck.id, slideId)

    if (nextSlideId) {
      setSelectedSlideId(nextSlideId)
      clearSelectedBlocks()
      setSelectedCommentThreadId(undefined)
    }
  }

  const handleDeleteSlide = () => {
    handleDeleteSlideById(selectedSlide?.id)
  }

  const handleDeleteSlideById = (slideId?: string) => {
    if (!activeDeck || !slideId) {
      return
    }

    const targetSlide = slides.find((slide) => slide.id === slideId)

    if (!targetSlide) {
      return
    }

    const slideHasContent =
      targetSlide.blocks.length > 0 ||
      targetSlide.notes.trim().length > 0 ||
      targetSlide.sourceTrace.length > 0 ||
      workspace.comments.some((thread) => thread.slideId === targetSlide.id)
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

    const nextSlideId = deleteSlide(activeDeck.id, targetSlide.id)
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

  const handleMoveSlide = (slideId: string, direction: 'up' | 'down') => {
    if (!activeDeck) {
      return
    }

    const currentIndex = slides.findIndex((slide) => slide.id === slideId)
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= slides.length) {
      return
    }

    const orderedSlideIds = slides.map((slide) => slide.id)
    const [movedSlideId] = orderedSlideIds.splice(currentIndex, 1)
    orderedSlideIds.splice(nextIndex, 0, movedSlideId)
    reorderSlides(activeDeck.id, orderedSlideIds)
    setSelectedSlideId(slideId)
  }

  const handleGenerateReport = () => {
    if (!activeDeck) {
      return
    }

    const assetId = generateReport(activeDeck.id, reportType)

    if (assetId) {
      setActiveReportAssetId(assetId)
      showToast('Report generated and saved as a deck asset.', 'success')
    } else {
      showToast('Report could not be generated for this deck.', 'error')
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
      showToast('PPTX export started.', 'success')
    } catch {
      showToast('PPTX export failed. Try again.', 'error')
    } finally {
      setIsExportingPptx(false)
    }
  }

  const handleZoom = (direction: 'in' | 'out') => {
    setZoomPercent((current) => getNextEditorZoom(current, direction))
  }

  const handleFitToWindow = () => {
    const workspaceElement = canvasWorkspaceRef.current

    if (!workspaceElement) {
      setZoomPercent(100)
      return
    }

    setZoomPercent(
      getFitEditorZoom({
        workspaceWidth: workspaceElement.clientWidth,
        workspaceHeight: workspaceElement.clientHeight,
        slideAspectRatio: 16 / 9,
        padding: 96,
      }),
    )
  }

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const workspaceElement = canvasWorkspaceRef.current

      if (!workspaceElement) {
        return
      }

      setZoomPercent(
        getFitEditorZoom({
          workspaceWidth: workspaceElement.clientWidth,
          workspaceHeight: workspaceElement.clientHeight,
          slideAspectRatio: 16 / 9,
          padding: 96,
        }),
      )
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [activeSidePanel, isThumbnailRailCollapsed, isThumbnailRailCompact, thumbnailRailWidth])

  useEffect(() => {
    let animationFrame = 0

    const fitOnResize = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const workspaceElement = canvasWorkspaceRef.current

        if (!workspaceElement) {
          return
        }

        setZoomPercent(
          getFitEditorZoom({
            workspaceWidth: workspaceElement.clientWidth,
            workspaceHeight: workspaceElement.clientHeight,
            slideAspectRatio: 16 / 9,
            padding: 96,
          }),
        )
      })
    }

    window.addEventListener('resize', fitOnResize)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', fitOnResize)
    }
  }, [])

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
        fit: 'fill',
        altText: file.name,
      })
      showToast('Image replaced.', 'success')
    } catch {
      window.alert('The selected image could not be read. Try a different image file.')
      showToast('Image could not be read.', 'error')
    }
  }

  const handleImageAssetChange = (imageAsset: SlideBlock['imageAsset']) => {
    if (!selectedSlide || !selectedBlock || !imageAsset) {
      return
    }

    replaceSlideBlockImage(selectedSlide.id, selectedBlock.id, getNormalizedImageAsset(imageAsset))
  }

  const handleResetImage = () => {
    if (!selectedSlide || !selectedBlock) {
      return
    }

    resetSlideBlockImage(selectedSlide.id, selectedBlock.id)
    showToast('Image reset to placeholder.', 'info')
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
    startPresentationFromSlide(selectedSlide?.id)
  }

  const startPresentationFromSlide = (slideId?: string) => {
    if (!slideId) {
      return
    }

    setPresentationSlideId(slideId)
    setIsPresenting(true)
    setActiveSidePanel(undefined)

    if (presentationRootRef.current?.requestFullscreen) {
      void presentationRootRef.current.requestFullscreen().catch(() => {
        showToast('Fullscreen presentation was blocked by the browser.', 'error')
      })
    } else {
      showToast('Fullscreen presentation is not available in this browser.', 'error')
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
      <div
        className={`editor-shell ${isThumbnailRailCollapsed ? 'is-thumbnail-collapsed' : ''}`}
        style={editorShellStyle}
      >
        <SlideThumbnailRail
          slides={slides}
          selectedSlideId={selectedSlide?.id}
          onSelectSlide={(slideId) => {
            setSelectedSlideId(slideId)
            clearSelectedBlocks()
          }}
          onAddSlide={handleAddSlide}
          onAddSlideWithLayout={(preset) => handleAddSlideWithLayout(preset)}
          onDuplicateSlide={handleDuplicateSlide}
          onDeleteSlide={handleDeleteSlide}
          onReorderSlides={handleReorderSlides}
          onOpenSlideContextMenu={(slideId, x, y) => setContextMenu({ kind: 'slide', slideId, x, y })}
          isCollapsed={isThumbnailRailCollapsed}
          isCompact={thumbnailRailPresentation.compact}
          railWidth={thumbnailRailWidth}
          onToggleCollapsed={() => setIsThumbnailRailCollapsed((current) => !current)}
          onToggleCompact={() => setIsThumbnailRailCompact((current) => !current)}
          onResizeRail={setThumbnailRailWidth}
        />

        <div className="editor-workspace">
          <div className="editor-topbar">
            <div className="editor-topbar__title">
              <span className="section-label">Editing</span>
              <strong>{activeDeck.title}</strong>
              <span>{slides.length} slides</span>
            </div>

            <div className="editor-ribbon">
              <div className="editor-ribbon__group editor-ribbon__group--file">
                <span className="editor-ribbon__label">File</span>
                <button type="button" title="Undo (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={undoWorkspace}>
                  Undo
                </button>
                <button type="button" title="Redo (Ctrl/Cmd+Y)" disabled={!canRedo} onClick={redoWorkspace}>
                  Redo
                </button>
                <button
                  type="button"
                  title="Share deck"
                  onClick={() => {
                    setIsFileMenuOpen(false)
                    setIsPresentMenuOpen(false)
                    setIsShareOpen(true)
                  }}
                >
                  Share
                </button>
                <div className="editor-overflow-menu">
                  <button
                    type="button"
                  title="More file actions"
                  aria-expanded={isFileMenuOpen}
                  onClick={() => {
                    setIsPresentMenuOpen(false)
                    setIsFileMenuOpen((current) => !current)
                  }}
                >
                    More
                  </button>
                  {isFileMenuOpen ? (
                    <div className="editor-overflow-menu__popover">
                      <button
                        type="button"
                        disabled={isExportingPptx}
                        onClick={() => {
                          setIsFileMenuOpen(false)
                          void handleExportPptx()
                        }}
                      >
                        {isExportingPptx ? 'Exporting PPTX...' : 'Export PPTX'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false)
                          setIsReportOpen(true)
                        }}
                      >
                        Generate Report
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false)
                          setIsReportOpen(true)
                          window.setTimeout(() => window.print(), 0)
                        }}
                      >
                        Print / Save report
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFileMenuOpen(false)
                          createAlternateVersion(activeDeck.id)
                        }}
                      >
                        Alternate version
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <FormattingToolbar
                selectedBlock={selectedBlock}
                onAddBlock={handleAddBlock}
                onTextStyleChange={(style) => {
                  if (selectedSlide && selectedBlock && !selectedBlockLocked) {
                    updateSlideBlockTextStyle(selectedSlide.id, selectedBlock.id, style)
                  }
                }}
                onTextBlockContentChange={(content) => {
                  if (selectedSlide && selectedBlock && !selectedBlockLocked) {
                    updateSlideBlockContent(selectedSlide.id, selectedBlock.id, content)
                  }
                }}
                onVisualStyleChange={(style) => {
                  if (selectedSlide && selectedBlock && !selectedBlockLocked) {
                    updateSlideBlockVisualStyle(selectedSlide.id, selectedBlock.id, style)
                  }
                }}
                onImageAssetChange={handleImageAssetChange}
                onResetImage={handleResetImage}
                onReplaceImage={handleReplaceImage}
                onCopyBlock={copySelectedBlocks}
                onCutBlock={cutSelectedBlocks}
                onPasteBlock={pasteClipboardBlocks}
                onAlignBlock={alignSelectedBlocks}
                onDistributeBlocks={distributeSelectedBlocks}
                canPasteBlock={clipboardBlocks.length > 0}
                selectedBlockCount={activeSelectedBlockIds.length}
              />

              <div className="editor-ribbon__group editor-ribbon__group--review">
                <span className="editor-ribbon__label">Review</span>
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
                  title="Open AI assistant"
                  className={activeSidePanel === 'assistant' ? 'is-active' : ''}
                  onClick={() => {
                    setIsFileMenuOpen(false)
                    setIsPresentMenuOpen(false)
                    setActiveSidePanel((current) => (current === 'assistant' ? undefined : 'assistant'))
                  }}
                >
                  AI
                </button>
                <button
                  type="button"
                  title="Open comments"
                  className={activeSidePanel === 'comments' ? 'is-active' : ''}
                  onClick={() => {
                    setIsFileMenuOpen(false)
                    setIsPresentMenuOpen(false)
                    setActiveSidePanel((current) => (current === 'comments' ? undefined : 'comments'))
                  }}
                >
                  Comments
                  <span>{slideCommentThreads.length + deckCommentThreads.length}</span>
                </button>
              </div>

              <div className="editor-ribbon__group editor-ribbon__group--present">
                <span className="editor-ribbon__label">Present</span>
                <div className="editor-overflow-menu">
                  <button
                    type="button"
                    title="Present options"
                    aria-expanded={isPresentMenuOpen}
                    onClick={() => {
                      setIsFileMenuOpen(false)
                      setIsPresentMenuOpen((current) => !current)
                    }}
                  >
                    Present
                  </button>
                  {isPresentMenuOpen ? (
                    <div className="editor-overflow-menu__popover editor-overflow-menu__popover--right">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPresentMenuOpen(false)
                          startPresentationFromSlide(slides[0]?.id)
                        }}
                      >
                        From beginning
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPresentMenuOpen(false)
                          startPresentation()
                        }}
                      >
                        From current slide
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="editor-ribbon__group editor-ribbon__group--zoom">
                <span className="editor-ribbon__label">View</span>
                <button type="button" title="Zoom out" onClick={() => handleZoom('out')}>
                  -
                </button>
                <strong>{zoomPercent}%</strong>
                <button type="button" title="Zoom in" onClick={() => handleZoom('in')}>
                  +
                </button>
                <button type="button" title="Fit slide to window" onClick={handleFitToWindow}>
                  Fit
                </button>
              </div>
            </div>
          </div>

          <div className={`editor-body ${activeSidePanel ? 'has-side-panel' : ''}`}>
            <div className="editor-canvas-workspace" ref={canvasWorkspaceRef}>
              <SlideCanvas
                slide={selectedSlide}
                selectedBlockIds={activeSelectedBlockIds}
                primarySelectedBlockId={selectedBlock?.id}
                commentCount={selectedSlideCommentCount}
                blockCommentCounts={blockCommentCounts}
                blockCommentThreadIds={blockCommentThreadIds}
                selectedCommentThreadId={selectedCommentThreadId}
                highlightedBlockIds={highlightedBlockIds}
                showSources={showSources}
                zoomPercent={zoomPercent}
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
                  const targetBlock = selectedSlide?.blocks.find((block) => block.id === blockId)
                  const targetIndex = selectedSlide?.blocks.findIndex((block) => block.id === blockId) ?? 0

                  if (selectedSlide && targetBlock && !isBlockLocked(targetBlock, targetIndex)) {
                    updateSlideBlockContent(selectedSlide.id, blockId, content)
                  }
                }}
                onBlockLayoutChange={(blockId, layout) => {
                  const targetBlock = selectedSlide?.blocks.find((block) => block.id === blockId)
                  const targetIndex = selectedSlide?.blocks.findIndex((block) => block.id === blockId) ?? 0

                  if (selectedSlide && targetBlock && !isBlockLocked(targetBlock, targetIndex)) {
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
                      ? selectedUnlockedBlocks.map((block) => block.id)
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
                onLockBlock={(blockId, locked) => setLockForBlocks([blockId], locked)}
                onOpenBlockContextMenu={(blockId, x, y) => {
                  const isAlreadySelected = activeSelectedBlockIds.includes(blockId)

                  selectBlock(blockId, isAlreadySelected ? { preserveSelection: true } : undefined)
                  setContextMenu({ kind: 'object', blockId, x, y })
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
                    onReopenThread={reopenComment}
                    onReplyThread={(thread, message, authorRole) =>
                      addComment({
                        projectId: thread.projectId,
                        deckId: thread.deckId,
                        slideId: thread.slideId,
                        blockId: thread.blockId,
                        inputFieldKey: thread.inputFieldKey,
                        message,
                        authorRole,
                      })
                    }
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
                      showToast('AI proposal accepted and applied.', 'success')
                    }}
                    onRejectProposal={(messageId) => {
                      updateProposalStatus(messageId, 'rejected')
                      showToast('AI proposal rejected.', 'info')
                    }}
                    versionLabels={versions.slice(0, 4).map((version) => version.label)}
                    messages={messages}
                    contextChips={aiContextChips}
                    onSendMessage={(message) => {
                      const plan = buildMockAiEditPlan({
                        deck: activeDeck,
                        slides,
                        scope,
                        request: message,
                        activeSlideId: selectedSlide?.id,
                      })
                      const diffs = getAiProposalBlockDiffs(slides, plan)
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
                        diffs,
                      }

                      if (!askBeforeApplying) {
                        applyAiEditPlan(activeDeck.id, plan)
                        showToast('AI edit applied.', 'success')
                      }

                      setMessages((current) => [...current, userMessage, proposalMessage])
                    }}
                  />
                )}
              </EditorSidePanel>
            ) : null}
          </div>

          <section className={`editor-notes-bar ${isNotesOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="editor-notes-bar__handle"
              onClick={() => setIsNotesOpen((current) => !current)}
            >
              <span>Speaker notes</span>
              <strong>
                {selectedSlide?.notes.trim()
                  ? selectedSlide.notes.split('\n')[0]
                  : 'Click to add speaker notes'}
              </strong>
              <em>{isNotesOpen ? 'Hide' : 'Show'}</em>
            </button>
            {isNotesOpen ? (
              <textarea
                rows={noteRows}
                value={selectedSlide?.notes ?? ''}
                placeholder="Add speaker notes for this slide"
                onChange={(event) => {
                  if (selectedSlide) {
                    updateSlideNotes(selectedSlide.id, event.target.value)
                  }
                }}
              />
            ) : null}
          </section>
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

      {contextMenu ? (
        <EditorContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={
            contextMenu.kind === 'object'
              ? getObjectContextMenuItems({
                  activeSelectedBlockIds,
                  blockId: contextMenu.blockId,
                  canPaste: clipboardBlocks.length > 0,
                  copySelectedBlocks,
                  cutSelectedBlocks,
                  pasteClipboardBlocks,
                  duplicateSelectedBlocks,
                  deleteSelectedUnlockedBlocks,
                  openComments: () => {
                    selectSingleBlock(contextMenu.blockId)
                    setSelectedCommentTarget('selected-block')
                    setActiveSidePanel('comments')
                  },
                  selectedSlide,
                  setLockForBlocks,
                  arrangeSlideBlock,
                })
              : getSlideContextMenuItems({
                  slideId: contextMenu.slideId,
                  slides,
                  getActions: (slideId) => ({
                    addSlide: () => handleAddSlideAfter(slideId),
                    duplicateSlide: () => handleDuplicateSlideById(slideId),
                    deleteSlide: () => handleDeleteSlideById(slideId),
                    moveUp: () => handleMoveSlide(slideId, 'up'),
                    moveDown: () => handleMoveSlide(slideId, 'down'),
                    present: () => startPresentationFromSlide(slideId),
                  }),
                })
          }
          onClose={closeContextMenu}
        />
      ) : null}
    </section>
  )
}

function getObjectContextMenuItems({
  activeSelectedBlockIds,
  blockId,
  canPaste,
  copySelectedBlocks,
  cutSelectedBlocks,
  pasteClipboardBlocks,
  duplicateSelectedBlocks,
  deleteSelectedUnlockedBlocks,
  openComments,
  selectedSlide,
  setLockForBlocks,
  arrangeSlideBlock,
}: {
  activeSelectedBlockIds: string[]
  blockId: string
  canPaste: boolean
  copySelectedBlocks: () => void
  cutSelectedBlocks: () => void
  pasteClipboardBlocks: () => void
  duplicateSelectedBlocks: () => void
  deleteSelectedUnlockedBlocks: () => void
  openComments: () => void
  selectedSlide: Slide | undefined
  setLockForBlocks: (blockIds: string[], locked: boolean) => void
  arrangeSlideBlock: (
    slideId: string,
    blockId: string,
    direction: 'forward' | 'backward' | 'front' | 'back',
  ) => void
}): EditorContextMenuItem[] {
  const targetBlock = selectedSlide?.blocks.find((block) => block.id === blockId)
  const targetBlockIndex = selectedSlide?.blocks.findIndex((block) => block.id === blockId) ?? 0
  const isLocked = targetBlock ? isBlockLocked(targetBlock, targetBlockIndex) : false
  const targetBlockIds = activeSelectedBlockIds.includes(blockId) ? activeSelectedBlockIds : [blockId]

  return [
    { label: 'Copy', shortcut: 'Ctrl+C', disabled: !targetBlock, onSelect: copySelectedBlocks },
    { label: 'Cut', shortcut: 'Ctrl+X', disabled: !targetBlock || isLocked, onSelect: cutSelectedBlocks },
    { label: 'Paste', shortcut: 'Ctrl+V', disabled: !canPaste, onSelect: pasteClipboardBlocks },
    { label: 'Duplicate', shortcut: 'Ctrl+D', disabled: !targetBlock, onSelect: duplicateSelectedBlocks },
    {
      label: 'Delete',
      shortcut: 'Del',
      disabled: !targetBlock || isLocked,
      destructive: true,
      onSelect: deleteSelectedUnlockedBlocks,
    },
    {
      label: 'Bring forward',
      disabled: !targetBlock || isLocked || !selectedSlide,
      onSelect: () => selectedSlide && arrangeSlideBlock(selectedSlide.id, blockId, 'forward'),
    },
    {
      label: 'Send backward',
      disabled: !targetBlock || isLocked || !selectedSlide,
      onSelect: () => selectedSlide && arrangeSlideBlock(selectedSlide.id, blockId, 'backward'),
    },
    {
      label: 'Bring to front',
      disabled: !targetBlock || isLocked || !selectedSlide,
      onSelect: () => selectedSlide && arrangeSlideBlock(selectedSlide.id, blockId, 'front'),
    },
    {
      label: 'Send to back',
      disabled: !targetBlock || isLocked || !selectedSlide,
      onSelect: () => selectedSlide && arrangeSlideBlock(selectedSlide.id, blockId, 'back'),
    },
    { label: 'Add comment', disabled: !targetBlock, onSelect: openComments },
    {
      label: isLocked ? 'Unlock' : 'Lock',
      disabled: !targetBlock,
      onSelect: () => setLockForBlocks(targetBlockIds, !isLocked),
    },
  ]
}

function getSlideContextMenuItems({
  slideId,
  slides,
  getActions,
}: {
  slideId: string
  slides: Array<{ id: string }>
  getActions: (slideId: string) => {
    addSlide: () => void
    duplicateSlide: () => void
    deleteSlide: () => void
    moveUp: () => void
    moveDown: () => void
    present: () => void
  }
}): EditorContextMenuItem[] {
  const slideIndex = slides.findIndex((slide) => slide.id === slideId)
  const actions = getActions(slideId)

  return [
    { label: 'Add slide', onSelect: actions.addSlide },
    { label: 'Duplicate slide', onSelect: actions.duplicateSlide },
    { label: 'Delete slide', destructive: true, onSelect: actions.deleteSlide },
    {
      label: 'Move up',
      disabled: slideIndex <= 0,
      onSelect: actions.moveUp,
    },
    {
      label: 'Move down',
      disabled: slideIndex < 0 || slideIndex >= slides.length - 1,
      onSelect: actions.moveDown,
    },
    { label: 'Present from this slide', onSelect: actions.present },
    {
      label: 'Rename section',
      disabled: true,
      onSelect: () => undefined,
    },
  ]
}
