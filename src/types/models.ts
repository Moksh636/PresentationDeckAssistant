export type ProjectStatus = 'active' | 'planning'
export type DeckStatus = 'draft' | 'ready' | 'editing'
export type FileAssetKind = 'pdf' | 'doc' | 'sheet' | 'image' | 'report' | 'other'
export type FileAssetStatus = 'uploaded' | 'extracting' | 'parsed'
export type FileContributorRole = 'owner' | 'collaborator'
export type CollaborationAccess = 'comment-only'
export type ChartSuggestionStatus = 'suggested' | 'accepted' | 'rejected'
export type ChartType = 'line' | 'bar' | 'comparison' | 'kpi'
export type ReportType = 'concise' | 'detailed'
export type SlideBlockType =
  | 'eyebrow'
  | 'title'
  | 'body'
  | 'bullet-list'
  | 'stat'
  | 'quote'
  | 'shape'
  | 'visual-placeholder'
  | 'chart-placeholder'
export type SlideAlignment = 'left' | 'center' | 'right'
export type SlideFontSize = 'sm' | 'md' | 'lg' | 'xl'
export type SourceTraceType =
  | 'deck-input'
  | 'uploaded-file'
  | 'generated-summary'
  | 'previous-deck'
  | 'web-research'
export type ExtractedMetadataValue = string | number | boolean
export type ExtractedMetadata = Record<string, ExtractedMetadataValue>

export interface Project {
  id: string
  name: string
  summary: string
  owner: string
  status: ProjectStatus
  deckIds: string[]
  updatedAt: string
  starred?: boolean
  trashedAt?: string
}

/** Optional structured intel attached to deck setup (normalized on load). */
export interface DeckIntel {
  companySummary?: string
  inferredPriorities?: string[]
  painPoints?: string[]
  proofPoints?: string[]
  objections?: string[]
  recommendedPitchAngle?: string
  citations?: SourceTrace[]
}

/** Metadata row for Intel Review / Edge: which Company Brain rows contributed and citation honesty. */
export interface CompanyBrainSourceUsed {
  id: string
  title: string
  sourceType: CompanyKnowledgeSourceType
  approvalStatus: KnowledgeApprovalStatus
  citationBacked: boolean
  citationCount: number
  memoryOnly: boolean
}

export interface DeckSetup {
  goal: string
  audience: string
  tone: string
  presentationType: string
  requiredSections: string[]
  notes: string
  webResearch: boolean
  usePreviousDeckContext: boolean
  shareSetupInputs: boolean
  /** Account / sales workflow (additive; legacy decks omit these). */
  targetCompany?: string
  targetWebsite?: string
  buyerPersona?: string
  offeringSummary?: string
  meetingGoal?: string
  knownPainPoints?: string[]
  desiredCta?: string
  /** Distinct from `presentationType` (deck taxonomy); optional extra classifier. */
  deckType?: string
  intel?: DeckIntel
  brandKitId?: string
  approvedMessagingIds?: string[]
  caseStudyIds?: string[]
  /** Company Brain: knowledge item ids included as context for this pitch (local/mock). */
  selectedCompanyKnowledgeItemIds?: string[]
}

export type SetupFieldKey = keyof DeckSetup

export interface CollaborationSettings {
  isShared: boolean
  access: CollaborationAccess
  allowCollaboratorUploads: boolean
}

export interface Deck {
  id: string
  projectId: string
  title: string
  status: DeckStatus
  updatedAt: string
  slideIds: string[]
  fileAssetIds: string[]
  /** Deck-level screenshot / capture asset ids (placeholders for future flows). */
  screenshotAssetIds?: string[]
  activeVersionId?: string
  starred?: boolean
  trashedAt?: string
  setup: DeckSetup
  collaboration: CollaborationSettings
}

export interface SlideBlockStyle {
  align: SlideAlignment
  fontSize: SlideFontSize
  bold?: boolean
  italic?: boolean
}

