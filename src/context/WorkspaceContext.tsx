import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../components/feedback/toastContext'
import {
  createChartSlideFromSuggestion,
  createChartSuggestionsFromFiles,
} from '../data/chartSuggestions'
import { resolveBrandGenerationContext, resolveBrandKitForDeckSetup } from '../data/brandKitResolve'
import { canCollaboratorUpload, getCommentTargetKey, getMockActor } from '../data/collaboration'
import {
  createAlternateSlides,
  createSlidesFromDeck,
  runMockDeckGenerationPipeline,
} from '../data/deckGenerator'
import { createEmptyDeck, seedWorkspaceState } from '../data/mockWorkspace'
import {
  autoFillPresentationFieldsFromFiles,
  createMockFileAsset,
  finalizeLocalFileAssetIngest,
  OWNER_USER_ID,
} from '../data/sourceIngestion'
import { filterAssetsForCitationUse, resolveCitationReviewMode } from '../data/sourceCitationReview'
import { generateDeckReport } from '../data/reportGenerator'
import {
  buildDeckReportCompanyBrainEntries,
  buildDeckReportCompanyBrainEntriesFromItems,
  filterRankedKnowledgeBySelection,
  mergeAssetsForKnowledgeTraceLookup,
} from '../data/companyBrainDeckPipeline'
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
import { createSlideFromLayoutPreset } from '../data/slideLayoutPresets'
import {
  loadOrganizationIdentity,
  saveOrganizationIdentity,
  type CompanyBrainCloudClient,
} from '../data/companyBrainCloudPersistence'
import {
  loadCompanyKnowledge,
  saveCompanyKnowledge,
  type CompanyKnowledgeCloudClient,
} from '../data/companyKnowledgeCloudPersistence'
import {
  loadCompanyLibraries,
  saveCompanyLibraries,
  type CompanyLibraryCloudClient,
} from '../data/companyLibraryCloudPersistence'
import { isSupabaseConfigured, supabase } from '../data/supabaseClient'
import {
  acceptWorkerInviteForUser,
  addOrganizationMember,
  archiveCompanyCatalogDepartment as applyArchiveCompanyCatalogDepartment,
  archiveCompanyCatalogRole as applyArchiveCompanyCatalogRole,
  completeCompanyOnboarding,
  deleteApprovedMessaging,
  deleteCaseStudy,
  deleteCompanyKnowledgeItem as applyDeleteCompanyKnowledgeItem,
  deleteProductService,
  deleteWorkerInviteDraft,
  dismissCompanyOnboarding as applyDismissCompanyOnboarding,
  getMembershipForOrgUser,
  markKnowledgeReviewed,
  markWorkerInviteInvited,
  revokeWorkerInvite,
  setActiveOrganization,
  setKnowledgeApproval,
  upsertApprovedMessaging,
  upsertBrandKit,
  upsertCaseStudy,
  upsertCompanyCatalogDepartment as applyUpsertCompanyCatalogDepartment,
  upsertCompanyCatalogRole as applyUpsertCompanyCatalogRole,
  stageKnowledgeOrganizationPlan,
  upsertCompanyKnowledgeItem,
  upsertKnowledgeFolder,
  upsertProductService,
  upsertWorkerInviteDraft,
} from '../data/companyBrainMutations'
import { getRelevantCompanyKnowledgeForUserWithExplanations } from '../data/companyKnowledgeRetrieval'
import { normalizeWorkspaceState } from '../data/workspaceState'
import { workspaceUserProfileFromAuth } from '../data/workspaceUserProfile'
import {
  WORKSPACE_STORAGE_BUCKETS,
  buildWorkspaceStoragePath,
  shouldAttemptWorkspaceStorageUpload,
  uploadWorkspaceAsset,
} from '../data/workspaceStorage'
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
  CompanyKnowledgeItem,
  Deck,
  DeckReportCompanyBrainEntry,
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
import { useAuth } from './useAuth'

const STORAGE_KEY = 'ai-presentation-workspace:v1'
const HISTORY_LIMIT = 40
const IDENTITY_AUTOSAVE_DEBOUNCE_MS = 3000

/** Conservative debounce for knowledge folders/items only (~4s; identity autosave stays 3s). */
const KNOWLEDGE_AUTOSAVE_DEBOUNCE_MS = 4000

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

function isBlockLocked(block: Slide, blockId: string) {
  const targetBlock = block.blocks.find((candidate) => candidate.id === blockId)

  return targetBlock ? normalizeBlockLayout(targetBlock, 0).locked === true : false
}

