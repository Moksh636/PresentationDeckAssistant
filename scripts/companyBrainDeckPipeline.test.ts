import assert from 'node:assert/strict'
import {
  buildBrainMapDeckInfluence,
  buildCompanyKnowledgeDeckInfluence,
  buildDeckReportCompanyBrainEntriesFromItems,
  filterRankedKnowledgeBySelection,
  groupCompanyKnowledgeByIntelBucket,
  resolveCompanyKnowledgeIntelBucket,
} from '../src/data/companyBrainDeckPipeline.ts'
import { createSlidesFromDeck } from '../src/data/deckGenerator.ts'
import type { RankedCompanyKnowledgeEntry } from '../src/data/companyKnowledgeRetrieval.ts'
import { OWNER_USER_ID } from '../src/data/sourceIngestion.ts'
import type {
  CompanyKnowledgeItem,
  Deck,
  FileAsset,
  Slide,
  SourceTrace,
} from '../src/types/models.ts'

function sampleTrace(fileId: string, fileName: string): SourceTrace {
  return {
    fileId,
    fileName,
    sourceType: 'uploaded-file',
    confidence: 0.92,
    extractedSnippet: 'Binding terms section',
    addedByUserId: OWNER_USER_ID,
  }
}

function sampleLibraryAsset(id: string): FileAsset {
  return {
    id,
    deckId: 'library-deck',
    name: `${id}.pdf`,
    kind: 'pdf',
    status: 'parsed',
    uploadedByUserId: OWNER_USER_ID,
    uploadedByRole: 'owner',
    highlightForOwnerReview: false,
    sizeBytes: 1200,
    sizeLabel: '1.2 KB',
    summary: '',
    uploadedAt: '2026-05-01',
    extractedTextPreview: 'Preview',
    extractedMetadata: {},
    possibleAudience: '',
    possibleGoal: '',
    possibleSections: [],
    possibleTone: '',
    sourceTrace: [sampleTrace(id, `${id}.pdf`)],
  }
}

function minimalDeck(): Deck {
  return {
    id: 'deck-pipe',
    projectId: 'proj-pipe',
    title: 'Brain pipeline test',
    status: 'draft',
    updatedAt: '2026-05-05',
    slideIds: [],
    fileAssetIds: [],
    setup: {
      goal: 'Win the pilot',
      audience: 'VP Ops',
      tone: 'Professional',
      presentationType: 'Pilot proposal deck',
      requiredSections: ['Recap', 'Plan'],
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
  }
}

const baseItemFields = {
  organizationId: 'org-1',
  uploadedByUserId: OWNER_USER_ID,
  approvalStatus: 'approved' as const,
  visibility: 'company' as const,
  tags: [] as string[],
  createdAt: '2026-05-05',
  updatedAt: '2026-05-05',
}

function item(overrides: Partial<CompanyKnowledgeItem> & Pick<CompanyKnowledgeItem, 'id' | 'title' | 'sourceType' | 'description'>): CompanyKnowledgeItem {
  return {
    ...baseItemFields,
    ...overrides,
  }
}

// —— Grouping ——
{
  const grouped = groupCompanyKnowledgeByIntelBucket([
    item({
      id: '1',
      title: 'Case win',
      description: 'Story',
      sourceType: 'case-study',
    }),
    item({
      id: '2',
      title: 'Beta tag',
      description: 'Via tags',
      sourceType: 'other',
      tags: ['case study'],
    }),
  ])
  assert.equal(grouped.get('case-studies')?.length, 2)
}

{
  const bucket = resolveCompanyKnowledgeIntelBucket(
    item({
      id: '3',
      title: 'Other with legal tag',
      description: 'x',
      sourceType: 'other',
      tags: ['msa'],
    }),
  )
  assert.equal(bucket, 'contracts-legal')
}

// —— No fake citations for memory-only influence ——
{
  const memory = item({
    id: 'm1',
    title: 'Internal note',
    description: 'No file id',
    sourceType: 'notes',
  })
  const lib = sampleLibraryAsset('lib-1')
  const infl = buildCompanyKnowledgeDeckInfluence([memory], new Map([[lib.id, lib]]))
  assert.deepEqual(infl.citedTraces, [])
  assert.ok(infl.memoryOnlyTitles.includes('Internal note'))
}

// —— Cited traces only from linked file asset ——
{
  const lib = sampleLibraryAsset('linked-doc')
  const linked = item({
    id: 'c1',
    title: 'Paper contract',
    description: 'Legal',
    sourceType: 'contract',
    fileAssetId: lib.id,
  })
  const infl = buildCompanyKnowledgeDeckInfluence([linked], new Map([[lib.id, lib]]))
  assert.equal(infl.citedTraces.length, 1)
  assert.deepEqual(infl.memoryOnlyTitles, [])
}

// —— Ranked selection filter ——
{
  const ranked: RankedCompanyKnowledgeEntry[] = [
    {
      item: item({ id: 'a', title: 'A', description: 'a', sourceType: 'notes' }),
      score: 200,
      band: 'high',
      explanation: { approvedSource: true },
    },
    {
      item: item({ id: 'b', title: 'B', description: 'b', sourceType: 'notes' }),
      score: 120,
      band: 'medium',
      explanation: { approvedSource: true },
    },
  ]
  const filtered = filterRankedKnowledgeBySelection(ranked, ['b'])
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.item.id, 'b')
}

