import { type PropsWithChildren, useEffect, useRef, useState } from 'react'
import {
  createChartSlideFromSuggestion,
  createChartSuggestionsFromFiles,
} from '../data/chartSuggestions'
import { canCollaboratorUpload, getCommentTargetKey, getMockActor } from '../data/collaboration'
import {
  createAlternateSlides,
  createSlidesFromDeck,
  runMockDeckGenerationPipeline,
} from '../data/deckGenerator'
import { createEmptyDeck, seedWorkspaceState } from '../data/mockWorkspace'
import {
  autoFillPresentationFieldsFromFiles,
  OWNER_USER_ID,
  createMockFileAsset,
} from '../data/sourceIngestion'
import { generateDeckReport } from '../data/reportGenerator'
import { cloneBlockForPaste } from '../data/slideObjectTools'
import {
  clampBlockLayout,
  createManualSlideBlock,
  getOffsetLayout,
  normalizeBlockLayout,
  normalizeBlockTextStyle,
  normalizeBlockVisualStyle,
  normalizeSlideBlock,
} from '../data/slideLayout'
import { normalizeWorkspaceState } from '../data/workspaceState'
import {
  deleteWorkspaceItemPermanently as deleteWorkspaceItemPermanentlyInState,
  duplicateWorkspaceItem as duplicateWorkspaceItemInState,
  moveWorkspaceItem as moveWorkspaceItemInState,
  renameWorkspaceItem as renameWorkspaceItemInState,
  restoreWorkspaceItem as restoreWorkspaceItemInState,
  toggleWorkspaceItemStarred as toggleWorkspaceItemStarredInState,
  trashWorkspaceItem as trashWorkspaceItemInState,
} from '../data/workspaceLibrary'
import type {
  Comment,
  Deck,
  FileAsset,
  FileAssetKind,
  FileContributorRole,
  ReportType,
  Slide,
  WorkspaceState,
} from '../types/models'
import { formatFileSize } from '../utils/formatters'
import { createId } from '../utils/ids'
import { WorkspaceContext } from './workspaceStoreContext'
import type { WorkspaceContextValue } from './workspaceStoreContext'

const STORAGE_KEY = 'ai-presentation-workspace:v1'
const HISTORY_LIMIT = 40

interface WorkspaceHistory {
  past: WorkspaceState[]
  future: WorkspaceState[]
}

function loadInitialWorkspace() {
  if (typeof window === 'undefined') {
    return normalizeWorkspaceState(seedWorkspaceState())
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)

  if (!stored) {
    return normalizeWorkspaceState(seedWorkspaceState())
  }

  try {
    return normalizeWorkspaceState(JSON.parse(stored) as WorkspaceState)
  } catch {
    return normalizeWorkspaceState(seedWorkspaceState())
  }
}

function inferFileKind(name: string): FileAssetKind {
  const extension = name.split('.').pop()?.toLowerCase()

  if (extension === 'pdf') {
    return 'pdf'
  }

  if (['doc', 'docx', 'txt', 'md'].includes(extension ?? '')) {
    return 'doc'
  }

  if (['xls', 'xlsx', 'csv'].includes(extension ?? '')) {
    return 'sheet'
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension ?? '')) {
    return 'image'
  }

  return 'other'
}

function touchDecks(decks: Deck[], deckId: string, updates: Partial<Deck>) {
  const nextUpdatedAt = new Date().toISOString()

  return decks.map((deck) =>
    deck.id === deckId
      ? {
          ...deck,
          ...updates,
          updatedAt: nextUpdatedAt,
        }
      : deck,
  )
}

function replaceDeckSlides(slides: Slide[], deckId: string, nextDeckSlides: Slide[]) {
  return [...slides.filter((slide) => slide.deckId !== deckId), ...nextDeckSlides]
}

function getOrderedDeckSlides(slides: Slide[], deckId: string) {
  return slides
    .filter((slide) => slide.deckId === deckId)
    .sort((left, right) => left.index - right.index)
}

function reindexSlides(slides: Slide[]) {
  return slides.map((slide, index) => ({
    ...slide,
    index: index + 1,
  }))
}

function createBlankSlide(deckId: string, index: number): Slide {
  return {
    id: createId('slide'),
    deckId,
    index,
    title: 'Untitled slide',
    notes: '',
    sourceTrace: [],
    blocks: [],
  }
}

