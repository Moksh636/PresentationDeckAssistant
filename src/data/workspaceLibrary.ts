import { createId } from '../utils/ids.ts'
import type {
  Comment,
  Deck,
  FileAsset,
  Project,
  Slide,
  SlideBlock,
  WorkspaceState,
} from '../types/models'

export type WorkspaceLibraryItemType = 'project' | 'deck' | 'report'
export type WorkspaceLibrarySection =
  | 'my-drive'
  | 'shared'
  | 'recent'
  | 'starred'
  | 'trash'
  | 'projects'
export type WorkspaceSortKey = 'updated-desc' | 'updated-asc' | 'name-asc' | 'name-desc' | 'type-asc'
export type WorkspaceViewMode = 'grid' | 'list'

export interface WorkspaceLibraryItem {
  id: string
  type: WorkspaceLibraryItemType
  projectId?: string
  deckId?: string
  name: string
  description: string
  owner: string
  updatedAt: string
  parentName?: string
  typeLabel: string
  countLabel: string
  statusLabel: string
  isShared: boolean
  isStarred: boolean
  isTrashed: boolean
  trashedAt?: string
  badges: string[]
  metadata: string[]
}

interface WorkspaceItemActionInput {
  itemType: WorkspaceLibraryItemType
  itemId: string
  now: string
}

interface WorkspaceRenameInput extends WorkspaceItemActionInput {
  name: string
}

interface WorkspaceDuplicateInput {
  itemType: WorkspaceLibraryItemType
  itemId: string
  now: string
}

export interface DuplicateDeckInput {
  deckId: string
  now: string
  newDeckId?: string
}

interface WorkspaceMoveInput {
  itemType: WorkspaceLibraryItemType
  itemId: string
  targetId: string
  now: string
}

export interface MoveDeckInput {
  deckId: string
  projectId: string
  now: string
}

interface WorkspaceFilterInput {
  section: WorkspaceLibrarySection
  searchQuery: string
}

