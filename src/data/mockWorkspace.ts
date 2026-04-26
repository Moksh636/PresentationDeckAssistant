import type { Deck, DeckVersion, WorkspaceState, Slide, FileAsset, Comment, Project } from '../types/models'
import { createChartSuggestionsFromFiles } from './chartSuggestions'
import {
  COLLABORATOR_USER_NAME,
  OWNER_USER_NAME,
  createDefaultCollaborationSettings,
  createSharedCollaborationSettings,
} from './collaboration'
import { createSlidesFromDeck } from './deckGenerator'
import { COLLABORATOR_USER_ID, OWNER_USER_ID, createMockFileAsset } from './sourceIngestion'
import { createId } from '../utils/ids'

const NOW = '2026-04-23T16:00:00.000Z'

function createSeedDecks(): Deck[] {
  return [
    {
      id: 'deck-board-narrative',
      projectId: 'project-aperture',
      title: 'Q3 Board Narrative',
      status: 'ready',
      updatedAt: NOW,
      slideIds: [],
      fileAssetIds: [],
      activeVersionId: undefined,
      collaboration: {
        ...createSharedCollaborationSettings(false),
        allowCollaboratorUploads: true,
      },
      setup: {
        goal:
          'Align the board on where AI-assisted workflow automation improved execution speed and where to invest next.',
        audience: 'Board members and executive staff',
        tone: 'Confident, concise, evidence-driven',
        presentationType: 'Board update',
        requiredSections: [
          'Market context',
          'Execution progress',
          'Product traction',
          'Financial signal',
          'Investment ask',
        ],
        notes:
          'Use the Q2 partner narrative as context, but tighten the recommendation and make the close decision-ready.',
        webResearch: true,
        usePreviousDeckContext: true,
        shareSetupInputs: false,
      },
    },
    {
      id: 'deck-portfolio-rollup',
      projectId: 'project-aperture',
      title: 'Portfolio AI Rollup',
      status: 'editing',
      updatedAt: '2026-04-22T11:10:00.000Z',
      slideIds: [],
      fileAssetIds: [],
      activeVersionId: undefined,
      collaboration: createDefaultCollaborationSettings(true),
      setup: {
        goal: 'Summarize portfolio adoption patterns across AI tooling experiments.',
        audience: 'Investment team',
        tone: 'Analytical and pattern-oriented',
        presentationType: 'Internal review',
        requiredSections: ['Adoption signal', 'Common blockers', 'High-conviction themes'],
        notes: 'Keep slides sparse and call out which data still needs validation.',
        webResearch: false,
        usePreviousDeckContext: false,
        shareSetupInputs: true,
      },
    },
    {
      id: 'deck-launch-readout',
      projectId: 'project-northstar',
      title: 'Launch Readout',
      status: 'draft',
      updatedAt: '2026-04-21T09:30:00.000Z',
      slideIds: [],
      fileAssetIds: [],
      activeVersionId: undefined,
      collaboration: createSharedCollaborationSettings(true),
      setup: {
        goal: 'Turn launch results into a sharper story for the next customer review.',
        audience: 'Product and GTM leads',
        tone: 'Plain-spoken and practical',
        presentationType: 'Launch debrief',
        requiredSections: ['What shipped', 'Customer signal', 'What to fix next'],
        notes: 'Need a stronger explanation of what changed after launch week.',
        webResearch: false,
        usePreviousDeckContext: true,
        shareSetupInputs: true,
      },
    },
  ]
}

function createSeedProjects(deckIdsByProject: Record<string, string[]>): Project[] {
  return [
    {
      id: 'project-aperture',
      name: 'Aperture Ventures',
      summary: 'Investor-facing narratives and portfolio operating reviews.',
      owner: 'Mina Patel',
      status: 'active',
      deckIds: deckIdsByProject['project-aperture'] ?? [],
      updatedAt: NOW,
    },
    {
      id: 'project-northstar',
      name: 'Northstar Product',
      summary: 'Product strategy decks, launch readouts, and roadmap checkpoints.',
      owner: 'Jon Reyes',
      status: 'planning',
      deckIds: deckIdsByProject['project-northstar'] ?? [],
      updatedAt: '2026-04-22T10:00:00.000Z',
    },
  ]
}

function buildSeedVersions(decks: Deck[], slides: Slide[]): DeckVersion[] {
  return decks.map((deck) => {
    const slideSnapshot = slides.filter((slide) => slide.deckId === deck.id)

    return {
      id: `version-${deck.id}-1`,
      deckId: deck.id,
      label: 'v1',
      summary: 'Initial JSON slide graph seeded for the MVP shell.',
      createdAt: deck.updatedAt,
      slideSnapshot,
    }
  })
}