function createReportFileName(deckTitle: string, reportType: ReportType) {
  const safeTitle = deckTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)

  return `${safeTitle || 'deck'}-${reportType}-report.html`
}

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [workspace, setWorkspace] = useState<WorkspaceState>(loadInitialWorkspace)
  const [history, setHistory] = useState<WorkspaceHistory>({ past: [], future: [] })
  const workspaceRef = useRef(workspace)
  const historyRef = useRef(history)

  useEffect(() => {
    workspaceRef.current = workspace
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  }, [workspace])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  const updateHistory = (nextHistory: WorkspaceHistory) => {
    historyRef.current = nextHistory
    setHistory(nextHistory)
  }

  const pushHistory = (previousWorkspace: WorkspaceState) => {
    const currentHistory = historyRef.current

    updateHistory({
      past: [...currentHistory.past, previousWorkspace].slice(-HISTORY_LIMIT),
      future: [],
    })
  }

  const commitWorkspace = (updater: (current: WorkspaceState) => WorkspaceState) => {
    const current = workspaceRef.current
    const next = updater(current)

    if (Object.is(next, current)) {
      return
    }

    pushHistory(current)
    workspaceRef.current = next
    setWorkspace(next)
  }

  const undoWorkspace = () => {
    const currentHistory = historyRef.current
    const previous = currentHistory.past[currentHistory.past.length - 1]

    if (!previous) {
      return
    }

    const current = workspaceRef.current
    const nextHistory = {
      past: currentHistory.past.slice(0, -1),
      future: [current, ...currentHistory.future].slice(0, HISTORY_LIMIT),
    }

    updateHistory(nextHistory)
    workspaceRef.current = previous
    setWorkspace(previous)
  }

  const redoWorkspace = () => {
    const currentHistory = historyRef.current
    const next = currentHistory.future[0]

    if (!next) {
      return
    }

    const current = workspaceRef.current
    const nextHistory = {
      past: [...currentHistory.past, current].slice(-HISTORY_LIMIT),
      future: currentHistory.future.slice(1),
    }

    updateHistory(nextHistory)
    workspaceRef.current = next
    setWorkspace(next)
  }

  const setActiveDeck = (deckId: string) => {
    setWorkspace((current) => ({
      ...current,
      activeDeckId: deckId,
    }))
  }

  const createPresentation = (projectId?: string) => {
    const targetProjectId = projectId ?? workspace.projects[0]?.id

    if (!targetProjectId) {
      return undefined
    }

    const nextDeck = createEmptyDeck(targetProjectId)

    setWorkspace((current) => ({
      ...current,
      activeDeckId: nextDeck.id,
      decks: [nextDeck, ...current.decks],
      projects: current.projects.map((project) =>
        project.id === targetProjectId
          ? {
              ...project,
              deckIds: [nextDeck.id, ...project.deckIds],
              updatedAt: nextDeck.updatedAt,
            }
          : project,
      ),
    }))

    return nextDeck.id
  }

  const renameWorkspaceItem: WorkspaceContextValue['renameWorkspaceItem'] = (
    itemType,
    itemId,
    name,
  ) => {
    commitWorkspace((current) =>
      renameWorkspaceItemInState(current, {
        itemType,
        itemId,
        name,
        now: new Date().toISOString(),
      }),
    )
  }

  const duplicateWorkspaceItem: WorkspaceContextValue['duplicateWorkspaceItem'] = (
    itemType,
    itemId,
  ) => {
    let nextActiveItemId: string | undefined
    const now = new Date().toISOString()

    commitWorkspace((current) => {
      const next = duplicateWorkspaceItemInState(current, {
        itemType,
        itemId,
        now,
      })

      if (itemType === 'deck' && next.activeDeckId !== current.activeDeckId) {
        nextActiveItemId = next.activeDeckId
      }

      return next
    })

    return nextActiveItemId
  }

  const moveWorkspaceItem: WorkspaceContextValue['moveWorkspaceItem'] = (
    itemType,
    itemId,
    targetId,
  ) => {
    commitWorkspace((current) =>
      moveWorkspaceItemInState(current, {
        itemType,
        itemId,
        targetId,
        now: new Date().toISOString(),
      }),
    )
  }

  const toggleWorkspaceItemStarred: WorkspaceContextValue['toggleWorkspaceItemStarred'] = (
    itemType,
    itemId,
  ) => {
    commitWorkspace((current) =>
      toggleWorkspaceItemStarredInState(current, {
        itemType,
        itemId,
        now: new Date().toISOString(),
      }),
    )
  }

  const trashWorkspaceItem: WorkspaceContextValue['trashWorkspaceItem'] = (itemType, itemId) => {
    commitWorkspace((current) =>
      trashWorkspaceItemInState(current, {
        itemType,
        itemId,
        now: new Date().toISOString(),
      }),
    )
  }

  const restoreWorkspaceItem: WorkspaceContextValue['restoreWorkspaceItem'] = (
    itemType,
    itemId,
  ) => {
    commitWorkspace((current) =>
      restoreWorkspaceItemInState(current, {
        itemType,
        itemId,
        now: new Date().toISOString(),
      }),
    )
  }

  const deleteWorkspaceItemPermanently: WorkspaceContextValue['deleteWorkspaceItemPermanently'] = (
    itemType,
    itemId,
  ) => {
    commitWorkspace((current) =>
      deleteWorkspaceItemPermanentlyInState(current, {
        itemType,
        itemId,
        now: new Date().toISOString(),
      }),
    )
  }

  const updateDeck: WorkspaceContextValue['updateDeck'] = (deckId, updates) => {
    setWorkspace((current) => ({
      ...current,
      decks: touchDecks(current.decks, deckId, updates),
    }))
  }

  const updateDeckSetup: WorkspaceContextValue['updateDeckSetup'] = (deckId, updates) => {
    setWorkspace((current) => ({
      ...current,
      decks: current.decks.map((deck) =>
        deck.id === deckId
          ? {
              ...deck,
              setup: {
                ...deck.setup,
                ...updates,
              },
              collaboration:
                updates.shareSetupInputs === true && deck.collaboration.isShared
                  ? {
                      ...deck.collaboration,
                      allowCollaboratorUploads: true,
                    }
                  : deck.collaboration,
              updatedAt: new Date().toISOString(),
            }
          : deck,
      ),
    }))
  }

  const updateDeckCollaboration: WorkspaceContextValue['updateDeckCollaboration'] = (
    deckId,
    updates,
  ) => {
    setWorkspace((current) => ({
      ...current,
      decks: current.decks.map((deck) =>
        deck.id === deckId
          ? {
              ...deck,
              collaboration: {
                ...deck.collaboration,
                isShared: updates.isShared,
                access: 'comment-only',
                allowCollaboratorUploads: updates.allowCollaboratorUploads,
              },
              setup: {
                ...deck.setup,
                shareSetupInputs: updates.shareSetupInputs,
              },
              updatedAt: new Date().toISOString(),
            }
          : deck,
      ),
    }))
  }

  const updateProjectCollaboration: WorkspaceContextValue['updateProjectCollaboration'] = (
    projectId,
    updates,
  ) => {
    setWorkspace((current) => ({
      ...current,
      decks: current.decks.map((deck) =>
        deck.projectId === projectId
          ? {
              ...deck,
              collaboration: {
                ...deck.collaboration,
                isShared: updates.isShared,
                access: 'comment-only',
                allowCollaboratorUploads: updates.allowCollaboratorUploads,
              },
              setup: {
                ...deck.setup,
                shareSetupInputs: updates.shareSetupInputs,
              },
              updatedAt: new Date().toISOString(),
            }
          : deck,
      ),
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              updatedAt: new Date().toISOString(),
            }
          : project,
      ),
    }))
  }

  const uploadAssets: WorkspaceContextValue['uploadAssets'] = (deckId, files, options) => {
    const entries = Array.from(files)

    if (entries.length === 0) {
      return
    }

    const deck = workspace.decks.find((candidate) => candidate.id === deckId)

    if (!deck) {
      return
    }

    const uploaderRole: FileContributorRole = options?.uploadedByRole ?? 'owner'
    const actor = getMockActor(uploaderRole)

    if (uploaderRole === 'collaborator' && !canCollaboratorUpload(deck)) {
      return
    }

    const uploadedAt = new Date().toISOString()
    const nextAssets: FileAsset[] = entries.map((file) =>
      createMockFileAsset({
        id: createId('file'),
        deckId,
        name: file.name,
        kind: inferFileKind(file.name),
        status: 'extracting',
        sizeBytes: file.size,
        sizeLabel: formatFileSize(file.size),
        uploadedAt,
        uploadedByRole: uploaderRole,
        uploadedByUserId: options?.uploadedByUserId ?? actor.userId,
        highlightForOwnerReview: uploaderRole === 'collaborator',
      }),
    )

    setWorkspace((current) => ({
      ...current,
      fileAssets: [...nextAssets, ...current.fileAssets],
      chartSuggestions: [
        ...createChartSuggestionsFromFiles(nextAssets, current.chartSuggestions).filter(
          (suggestion) =>
            !current.chartSuggestions.some((currentSuggestion) => currentSuggestion.id === suggestion.id),
        ),
        ...current.chartSuggestions,
      ],
      decks: current.decks.map((deck) =>
        deck.id === deckId
          ? {
              ...deck,
              fileAssetIds: [...nextAssets.map((asset) => asset.id), ...deck.fileAssetIds],
              updatedAt: uploadedAt,
            }
          : deck,
      ),
    }))

    // Replace this mocked lifecycle with a real async ingestion job when backend parsing exists.
    window.setTimeout(() => {
      setWorkspace((current) => ({
        ...current,
        fileAssets: current.fileAssets.map((asset) =>
          nextAssets.some((candidate) => candidate.id === asset.id)
            ? {
                ...asset,
                status: 'parsed',
              }
            : asset,
        ),
      }))
    }, 900)
  }

  const markAssetReviewed: WorkspaceContextValue['markAssetReviewed'] = (assetId) => {
    setWorkspace((current) => ({
      ...current,
      fileAssets: current.fileAssets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              highlightForOwnerReview: false,
            }
          : asset,
      ),
    }))
  }

  const autoFillDeckSetupFromFiles: WorkspaceContextValue['autoFillDeckSetupFromFiles'] = (
    deckId,
  ) => {
    setWorkspace((current) => {
      const deck = current.decks.find((candidate) => candidate.id === deckId)

      if (!deck) {
        return current
      }

      const deckAssets = current.fileAssets.filter((asset) => asset.deckId === deckId)
      const autofill = autoFillPresentationFieldsFromFiles(deckAssets, deck.setup)

      if (Object.keys(autofill).length === 0) {
        return current
      }

      return {
        ...current,
        decks: current.decks.map((candidate) =>
          candidate.id === deckId
            ? {
                ...candidate,
                setup: {
                  ...candidate.setup,
                  ...autofill,
                },
                updatedAt: new Date().toISOString(),
              }
            : candidate,
        ),
      }
    })
  }

  const generateSlides: WorkspaceContextValue['generateSlides'] = async (deckId) => {
    const sourceDeck = workspace.decks.find((candidate) => candidate.id === deckId)

    if (!sourceDeck) {
      return undefined
    }

    const sourceFiles = workspace.fileAssets.filter((asset) => asset.deckId === deckId)
    const previousDeck = workspace.decks
      .filter((candidate) => candidate.projectId === sourceDeck.projectId && candidate.id !== deckId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    const result = await runMockDeckGenerationPipeline({
      sourceDeck,
      sourceFiles,
      previousDeck,
    })

    setWorkspace((current) => ({
      ...current,
      activeDeckId: result.generatedDeck.id,
      decks: [result.generatedDeck, ...current.decks],
      slides: [...current.slides, ...result.generatedSlides],
      fileAssets: [...current.fileAssets, ...result.generatedFiles],
      chartSuggestions: [
        ...createChartSuggestionsFromFiles(result.generatedFiles, current.chartSuggestions).filter(
          (suggestion) =>
            !current.chartSuggestions.some((currentSuggestion) => currentSuggestion.id === suggestion.id),
        ),
        ...current.chartSuggestions,
      ],
      deckVersions: [result.generatedVersion, ...current.deckVersions],
      projects: current.projects.map((project) =>
        project.id === result.generatedDeck.projectId
          ? {
              ...project,
              deckIds: [result.generatedDeck.id, ...project.deckIds],
              updatedAt: result.generatedDeck.updatedAt,
            }
          : project,
      ),
    }))

    return result.generatedDeck.id
  }

  const generateReport: WorkspaceContextValue['generateReport'] = (deckId, reportType) => {
    const assetId = createId('file-report')
    const versionId = createId('version')

    setWorkspace((current) => {
      const deck = current.decks.find((candidate) => candidate.id === deckId)

      if (!deck) {
        return current
      }

      const deckSlides = getOrderedDeckSlides(current.slides, deckId)
      const sourceFiles = current.fileAssets.filter(
        (asset) => asset.deckId === deckId && asset.kind !== 'report',
      )
      const report = generateDeckReport({
        deck,
        slides: deckSlides,
        fileAssets: sourceFiles,
        reportType,
      })
      const fileName = createReportFileName(deck.title, reportType)
      const sizeBytes = new TextEncoder().encode(report.plainText).length
      const reportAsset: FileAsset = {
        id: assetId,
        deckId,
        name: fileName,
        kind: 'report',
        status: 'parsed',
        uploadedByUserId: OWNER_USER_ID,
        uploadedByRole: 'owner',
        highlightForOwnerReview: false,
        sizeBytes,
        sizeLabel: formatFileSize(sizeBytes),
        summary: `Printable ${reportType} report generated from ${deckSlides.length} slide${deckSlides.length === 1 ? '' : 's'}.`,
        uploadedAt: report.generatedAt,
        extractedTextPreview: report.executiveSummary,
        extractedMetadata: {
          reportType,
          generatedAt: report.generatedAt,
          slideCount: deckSlides.length,
          sourceCount: report.sourceReferences.length,
          output: 'html-print-ready',
        },
        possibleAudience: deck.setup.audience,
        possibleGoal: deck.setup.goal,
        possibleSections: report.keyPoints.map((section) => section.title),
        possibleTone: deck.setup.tone,
        sourceTrace: report.sourceReferences,
        report,
      }

      return {
        ...current,
        fileAssets: [reportAsset, ...current.fileAssets],
        deckVersions: [
          {
            id: versionId,
            deckId,
            label: 'Report generated',
            summary: `Generated ${reportType} printable report asset ${fileName}.`,
            createdAt: report.generatedAt,
            parentVersionId: deck.activeVersionId,
            sourceDeckId: deck.id,
            slideSnapshot: deckSlides,
          },
          ...current.deckVersions,
        ],
        decks: touchDecks(current.decks, deckId, {
          fileAssetIds: [assetId, ...deck.fileAssetIds],
          activeVersionId: versionId,
          status: 'editing',
        }),
      }
    })

    return assetId
  }

  const acceptChartSuggestion: WorkspaceContextValue['acceptChartSuggestion'] = (suggestionId) => {
    setWorkspace((current) => {
      const suggestion = current.chartSuggestions.find((candidate) => candidate.id === suggestionId)

      if (!suggestion || suggestion.status !== 'suggested') {
        return current
      }

      const deck = current.decks.find((candidate) => candidate.id === suggestion.deckId)

      if (!deck) {
        return current
      }

      const deckSlides = current.slides
        .filter((slide) => slide.deckId === deck.id)
        .sort((left, right) => left.index - right.index)
      const fileAsset = current.fileAssets.find((asset) => asset.id === suggestion.fileId)
      const nextSlide = createChartSlideFromSuggestion(
        deck.id,
        deckSlides.length + 1,
        suggestion,
        fileAsset,
      )
      const nextSlides = [...deckSlides, nextSlide]
      const nextVersionId = createId('version')

      return {
        ...current,
        activeDeckId: deck.id,
        slides: replaceDeckSlides(current.slides, deck.id, nextSlides),
        chartSuggestions: current.chartSuggestions.map((candidate) =>
          candidate.id === suggestion.id
            ? {
                ...candidate,
                status: 'accepted',
              }
            : candidate,
        ),
        deckVersions: [
          {
            id: nextVersionId,
            deckId: deck.id,
            label: 'Chart added',
            summary: `Added chart placeholder from ${fileAsset?.name ?? suggestion.title}.`,
            createdAt: new Date().toISOString(),
            parentVersionId: deck.activeVersionId,
            sourceDeckId: deck.id,
            slideSnapshot: nextSlides,
          },
          ...current.deckVersions,
        ],
        decks: touchDecks(current.decks, deck.id, {
          slideIds: nextSlides.map((slide) => slide.id),
          activeVersionId: nextVersionId,
          status: 'editing',
        }),
      }
    })
  }

  const rejectChartSuggestion: WorkspaceContextValue['rejectChartSuggestion'] = (suggestionId) => {
    setWorkspace((current) => ({
      ...current,
      chartSuggestions: current.chartSuggestions.map((suggestion) =>
        suggestion.id === suggestionId
          ? {
              ...suggestion,
              status: 'rejected',
            }
          : suggestion,
      ),
    }))
  }

  const addComment: WorkspaceContextValue['addComment'] = (input) => {
    const actor = getMockActor(input.authorRole)

    setWorkspace((current) => {
      const matchingThread = current.comments.find(
        (thread) =>
          getCommentTargetKey({
            deckId: thread.deckId,
            slideId: thread.slideId,
            blockId: thread.blockId,
            inputFieldKey: thread.inputFieldKey,
          }) ===
            getCommentTargetKey({
              deckId: input.deckId,
              slideId: input.slideId,
              blockId: input.blockId,
              inputFieldKey: input.inputFieldKey,
            }) && thread.projectId === input.projectId,
      )

      if (matchingThread) {
        const nextMessage = {
          id: createId('comment-message'),
          author: actor.name,
          authorUserId: actor.userId,
          authorRole: actor.role,
          message: input.message,
          createdAt: new Date().toISOString(),
        }

        return {
          ...current,
          comments: current.comments.map((thread) =>
            thread.id === matchingThread.id
              ? {
                  ...thread,
                  updatedAt: nextMessage.createdAt,
                  resolved: false,
                  messages: [...thread.messages, nextMessage],
                }
              : thread,
          ),
        }
      }

      const createdAt = new Date().toISOString()
      const nextThread: Comment = {
        id: createId('comment-thread'),
        projectId: input.projectId,
        deckId: input.deckId,
        slideId: input.slideId,
        blockId: input.blockId,
        inputFieldKey: input.inputFieldKey,
        createdAt,
        updatedAt: createdAt,
        resolved: false,
        messages: [
          {
            id: createId('comment-message'),
            author: actor.name,
            authorUserId: actor.userId,
            authorRole: actor.role,
            message: input.message,
            createdAt,
          },
        ],
      }

      return {
        ...current,
        comments: [nextThread, ...current.comments],
      }
    })
  }

  const resolveComment: WorkspaceContextValue['resolveComment'] = (commentId) => {
    setWorkspace((current) => ({
      ...current,
      comments: current.comments.map((thread) =>
        thread.id === commentId
          ? {
              ...thread,
              resolved: true,
              updatedAt: new Date().toISOString(),
            }
          : thread,
      ),
    }))
  }

  const addSlide: WorkspaceContextValue['addSlide'] = (deckId, afterSlideId) => {
    const currentDeckSlides = getOrderedDeckSlides(workspaceRef.current.slides, deckId)
    const afterIndex = currentDeckSlides.findIndex((slide) => slide.id === afterSlideId)
    const insertIndex = afterIndex >= 0 ? afterIndex + 1 : currentDeckSlides.length
    const nextSlide = createBlankSlide(deckId, insertIndex + 1)

    commitWorkspace((current) => {
      const deck = current.decks.find((candidate) => candidate.id === deckId)

      if (!deck) {
        return current
      }

      const deckSlides = getOrderedDeckSlides(current.slides, deckId)
      const safeInsertIndex = Math.min(Math.max(insertIndex, 0), deckSlides.length)
      const nextDeckSlides = reindexSlides([
        ...deckSlides.slice(0, safeInsertIndex),
        nextSlide,
        ...deckSlides.slice(safeInsertIndex),
      ])

      return {
        ...current,
        slides: replaceDeckSlides(current.slides, deckId, nextDeckSlides),
        decks: touchDecks(current.decks, deckId, {
          slideIds: nextDeckSlides.map((slide) => slide.id),
          status: 'editing',
        }),
      }
    })

    return nextSlide.id
  }

  const deleteSlide: WorkspaceContextValue['deleteSlide'] = (deckId, slideId) => {
    const currentDeckSlides = getOrderedDeckSlides(workspaceRef.current.slides, deckId)
    const deletedIndex = currentDeckSlides.findIndex((slide) => slide.id === slideId)
    const nextActiveSlideId =
      deletedIndex >= 0
        ? (currentDeckSlides[deletedIndex + 1] ?? currentDeckSlides[deletedIndex - 1])?.id
        : undefined

    commitWorkspace((current) => {
      const deck = current.decks.find((candidate) => candidate.id === deckId)

      if (!deck || !current.slides.some((slide) => slide.id === slideId && slide.deckId === deckId)) {
        return current
      }

      const nextDeckSlides = reindexSlides(
        getOrderedDeckSlides(current.slides, deckId).filter((slide) => slide.id !== slideId),
      )

      return {
        ...current,
        slides: replaceDeckSlides(current.slides, deckId, nextDeckSlides),
        comments: current.comments.filter((thread) => thread.slideId !== slideId),
        decks: touchDecks(current.decks, deckId, {
          slideIds: nextDeckSlides.map((slide) => slide.id),
          status: 'editing',
        }),
      }
    })

    return nextActiveSlideId
  }

  const duplicateSlide: WorkspaceContextValue['duplicateSlide'] = (deckId, slideId) => {
    const sourceSlide = getOrderedDeckSlides(workspaceRef.current.slides, deckId).find(
      (slide) => slide.id === slideId,
    )

    if (!sourceSlide) {
      return undefined
    }

    const nextSlideId = createId('slide')
    const blockIdMap = new Map<string, string>()
    const nextBlocks = sourceSlide.blocks.map((block, index) => {
      const nextBlockId = createId(`block-${block.type}`)
      blockIdMap.set(block.id, nextBlockId)

      return normalizeSlideBlock(
        {
          ...block,
          id: nextBlockId,
          sourceTrace: [...block.sourceTrace],
        },
        index,
      )
    })
    const nextSlide: Slide = {
      ...sourceSlide,
      id: nextSlideId,
      index: sourceSlide.index + 1,
      title: `${sourceSlide.title} copy`,
      notes: sourceSlide.notes,
      sourceTrace: [...sourceSlide.sourceTrace],
      blocks: nextBlocks,
    }
    const copiedComments = workspaceRef.current.comments
      .filter((thread) => thread.deckId === deckId && thread.slideId === slideId)
      .map((thread) => ({
        ...thread,
        id: createId('comment-thread'),
        slideId: nextSlideId,
        blockId: thread.blockId ? blockIdMap.get(thread.blockId) : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolved: false,
        messages: thread.messages.map((message) => ({
          ...message,
          id: createId('comment-message'),
        })),
      }))

    commitWorkspace((current) => {
      const deck = current.decks.find((candidate) => candidate.id === deckId)

      if (!deck) {
        return current
      }

      const deckSlides = getOrderedDeckSlides(current.slides, deckId)
      const sourceIndex = deckSlides.findIndex((slide) => slide.id === slideId)
      const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : deckSlides.length
      const nextDeckSlides = reindexSlides([
        ...deckSlides.slice(0, insertIndex),
        nextSlide,
        ...deckSlides.slice(insertIndex),
      ])

      return {
        ...current,
        slides: replaceDeckSlides(current.slides, deckId, nextDeckSlides),
        comments: [...copiedComments, ...current.comments],
        decks: touchDecks(current.decks, deckId, {
          slideIds: nextDeckSlides.map((slide) => slide.id),
          status: 'editing',
        }),
      }
    })

    return nextSlideId
  }

  const reorderSlides: WorkspaceContextValue['reorderSlides'] = (deckId, orderedSlideIds) => {
    commitWorkspace((current) => {
      const deck = current.decks.find((candidate) => candidate.id === deckId)

      if (!deck) {
        return current
      }

      const deckSlides = getOrderedDeckSlides(current.slides, deckId)
      const deckSlideIds = deckSlides.map((slide) => slide.id)
      const orderedSet = new Set(orderedSlideIds)

      if (
        orderedSlideIds.length !== deckSlides.length ||
        orderedSlideIds.some((slideId) => !deckSlideIds.includes(slideId)) ||
        orderedSet.size !== deckSlides.length ||
        orderedSlideIds.every((slideId, index) => slideId === deckSlideIds[index])
      ) {
        return current
      }

      const slideById = new Map(deckSlides.map((slide) => [slide.id, slide]))
      const nextDeckSlides = reindexSlides(
        orderedSlideIds.flatMap((slideId) => {
          const slide = slideById.get(slideId)

          return slide ? [slide] : []
        }),
      )

      return {
        ...current,
        slides: replaceDeckSlides(current.slides, deckId, nextDeckSlides),
        decks: touchDecks(current.decks, deckId, {
          slideIds: nextDeckSlides.map((slide) => slide.id),
          status: 'editing',
        }),
      }
    })
  }

  const updateSlides = (slideId: string, updater: (slide: Slide) => Slide) => {
    commitWorkspace((current) => {
      const targetSlide = current.slides.find((slide) => slide.id === slideId)

      if (!targetSlide) {
        return current
      }

      return {
        ...current,
        slides: current.slides.map((slide) => (slide.id === slideId ? updater(slide) : slide)),
        decks: touchDecks(current.decks, targetSlide.deckId, {
          status: 'editing',
        }),
      }
    })
  }

  const addSlideBlock: WorkspaceContextValue['addSlideBlock'] = (
    slideId,
    kind,
    anchorBlockId,
  ) => {
    const targetSlide = workspaceRef.current.slides.find((slide) => slide.id === slideId)
    const anchorBlock = targetSlide?.blocks.find((block) => block.id === anchorBlockId)
    const nextBlock = createManualSlideBlock(
      kind,
      targetSlide?.blocks.length ?? 0,
      anchorBlock ? normalizeBlockLayout(anchorBlock, 0) : undefined,
    )

    updateSlides(slideId, (slide) => ({
      ...slide,
      blocks: [...slide.blocks, nextBlock],
    }))

    return targetSlide ? nextBlock.id : undefined
  }

  const deleteSlideBlocks: WorkspaceContextValue['deleteSlideBlocks'] = (slideId, blockIds) => {
    const deletedBlockIds = new Set(blockIds)

    if (deletedBlockIds.size === 0) {
      return
    }

    commitWorkspace((current) => {
      const targetSlide = current.slides.find((slide) => slide.id === slideId)

      if (!targetSlide) {
        return current
      }

      return {
        ...current,
        slides: current.slides.map((slide) =>
          slide.id === slideId
            ? {
                ...slide,
                blocks: slide.blocks.filter((block) => !deletedBlockIds.has(block.id)),
              }
            : slide,
        ),
        comments: current.comments.filter(
          (thread) => !thread.blockId || !deletedBlockIds.has(thread.blockId),
        ),
        decks: touchDecks(current.decks, targetSlide.deckId, {
          status: 'editing',
        }),
      }
    })
  }

  const deleteSlideBlock: WorkspaceContextValue['deleteSlideBlock'] = (slideId, blockId) => {
    deleteSlideBlocks(slideId, [blockId])
  }

  const duplicateSlideBlock: WorkspaceContextValue['duplicateSlideBlock'] = (slideId, blockId) => {
    const targetSlide = workspaceRef.current.slides.find((slide) => slide.id === slideId)
    const sourceBlock = targetSlide?.blocks.find((block) => block.id === blockId)

    if (!targetSlide || !sourceBlock) {
      return undefined
    }

    const nextBlock = normalizeSlideBlock(
      {
        ...sourceBlock,
        id: createId(`block-${sourceBlock.type}`),
        layout: getOffsetLayout(normalizeBlockLayout(sourceBlock, targetSlide.blocks.length)),
      },
      targetSlide.blocks.length,
    )

    updateSlides(slideId, (slide) => {
      const sourceIndex = slide.blocks.findIndex((block) => block.id === blockId)
      const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : slide.blocks.length

      return {
        ...slide,
        blocks: [
          ...slide.blocks.slice(0, insertIndex),
          nextBlock,
          ...slide.blocks.slice(insertIndex),
        ],
      }
    })

    return nextBlock.id
  }

  const updateSlideBlockContent: WorkspaceContextValue['updateSlideBlockContent'] = (
    slideId,
    blockId,
    content,
  ) => {
    updateSlides(slideId, (slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              content,
            }
          : block,
      ),
    }))
  }

  const updateSlideBlockStyle: WorkspaceContextValue['updateSlideBlockStyle'] = (
    slideId,
    blockId,
    style,
  ) => {
    updateSlides(slideId, (slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
            style: {
              ...block.style,
              ...style,
            },
            textStyle: normalizeBlockTextStyle({
              ...block,
              style: {
                ...block.style,
                ...style,
              },
            }),
          }
          : block,
      ),
    }))
  }

  const updateSlideBlockTextStyle: WorkspaceContextValue['updateSlideBlockTextStyle'] = (
    slideId,
    blockId,
    style,
  ) => {
    updateSlides(slideId, (slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) => {
        if (block.id !== blockId) {
          return block
        }

        const nextTextStyle = {
          ...normalizeBlockTextStyle(block),
          ...style,
        }

        return {
          ...block,
          textStyle: nextTextStyle,
          style: {
            ...block.style,
            align: nextTextStyle.alignment,
            bold: nextTextStyle.bold,
            italic: nextTextStyle.italic,
          },
        }
      }),
    }))
  }

  const updateSlideBlockVisualStyle: WorkspaceContextValue['updateSlideBlockVisualStyle'] = (
    slideId,
    blockId,
    style,
  ) => {
    updateSlides(slideId, (slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              visualStyle: {
                ...normalizeBlockVisualStyle(block),
                ...style,
              },
            }
          : block,
      ),
    }))
  }

  const replaceSlideBlockImage: WorkspaceContextValue['replaceSlideBlockImage'] = (
    slideId,
    blockId,
    imageAsset,
  ) => {
    updateSlides(slideId, (slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              content: imageAsset.name,
              imageAsset,
            }
          : block,
      ),
    }))
  }

  const updateSlideBlockLayout: WorkspaceContextValue['updateSlideBlockLayout'] = (
    slideId,
    blockId,
    layout,
  ) => {
    updateSlideBlocksLayout(slideId, [{ blockId, layout }])
  }

  const updateSlideBlocksLayout: WorkspaceContextValue['updateSlideBlocksLayout'] = (
    slideId,
    updates,
  ) => {
    if (updates.length === 0) {
      return
    }

    const updatesByBlockId = new Map(updates.map((update) => [update.blockId, update.layout]))

    updateSlides(slideId, (slide) => ({
      ...slide,
      blocks: slide.blocks.map((block, index) =>
        updatesByBlockId.has(block.id)
          ? {
              ...block,
              layout: clampBlockLayout({
                ...normalizeBlockLayout(block, index),
                ...updatesByBlockId.get(block.id),
              }),
            }
          : block,
      ),
    }))
  }

  const pasteSlideBlock: WorkspaceContextValue['pasteSlideBlock'] = (slideId, block, offset) => {
    return pasteSlideBlocks(slideId, [block], offset)[0]
  }

  const pasteSlideBlocks: WorkspaceContextValue['pasteSlideBlocks'] = (slideId, blocks, offset) => {
    const targetSlide = workspaceRef.current.slides.find((slide) => slide.id === slideId)

    if (!targetSlide || blocks.length === 0) {
      return []
    }

    const nextBlocks = blocks.map((block, index) =>
      cloneBlockForPaste(block, targetSlide.blocks.length + index, offset),
    )

    updateSlides(slideId, (slide) => ({
      ...slide,
      blocks: [...slide.blocks, ...nextBlocks],
    }))

    return nextBlocks.map((block) => block.id)
  }

  const arrangeSlideBlock: WorkspaceContextValue['arrangeSlideBlock'] = (
    slideId,
    blockId,
    direction,
  ) => {
    updateSlides(slideId, (slide) => {
      const orderedBlocks = slide.blocks
        .map((block, index) => ({
          block,
          layout: normalizeBlockLayout(block, index),
        }))
        .sort((left, right) => left.layout.zIndex - right.layout.zIndex)
      const currentIndex = orderedBlocks.findIndex((item) => item.block.id === blockId)
      const swapIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1

      if (currentIndex < 0 || swapIndex < 0 || swapIndex >= orderedBlocks.length) {
        return slide
      }

      const current = orderedBlocks[currentIndex]
      const target = orderedBlocks[swapIndex]
      const currentZ = current.layout.zIndex
      const targetZ = target.layout.zIndex

      return {
        ...slide,
        blocks: slide.blocks.map((block, index) => {
          if (block.id === current.block.id) {
            return {
              ...block,
              layout: {
                ...normalizeBlockLayout(block, index),
                zIndex: targetZ,
              },
            }
          }

          if (block.id === target.block.id) {
            return {
              ...block,
              layout: {
                ...normalizeBlockLayout(block, index),
                zIndex: currentZ,
              },
            }
          }

          return normalizeSlideBlock(block, index)
        }),
      }
    })
  }

  const updateSlideNotes: WorkspaceContextValue['updateSlideNotes'] = (slideId, notes) => {
    updateSlides(slideId, (slide) => ({
      ...slide,
      notes,
    }))
  }

  const createAlternateVersion: WorkspaceContextValue['createAlternateVersion'] = (deckId) => {
    setWorkspace((current) => {
      const deck = current.decks.find((candidate) => candidate.id === deckId)

      if (!deck) {
        return current
      }

      const currentSlides = current.slides
        .filter((slide) => slide.deckId === deckId)
        .sort((left, right) => left.index - right.index)
      const deckAssets = current.fileAssets.filter((asset) => asset.deckId === deckId)
      const nextSlides = createAlternateSlides(
        deck,
        currentSlides.length > 0 ? currentSlides : createSlidesFromDeck(deck, deckAssets),
      )
      const nextVersionId = createId('version')
      const nextVersionNumber =
        current.deckVersions.filter((version) => version.deckId === deckId).length + 1

      return {
        ...current,
        activeDeckId: deckId,
        slides: replaceDeckSlides(current.slides, deckId, nextSlides),
        deckVersions: [
          {
            id: nextVersionId,
            deckId,
            label: `alt-v${nextVersionNumber}`,
            summary: 'Alternate branch from the current slide structure.',
            createdAt: new Date().toISOString(),
            parentVersionId: deck.activeVersionId,
            sourceDeckId: deck.id,
            slideSnapshot: nextSlides,
          },
          ...current.deckVersions,
        ],
        decks: touchDecks(current.decks, deckId, {
          slideIds: nextSlides.map((slide) => slide.id),
          activeVersionId: nextVersionId,
          status: 'editing',
        }),
      }
    })
  }

  const applyAiEditPlan: WorkspaceContextValue['applyAiEditPlan'] = (deckId, plan) => {
    setWorkspace((current) => {
      const deck = current.decks.find((candidate) => candidate.id === deckId)

      if (!deck) {
        return current
      }

      const currentDeckSlides = current.slides
        .filter((slide) => slide.deckId === deckId)
        .sort((left, right) => left.index - right.index)
      const updatedSlidesById = new Map(plan.updatedSlides.map((slide) => [slide.id, slide]))
      const nextSlides = currentDeckSlides.map((slide) => updatedSlidesById.get(slide.id) ?? slide)
      const nextVersionId = createId('version')
      const label = plan.scope === 'slide' ? 'AI slide edit' : 'AI deck edit'

      return {
        ...current,
        activeDeckId: deckId,
        slides: replaceDeckSlides(current.slides, deckId, nextSlides),
        deckVersions: [
          {
            id: nextVersionId,
            deckId,
            label,
            summary: plan.summary,
            createdAt: new Date().toISOString(),
            parentVersionId: deck.activeVersionId,
            sourceDeckId: deck.id,
            slideSnapshot: nextSlides,
          },
          ...current.deckVersions,
        ],
        decks: touchDecks(current.decks, deckId, {
          slideIds: nextSlides.map((slide) => slide.id),
          activeVersionId: nextVersionId,
          status: 'editing',
        }),
      }
    })
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        undoWorkspace,
        redoWorkspace,
        setActiveDeck,
        createPresentation,
        renameWorkspaceItem,
        duplicateWorkspaceItem,
        moveWorkspaceItem,
        toggleWorkspaceItemStarred,
        trashWorkspaceItem,
        restoreWorkspaceItem,
        deleteWorkspaceItemPermanently,
        updateDeck,
        updateDeckSetup,
        updateDeckCollaboration,
        updateProjectCollaboration,
        uploadAssets,
        markAssetReviewed,
        autoFillDeckSetupFromFiles,
        generateSlides,
        generateReport,
        acceptChartSuggestion,
        rejectChartSuggestion,
        addComment,
        resolveComment,
        addSlide,
        deleteSlide,
        duplicateSlide,
        reorderSlides,
        addSlideBlock,
        deleteSlideBlock,
        deleteSlideBlocks,
        duplicateSlideBlock,
        updateSlideBlockContent,
        updateSlideBlockStyle,
        updateSlideBlockTextStyle,
        updateSlideBlockVisualStyle,
        replaceSlideBlockImage,
        updateSlideBlockLayout,
        updateSlideBlocksLayout,
        pasteSlideBlock,
        pasteSlideBlocks,
        arrangeSlideBlock,
        updateSlideNotes,
        applyAiEditPlan,
        createAlternateVersion,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}