// —— Slide generation injects selected knowledge strings ——
{
  const k1 = item({
    id: 'k1',
    title: 'Acme win',
    description: '40% faster onboarding for Acme',
    sourceType: 'case-study',
  })
  const slides = createSlidesFromDeck(minimalDeck(), [], undefined, {
    items: [k1],
    workspaceFileAssets: [],
  })
  const execSlide = slides.find((s) => /executive/i.test(getSlideHeading(s))) ?? slides[2]
  const bullets = execSlide.blocks.find((b) => b.type === 'bullet-list')
  assert.ok(Array.isArray(bullets?.content))
  const flattened = JSON.stringify(bullets?.content)
  assert.ok(
    flattened.includes('Proof (Company Brain)'),
    'expected Proof (Company Brain) bullet from case study influence',
  )
  assert.ok(flattened.includes('Acme win'), 'expected knowledge title surfaced in bullets')
}

// —— Intel Brief rows (report pipeline input) mirror selections ——
{
  const rows = buildDeckReportCompanyBrainEntriesFromItems(
    [
      item({
        id: 'r1',
        title: 'Row one',
        description: 'x',
        sourceType: 'product-doc',
      }),
    ],
    new Map(),
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.backing, 'memory-only')
  assert.equal(rows[0]?.title, 'Row one')
  assert.ok(JSON.stringify(rows).includes('product-doc'))
}

function getSlideHeading(slide: Slide) {
  const titleBlock = slide.blocks.find((b) => b.type === 'title')
  return typeof titleBlock?.content === 'string' ? titleBlock.content : slide.title
}

// —— Brain Map deck influence: approved skill + linked knowledge traces only ——
{
  const lib = sampleLibraryAsset('linked-price-doc')
  const linked = item({
    id: 'know-price',
    title: 'Pilot pricing terms',
    description: 'Commercial guardrails',
    sourceType: 'proposal',
    fileAssetId: lib.id,
  })
  const proc = {
    id: 'proc-1',
    organizationId: 'org-1',
    title: 'Pilot workflow',
    description: 'Onboarding checkpoints',
    category: 'CS',
    steps: ['Kickoff', 'QA'],
    inputs: [],
    outputs: [],
    relatedKnowledgeItemIds: ['know-price'],
    relatedRoleTitles: [],
    approvalStatus: 'approved' as const,
    createdAt: '2026-05-05',
    updatedAt: '2026-05-05',
  }
  const skill = {
    id: 'skill-1',
    organizationId: 'org-1',
    title: 'Approved deck skill',
    description: '',
    skillType: 'sales-deck' as const,
    instructions: ['Lead with ROI proof before product detail'],
    requiredInputs: [],
    outputFormat: '',
    allowedSourceTypes: ['proposal'] as const,
    relatedProcessIds: [],
    relatedPolicyIds: [],
    relatedKnowledgeItemIds: ['know-price'],
    approvalStatus: 'approved' as const,
    createdAt: '2026-05-05',
    updatedAt: '2026-05-05',
  }
  const infl = buildBrainMapDeckInfluence([linked], new Map([[lib.id, lib]]), [proc], [], [skill])
  assert.ok(infl.linkedKnowledgeTraces.length >= 1, 'expected real traces from linked knowledge')
  assert.ok(
    infl.structureSectionHints.some((h) => h.includes('Approved deck skill')),
    'expected sales-deck skill to influence structure hints',
  )
  assert.ok(infl.processSpeakerNoteLines.some((line) => line.includes('Pilot workflow')))
}

console.info('companyBrainDeckPipeline OK')
