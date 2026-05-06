import { createContext } from 'react'
import type { AiEditPlan } from '../data/aiEditor'
import type { ManualBlockKind } from '../data/slideLayout'
import type { SlideLayoutPreset } from '../data/slideLayoutPresets'
import type { WorkspaceLibraryItemType } from '../data/workspaceLibrary'
import type {
  CompleteCompanyOnboardingInput,
  UpsertKnowledgeItemInput,
  UpsertWorkerInviteInput,
} from '../data/companyBrainMutations'
import type { CompanyKnowledgeOrganizationPlan } from '../data/companyKnowledgeOrganization'
import type {
  ApprovedMessagingItem,
  CaseStudyItem,
  CompanyBrandKit,
  CompanyBrainCatalogDepartment,
  CompanyBrainCatalogRole,
  KnowledgeApprovalStatus,
  KnowledgeFolder,
  OrganizationMembership,
  ProductServiceItem,
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
  WorkerInvite,
  WorkspaceState,
} from '../types/models'

export interface CollaborationUpdate {
  isShared: boolean
  shareSetupInputs: boolean
  allowCollaboratorUploads: boolean
}

export type CompanyIdentitySyncState = 'local-only' | 'saved' | 'saving' | 'unsaved' | 'save-failed'

export interface CompanyIdentitySyncStatus {
  state: CompanyIdentitySyncState
  lastSyncedAt?: string
  message?: string
}