export interface SlideTextStyle {
  fontFamily: string
  fontSizePx: number
  bold: boolean
  italic: boolean
  underline: boolean
  alignment: SlideAlignment
  listStyle?: 'none' | 'bullet' | 'number'
  lineHeight?: number
  verticalAlign?: 'top' | 'middle' | 'bottom'
  color?: string
}

export interface SlideBlockVisualStyle {
  fillColor: string
  borderColor: string
  borderWidthPx: number
  opacity: number
}

/** When set, the same file is stored in Supabase Storage (see `src/data/workspaceStorage.ts`). */
export interface WorkspaceAssetStorageRef {
  bucket: string
  objectPath: string
}

export interface SlideImageAsset {
  name: string
  mimeType: string
  sizeBytes: number
  dataUrl: string
  fit?: 'fit' | 'fill'
  altText?: string
  storage?: WorkspaceAssetStorageRef
}

export interface SlideBlockLayout {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  locked?: boolean
}

export interface SlideBlock {
  id: string
  type: SlideBlockType
  content: string | string[]
  placeholder?: string
  style: SlideBlockStyle
  textStyle?: SlideTextStyle
  visualStyle?: SlideBlockVisualStyle
  imageAsset?: SlideImageAsset
  layout?: SlideBlockLayout
  sourceTrace: SourceTrace[]
}

export interface Slide {
  id: string
  deckId: string
  index: number
  title: string
  notes: string
  sourceTrace: SourceTrace[]
  blocks: SlideBlock[]
}

export interface SourceTrace {
  fileId: string
  fileName: string
  sourceType: SourceTraceType
  confidence: number
  extractedSnippet: string
  addedByUserId: string
}

export type SourceReviewStatus = 'pending' | 'approved' | 'excluded'

export interface SourceSnippetReviewState {
  enabled?: boolean
  labelOverride?: string
}

export interface FileAssetSourceReviewState {
  status?: SourceReviewStatus
  snippetReviews?: Record<string, SourceSnippetReviewState>
}

export interface FileAsset {
  id: string
  deckId: string
  name: string
  kind: FileAssetKind
  status: FileAssetStatus
  uploadedByUserId: string
  uploadedByRole: FileContributorRole
  highlightForOwnerReview: boolean
  sizeBytes: number
  sizeLabel: string
  summary: string
  uploadedAt: string
  extractedTextPreview: string
  extractedMetadata: ExtractedMetadata
  possibleAudience: string
  possibleGoal: string
  possibleSections: string[]
  possibleTone: string
  parseWarnings?: string[]
  sourceTrace: SourceTrace[]
  sourceReview?: FileAssetSourceReviewState
  starred?: boolean
  trashedAt?: string
  report?: GeneratedDeckReport
  storage?: WorkspaceAssetStorageRef
}

export interface DeckReportKeyPoint {
  slideId: string
  slideIndex: number
  title: string
  points: string[]
}

export interface DeckReportMetric {
  slideId: string
  slideTitle: string
  label: string
  summary: string
}

export interface DeckReportDecision {
  slideId: string
  slideTitle: string
  summary: string
}

/** Rows for Intel Brief “Company Brain” section (deck setup selections + retrieval ranks when available). */
export interface DeckReportCompanyBrainEntry {
  title: string
  sourceType: CompanyKnowledgeSourceType
  approvalStatus: KnowledgeApprovalStatus
  visibilityLabel: string
  backing: 'citation-backed' | 'memory-only'
  relevanceBand?: 'high' | 'medium' | 'low'
  relevanceScore?: number
}

export interface GeneratedDeckReport {
  id: string
  deckId: string
  title: string
  reportType: ReportType
  generatedAt: string
  executiveSummary: string
  keyPoints: DeckReportKeyPoint[]
  metrics: DeckReportMetric[]
  decisions: DeckReportDecision[]
  sourceReferences: SourceTrace[]
  plainText: string
  /** Company Brain items selected on the pitch setup (citation-backed vs memory-only). */
  companyBrainSources?: DeckReportCompanyBrainEntry[]
  /** When the deck had an applied Brand Kit, Intel Brief preview picks up light chrome colors. */
  intelBriefTheme?: {
    primaryColor: string
    accentColor: string
    secondaryColor: string
    fontFamily: string
  }
}

