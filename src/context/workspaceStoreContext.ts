import { createContext } from 'react'
import type { AiEditPlan } from '../data/aiEditor'
import type { ManualBlockKind } from '../data/slideLayout'
import type {
  Deck,
  DeckSetup,
  FileContributorRole,
  ReportType,
  SlideBlock,
  SlideBlockLayout,
  SlideBlockStyle,
  SlideBlockVisualStyle,
  SlideImageAsset,
  SlideTextStyle,
  WorkspaceState,
} from '../types/models'

export interface CollaborationUpdate {
  isShared: boolean
  shareSetupInputs: boolean
  allowCollaboratorUploads: boolean
}

export interface WorkspaceContextValue {
  workspace: WorkspaceState
  canUndo: boolean
  canRedo: boolean
  undoWorkspace: () => void
  redoWorkspace: () => void
  setActiveDeck: (deckId: string) => void
  createPresentation: (projectId?: string) => string | undefined
  updateDeck: (deckId: string, updates: Partial<Omit<Deck, 'id' | 'projectId' | 'setup'>>) => void
  updateDeckSetup: (deckId: string, updates: Partial<DeckSetup>) => void
  updateDeckCollaboration: (deckId: string, updates: CollaborationUpdate) => void
  updateProjectCollaboration: (projectId: string, updates: CollaborationUpdate) => void
  uploadAssets: (
    deckId: string,
    files: FileList | File[],
    options?: {
      uploadedByRole?: FileContributorRole
      uploadedByUserId?: string
    },
  ) => void
  markAssetReviewed: (assetId: string) => void
  autoFillDeckSetupFromFiles: (deckId: string) => void
  generateSlides: (deckId: string) => Promise<string | undefined>
  generateReport: (deckId: string, reportType: ReportType) => string | undefined
  acceptChartSuggestion: (suggestionId: string) => void
  rejectChartSuggestion: (suggestionId: string) => void
  addComment: (input: {
    projectId: string
    deckId: string
    slideId?: string
    blockId?: string
    inputFieldKey?: keyof DeckSetup
    message: string
    authorRole: FileContributorRole
  }) => void
  resolveComment: (commentId: string) => void
  addSlide: (deckId: string, afterSlideId?: string) => string | undefined
  deleteSlide: (deckId: string, slideId: string) => string | undefined
  duplicateSlide: (deckId: string, slideId: string) => string | undefined
  reorderSlides: (deckId: string, orderedSlideIds: string[]) => void
  addSlideBlock: (slideId: string, kind: ManualBlockKind, anchorBlockId?: string) => string | undefined
  deleteSlideBlock: (slideId: string, blockId: string) => void
  deleteSlideBlocks: (slideId: string, blockIds: string[]) => void
  duplicateSlideBlock: (slideId: string, blockId: string) => string | undefined
  updateSlideBlockContent: (slideId: string, blockId: string, content: string | string[]) => void
  updateSlideBlockStyle: (slideId: string, blockId: string, style: Partial<SlideBlockStyle>) => void
  updateSlideBlockTextStyle: (slideId: string, blockId: string, style: Partial<SlideTextStyle>) => void
  updateSlideBlockVisualStyle: (
    slideId: string,
    blockId: string,
    style: Partial<SlideBlockVisualStyle>,
  ) => void
  replaceSlideBlockImage: (slideId: string, blockId: string, imageAsset: SlideImageAsset) => void
  updateSlideBlockLayout: (slideId: string, blockId: string, layout: Partial<SlideBlockLayout>) => void
  updateSlideBlocksLayout: (
    slideId: string,
    updates: Array<{ blockId: string; layout: Partial<SlideBlockLayout> }>,
  ) => void
  pasteSlideBlock: (slideId: string, block: SlideBlock, offset?: number) => string | undefined
  pasteSlideBlocks: (slideId: string, blocks: SlideBlock[], offset?: number) => string[]
  arrangeSlideBlock: (slideId: string, blockId: string, direction: 'forward' | 'backward') => void
  updateSlideNotes: (slideId: string, notes: string) => void
  applyAiEditPlan: (deckId: string, plan: AiEditPlan) => void
  createAlternateVersion: (deckId: string) => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