export interface WorkspaceContextValue {
  workspace: WorkspaceState
  canUndo: boolean
  canRedo: boolean
  companyIdentitySyncStatus: CompanyIdentitySyncStatus
  companyKnowledgeSyncStatus: CompanyIdentitySyncStatus
  companyLibrarySyncStatus: CompanyIdentitySyncStatus
  replaceWorkspace: (workspace: WorkspaceState) => void
  undoWorkspace: () => void
  redoWorkspace: () => void
  setActiveDeck: (deckId: string) => void
  createPresentation: (projectId?: string) => string | undefined
  renameWorkspaceItem: (
    itemType: WorkspaceLibraryItemType,
    itemId: string,
    name: string,
  ) => void
  duplicateWorkspaceItem: (
    itemType: WorkspaceLibraryItemType,
    itemId: string,
  ) => string | undefined
  moveWorkspaceItem: (
    itemType: WorkspaceLibraryItemType,
    itemId: string,
    targetId: string,
  ) => void
  toggleWorkspaceItemStarred: (itemType: WorkspaceLibraryItemType, itemId: string) => void
  trashWorkspaceItem: (itemType: WorkspaceLibraryItemType, itemId: string) => void
  restoreWorkspaceItem: (itemType: WorkspaceLibraryItemType, itemId: string) => void
  deleteWorkspaceItemPermanently: (
    itemType: WorkspaceLibraryItemType,
    itemId: string,
  ) => void
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
  setFileAssetSourceReviewStatus: (
    assetId: string,
    status: 'pending' | 'approved' | 'excluded',
  ) => void
  setFileAssetSnippetEnabled: (assetId: string, snippetKey: string, enabled: boolean) => void
  setFileAssetSnippetLabelOverride: (
    assetId: string,
    snippetKey: string,
    labelOverride: string,
  ) => void
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
  reopenComment: (commentId: string) => void
  addSlide: (deckId: string, afterSlideId?: string) => string | undefined
  addSlideWithLayout: (
    deckId: string,
    afterSlideId: string | undefined,
    preset: SlideLayoutPreset,
  ) => string | undefined
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
  resetSlideBlockImage: (slideId: string, blockId: string) => void
  updateSlideBlockLayout: (slideId: string, blockId: string, layout: Partial<SlideBlockLayout>) => void
  updateSlideBlocksLayout: (
    slideId: string,
    updates: Array<{ blockId: string; layout: Partial<SlideBlockLayout> }>,
  ) => void
  pasteSlideBlock: (slideId: string, block: SlideBlock, offset?: number) => string | undefined
  pasteSlideBlocks: (slideId: string, blocks: SlideBlock[], offset?: number) => string[]
  arrangeSlideBlock: (
    slideId: string,
    blockId: string,
    direction: 'forward' | 'backward' | 'front' | 'back',
  ) => void
  updateSlideNotes: (slideId: string, notes: string) => void
  applyAiEditPlan: (deckId: string, plan: AiEditPlan) => void
  createAlternateVersion: (deckId: string) => void
  dismissCompanyOnboarding: () => void
  setCompanyActiveOrganization: (organizationId: string) => void
  completeCompanyBrainOnboarding: (input: CompleteCompanyOnboardingInput) => void
  upsertCompanyCatalogDepartment: (
    organizationId: string,
    input: Pick<CompanyBrainCatalogDepartment, 'name'> &
      Partial<Pick<CompanyBrainCatalogDepartment, 'description' | 'archived'>> & {
        id?: string
      },
  ) => void
  archiveCompanyCatalogDepartment: (organizationId: string, departmentId: string) => void
  upsertCompanyCatalogRole: (
    organizationId: string,
    input: Pick<CompanyBrainCatalogRole, 'name'> &
      Partial<Pick<CompanyBrainCatalogRole, 'description' | 'defaultDepartmentId' | 'archived'>> & {
        id?: string
      },
  ) => void
  archiveCompanyCatalogRole: (organizationId: string, roleId: string) => void
  upsertCompanyKnowledgeFolder: (
    organizationId: string,
    folder: Pick<KnowledgeFolder, 'name'> &
      Partial<Pick<KnowledgeFolder, 'parentFolderId' | 'description' | 'suggestedByAi' | 'ownerApproved'>> & {
        id?: string
      },
  ) => void
  upsertCompanyKnowledgeItem: (organizationId: string, input: UpsertKnowledgeItemInput) => void
  deleteCompanyKnowledgeItem: (organizationId: string, itemId: string) => void
  setCompanyKnowledgeApproval: (
    organizationId: string,
    itemId: string,
    approvalStatus: KnowledgeApprovalStatus,
    detail?: string,
  ) => void
  markCompanyKnowledgeReviewed: (organizationId: string, itemId: string) => void
  upsertCompanyBrandKit: (
    organizationId: string,
    input: Partial<
      Pick<
        CompanyBrandKit,
        'primaryColor' | 'secondaryColor' | 'accentColor' | 'fontFamily' | 'defaultDeckTone' | 'logoAssetId'
      >
    > & { id?: string },
  ) => void
  upsertCompanyApprovedMessaging: (
    organizationId: string,
    input: Pick<ApprovedMessagingItem, 'title' | 'content' | 'category' | 'tags' | 'approvalStatus'> & {
      id?: string
    },
  ) => void
  deleteCompanyApprovedMessaging: (organizationId: string, messageId: string) => void
  upsertCompanyCaseStudy: (
    organizationId: string,
    input: Omit<CaseStudyItem, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => void
  deleteCompanyCaseStudy: (organizationId: string, caseStudyId: string) => void
  upsertCompanyProductService: (
    organizationId: string,
    input: Omit<ProductServiceItem, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => void
  deleteCompanyProductService: (organizationId: string, productId: string) => void
  addCompanyMember: (
    organizationId: string,
    member: Omit<OrganizationMembership, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'> & {
      id?: string
    },
  ) => void
  acceptWorkerInvite: (invite: WorkerInvite) => void
  upsertWorkerInviteDraft: (organizationId: string, input: UpsertWorkerInviteInput) => void
  markWorkerInviteInvited: (organizationId: string, inviteId: string) => void
  revokeWorkerInvite: (organizationId: string, inviteId: string) => void
  deleteWorkerInviteDraft: (organizationId: string, inviteId: string) => void
  stageCompanyKnowledgeOrganizationPlan: (
    organizationId: string,
    plan: CompanyKnowledgeOrganizationPlan,
  ) => void
  saveCompanyIdentityToCloud: () => Promise<boolean>
  loadCompanyIdentityFromCloud: () => Promise<boolean>
  saveCompanyKnowledgeToCloud: () => Promise<boolean>
  loadCompanyKnowledgeFromCloud: () => Promise<boolean>
  saveCompanyLibrariesToCloud: () => Promise<boolean>
  loadCompanyLibrariesFromCloud: () => Promise<boolean>
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