export interface ChartSuggestion {
  id: string
  deckId: string
  fileId: string
  title: string
  chartType: ChartType
  reason: string
  confidence: number
  dataPreview: string[]
  status: ChartSuggestionStatus
}

export interface CommentMessage {
  id: string
  author: string
  authorUserId: string
  authorRole: FileContributorRole
  message: string
  createdAt: string
}

export interface Comment {
  id: string
  projectId: string
  deckId: string
  slideId?: string
  blockId?: string
  inputFieldKey?: SetupFieldKey
  createdAt: string
  updatedAt: string
  resolved: boolean
  messages: CommentMessage[]
}

export interface DeckVersion {
  id: string
  deckId: string
  label: string
  summary: string
  createdAt: string
  parentVersionId?: string
  sourceDeckId?: string
  slideSnapshot: Slide[]
}

/** Company Brain (shared organizational memory scaffolding; local/mock + future Supabase). */
export type MembershipAccessRole = 'owner' | 'admin' | 'member' | 'viewer'
export type CompanyDepartment = string

/** Job title / IC role definitions managed by admins (distinct from MembershipAccessRole). */
export interface CompanyBrainCatalogRole {
  id: string
  organizationId: string
  name: string
  description?: string
  /** Optional default department catalog id when assigning this role. */
  defaultDepartmentId?: string
  archived?: boolean
  createdAt: string
  updatedAt: string
}

/** Department definitions managed by admins. */
export interface CompanyBrainCatalogDepartment {
  id: string
  organizationId: string
  name: string
  description?: string
  archived?: boolean
  createdAt: string
  updatedAt: string
}
export type KnowledgeApprovalStatus = 'approved' | 'needs-review' | 'rejected' | 'archived'

export interface KnowledgeVisibilityRule {
  scope: KnowledgeVisibilityScope
  allowedDepartments?: CompanyDepartment[]
  allowedRoleTitles?: string[]
}

export type KnowledgeVisibilityScope = 'company' | 'department' | 'role' | 'private'

export type CompanyKnowledgeSourceType =
  | 'contract'
  | 'deck'
  | 'proposal'
  | 'notes'
  | 'case-study'
  | 'product-doc'
  | 'policy'
  | 'transcript'
  | 'other'

export interface KnowledgeTag {
  id: string
  label: string
}

/** How the company wants AI-assisted vs manual knowledge filing to behave (owner onboarding preference). */
export type KnowledgeOrgPreferenceMode = 'auto' | 'manual' | 'hybrid' | 'drive-like'

