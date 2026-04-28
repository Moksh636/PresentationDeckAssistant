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

export interface SlideImageAsset {
  name: string
  mimeType: string
  sizeBytes: number
  dataUrl: string
  fit?: 'fit' | 'fill'
  altText?: string
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
  sourceTrace: SourceTrace[]
  starred?: boolean
  trashedAt?: string
  report?: GeneratedDeckReport
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

export interface WorkspaceState {
  activeDeckId: string
  projects: Project[]
  decks: Deck[]
  slides: Slide[]
  fileAssets: FileAsset[]
  chartSuggestions: ChartSuggestion[]
  comments: Comment[]
  deckVersions: DeckVersion[]
}