const itemTypeOrder: Record<WorkspaceLibraryItemType, number> = {
  project: 0,
  deck: 1,
  report: 2,
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function getFirstRemainingDeckId(decks: Deck[], activeDeckId: string) {
  if (decks.some((deck) => deck.id === activeDeckId)) {
    return activeDeckId
  }

  return decks.find((deck) => !deck.trashedAt)?.id ?? decks[0]?.id ?? ''
}

function getProjectDecks(workspace: WorkspaceState, projectId: string) {
  return workspace.decks.filter((deck) => deck.projectId === projectId)
}

function getDeckReports(workspace: WorkspaceState, deckId: string) {
  return workspace.fileAssets.filter((asset) => asset.deckId === deckId && asset.kind === 'report')
}

function getLatestDeckActivity(workspace: WorkspaceState, project: Project) {
  return getProjectDecks(workspace, project.id)
    .map((deck) => deck.updatedAt)
    .sort((left, right) => right.localeCompare(left))[0]
}

function getProjectSharedState(workspace: WorkspaceState, project: Project) {
  return getProjectDecks(workspace, project.id).some((deck) => deck.collaboration.isShared)
}

function getCommentCount(comments: Comment[], deckId: string) {
  return comments.filter((comment) => comment.deckId === deckId).length
}

function isReportAsset(asset: FileAsset) {
  return asset.kind === 'report'
}

function appendCopySuffix(name: string) {
  return name.endsWith(' copy') ? `${name} 2` : `${name} copy`
}

function cloneBlock(block: SlideBlock) {
  return {
    ...block,
    id: createId(`block-${block.type}`),
    sourceTrace: [...block.sourceTrace],
    layout: block.layout ? { ...block.layout } : undefined,
    textStyle: block.textStyle ? { ...block.textStyle } : undefined,
    visualStyle: block.visualStyle ? { ...block.visualStyle } : undefined,
    imageAsset: block.imageAsset ? { ...block.imageAsset } : undefined,
  }
}

function cloneSlide(slide: Slide, deckId: string, index: number) {
  const nextBlocks = slide.blocks.map((block) => cloneBlock(block))

  return {
    ...slide,
    id: createId('slide'),
    deckId,
    index,
    title: slide.title,
    sourceTrace: [...slide.sourceTrace],
    blocks: nextBlocks,
  }
}

function cloneReportAsset(asset: FileAsset, deckId: string, now: string) {
  const nextAssetId = createId('file-report')

  return {
    ...asset,
    id: nextAssetId,
    deckId,
    name: appendCopySuffix(asset.name),
    uploadedAt: now,
    starred: false,
    trashedAt: undefined,
    sourceTrace: asset.sourceTrace.map((trace) => ({
      ...trace,
      fileId: trace.fileId === asset.id ? nextAssetId : trace.fileId,
      fileName: trace.fileName === asset.name ? appendCopySuffix(asset.name) : trace.fileName,
    })),
    report: asset.report
      ? {
          ...asset.report,
          id: createId('report'),
          deckId,
          title: appendCopySuffix(asset.report.title),
          generatedAt: now,
        }
      : undefined,
  }
}

export function buildWorkspaceLibraryItems(workspace: WorkspaceState): WorkspaceLibraryItem[] {
  const projectsById = new Map(workspace.projects.map((project) => [project.id, project]))
  const decksById = new Map(workspace.decks.map((deck) => [deck.id, deck]))

  const projectItems = workspace.projects.map<WorkspaceLibraryItem>((project) => {
    const projectDecks = getProjectDecks(workspace, project.id)
    const projectReports = projectDecks.flatMap((deck) => getDeckReports(workspace, deck.id))
    const isShared = getProjectSharedState(workspace, project)
    const latestActivity = getLatestDeckActivity(workspace, project) ?? project.updatedAt

    return {
      id: project.id,
      type: 'project',
      projectId: project.id,
      name: project.name,
      description: project.summary,
      owner: project.owner,
      updatedAt: latestActivity,
      typeLabel: 'Project folder',
      countLabel: `${formatCount(projectDecks.length, 'deck')} / ${formatCount(
        projectReports.length,
        'report',
      )}`,
      statusLabel: project.status,
      isShared,
      isStarred: project.starred === true,
      isTrashed: Boolean(project.trashedAt),
      trashedAt: project.trashedAt,
      badges: [project.status, isShared ? 'Shared' : 'Owner'],
      metadata: [formatCount(projectDecks.length, 'deck'), formatCount(projectReports.length, 'report')],
    }
  })

  const deckItems = workspace.decks.map<WorkspaceLibraryItem>((deck) => {
    const project = projectsById.get(deck.projectId)
    const slideCount = workspace.slides.filter((slide) => slide.deckId === deck.id).length
    const reportCount = getDeckReports(workspace, deck.id).length
    const assetCount = workspace.fileAssets.filter(
      (asset) => asset.deckId === deck.id && asset.kind !== 'report',
    ).length
    const commentCount = getCommentCount(workspace.comments, deck.id)
    const isTrashed = Boolean(deck.trashedAt || project?.trashedAt)

    return {
      id: deck.id,
      type: 'deck',
      projectId: deck.projectId,
      deckId: deck.id,
      name: deck.title,
      description: deck.setup.goal || 'Presentation setup has not been filled in yet.',
      owner: project?.owner ?? 'Owner',
      updatedAt: deck.updatedAt,
      parentName: project?.name,
      typeLabel: 'Presentation',
      countLabel: `${formatCount(slideCount, 'slide')} / ${formatCount(assetCount, 'source')}`,
      statusLabel: deck.status,
      isShared: deck.collaboration.isShared,
      isStarred: deck.starred === true,
      isTrashed,
      trashedAt: deck.trashedAt ?? project?.trashedAt,
      badges: [deck.status, deck.collaboration.isShared ? 'Shared' : 'Owner'],
      metadata: [
        formatCount(slideCount, 'slide'),
        formatCount(assetCount, 'source'),
        formatCount(reportCount, 'report'),
        formatCount(commentCount, 'comment'),
      ],
    }
  })

  const reportItems = workspace.fileAssets.filter(isReportAsset).map<WorkspaceLibraryItem>((asset) => {
    const deck = decksById.get(asset.deckId)
    const project = deck ? projectsById.get(deck.projectId) : undefined
    const isTrashed = Boolean(asset.trashedAt || deck?.trashedAt || project?.trashedAt)

    return {
      id: asset.id,
      type: 'report',
      projectId: project?.id,
      deckId: asset.deckId,
      name: asset.name,
      description: asset.summary || asset.extractedTextPreview || 'Generated report asset.',
      owner: asset.uploadedByRole === 'collaborator' ? 'Collaborator' : (project?.owner ?? 'Owner'),
      updatedAt: asset.uploadedAt,
      parentName: deck?.title,
      typeLabel: 'Report',
      countLabel: asset.sizeLabel,
      statusLabel: asset.status,
      isShared: deck?.collaboration.isShared === true,
      isStarred: asset.starred === true,
      isTrashed,
      trashedAt: asset.trashedAt ?? deck?.trashedAt ?? project?.trashedAt,
      badges: ['report', deck?.collaboration.isShared ? 'Shared' : 'Owner'],
      metadata: [asset.sizeLabel, asset.status, deck?.title ?? 'Unlinked deck'],
    }
  })

  return [...projectItems, ...deckItems, ...reportItems]
}

export function filterWorkspaceLibraryItems(
  items: WorkspaceLibraryItem[],
  input: WorkspaceFilterInput,
) {
  const normalizedQuery = input.searchQuery.trim().toLowerCase()

  return items.filter((item) => {
    const matchesSection =
      input.section === 'my-drive'
        ? !item.isTrashed
        : input.section === 'shared'
          ? !item.isTrashed && item.isShared
          : input.section === 'recent'
            ? !item.isTrashed
            : input.section === 'starred'
              ? !item.isTrashed && item.isStarred
              : input.section === 'trash'
                ? item.isTrashed
                : !item.isTrashed && item.type === 'project'

    if (!matchesSection) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return [item.name, item.description, item.owner, item.parentName, item.typeLabel]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedQuery))
  })
}