function buildSeedAssets(): FileAsset[] {
  return [
    createMockFileAsset({
      id: 'file-market-brief',
      deckId: 'deck-board-narrative',
      name: 'market-brief.pdf',
      kind: 'pdf',
      status: 'parsed',
      uploadedByRole: 'collaborator',
      uploadedByUserId: COLLABORATOR_USER_ID,
      highlightForOwnerReview: true,
      sizeBytes: 842_100,
      summary: 'Condensed market signal and two competitor updates ready for source trace.',
      uploadedAt: NOW,
      extractedTextPreview:
        'Mock parser identified a market narrative, competitor references, and a recommendation for executive review.',
      possibleSections: ['Market context', 'Competitive movement', 'Recommendation'],
    }),
    createMockFileAsset({
      id: 'file-finance-model',
      deckId: 'deck-board-narrative',
      name: 'forecast-model.xlsx',
      kind: 'sheet',
      status: 'extracting',
      uploadedByRole: 'owner',
      uploadedByUserId: OWNER_USER_ID,
      highlightForOwnerReview: false,
      sizeBytes: 289_000,
      summary: 'Awaiting metric extraction and chart recommendations.',
      uploadedAt: NOW,
      extractedTextPreview:
        'Mock extraction found trend lines, forecast deltas, and a likely financial recommendation.',
      possibleSections: ['Financial signal', 'Scenario outlook', 'Recommendation'],
    }),
    createMockFileAsset({
      id: 'file-voice-notes',
      deckId: 'deck-launch-readout',
      name: 'launch-notes.docx',
      kind: 'doc',
      status: 'parsed',
      uploadedByRole: 'owner',
      uploadedByUserId: OWNER_USER_ID,
      highlightForOwnerReview: false,
      sizeBytes: 120_400,
      summary: 'Draft notes uploaded as source material.',
      uploadedAt: '2026-04-21T09:15:00.000Z',
      extractedTextPreview:
        'Mock ingestion turned launch notes into a concise preview of customer signal and next-step themes.',
    }),
  ]
}

function buildSeedComments(slides: Slide[]): Comment[] {
  const boardSlide = slides.find((slide) => slide.deckId === 'deck-board-narrative')
  const boardBlock = boardSlide?.blocks.find((block) => block.type === 'body') ?? boardSlide?.blocks[0]

  return [
    {
      id: 'comment-1',
      projectId: 'project-aperture',
      deckId: 'deck-board-narrative',
      createdAt: NOW,
      updatedAt: NOW,
      resolved: false,
      messages: [
        {
          id: 'comment-1-message-1',
          author: OWNER_USER_NAME,
          authorUserId: OWNER_USER_ID,
          authorRole: 'owner',
          message: 'Need a sharper board-level recommendation in the final slide.',
          createdAt: NOW,
        },
        {
          id: 'comment-1-message-2',
          author: COLLABORATOR_USER_NAME,
          authorUserId: COLLABORATOR_USER_ID,
          authorRole: 'collaborator',
          message: 'I would also trim the setup before the recommendation lands.',
          createdAt: '2026-04-23T16:08:00.000Z',
        },
      ],
    },
    {
      id: 'comment-2',
      projectId: 'project-aperture',
      deckId: 'deck-board-narrative',
      slideId: boardSlide?.id,
      blockId: boardBlock?.id,
      createdAt: '2026-04-23T16:05:00.000Z',
      updatedAt: '2026-04-23T16:12:00.000Z',
      resolved: false,
      messages: [
        {
          id: 'comment-2-message-1',
          author: COLLABORATOR_USER_NAME,
          authorUserId: COLLABORATOR_USER_ID,
          authorRole: 'collaborator',
          message: 'Could this slide make the risk tradeoff more explicit for the board?',
          createdAt: '2026-04-23T16:05:00.000Z',
        },
      ],
    },
    {
      id: 'comment-3',
      projectId: 'project-northstar',
      deckId: 'deck-launch-readout',
      inputFieldKey: 'goal',
      createdAt: '2026-04-22T11:25:00.000Z',
      updatedAt: '2026-04-22T11:25:00.000Z',
      resolved: true,
      messages: [
        {
          id: 'comment-3-message-1',
          author: OWNER_USER_NAME,
          authorUserId: OWNER_USER_ID,
          authorRole: 'owner',
          message: 'The story would benefit from one cross-portfolio pattern slide.',
          createdAt: '2026-04-22T11:25:00.000Z',
        },
      ],
    },
  ]
}

export function createEmptyDeck(projectId: string, title = 'New Presentation'): Deck {
  return {
    id: createId('deck'),
    projectId,
    title,
    status: 'draft',
    updatedAt: new Date().toISOString(),
    slideIds: [],
    fileAssetIds: [],
    activeVersionId: undefined,
    collaboration: createDefaultCollaborationSettings(false),
    setup: {
      goal: '',
      audience: '',
      tone: '',
      presentationType: 'Strategy update',
      requiredSections: [],
      notes: '',
      webResearch: false,
      usePreviousDeckContext: false,
      shareSetupInputs: false,
    },
  }
}

export function seedWorkspaceState(): WorkspaceState {
  const rawDecks = createSeedDecks()
  const fileAssets = buildSeedAssets()
  const slides = rawDecks.flatMap((deck) =>
    createSlidesFromDeck(
      deck,
      fileAssets.filter((asset) => asset.deckId === deck.id),
    ),
  )
  const deckIdsByProject = rawDecks.reduce<Record<string, string[]>>((accumulator, deck) => {
    accumulator[deck.projectId] = [...(accumulator[deck.projectId] ?? []), deck.id]
    return accumulator
  }, {})

  const decks = rawDecks.map((deck) => {
    const deckSlides = slides.filter((slide) => slide.deckId === deck.id)
    return {
      ...deck,
      slideIds: deckSlides.map((slide) => slide.id),
      activeVersionId: `version-${deck.id}-1`,
    }
  })

  const decksWithAssets = decks.map((deck) => ({
    ...deck,
    fileAssetIds: fileAssets
      .filter((asset) => asset.deckId === deck.id)
      .map((asset) => asset.id),
  }))

  return {
    activeDeckId: 'deck-board-narrative',
    projects: createSeedProjects(deckIdsByProject),
    decks: decksWithAssets,
    slides,
    fileAssets,
    chartSuggestions: createChartSuggestionsFromFiles(fileAssets),
    comments: buildSeedComments(slides),
    deckVersions: buildSeedVersions(decksWithAssets, slides),
  }
}