function createReportFileName(deckTitle: string, reportType: ReportType) {
  const safeTitle = deckTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)

  return `${safeTitle || 'deck'}-${reportType}-intel-brief.html`
}

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { user, isLocalDevBypass } = useAuth()
  const { showToast } = useToast()
  const [workspace, setWorkspace] = useState<WorkspaceState>(loadInitialWorkspace)
  const [history, setHistory] = useState<WorkspaceHistory>({ past: [], future: [] })
  const [companyIdentitySyncStatus, setCompanyIdentitySyncStatus] =
    useState<WorkspaceContextValue['companyIdentitySyncStatus']>({
      state: isSupabaseConfigured ? 'saved' : 'local-only',
      message: isSupabaseConfigured ? undefined : 'Supabase is not configured.',
    })
  const [companyKnowledgeSyncStatus, setCompanyKnowledgeSyncStatus] =
    useState<WorkspaceContextValue['companyKnowledgeSyncStatus']>({
      state: isSupabaseConfigured ? 'saved' : 'local-only',
      message: isSupabaseConfigured ? undefined : 'Supabase is not configured.',
    })
  const [companyLibrarySyncStatus, setCompanyLibrarySyncStatus] =
    useState<WorkspaceContextValue['companyLibrarySyncStatus']>({
      state: isSupabaseConfigured ? 'saved' : 'local-only',
      message: isSupabaseConfigured ? undefined : 'Supabase is not configured.',
    })
  const [identityDirtyVersion, setIdentityDirtyVersion] = useState(0)
  const [identityLastSavedVersion, setIdentityLastSavedVersion] = useState(0)
  const [knowledgeDirtyVersion, setKnowledgeDirtyVersion] = useState(0)
  const [knowledgeLastSavedVersion, setKnowledgeLastSavedVersion] = useState(0)
  const [libraryDirtyVersion, setLibraryDirtyVersion] = useState(0)
  const [libraryLastSavedVersion, setLibraryLastSavedVersion] = useState(0)
  const workspaceRef = useRef(workspace)
  const historyRef = useRef(history)
  const identityDirtyVersionRef = useRef(0)
  const identityLastSavedVersionRef = useRef(0)
  const knowledgeDirtyVersionRef = useRef(0)
  const knowledgeLastSavedVersionRef = useRef(0)
  const libraryDirtyVersionRef = useRef(0)
  const libraryLastSavedVersionRef = useRef(0)
  const identityAutosaveTimerRef = useRef<number | null>(null)
  const knowledgeAutosaveTimerRef = useRef<number | null>(null)
  const libraryAutosaveTimerRef = useRef<number | null>(null)
  const suppressIdentityAutosaveUntilVersionRef = useRef(0)
  const suppressKnowledgeAutosaveUntilVersionRef = useRef(0)
  const suppressLibraryAutosaveUntilVersionRef = useRef(0)
  const identityAutosaveInFlightRef = useRef(false)
  const identityAutosaveQueuedRef = useRef(false)
  const knowledgeAutosaveInFlightRef = useRef(false)
  const knowledgeAutosaveQueuedRef = useRef(false)
  const libraryAutosaveInFlightRef = useRef(false)
  const libraryAutosaveQueuedRef = useRef(false)

  useEffect(() => {
    workspaceRef.current = workspace
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  }, [workspace])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  useEffect(() => {
    identityDirtyVersionRef.current = identityDirtyVersion
  }, [identityDirtyVersion])

  useEffect(() => {
    identityLastSavedVersionRef.current = identityLastSavedVersion
  }, [identityLastSavedVersion])

  useEffect(() => {
    knowledgeDirtyVersionRef.current = knowledgeDirtyVersion
  }, [knowledgeDirtyVersion])

  useEffect(() => {
    knowledgeLastSavedVersionRef.current = knowledgeLastSavedVersion
  }, [knowledgeLastSavedVersion])

  useEffect(() => {
    libraryDirtyVersionRef.current = libraryDirtyVersion
  }, [libraryDirtyVersion])

  useEffect(() => {
    libraryLastSavedVersionRef.current = libraryLastSavedVersion
  }, [libraryLastSavedVersion])

  const markIdentityDirty = () => {
    setIdentityDirtyVersion((current) => current + 1)
    setCompanyIdentitySyncStatus((current) => {
      if (current.state === 'local-only' || current.state === 'saving') {
        return current
      }

      return {
        ...current,
        state: 'unsaved',
        message: undefined,
      }
    })
  }

  const markKnowledgeDirty = () => {
    setKnowledgeDirtyVersion((current) => current + 1)
    setCompanyKnowledgeSyncStatus((current) => {
      if (current.state === 'local-only' || current.state === 'saving') {
        return current
      }
      return {
        ...current,
        state: 'unsaved',
        message: undefined,
      }
    })
  }

  const markLibraryDirty = () => {
    setLibraryDirtyVersion((current) => current + 1)
    setCompanyLibrarySyncStatus((current) => {
      if (current.state === 'local-only' || current.state === 'saving') {
        return current
      }
      return {
        ...current,
        state: 'unsaved',
        message: undefined,
      }
    })
  }

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

  const replaceWorkspace: WorkspaceContextValue['replaceWorkspace'] = (nextWorkspace) => {
    const normalizedWorkspace = normalizeWorkspaceState(nextWorkspace)

    commitWorkspace(() => normalizedWorkspace)
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

    void (async () => {
      for (let index = 0; index < entries.length; index++) {
        const file = entries[index]
        const seedAsset = nextAssets[index]

        if (!file || !seedAsset) {
          continue
        }

        const finalized = await finalizeLocalFileAssetIngest(seedAsset, file)

        setWorkspace((current) => ({
          ...current,
          fileAssets: current.fileAssets.map((candidate) =>
            candidate.id === finalized.id
              ? { ...candidate, ...finalized, storage: candidate.storage }
              : candidate,
          ),
        }))
      }
    })()

    if (shouldAttemptWorkspaceStorageUpload({ supabaseClient: supabase, userId: user?.id, isLocalDevBypass }) && supabase && user) {
      const authUserId = user.id

      void (async () => {
        for (let index = 0; index < entries.length; index++) {
          const file = entries[index]
          const asset = nextAssets[index]

          if (!file || !asset) {
            continue
          }

          const objectPath = buildWorkspaceStoragePath({
            userId: authUserId,
            deckId,
            assetId: asset.id,
            fileName: file.name,
          })

          const result = await uploadWorkspaceAsset({
            supabase,
            bucket: WORKSPACE_STORAGE_BUCKETS.sourceFiles,
            objectPath,
            file,
            contentType: file.type || undefined,
          })

          if (result.error) {
            showToast(
              `Could not save "${file.name}" to cloud storage. It remains available locally only.`,
              'info',
            )
            continue
          }

          setWorkspace((current) => ({
            ...current,
            fileAssets: current.fileAssets.map((candidate) =>
              candidate.id === asset.id
                ? {
                    ...candidate,
                    storage: { bucket: result.bucket, objectPath: result.objectPath },
                  }
                : candidate,
            ),
          }))
        }
      })()
    }
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

  const setFileAssetSourceReviewStatus: WorkspaceContextValue['setFileAssetSourceReviewStatus'] = (
    assetId,
    status,
  ) => {
    setWorkspace((current) => ({
      ...current,
      fileAssets: current.fileAssets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              sourceReview: {
                ...asset.sourceReview,
                status,
              },
            }
          : asset,
      ),
    }))
  }

  const setFileAssetSnippetEnabled: WorkspaceContextValue['setFileAssetSnippetEnabled'] = (
    assetId,
    snippetKey,
    enabled,
  ) => {
    setWorkspace((current) => ({
      ...current,
      fileAssets: current.fileAssets.map((asset) => {
        if (asset.id !== assetId) {
          return asset
        }
        const review = asset.sourceReview ?? {}
        const snippets = review.snippetReviews ?? {}
        const currentSnippet = snippets[snippetKey] ?? {}
        return {
          ...asset,
          sourceReview: {
            ...review,
            snippetReviews: {
              ...snippets,
              [snippetKey]: {
                ...currentSnippet,
                enabled,
              },
            },
          },
        }
      }),
    }))
  }

  const setFileAssetSnippetLabelOverride: WorkspaceContextValue['setFileAssetSnippetLabelOverride'] = (
    assetId,
    snippetKey,
    labelOverride,
  ) => {
    setWorkspace((current) => ({
      ...current,
      fileAssets: current.fileAssets.map((asset) => {
        if (asset.id !== assetId) {
          return asset
        }
        const review = asset.sourceReview ?? {}
        const snippets = review.snippetReviews ?? {}
        const currentSnippet = snippets[snippetKey] ?? {}
        return {
          ...asset,
          sourceReview: {
            ...review,
            snippetReviews: {
              ...snippets,
              [snippetKey]: {
                ...currentSnippet,
                labelOverride: labelOverride.trim(),
              },
            },
          },
        }
      }),
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

    const sourceFiles = filterAssetsForCitationUse(
      workspace.fileAssets.filter((asset) => asset.deckId === deckId),
      resolveCitationReviewMode(sourceDeck.setup),
    )
    const previousDeck = workspace.decks
      .filter((candidate) => candidate.projectId === sourceDeck.projectId && candidate.id !== deckId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    const brand = resolveBrandGenerationContext(sourceDeck.setup, workspace.companyBrain, sourceFiles)
    const selectedBrainIds = sourceDeck.setup.selectedCompanyKnowledgeItemIds ?? []
    const knowledgeById = new Map(workspace.companyBrain.knowledgeItems.map((item) => [item.id, item]))
    const selectedBrainItems = selectedBrainIds
      .map((id) => knowledgeById.get(id))
      .filter((item): item is CompanyKnowledgeItem => Boolean(item))
    const result = await runMockDeckGenerationPipeline({
      sourceDeck,
      sourceFiles,
      previousDeck,
      brand,
      companyKnowledgeItems:
        selectedBrainItems.length > 0 ? selectedBrainItems : undefined,
      workspaceFileAssets: workspace.fileAssets,
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
      const sourceFiles = filterAssetsForCitationUse(
        current.fileAssets.filter((asset) => asset.deckId === deckId && asset.kind !== 'report'),
        resolveCitationReviewMode(deck.setup),
      )
      const intelBriefBrandKit = resolveBrandKitForDeckSetup(deck.setup, current.companyBrain)

      const selectedBrainReportIds = deck.setup.selectedCompanyKnowledgeItemIds ?? []
      const mergedAssetLookup = mergeAssetsForKnowledgeTraceLookup(sourceFiles, current.fileAssets)

      const companyBrainSources: DeckReportCompanyBrainEntry[] | undefined =
        selectedBrainReportIds.length > 0
          ? (() => {
              const organizationId =
                current.companyBrain.activeOrganizationId ||
                current.companyBrain.organizations[0]?.id ||
                ''

              const fallbackRows = () =>
                buildDeckReportCompanyBrainEntriesFromItems(
                  selectedBrainReportIds
                    .map((id) => current.companyBrain.knowledgeItems.find((item) => item.id === id))
                    .filter((item): item is CompanyKnowledgeItem => Boolean(item)),
                  mergedAssetLookup,
                )

              if (!organizationId || !user) {
                return fallbackRows()
              }

              const profileSnapshot = workspaceUserProfileFromAuth(user ?? null, isLocalDevBypass)
              const membership = getMembershipForOrgUser(current, organizationId, profileSnapshot.userId)
              const catalogRoleNames = current.companyBrain.companyRoles
                .filter((role) => !role.archived && role.organizationId === organizationId)
                .map((role) => role.name)
              const catalogDepartmentNames = current.companyBrain.companyDepartments
                .filter((department) => !department.archived && department.organizationId === organizationId)
                .map((department) => department.name)

              const ranked = getRelevantCompanyKnowledgeForUserWithExplanations({
                organizationId,
                userRoleTitle: membership?.roleTitle ?? '',
                department: membership?.department ?? '',
                accessRole: membership?.accessRole ?? 'viewer',
                currentUserId: profileSnapshot.userId,
                deckSetup: deck.setup,
                knowledgeItems: current.companyBrain.knowledgeItems,
                companyCatalogRoleNames: catalogRoleNames.length ? catalogRoleNames : undefined,
                companyCatalogDepartmentNames: catalogDepartmentNames.length
                  ? catalogDepartmentNames
                  : undefined,
              })

              const rankedSelected = filterRankedKnowledgeBySelection(ranked, selectedBrainReportIds)

              if (rankedSelected.length > 0) {
                return buildDeckReportCompanyBrainEntries(rankedSelected, mergedAssetLookup)
              }

              return fallbackRows()
            })()
          : undefined

      const report = generateDeckReport({
        deck,
        slides: deckSlides,
        fileAssets: sourceFiles,
        reportType,
        intelBriefBrandKit,
        ...(companyBrainSources !== undefined ? { companyBrainSources } : {}),
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
        summary: `Printable ${reportType} Intel Brief generated from ${deckSlides.length} slide${deckSlides.length === 1 ? '' : 's'}.`,
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
            label: 'Intel Brief generated',
            summary: `Generated ${reportType} printable Intel Brief asset ${fileName}.`,
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

  const reopenComment: WorkspaceContextValue['reopenComment'] = (commentId) => {
    setWorkspace((current) => ({
      ...current,
      comments: current.comments.map((thread) =>
        thread.id === commentId
          ? {
              ...thread,
              resolved: false,
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

  const addSlideWithLayout: WorkspaceContextValue['addSlideWithLayout'] = (
    deckId,
    afterSlideId,
    preset,
  ) => {
    const currentDeckSlides = getOrderedDeckSlides(workspaceRef.current.slides, deckId)
    const afterIndex = currentDeckSlides.findIndex((slide) => slide.id === afterSlideId)
    const insertIndex = afterIndex >= 0 ? afterIndex + 1 : currentDeckSlides.length
    const nextSlide = createSlideFromLayoutPreset(deckId, insertIndex + 1, preset)

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
    const targetSlide = workspaceRef.current.slides.find((slide) => slide.id === slideId)
    const lockedBlockIds = new Set(
      targetSlide?.blocks
        .filter((block, index) => normalizeBlockLayout(block, index).locked)
        .map((block) => block.id) ?? [],
    )
    const deletedBlockIds = new Set(blockIds.filter((blockId) => !lockedBlockIds.has(blockId)))

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
      blocks: slide.blocks.map((block, index) =>
        block.id === blockId && !normalizeBlockLayout(block, index).locked
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
      blocks: slide.blocks.map((block, index) =>
        block.id === blockId && !normalizeBlockLayout(block, index).locked
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
      blocks: slide.blocks.map((block, index) => {
        if (block.id !== blockId || normalizeBlockLayout(block, index).locked) {
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
      blocks: slide.blocks.map((block, index) =>
        block.id === blockId && !normalizeBlockLayout(block, index).locked
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
      blocks: slide.blocks.map((block, index) =>
        block.id === blockId && !normalizeBlockLayout(block, index).locked
          ? {
              ...block,
              content: imageAsset.name,
              imageAsset,
            }
          : block,
      ),
    }))
  }

  const resetSlideBlockImage: WorkspaceContextValue['resetSlideBlockImage'] = (slideId, blockId) => {
    updateSlides(slideId, (slide) => ({
      ...slide,
      blocks: slide.blocks.map((block, index) =>
        block.id === blockId && !normalizeBlockLayout(block, index).locked
          ? {
              ...block,
              content: 'Image placeholder',
              imageAsset: undefined,
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
      blocks: slide.blocks.map((block, index) => {
        const update = updatesByBlockId.get(block.id)

        if (!update) {
          return block
        }

        const currentLayout = normalizeBlockLayout(block, index)

        if (currentLayout.locked && !Object.hasOwn(update, 'locked')) {
          return block
        }

        return {
          ...block,
          layout: clampBlockLayout({
            ...currentLayout,
            ...update,
          }),
        }
      }),
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
      if (isBlockLocked(slide, blockId)) {
        return slide
      }

      const orderedBlocks = slide.blocks
        .map((block, index) => ({
          block,
          layout: normalizeBlockLayout(block, index),
        }))
        .sort((left, right) => left.layout.zIndex - right.layout.zIndex)
      const currentIndex = orderedBlocks.findIndex((item) => item.block.id === blockId)

      if (currentIndex < 0) {
        return slide
      }

      const nextOrderedBlocks = [...orderedBlocks]
      const [current] = nextOrderedBlocks.splice(currentIndex, 1)

      if (direction === 'front') {
        nextOrderedBlocks.push(current)
      } else if (direction === 'back') {
        nextOrderedBlocks.unshift(current)
      } else {
        const nextIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1

        if (nextIndex < 0 || nextIndex > nextOrderedBlocks.length) {
          return slide
        }

        nextOrderedBlocks.splice(nextIndex, 0, current)
      }

      const nextZIndexByBlockId = new Map(
        nextOrderedBlocks.map((item, index) => [item.block.id, index + 1]),
      )

      return {
        ...slide,
        blocks: slide.blocks.map((block, index) => ({
          ...normalizeSlideBlock(block, index),
          layout: {
            ...normalizeBlockLayout(block, index),
            zIndex: nextZIndexByBlockId.get(block.id) ?? index + 1,
          },
        })),
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
      const brand = resolveBrandGenerationContext(deck.setup, current.companyBrain, deckAssets)
      const nextSlides = createAlternateSlides(
        deck,
        currentSlides.length > 0 ? currentSlides : createSlidesFromDeck(deck, deckAssets, brand),
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

  const resolveActorProfile = () => workspaceUserProfileFromAuth(user ?? null, isLocalDevBypass)

  const canUseIdentityCloud = Boolean(supabase && user)
  const canUseKnowledgeCloud = Boolean(
    supabase && user && workspace.companyBrain.activeOrganizationId,
  )
  const canUseLibraryCloud = canUseKnowledgeCloud

  const clearIdentityAutosaveTimer = () => {
    if (identityAutosaveTimerRef.current !== null) {
      window.clearTimeout(identityAutosaveTimerRef.current)
      identityAutosaveTimerRef.current = null
    }
  }

  const clearKnowledgeAutosaveTimer = () => {
    if (knowledgeAutosaveTimerRef.current !== null) {
      window.clearTimeout(knowledgeAutosaveTimerRef.current)
      knowledgeAutosaveTimerRef.current = null
    }
  }

  const clearLibraryAutosaveTimer = () => {
    if (libraryAutosaveTimerRef.current !== null) {
      window.clearTimeout(libraryAutosaveTimerRef.current)
      libraryAutosaveTimerRef.current = null
    }
  }

  const saveIdentityNow = useCallback(
    async (source: 'manual' | 'autosave'): Promise<boolean> => {
      if (!supabase || !user) {
        setCompanyIdentitySyncStatus({
          state: 'local-only',
          message: 'Cloud sync unavailable. Working in local mode.',
        })
        if (source === 'manual') {
          showToast('Supabase is unavailable. Kept local workspace data only.', 'info')
        }
        return false
      }

      const dirtyAtStart = identityDirtyVersionRef.current
      if (source === 'autosave' && dirtyAtStart <= identityLastSavedVersionRef.current) {
        return true
      }

      setCompanyIdentitySyncStatus((current) => ({
        ...current,
        state: 'saving',
        message: undefined,
      }))
      identityAutosaveInFlightRef.current = source === 'autosave'

      try {
        const brain = workspaceRef.current.companyBrain
        await saveOrganizationIdentity({
          supabase: supabase as unknown as CompanyBrainCloudClient,
          userId: user.id,
          organizations: brain.organizations,
          organizationMemberships: brain.organizationMemberships,
          companyRoles: brain.companyRoles,
          companyDepartments: brain.companyDepartments,
          workerInvites: brain.workerInvites,
        })

        const syncedAt = new Date().toISOString()
        setIdentityLastSavedVersion((current) => Math.max(current, dirtyAtStart))
        setCompanyIdentitySyncStatus({
          state: 'saved',
          lastSyncedAt: syncedAt,
        })
        if (source === 'manual') {
          showToast('Company identity saved to cloud.', 'success')
        }
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cloud save failed.'
        setCompanyIdentitySyncStatus({
          state: 'save-failed',
          message,
        })
        if (source === 'manual') {
          showToast(`Cloud sync failed. ${message}`, 'error')
        }
        return false
      } finally {
        identityAutosaveInFlightRef.current = false
      }
    },
    [showToast, user],
  )

  const saveKnowledgeNow = useCallback(
    async (source: 'manual' | 'autosave'): Promise<boolean> => {
      if (!supabase || !user) {
        setCompanyKnowledgeSyncStatus({
          state: 'local-only',
          message: 'Cloud sync unavailable. Working in local mode.',
        })
        if (source === 'manual') {
          showToast('Supabase is unavailable. Kept local workspace data only.', 'info')
        }
        return false
      }

      const organizationId = workspaceRef.current.companyBrain.activeOrganizationId
      if (!organizationId) {
        setCompanyKnowledgeSyncStatus({
          state: 'save-failed',
          message: 'No active organization selected.',
        })
        return false
      }

      const dirtyAtStart = knowledgeDirtyVersionRef.current
      if (source === 'autosave' && dirtyAtStart <= knowledgeLastSavedVersionRef.current) {
        return true
      }

      setCompanyKnowledgeSyncStatus((current) => ({
        ...current,
        state: 'saving',
        message: undefined,
      }))
      knowledgeAutosaveInFlightRef.current = source === 'autosave'

      try {
        const brain = workspaceRef.current.companyBrain
        await saveCompanyKnowledge({
          supabase: supabase as unknown as CompanyKnowledgeCloudClient,
          organizationId,
          knowledgeFolders: brain.knowledgeFolders,
          knowledgeItems: brain.knowledgeItems,
        })

        const syncedAt = new Date().toISOString()
        setKnowledgeLastSavedVersion((current) => Math.max(current, dirtyAtStart))
        setCompanyKnowledgeSyncStatus({
          state: 'saved',
          lastSyncedAt: syncedAt,
        })
        if (source === 'manual') {
          showToast('Knowledge library saved to cloud.', 'success')
        }
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cloud save failed.'
        setCompanyKnowledgeSyncStatus({
          state: 'save-failed',
          message,
        })
        if (source === 'manual') {
          showToast(`Cloud sync failed. ${message}`, 'error')
        }
        return false
      } finally {
        knowledgeAutosaveInFlightRef.current = false
      }
    },
    [showToast, user],
  )

  const saveLibrariesNow = useCallback(
    async (source: 'manual' | 'autosave'): Promise<boolean> => {
      if (!supabase || !user) {
        setCompanyLibrarySyncStatus({
          state: 'local-only',
          message: 'Cloud sync unavailable. Working in local mode.',
        })
        if (source === 'manual') {
          showToast('Supabase is unavailable. Kept local workspace data only.', 'info')
        }
        return false
      }

      const organizationId = workspaceRef.current.companyBrain.activeOrganizationId
      if (!organizationId) {
        setCompanyLibrarySyncStatus({
          state: 'save-failed',
          message: 'No active organization selected.',
        })
        return false
      }

      const dirtyAtStart = libraryDirtyVersionRef.current
      if (source === 'autosave' && dirtyAtStart <= libraryLastSavedVersionRef.current) {
        return true
      }

      setCompanyLibrarySyncStatus((current) => ({
        ...current,
        state: 'saving',
        message: undefined,
      }))
      libraryAutosaveInFlightRef.current = source === 'autosave'

      try {
        const brain = workspaceRef.current.companyBrain
        await saveCompanyLibraries({
          supabase: supabase as unknown as CompanyLibraryCloudClient,
          organizationId,
          brandKits: brain.brandKits,
          approvedMessaging: brain.approvedMessaging,
          caseStudies: brain.caseStudies,
          productsServices: brain.productsServices,
        })

        const syncedAt = new Date().toISOString()
        setLibraryLastSavedVersion((current) => Math.max(current, dirtyAtStart))
        setCompanyLibrarySyncStatus({
          state: 'saved',
          lastSyncedAt: syncedAt,
        })
        if (source === 'manual') {
          showToast('Company libraries saved to cloud.', 'success')
        }
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cloud save failed.'
        setCompanyLibrarySyncStatus({
          state: 'save-failed',
          message,
        })
        if (source === 'manual') {
          showToast(`Cloud sync failed. ${message}`, 'error')
        }
        return false
      } finally {
        libraryAutosaveInFlightRef.current = false
      }
    },
    [showToast, user],
  )

  const saveCompanyIdentityToCloud: WorkspaceContextValue['saveCompanyIdentityToCloud'] = async () => {
    clearIdentityAutosaveTimer()
    return saveIdentityNow('manual')
  }

  const loadCompanyIdentityFromCloud: WorkspaceContextValue['loadCompanyIdentityFromCloud'] = async () => {
    if (!supabase || !user) {
      setCompanyIdentitySyncStatus({
        state: 'local-only',
        message: 'Cloud load unavailable. Working in local mode.',
      })
      showToast('Supabase is unavailable. Kept local workspace data only.', 'info')
      return false
    }
    try {
      const cloud = await loadOrganizationIdentity({
        supabase: supabase as unknown as CompanyBrainCloudClient,
        userId: user.id,
      })
      const local = workspaceRef.current.companyBrain
      const hasLocalIdentity = local.organizations.length > 0
      const hasCloudIdentity = cloud.organizations.length > 0

      if (hasLocalIdentity && hasCloudIdentity) {
        const answer = window.prompt(
          'Both local and cloud identity data exist. Type: local | cloud | save',
          'cloud',
        )
        if (answer === 'local') {
          setCompanyIdentitySyncStatus({
            state: 'saved',
            message: 'Kept local identity data.',
          })
          showToast('Kept local identity data.', 'info')
          return false
        }
        if (answer === 'save') {
          return saveCompanyIdentityToCloud()
        }
      }

      if (!hasCloudIdentity) {
        setCompanyIdentitySyncStatus({
          state: 'saved',
          message: 'No cloud identity rows found.',
        })
        showToast('No cloud identity data found for this user.', 'info')
        return false
      }

      commitWorkspace((current) => ({
        ...current,
        companyBrain: {
          ...current.companyBrain,
          organizations: cloud.organizations,
          organizationMemberships: cloud.organizationMemberships,
          companyRoles: cloud.companyRoles,
          companyDepartments: cloud.companyDepartments,
          workerInvites: cloud.workerInvites,
          activeOrganizationId:
            current.companyBrain.activeOrganizationId ||
            cloud.organizations[0]?.id ||
            '',
        },
      }))

      const nextDirtyVersion = identityDirtyVersionRef.current
      suppressIdentityAutosaveUntilVersionRef.current = nextDirtyVersion
      setIdentityLastSavedVersion(nextDirtyVersion)

      setCompanyIdentitySyncStatus({
        state: 'saved',
        lastSyncedAt: new Date().toISOString(),
        message: 'Loaded identity data from cloud.',
      })
      showToast('Loaded company identity from cloud.', 'success')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloud load failed.'
      setCompanyIdentitySyncStatus({
        state: 'save-failed',
        message,
      })
      showToast(`Cloud load failed. ${message}`, 'error')
      return false
    }
  }

  const saveCompanyKnowledgeToCloud: WorkspaceContextValue['saveCompanyKnowledgeToCloud'] = async () => {
    clearKnowledgeAutosaveTimer()
    return saveKnowledgeNow('manual')
  }

  const saveCompanyLibrariesToCloud: WorkspaceContextValue['saveCompanyLibrariesToCloud'] = async () => {
    clearLibraryAutosaveTimer()
    return saveLibrariesNow('manual')
  }

  const loadCompanyLibrariesFromCloud: WorkspaceContextValue['loadCompanyLibrariesFromCloud'] = async () => {
    if (!supabase || !user) {
      setCompanyLibrarySyncStatus({
        state: 'local-only',
        message: 'Cloud load unavailable. Working in local mode.',
      })
      showToast('Supabase is unavailable. Kept local workspace data only.', 'info')
      return false
    }
    const organizationId = workspaceRef.current.companyBrain.activeOrganizationId
    if (!organizationId) {
      setCompanyLibrarySyncStatus({
        state: 'save-failed',
        message: 'No active organization selected.',
      })
      return false
    }

    try {
      const cloud = await loadCompanyLibraries({
        supabase: supabase as unknown as CompanyLibraryCloudClient,
        organizationId,
      })
      const brain = workspaceRef.current.companyBrain

      const countLocalLibs = (slice: typeof brain) =>
        slice.brandKits.filter((b) => b.organizationId === organizationId).length +
        slice.approvedMessaging.filter((m) => m.organizationId === organizationId).length +
        slice.caseStudies.filter((c) => c.organizationId === organizationId).length +
        slice.productsServices.filter((p) => p.organizationId === organizationId).length

      const countCloudLibs = cloud.brandKits.length +
        cloud.approvedMessaging.length +
        cloud.caseStudies.length +
        cloud.productsServices.length

      const hasLocalLibraries = countLocalLibs(brain) > 0
      const hasCloudLibraries = countCloudLibs > 0

      if (hasLocalLibraries && hasCloudLibraries) {
        const answer = window.prompt(
          'Both local and cloud company libraries exist. Type: local | cloud | save',
          'cloud',
        )
        if (answer === 'local') {
          setCompanyLibrarySyncStatus({ state: 'saved', message: 'Kept local company libraries.' })
          showToast('Kept local company libraries.', 'info')
          return false
        }
        if (answer === 'save') {
          return saveCompanyLibrariesToCloud()
        }
      }

      if (!hasCloudLibraries) {
        setCompanyLibrarySyncStatus({ state: 'saved', message: 'No cloud library rows found.' })
        showToast('No cloud company libraries found for this organization.', 'info')
        return false
      }

      commitWorkspace((current) => ({
        ...current,
        companyBrain: {
          ...current.companyBrain,
          brandKits: [
            ...current.companyBrain.brandKits.filter((b) => b.organizationId !== organizationId),
            ...cloud.brandKits,
          ],
          approvedMessaging: [
            ...current.companyBrain.approvedMessaging.filter((m) => m.organizationId !== organizationId),
            ...cloud.approvedMessaging,
          ],
          caseStudies: [
            ...current.companyBrain.caseStudies.filter((c) => c.organizationId !== organizationId),
            ...cloud.caseStudies,
          ],
          productsServices: [
            ...current.companyBrain.productsServices.filter((p) => p.organizationId !== organizationId),
            ...cloud.productsServices,
          ],
        },
      }))

      const syncedAt = new Date().toISOString()
      const nextDirtyVersion = libraryDirtyVersionRef.current
      suppressLibraryAutosaveUntilVersionRef.current = nextDirtyVersion
      setLibraryLastSavedVersion(nextDirtyVersion)

      setCompanyLibrarySyncStatus({
        state: 'saved',
        lastSyncedAt: syncedAt,
        message: 'Loaded company libraries from cloud.',
      })
      showToast('Loaded company libraries from cloud.', 'success')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloud load failed.'
      setCompanyLibrarySyncStatus({
        state: 'save-failed',
        message,
      })
      showToast(`Cloud load failed. ${message}`, 'error')
      return false
    }
  }

  const loadCompanyKnowledgeFromCloud: WorkspaceContextValue['loadCompanyKnowledgeFromCloud'] = async () => {
    if (!supabase || !user) {
      setCompanyKnowledgeSyncStatus({
        state: 'local-only',
        message: 'Cloud load unavailable. Working in local mode.',
      })
      showToast('Supabase is unavailable. Kept local workspace data only.', 'info')
      return false
    }
    const organizationId = workspaceRef.current.companyBrain.activeOrganizationId
    if (!organizationId) {
      setCompanyKnowledgeSyncStatus({
        state: 'save-failed',
        message: 'No active organization selected.',
      })
      return false
    }
    try {
      const cloud = await loadCompanyKnowledge({
        supabase: supabase as unknown as CompanyKnowledgeCloudClient,
        organizationId,
      })
      const brain = workspaceRef.current.companyBrain
      const localFolders = brain.knowledgeFolders.filter((row) => row.organizationId === organizationId)
      const localItems = brain.knowledgeItems.filter((row) => row.organizationId === organizationId)
      const hasLocalKnowledge = localFolders.length > 0 || localItems.length > 0
      const hasCloudKnowledge = cloud.knowledgeFolders.length > 0 || cloud.knowledgeItems.length > 0

      if (hasLocalKnowledge && hasCloudKnowledge) {
        const answer = window.prompt('Both local and cloud knowledge data exist. Type: local | cloud | save', 'cloud')
        if (answer === 'local') {
          setCompanyKnowledgeSyncStatus({ state: 'saved', message: 'Kept local knowledge data.' })
          showToast('Kept local knowledge data.', 'info')
          return false
        }
        if (answer === 'save') {
          return saveCompanyKnowledgeToCloud()
        }
      }

      if (!hasCloudKnowledge) {
        setCompanyKnowledgeSyncStatus({ state: 'saved', message: 'No cloud knowledge rows found.' })
        showToast('No cloud knowledge data found for this organization.', 'info')
        return false
      }

      commitWorkspace((current) => ({
        ...current,
        companyBrain: {
          ...current.companyBrain,
          knowledgeFolders: [
            ...current.companyBrain.knowledgeFolders.filter((row) => row.organizationId !== organizationId),
            ...cloud.knowledgeFolders,
          ],
          knowledgeItems: [
            ...current.companyBrain.knowledgeItems.filter((row) => row.organizationId !== organizationId),
            ...cloud.knowledgeItems,
          ],
        },
      }))
      const syncedAt = new Date().toISOString()
      const nextDirtyVersion = knowledgeDirtyVersionRef.current
      suppressKnowledgeAutosaveUntilVersionRef.current = nextDirtyVersion
      setKnowledgeLastSavedVersion(nextDirtyVersion)
      setCompanyKnowledgeSyncStatus({
        state: 'saved',
        lastSyncedAt: syncedAt,
        message: 'Loaded knowledge library from cloud.',
      })
      showToast('Loaded knowledge library from cloud.', 'success')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloud load failed.'
      setCompanyKnowledgeSyncStatus({
        state: 'save-failed',
        message,
      })
      showToast(`Cloud load failed. ${message}`, 'error')
      return false
    }
  }

  useEffect(() => {
    if (!canUseIdentityCloud) {
      clearIdentityAutosaveTimer()
      return
    }

    const hasUnsavedIdentity = identityDirtyVersion > identityLastSavedVersion
    const suppressed = identityDirtyVersion <= suppressIdentityAutosaveUntilVersionRef.current

    if (!hasUnsavedIdentity || suppressed) {
      clearIdentityAutosaveTimer()
      return
    }

    clearIdentityAutosaveTimer()
    identityAutosaveTimerRef.current = window.setTimeout(() => {
      identityAutosaveTimerRef.current = null
      if (identityAutosaveInFlightRef.current) {
        identityAutosaveQueuedRef.current = true
        return
      }
      void saveIdentityNow('autosave').then(() => {
        if (identityAutosaveQueuedRef.current) {
          identityAutosaveQueuedRef.current = false
          void saveIdentityNow('autosave')
        }
      })
    }, IDENTITY_AUTOSAVE_DEBOUNCE_MS)

    return () => {
      clearIdentityAutosaveTimer()
    }
  }, [canUseIdentityCloud, identityDirtyVersion, identityLastSavedVersion, saveIdentityNow])

  useEffect(() => {
    if (!canUseKnowledgeCloud) {
      clearKnowledgeAutosaveTimer()
      return
    }

    const hasUnsavedKnowledge = knowledgeDirtyVersion > knowledgeLastSavedVersion
    const suppressed =
      knowledgeDirtyVersion <= suppressKnowledgeAutosaveUntilVersionRef.current

    if (!hasUnsavedKnowledge || suppressed) {
      clearKnowledgeAutosaveTimer()
      return
    }

    clearKnowledgeAutosaveTimer()
    knowledgeAutosaveTimerRef.current = window.setTimeout(() => {
      knowledgeAutosaveTimerRef.current = null
      if (knowledgeAutosaveInFlightRef.current) {
        knowledgeAutosaveQueuedRef.current = true
        return
      }
      void saveKnowledgeNow('autosave').then(() => {
        if (knowledgeAutosaveQueuedRef.current) {
          knowledgeAutosaveQueuedRef.current = false
          void saveKnowledgeNow('autosave')
        }
      })
    }, KNOWLEDGE_AUTOSAVE_DEBOUNCE_MS)

    return () => {
      clearKnowledgeAutosaveTimer()
    }
  }, [canUseKnowledgeCloud, knowledgeDirtyVersion, knowledgeLastSavedVersion, saveKnowledgeNow])

  useEffect(() => {
    if (!canUseLibraryCloud) {
      clearLibraryAutosaveTimer()
      return
    }

    const hasUnsavedLibraries = libraryDirtyVersion > libraryLastSavedVersion
    const suppressed =
      libraryDirtyVersion <= suppressLibraryAutosaveUntilVersionRef.current

    if (!hasUnsavedLibraries || suppressed) {
      clearLibraryAutosaveTimer()
      return
    }

    clearLibraryAutosaveTimer()
    libraryAutosaveTimerRef.current = window.setTimeout(() => {
      libraryAutosaveTimerRef.current = null
      if (libraryAutosaveInFlightRef.current) {
        libraryAutosaveQueuedRef.current = true
        return
      }
      void saveLibrariesNow('autosave').then(() => {
        if (libraryAutosaveQueuedRef.current) {
          libraryAutosaveQueuedRef.current = false
          void saveLibrariesNow('autosave')
        }
      })
    }, KNOWLEDGE_AUTOSAVE_DEBOUNCE_MS)

    return () => {
      clearLibraryAutosaveTimer()
    }
  }, [canUseLibraryCloud, libraryDirtyVersion, libraryLastSavedVersion, saveLibrariesNow])

  const dismissCompanyOnboarding: WorkspaceContextValue['dismissCompanyOnboarding'] = () => {
    commitWorkspace((current) => applyDismissCompanyOnboarding(current))
  }

  const setCompanyActiveOrganization: WorkspaceContextValue['setCompanyActiveOrganization'] = (
    organizationId,
  ) => {
    commitWorkspace((current) => setActiveOrganization(current, organizationId))
  }

  const completeCompanyBrainOnboarding: WorkspaceContextValue['completeCompanyBrainOnboarding'] = (
    input,
  ) => {
    commitWorkspace((current) => completeCompanyOnboarding(current, input, resolveActorProfile()))
    markIdentityDirty()
  }

  const upsertCompanyKnowledgeFolder: WorkspaceContextValue['upsertCompanyKnowledgeFolder'] = (
    organizationId,
    folder,
  ) => {
    commitWorkspace((current) => upsertKnowledgeFolder(current, organizationId, folder))
    markKnowledgeDirty()
  }

  const upsertCompanyKnowledgeItemMutation: WorkspaceContextValue['upsertCompanyKnowledgeItem'] = (
    organizationId,
    input,
  ) => {
    commitWorkspace((current) =>
      upsertCompanyKnowledgeItem(current, organizationId, resolveActorProfile(), input),
    )
    markKnowledgeDirty()
  }

  const deleteCompanyKnowledgeItemMutation: WorkspaceContextValue['deleteCompanyKnowledgeItem'] = (
    organizationId,
    itemId,
  ) => {
    commitWorkspace((current) => applyDeleteCompanyKnowledgeItem(current, organizationId, itemId))
    markKnowledgeDirty()
  }

  const setCompanyKnowledgeApproval: WorkspaceContextValue['setCompanyKnowledgeApproval'] = (
    organizationId,
    itemId,
    approvalStatus,
    detail,
  ) => {
    commitWorkspace((current) =>
      setKnowledgeApproval(current, organizationId, resolveActorProfile(), itemId, approvalStatus, detail),
    )
    markKnowledgeDirty()
  }

  const markCompanyKnowledgeReviewed: WorkspaceContextValue['markCompanyKnowledgeReviewed'] = (
    organizationId,
    itemId,
  ) => {
    commitWorkspace((current) => markKnowledgeReviewed(current, organizationId, itemId))
    markKnowledgeDirty()
  }

  const upsertCompanyBrandKit: WorkspaceContextValue['upsertCompanyBrandKit'] = (
    organizationId,
    input,
  ) => {
    commitWorkspace((current) => upsertBrandKit(current, organizationId, resolveActorProfile(), input))
    markLibraryDirty()
  }

  const upsertCompanyApprovedMessaging: WorkspaceContextValue['upsertCompanyApprovedMessaging'] = (
    organizationId,
    input,
  ) => {
    commitWorkspace((current) =>
      upsertApprovedMessaging(current, organizationId, resolveActorProfile(), input),
    )
    markLibraryDirty()
  }

  const deleteCompanyApprovedMessaging: WorkspaceContextValue['deleteCompanyApprovedMessaging'] = (
    organizationId,
    messageId,
  ) => {
    commitWorkspace((current) => deleteApprovedMessaging(current, organizationId, messageId))
    markLibraryDirty()
  }

  const upsertCompanyCaseStudy: WorkspaceContextValue['upsertCompanyCaseStudy'] = (
    organizationId,
    input,
  ) => {
    commitWorkspace((current) => upsertCaseStudy(current, organizationId, resolveActorProfile(), input))
    markLibraryDirty()
  }

  const deleteCompanyCaseStudy: WorkspaceContextValue['deleteCompanyCaseStudy'] = (
    organizationId,
    caseStudyId,
  ) => {
    commitWorkspace((current) => deleteCaseStudy(current, organizationId, caseStudyId))
    markLibraryDirty()
  }

  const upsertCompanyProductService: WorkspaceContextValue['upsertCompanyProductService'] = (
    organizationId,
    input,
  ) => {
    commitWorkspace((current) =>
      upsertProductService(current, organizationId, resolveActorProfile(), input),
    )
    markLibraryDirty()
  }

  const deleteCompanyProductService: WorkspaceContextValue['deleteCompanyProductService'] = (
    organizationId,
    productId,
  ) => {
    commitWorkspace((current) => deleteProductService(current, organizationId, productId))
    markLibraryDirty()
  }

  const addCompanyMember: WorkspaceContextValue['addCompanyMember'] = (organizationId, member) => {
    commitWorkspace((current) =>
      addOrganizationMember(current, organizationId, resolveActorProfile(), member),
    )
    markIdentityDirty()
  }

  const acceptWorkerInvite: WorkspaceContextValue['acceptWorkerInvite'] = (invite) => {
    const profile = resolveActorProfile()
    commitWorkspace((current) =>
      acceptWorkerInviteForUser(current, {
        invite,
        userId: profile.userId,
        email: profile.email,
        displayName: profile.displayName,
      }),
    )
    markIdentityDirty()
  }

  const upsertWorkerInviteDraftMutation: WorkspaceContextValue['upsertWorkerInviteDraft'] = (
    organizationId,
    input,
  ) => {
    commitWorkspace((current) =>
      upsertWorkerInviteDraft(current, organizationId, resolveActorProfile(), input),
    )
    markIdentityDirty()
  }

  const markWorkerInviteInvitedMutation: WorkspaceContextValue['markWorkerInviteInvited'] = (
    organizationId,
    inviteId,
  ) => {
    commitWorkspace((current) =>
      markWorkerInviteInvited(current, organizationId, resolveActorProfile(), inviteId),
    )
    markIdentityDirty()
  }

  const revokeWorkerInviteMutation: WorkspaceContextValue['revokeWorkerInvite'] = (organizationId, inviteId) => {
    commitWorkspace((current) => revokeWorkerInvite(current, organizationId, resolveActorProfile(), inviteId))
    markIdentityDirty()
  }

  const deleteWorkerInviteDraftMutation: WorkspaceContextValue['deleteWorkerInviteDraft'] = (
    organizationId,
    inviteId,
  ) => {
    commitWorkspace((current) =>
      deleteWorkerInviteDraft(current, organizationId, resolveActorProfile(), inviteId),
    )
    markIdentityDirty()
  }

  const stageCompanyKnowledgeOrganizationPlan: WorkspaceContextValue['stageCompanyKnowledgeOrganizationPlan'] = (
    organizationId,
    plan,
  ) => {
    commitWorkspace((current) =>
      stageKnowledgeOrganizationPlan(current, organizationId, resolveActorProfile(), plan),
    )
    markKnowledgeDirty()
  }

  const upsertCatalogDepartment: WorkspaceContextValue['upsertCompanyCatalogDepartment'] = (
    organizationId,
    input,
  ) => {
    commitWorkspace((current) =>
      applyUpsertCompanyCatalogDepartment(current, organizationId, input),
    )
    markIdentityDirty()
  }

  const archiveCatalogDepartment: WorkspaceContextValue['archiveCompanyCatalogDepartment'] = (
    organizationId,
    departmentId,
  ) => {
    commitWorkspace((current) =>
      applyArchiveCompanyCatalogDepartment(current, organizationId, departmentId),
    )
    markIdentityDirty()
  }

  const upsertCatalogRole: WorkspaceContextValue['upsertCompanyCatalogRole'] = (organizationId, input) => {
    commitWorkspace((current) => applyUpsertCompanyCatalogRole(current, organizationId, input))
    markIdentityDirty()
  }

  const archiveCatalogRole: WorkspaceContextValue['archiveCompanyCatalogRole'] = (organizationId, roleId) => {
    commitWorkspace((current) => applyArchiveCompanyCatalogRole(current, organizationId, roleId))
    markIdentityDirty()
  }

  const effectiveCompanyIdentitySyncStatus: WorkspaceContextValue['companyIdentitySyncStatus'] =
    canUseIdentityCloud
      ? companyIdentitySyncStatus
      : {
          state: 'local-only',
          message: isSupabaseConfigured
            ? 'Sign in to enable cloud identity sync.'
            : 'Supabase is not configured.',
        }

  const effectiveCompanyKnowledgeSyncStatus: WorkspaceContextValue['companyKnowledgeSyncStatus'] =
    canUseIdentityCloud
      ? knowledgeDirtyVersion > knowledgeLastSavedVersion && companyKnowledgeSyncStatus.state === 'saved'
        ? { state: 'unsaved', message: companyKnowledgeSyncStatus.message }
        : companyKnowledgeSyncStatus
      : {
          state: 'local-only',
          message: isSupabaseConfigured
            ? 'Sign in to enable cloud knowledge sync.'
            : 'Supabase is not configured.',
        }

  const effectiveCompanyLibrarySyncStatus: WorkspaceContextValue['companyLibrarySyncStatus'] =
    canUseIdentityCloud
      ? libraryDirtyVersion > libraryLastSavedVersion && companyLibrarySyncStatus.state === 'saved'
        ? { state: 'unsaved', message: companyLibrarySyncStatus.message }
        : companyLibrarySyncStatus
      : {
          state: 'local-only',
          message: isSupabaseConfigured
            ? 'Sign in to enable cloud library sync.'
            : 'Supabase is not configured.',
        }

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        companyIdentitySyncStatus: effectiveCompanyIdentitySyncStatus,
        companyKnowledgeSyncStatus: effectiveCompanyKnowledgeSyncStatus,
        companyLibrarySyncStatus: effectiveCompanyLibrarySyncStatus,
        replaceWorkspace,
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
        setFileAssetSourceReviewStatus,
        setFileAssetSnippetEnabled,
        setFileAssetSnippetLabelOverride,
        autoFillDeckSetupFromFiles,
        generateSlides,
        generateReport,
        acceptChartSuggestion,
        rejectChartSuggestion,
        addComment,
        resolveComment,
        reopenComment,
        addSlide,
        addSlideWithLayout,
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
        resetSlideBlockImage,
        updateSlideBlockLayout,
        updateSlideBlocksLayout,
        pasteSlideBlock,
        pasteSlideBlocks,
        arrangeSlideBlock,
        updateSlideNotes,
        applyAiEditPlan,
        createAlternateVersion,
        dismissCompanyOnboarding,
        setCompanyActiveOrganization,
        completeCompanyBrainOnboarding,
        upsertCompanyKnowledgeFolder,
        upsertCompanyKnowledgeItem: upsertCompanyKnowledgeItemMutation,
        deleteCompanyKnowledgeItem: deleteCompanyKnowledgeItemMutation,
        setCompanyKnowledgeApproval,
        markCompanyKnowledgeReviewed,
        upsertCompanyBrandKit,
        upsertCompanyApprovedMessaging,
        deleteCompanyApprovedMessaging,
        upsertCompanyCaseStudy,
        deleteCompanyCaseStudy,
        upsertCompanyProductService,
        deleteCompanyProductService,
        addCompanyMember,
        acceptWorkerInvite,
        upsertWorkerInviteDraft: upsertWorkerInviteDraftMutation,
        markWorkerInviteInvited: markWorkerInviteInvitedMutation,
        revokeWorkerInvite: revokeWorkerInviteMutation,
        deleteWorkerInviteDraft: deleteWorkerInviteDraftMutation,
        upsertCompanyCatalogDepartment: upsertCatalogDepartment,
        archiveCompanyCatalogDepartment: archiveCatalogDepartment,
        upsertCompanyCatalogRole: upsertCatalogRole,
        archiveCompanyCatalogRole: archiveCatalogRole,
        stageCompanyKnowledgeOrganizationPlan,
        saveCompanyIdentityToCloud,
        loadCompanyIdentityFromCloud,
        saveCompanyKnowledgeToCloud,
        loadCompanyKnowledgeFromCloud,
        saveCompanyLibrariesToCloud,
        loadCompanyLibrariesFromCloud,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}