export function sortWorkspaceLibraryItems(items: WorkspaceLibraryItem[], sortKey: WorkspaceSortKey) {
  return [...items].sort((left, right) => {
    if (sortKey === 'name-asc') {
      return left.name.localeCompare(right.name)
    }

    if (sortKey === 'name-desc') {
      return right.name.localeCompare(left.name)
    }

    if (sortKey === 'updated-asc') {
      return left.updatedAt.localeCompare(right.updatedAt)
    }

    if (sortKey === 'type-asc') {
      return itemTypeOrder[left.type] - itemTypeOrder[right.type] || left.name.localeCompare(right.name)
    }

    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

export function renameWorkspaceItem(
  workspace: WorkspaceState,
  input: WorkspaceRenameInput,
): WorkspaceState {
  const nextName = input.name.trim()

  if (!nextName) {
    return workspace
  }

  if (input.itemType === 'project') {
    return {
      ...workspace,
      projects: workspace.projects.map((project) =>
        project.id === input.itemId
          ? {
              ...project,
              name: nextName,
              updatedAt: input.now,
            }
          : project,
      ),
    }
  }

  if (input.itemType === 'deck') {
    return {
      ...workspace,
      decks: workspace.decks.map((deck) =>
        deck.id === input.itemId
          ? {
              ...deck,
              title: nextName,
              updatedAt: input.now,
            }
          : deck,
      ),
    }
  }

  return {
    ...workspace,
    fileAssets: workspace.fileAssets.map((asset) =>
      asset.id === input.itemId && asset.kind === 'report'
        ? {
            ...asset,
            name: nextName,
            uploadedAt: input.now,
          }
        : asset,
    ),
  }
}

export function toggleWorkspaceItemStarred(
  workspace: WorkspaceState,
  input: WorkspaceItemActionInput,
): WorkspaceState {
  if (input.itemType === 'project') {
    return {
      ...workspace,
      projects: workspace.projects.map((project) =>
        project.id === input.itemId
          ? {
              ...project,
              starred: project.starred !== true,
              updatedAt: input.now,
            }
          : project,
      ),
    }
  }

  if (input.itemType === 'deck') {
    return {
      ...workspace,
      decks: workspace.decks.map((deck) =>
        deck.id === input.itemId
          ? {
              ...deck,
              starred: deck.starred !== true,
              updatedAt: input.now,
            }
          : deck,
      ),
    }
  }

  return {
    ...workspace,
    fileAssets: workspace.fileAssets.map((asset) =>
      asset.id === input.itemId && asset.kind === 'report'
        ? {
            ...asset,
            starred: asset.starred !== true,
            uploadedAt: input.now,
          }
        : asset,
    ),
  }
}

export function trashWorkspaceItem(
  workspace: WorkspaceState,
  input: WorkspaceItemActionInput,
): WorkspaceState {
  if (input.itemType === 'project') {
    return {
      ...workspace,
      projects: workspace.projects.map((project) =>
        project.id === input.itemId
          ? {
              ...project,
              trashedAt: input.now,
              updatedAt: input.now,
            }
          : project,
      ),
    }
  }

  if (input.itemType === 'deck') {
    return {
      ...workspace,
      decks: workspace.decks.map((deck) =>
        deck.id === input.itemId
          ? {
              ...deck,
              trashedAt: input.now,
              updatedAt: input.now,
            }
          : deck,
      ),
      activeDeckId:
        workspace.activeDeckId === input.itemId
          ? getFirstRemainingDeckId(
              workspace.decks.filter((deck) => deck.id !== input.itemId),
              workspace.activeDeckId,
            )
          : workspace.activeDeckId,
    }
  }

  return {
    ...workspace,
    fileAssets: workspace.fileAssets.map((asset) =>
      asset.id === input.itemId && asset.kind === 'report'
        ? {
            ...asset,
            trashedAt: input.now,
            uploadedAt: input.now,
          }
        : asset,
    ),
  }
}

export function restoreWorkspaceItem(
  workspace: WorkspaceState,
  input: WorkspaceItemActionInput,
): WorkspaceState {
  if (input.itemType === 'project') {
    return {
      ...workspace,
      projects: workspace.projects.map((project) =>
        project.id === input.itemId
          ? {
              ...project,
              trashedAt: undefined,
              updatedAt: input.now,
            }
          : project,
      ),
    }
  }

  if (input.itemType === 'deck') {
    return {
      ...workspace,
      decks: workspace.decks.map((deck) =>
        deck.id === input.itemId
          ? {
              ...deck,
              trashedAt: undefined,
              updatedAt: input.now,
            }
          : deck,
      ),
    }
  }

  return {
    ...workspace,
    fileAssets: workspace.fileAssets.map((asset) =>
      asset.id === input.itemId && asset.kind === 'report'
        ? {
            ...asset,
            trashedAt: undefined,
            uploadedAt: input.now,
          }
        : asset,
    ),
  }
}

export function deleteWorkspaceItemPermanently(
  workspace: WorkspaceState,
  input: WorkspaceItemActionInput,
): WorkspaceState {
  if (input.itemType === 'project') {
    const deletedDeckIds = new Set(
      workspace.decks.filter((deck) => deck.projectId === input.itemId).map((deck) => deck.id),
    )
    const nextDecks = workspace.decks.filter((deck) => !deletedDeckIds.has(deck.id))

    return {
      ...workspace,
      activeDeckId: getFirstRemainingDeckId(nextDecks, workspace.activeDeckId),
      projects: workspace.projects.filter((project) => project.id !== input.itemId),
      decks: nextDecks,
      slides: workspace.slides.filter((slide) => !deletedDeckIds.has(slide.deckId)),
      fileAssets: workspace.fileAssets.filter((asset) => !deletedDeckIds.has(asset.deckId)),
      chartSuggestions: workspace.chartSuggestions.filter(
        (suggestion) => !deletedDeckIds.has(suggestion.deckId),
      ),
      comments: workspace.comments.filter((comment) => !deletedDeckIds.has(comment.deckId)),
      deckVersions: workspace.deckVersions.filter((version) => !deletedDeckIds.has(version.deckId)),
    }
  }

  if (input.itemType === 'deck') {
    const nextDecks = workspace.decks.filter((deck) => deck.id !== input.itemId)

    return {
      ...workspace,
      activeDeckId: getFirstRemainingDeckId(nextDecks, workspace.activeDeckId),
      projects: workspace.projects.map((project) => ({
        ...project,
        deckIds: project.deckIds.filter((deckId) => deckId !== input.itemId),
        updatedAt: project.deckIds.includes(input.itemId) ? input.now : project.updatedAt,
      })),
      decks: nextDecks,
      slides: workspace.slides.filter((slide) => slide.deckId !== input.itemId),
      fileAssets: workspace.fileAssets.filter((asset) => asset.deckId !== input.itemId),
      chartSuggestions: workspace.chartSuggestions.filter(
        (suggestion) => suggestion.deckId !== input.itemId,
      ),
      comments: workspace.comments.filter((comment) => comment.deckId !== input.itemId),
      deckVersions: workspace.deckVersions.filter((version) => version.deckId !== input.itemId),
    }
  }

  const report = workspace.fileAssets.find((asset) => asset.id === input.itemId)

  return {
    ...workspace,
    fileAssets: workspace.fileAssets.filter((asset) => asset.id !== input.itemId),
    decks: report
      ? workspace.decks.map((deck) =>
          deck.id === report.deckId
            ? {
                ...deck,
                fileAssetIds: deck.fileAssetIds.filter((assetId) => assetId !== input.itemId),
                updatedAt: input.now,
              }
            : deck,
        )
      : workspace.decks,
  }
}

export function duplicateProjectInWorkspace(
  workspace: WorkspaceState,
  input: WorkspaceDuplicateInput,
): WorkspaceState {
  const project = workspace.projects.find((candidate) => candidate.id === input.itemId)

  if (!project) {
    return workspace
  }

  const nextProject: Project = {
    ...project,
    id: createId('project'),
    name: appendCopySuffix(project.name),
    deckIds: [],
    updatedAt: input.now,
    starred: false,
    trashedAt: undefined,
  }

  return {
    ...workspace,
    projects: [nextProject, ...workspace.projects],
  }
}

export function duplicateDeckInWorkspace(
  workspace: WorkspaceState,
  input: DuplicateDeckInput,
): WorkspaceState {
  const deck = workspace.decks.find((candidate) => candidate.id === input.deckId)

  if (!deck) {
    return workspace
  }

  const nextDeckId = input.newDeckId ?? createId('deck')
  const nextSlides = workspace.slides
    .filter((slide) => slide.deckId === deck.id)
    .sort((left, right) => left.index - right.index)
    .map((slide, index) => cloneSlide(slide, nextDeckId, index + 1))
  const nextReportAssets = workspace.fileAssets
    .filter((asset) => asset.deckId === deck.id && asset.kind === 'report')
    .map((asset) => cloneReportAsset(asset, nextDeckId, input.now))
  const nextDeck: Deck = {
    ...deck,
    id: nextDeckId,
    title: appendCopySuffix(deck.title),
    updatedAt: input.now,
    slideIds: nextSlides.map((slide) => slide.id),
    fileAssetIds: nextReportAssets.map((asset) => asset.id),
    activeVersionId: undefined,
    starred: false,
    trashedAt: undefined,
  }

  return {
    ...workspace,
    activeDeckId: nextDeckId,
    decks: [nextDeck, ...workspace.decks],
    slides: [...workspace.slides, ...nextSlides],
    fileAssets: [...nextReportAssets, ...workspace.fileAssets],
    projects: workspace.projects.map((project) =>
      project.id === deck.projectId
        ? {
            ...project,
            deckIds: [nextDeckId, ...project.deckIds],
            updatedAt: input.now,
          }
        : project,
    ),
  }
}

export function duplicateReportInWorkspace(
  workspace: WorkspaceState,
  input: WorkspaceDuplicateInput,
): WorkspaceState {
  const report = workspace.fileAssets.find((asset) => asset.id === input.itemId && asset.kind === 'report')

  if (!report) {
    return workspace
  }

  const nextReport = cloneReportAsset(report, report.deckId, input.now)

  return {
    ...workspace,
    fileAssets: [nextReport, ...workspace.fileAssets],
    decks: workspace.decks.map((deck) =>
      deck.id === report.deckId
        ? {
            ...deck,
            fileAssetIds: [nextReport.id, ...deck.fileAssetIds],
            updatedAt: input.now,
          }
        : deck,
    ),
  }
}

export function duplicateWorkspaceItem(
  workspace: WorkspaceState,
  input: WorkspaceDuplicateInput,
): WorkspaceState {
  if (input.itemType === 'project') {
    return duplicateProjectInWorkspace(workspace, input)
  }

  if (input.itemType === 'deck') {
    return duplicateDeckInWorkspace(workspace, {
      deckId: input.itemId,
      now: input.now,
    })
  }

  return duplicateReportInWorkspace(workspace, input)
}

export function moveDeckToProject(workspace: WorkspaceState, input: MoveDeckInput): WorkspaceState {
  const deck = workspace.decks.find((candidate) => candidate.id === input.deckId)

  if (!deck || deck.projectId === input.projectId) {
    return workspace
  }

  return {
    ...workspace,
    decks: workspace.decks.map((candidate) =>
      candidate.id === input.deckId
        ? {
            ...candidate,
            projectId: input.projectId,
            updatedAt: input.now,
          }
        : candidate,
    ),
    projects: workspace.projects.map((project) => {
      if (project.id === deck.projectId) {
        return {
          ...project,
          deckIds: project.deckIds.filter((deckId) => deckId !== deck.id),
          updatedAt: input.now,
        }
      }

      if (project.id === input.projectId) {
        return {
          ...project,
          deckIds: [deck.id, ...project.deckIds.filter((deckId) => deckId !== deck.id)],
          updatedAt: input.now,
        }
      }

      return project
    }),
  }
}

export function moveWorkspaceItem(
  workspace: WorkspaceState,
  input: WorkspaceMoveInput,
): WorkspaceState {
  if (input.itemType === 'deck') {
    return moveDeckToProject(workspace, {
      deckId: input.itemId,
      projectId: input.targetId,
      now: input.now,
    })
  }

  if (input.itemType !== 'report') {
    return workspace
  }

  const report = workspace.fileAssets.find((asset) => asset.id === input.itemId && asset.kind === 'report')

  if (!report || report.deckId === input.targetId) {
    return workspace
  }

  return {
    ...workspace,
    fileAssets: workspace.fileAssets.map((asset) =>
      asset.id === report.id
        ? {
            ...asset,
            deckId: input.targetId,
            uploadedAt: input.now,
          }
        : asset,
    ),
    decks: workspace.decks.map((deck) => {
      if (deck.id === report.deckId) {
        return {
          ...deck,
          fileAssetIds: deck.fileAssetIds.filter((assetId) => assetId !== report.id),
          updatedAt: input.now,
        }
      }

      if (deck.id === input.targetId) {
        return {
          ...deck,
          fileAssetIds: [report.id, ...deck.fileAssetIds.filter((assetId) => assetId !== report.id)],
          updatedAt: input.now,
        }
      }

      return deck
    }),
  }
}
