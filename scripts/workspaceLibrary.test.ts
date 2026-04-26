import assert from 'node:assert/strict'
import {
  buildWorkspaceLibraryItems,
  duplicateDeckInWorkspace,
  filterWorkspaceLibraryItems,
  moveDeckToProject,
  renameWorkspaceItem,
  sortWorkspaceLibraryItems,
  trashWorkspaceItem,
} from '../src/data/workspaceLibrary.ts'
import type { WorkspaceState } from '../src/types/models.ts'

const workspace: WorkspaceState = {
  activeDeckId: 'deck-board-narrative',
  projects: [
    {
      id: 'project-aperture',
      name: 'Aperture Ventures',
      summary: 'Investor-facing narratives.',
      owner: 'Mina Patel',
      status: 'active',
      deckIds: ['deck-board-narrative'],
      updatedAt: '2026-04-23T16:00:00.000Z',
    },
    {
      id: 'project-northstar',
      name: 'Northstar Product',
      summary: 'Launch and product narratives.',
      owner: 'Jon Reyes',
      status: 'planning',
      deckIds: ['deck-launch-readout'],
      updatedAt: '2026-04-22T10:00:00.000Z',
    },
  ],
  decks: [
    {
      id: 'deck-board-narrative',
      projectId: 'project-aperture',
      title: 'Q3 Board Narrative',
      status: 'ready',
      updatedAt: '2026-04-23T16:00:00.000Z',
      slideIds: ['slide-board-1'],
      fileAssetIds: ['report-board'],
      setup: {
        goal: 'Align the board on investment priorities.',
        audience: 'Board members',
        tone: 'Confident',
        presentationType: 'Board update',
        requiredSections: ['Market context'],
        notes: '',
        webResearch: false,
        usePreviousDeckContext: false,
        shareSetupInputs: false,
      },
      collaboration: {
        isShared: true,
        access: 'comment-only',
        allowCollaboratorUploads: true,
      },
    },
    {
      id: 'deck-launch-readout',
      projectId: 'project-northstar',
      title: 'Launch Readout',
      status: 'draft',
      updatedAt: '2026-04-21T09:30:00.000Z',
      slideIds: ['slide-launch-1'],
      fileAssetIds: [],
      setup: {
        goal: 'Summarize launch learnings.',
        audience: 'Product leads',
        tone: 'Plain-spoken',
        presentationType: 'Launch debrief',
        requiredSections: ['What shipped'],
        notes: '',
        webResearch: false,
        usePreviousDeckContext: false,
        shareSetupInputs: false,
      },
      collaboration: {
        isShared: false,
        access: 'comment-only',
        allowCollaboratorUploads: false,
      },
    },
  ],
  slides: [
    {
      id: 'slide-board-1',
      deckId: 'deck-board-narrative',
      index: 1,
      title: 'Board title',
      notes: '',
      sourceTrace: [],
      blocks: [],
    },
    {
      id: 'slide-launch-1',
      deckId: 'deck-launch-readout',
      index: 1,
      title: 'Launch title',
      notes: '',
      sourceTrace: [],
      blocks: [],
    },
  ],
  fileAssets: [
    {
      id: 'report-board',
      deckId: 'deck-board-narrative',
      name: 'board-report.html',
      kind: 'report',
      status: 'parsed',
      uploadedByUserId: 'user-owner-1',
      uploadedByRole: 'owner',
      highlightForOwnerReview: false,
      sizeBytes: 1024,
      sizeLabel: '1 KB',
      summary: 'Generated board report.',
      uploadedAt: '2026-04-23T16:10:00.000Z',
      extractedTextPreview: 'Report preview',
      extractedMetadata: {},
      possibleAudience: 'Board',
      possibleGoal: 'Review',
      possibleSections: ['Summary'],
      possibleTone: 'Concise',
      sourceTrace: [],
    },
  ],
  chartSuggestions: [],
  comments: [],
  deckVersions: [],
}

const allItems = buildWorkspaceLibraryItems(workspace)
assert.equal(allItems.filter((item) => item.type === 'project').length, workspace.projects.length)
assert.equal(allItems.filter((item) => item.type === 'deck').length, workspace.decks.length)
assert.ok(allItems.some((item) => item.type === 'report'))

const sharedItems = filterWorkspaceLibraryItems(allItems, {
  section: 'shared',
  searchQuery: '',
})
assert.ok(sharedItems.length > 0)
assert.ok(sharedItems.every((item) => item.isShared))

const searchedItems = filterWorkspaceLibraryItems(allItems, {
  section: 'my-drive',
  searchQuery: 'board',
})
assert.deepEqual(
  searchedItems.map((item) => item.name),
  ['Q3 Board Narrative', 'board-report.html'],
)

const sortedByName = sortWorkspaceLibraryItems(allItems, 'name-asc')
assert.equal(sortedByName[0].name, 'Aperture Ventures')

const renamedWorkspace = renameWorkspaceItem(workspace, {
  itemId: 'deck-board-narrative',
  itemType: 'deck',
  name: 'Board Narrative Renamed',
  now: '2026-04-26T12:00:00.000Z',
})
assert.equal(
  renamedWorkspace.decks.find((deck) => deck.id === 'deck-board-narrative')?.title,
  'Board Narrative Renamed',
)

const trashedWorkspace = trashWorkspaceItem(workspace, {
  itemId: 'deck-board-narrative',
  itemType: 'deck',
  now: '2026-04-26T12:00:00.000Z',
})
const trashedItems = filterWorkspaceLibraryItems(buildWorkspaceLibraryItems(trashedWorkspace), {
  section: 'trash',
  searchQuery: '',
})
assert.ok(trashedItems.some((item) => item.id === 'deck-board-narrative'))

const duplicatedWorkspace = duplicateDeckInWorkspace(workspace, {
  deckId: 'deck-board-narrative',
  newDeckId: 'deck-board-narrative-copy',
  now: '2026-04-26T12:00:00.000Z',
})
assert.ok(duplicatedWorkspace.decks.some((deck) => deck.id === 'deck-board-narrative-copy'))
assert.ok(duplicatedWorkspace.slides.some((slide) => slide.deckId === 'deck-board-narrative-copy'))

const movedWorkspace = moveDeckToProject(workspace, {
  deckId: 'deck-launch-readout',
  projectId: 'project-aperture',
  now: '2026-04-26T12:00:00.000Z',
})
assert.equal(
  movedWorkspace.decks.find((deck) => deck.id === 'deck-launch-readout')?.projectId,
  'project-aperture',
)
assert.ok(
  movedWorkspace.projects
    .find((project) => project.id === 'project-aperture')
    ?.deckIds.includes('deck-launch-readout'),
)

console.log('workspaceLibrary tests passed')