export interface Organization {
  id: string
  name: string
  slug: string
  /** Company marketing site — captured during owner onboarding when provided. */
  website?: string
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationMembership {
  id: string
  organizationId: string
  userId: string
  email: string
  displayName: string
  roleTitle: string
  department: CompanyDepartment
  accessRole: MembershipAccessRole
  createdAt: string
  updatedAt: string
  /** Pre-assignment scaffold for invites (titles match catalog names when configured). */
  invitedRoleTitle?: string
  invitedDepartment?: string
  roleLocked?: boolean
  departmentLocked?: boolean
}

export interface KnowledgeFolder {
  id: string
  organizationId: string
  name: string
  /** When set, folder renders as a child in the library tree. */
  parentFolderId?: string
  description?: string
  /** Mock AI folder planner — folders proposed by local heuristics, not a remote model. */
  suggestedByAi?: boolean
  /** Owner acknowledged this folder’s placement (paired with `suggestedByAi`). */
  ownerApproved?: boolean
  createdAt: string
  updatedAt: string
}

export interface CompanyKnowledgeItem {
  id: string
  organizationId: string
  folderId?: string
  /** Mock AI suggestion — target folder before owner confirms `folderId`. */
  suggestedFolderId?: string
  /** Owner approved moving this item into `folderId` (clears suggestion friction in UI). */
  ownerApprovedFolder?: boolean
  uploadedByUserId: string
  title: string
  description: string
  fileAssetId?: string
  sourceType: CompanyKnowledgeSourceType
  tags: string[]
  approvalStatus: KnowledgeApprovalStatus
  visibility: KnowledgeVisibilityScope
  allowedDepartments?: string[]
  allowedRoleTitles?: string[]
  createdAt: string
  updatedAt: string
  lastReviewedAt?: string
}

export interface CompanyBrandKit {
  id: string
  organizationId: string
  logoAssetId?: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  defaultDeckTone: string
  createdAt: string
  updatedAt: string
}

export interface ApprovedMessagingItem {
  id: string
  organizationId: string
  title: string
  content: string
  category: string
  tags: string[]
  approvalStatus: KnowledgeApprovalStatus
  createdAt: string
  updatedAt: string
}

export interface CaseStudyItem {
  id: string
  organizationId: string
  title: string
  customerName: string
  industry: string
  challenge: string
  solution: string
  outcome: string
  approvedQuote?: string
  sourceKnowledgeItemIds: string[]
  createdAt: string
  updatedAt: string
}

export interface ProductServiceItem {
  id: string
  organizationId: string
  name: string
  description: string
  targetBuyer: string
  keyBenefits: string[]
  proofPoints: string[]
  commonObjections: string[]
  createdAt: string
  updatedAt: string
}

export type CompanyActivityKind =
  | 'knowledge-item-created'
  | 'knowledge-item-approved'
  | 'knowledge-item-rejected'
  | 'brand-kit-updated'
  | 'approved-messaging-added'
  | 'case-study-added'
  | 'product-service-added'
  | 'member-added'
  | 'worker-invite-created'
  | 'worker-invite-marked-invited'
  | 'worker-invite-revoked'
  | 'worker-invite-updated'
  | 'worker-joined-from-invite'

/** Workspace access granted when a worker accepts an invite (never owner). */
export type WorkerInviteAccessRole = 'admin' | 'member' | 'viewer'

export type WorkerInviteStatus = 'draft' | 'invited' | 'joined' | 'revoked'

export interface WorkerInvite {
  id: string
  organizationId: string
  email: string
  displayName?: string
  invitedRoleTitle?: string
  invitedDepartment?: string
  accessRole: WorkerInviteAccessRole
  roleLocked?: boolean
  departmentLocked?: boolean
  status: WorkerInviteStatus
  createdByUserId: string
  createdAt: string
  updatedAt: string
  joinedUserId?: string
  joinedAt?: string
}

export interface CompanyActivityLog {
  id: string
  organizationId: string
  actorUserId: string
  kind: CompanyActivityKind
  detail: string
  createdAt: string
}

export interface CompanyBrainOnboardingDraft {
  dismissed: boolean
  companyName?: string
  roleTitle?: string
  department?: CompanyDepartment
  setupCompletedAt?: string
  /** Persisted owner wizard preference once onboarding completes. */
  knowledgeOrgPreference?: KnowledgeOrgPreferenceMode
}

export interface CompanyBrainWorkspaceSlice {
  activeOrganizationId: string
  organizations: Organization[]
  organizationMemberships: OrganizationMembership[]
  /** Owner/admin-prepared worker invites (local scaffold; future sync with Supabase). */
  workerInvites: WorkerInvite[]
  /** Company-managed job roles / titles. */
  companyRoles: CompanyBrainCatalogRole[]
  /** Company-managed departments. */
  companyDepartments: CompanyBrainCatalogDepartment[]
  knowledgeFolders: KnowledgeFolder[]
  knowledgeItems: CompanyKnowledgeItem[]
  brandKits: CompanyBrandKit[]
  approvedMessaging: ApprovedMessagingItem[]
  caseStudies: CaseStudyItem[]
  productsServices: ProductServiceItem[]
  activityLogs: CompanyActivityLog[]
  onboarding: CompanyBrainOnboardingDraft
}

export interface WorkspaceState {
  activeDeckId: string
  projects: Project[]
  decks: Deck[]
  slides: Slide[]
  fileAssets: FileAsset[]
  chartSuggestions: ChartSuggestion[]
  comments: Comment[]
  deckVersions: DeckVersion[]
  companyBrain: CompanyBrainWorkspaceSlice
}
