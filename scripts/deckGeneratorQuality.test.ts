import assert from 'node:assert/strict'
import { createSlidesFromDeck } from '../src/data/deckGenerator.ts'
import { OWNER_USER_ID } from '../src/data/sourceIngestion.ts'
import type { CompanyKnowledgeItem, Deck, FileAsset, Slide, SourceTrace } from '../src/types/models.ts'

function sampleTrace(fileId: string, fileName: string, snippet: string): SourceTrace {
  return {
    fileId,
    fileName,
    sourceType: 'uploaded-file',
    confidence: 0.92,
    extractedSnippet: snippet,
    addedByUserId: OWNER_USER_ID,
  }
}

function sampleAsset(id: string, name: string, snippet: string, status: 'pending' | 'approved' = 'approved'): FileAsset {
  return {
    id,
    deckId: 'deck-source',
    name,
    kind: 'pdf',
    status: 'parsed',
    uploadedByUserId: OWNER_USER_ID,
    uploadedByRole: 'owner',
    highlightForOwnerReview: false,
    sizeBytes: 1200,
    sizeLabel: '1.2 KB',
    summary: '',
    uploadedAt: '2026-05-06',
    extractedTextPreview: 'Preview',
    extractedMetadata: {},
    possibleAudience: '',
    possibleGoal: 'Improve conversion',
    possibleSections: [],
    possibleTone: '',
    sourceTrace: [sampleTrace(id, name, snippet)],
    sourceReview: { status },
  }
}

function baseDeck(presentationType: string): Deck {
  return {
    id: 'deck-quality',
    projectId: 'proj-quality',
    title: 'Quality deck',
    status: 'draft',
    updatedAt: '2026-05-06',
    slideIds: [],
    fileAssetIds: [],
    setup: {
      goal: 'Land agreement on pilot scope',
      audience: 'VP Operations',
      tone: 'Professional',
      presentationType,
      requiredSections: [],
      notes: '',
      webResearch: false,
      usePreviousDeckContext: false,
      shareSetupInputs: false,
      targetCompany: 'Northwind',
      buyerPersona: 'VP Operations',
      offeringSummary: 'Workflow automation platform',
      meetingGoal: 'Secure approval to launch pilot',
      knownPainPoints: ['Manual handoffs create delays'],
      desiredCta: 'Approve a 60-day pilot kickoff',
      citationReviewMode: 'permissive',
    },
    collaboration: {
      isShared: false,
      access: 'comment-only',
      allowCollaboratorUploads: false,
    },
  }
}

function item(overrides: Partial<CompanyKnowledgeItem> & Pick<CompanyKnowledgeItem, 'id' | 'title' | 'sourceType' | 'description'>): CompanyKnowledgeItem {
  return {
    id: overrides.id,
    organizationId: 'org-1',
    title: overrides.title,
    description: overrides.description,
    sourceType: overrides.sourceType,
    uploadedByUserId: OWNER_USER_ID,
    approvalStatus: 'approved',
    visibility: 'company',
    tags: [],
    createdAt: '2026-05-06',
    updatedAt: '2026-05-06',
    ...overrides,
  }
}

function agendaBullets(slides: Slide[]) {
  const agenda = slides.find((slide) => slide.title.toLowerCase() === 'agenda')
  const list = agenda?.blocks.find((block) => block.type === 'bullet-list')
  return Array.isArray(list?.content) ? list.content : []
}

{
  const accountSlides = createSlidesFromDeck(baseDeck('Account pitch deck'))
  const pilotSlides = createSlidesFromDeck(baseDeck('Pilot proposal deck'))
  assert.ok(
    agendaBullets(accountSlides).includes('Account context & priorities'),
    'account pitch outline should include account-specific context section',
  )
  assert.ok(
    agendaBullets(pilotSlides).includes('Pilot scope and timeline'),
    'pilot proposal outline should include pilot scope section',
  )
}

{
  const citedAsset = sampleAsset('asset-proof', 'proof.pdf', 'Customer reduced onboarding by 40%', 'approved')
  const knowledge = item({
    id: 'k-proof',
    title: 'Acme deployment win',
    description: 'Reduced onboarding time by 40% in 90 days',
    sourceType: 'case-study',
    fileAssetId: citedAsset.id,
  })
  const slides = createSlidesFromDeck(baseDeck('Sales proposal deck'), [citedAsset], undefined, {
    items: [knowledge],
    workspaceFileAssets: [],
  })
  const executive = slides.find((slide) => /executive summary/i.test(slide.title))
  const bullets = executive?.blocks.find((block) => block.type === 'bullet-list')
  assert.ok(
    JSON.stringify(bullets?.content).includes('Acme deployment win'),
    'selected Company Brain content should appear in generated narrative',
  )
}

{
  const strictDeck = baseDeck('Executive briefing deck')
  strictDeck.setup.citationReviewMode = 'strict-approved-only'
  const pendingAsset = sampleAsset('asset-pending', 'pending.pdf', 'This snippet should be filtered', 'pending')
  const slides = createSlidesFromDeck(strictDeck, [pendingAsset])
  const allTraces = slides.flatMap((slide) => [...slide.sourceTrace, ...slide.blocks.flatMap((block) => block.sourceTrace)])
  assert.ok(
    allTraces.every((trace) => trace.extractedSnippet !== 'This snippet should be filtered'),
    'strict citation mode should exclude unapproved snippets from slide traces',
  )
}

{
  const memoryOnlyKnowledge = item({
    id: 'k-memory',
    title: 'Field note only',
    description: 'Useful memory without linked file',
    sourceType: 'notes',
  })
  const slides = createSlidesFromDeck(baseDeck('Discovery follow-up deck'), [], undefined, {
    items: [memoryOnlyKnowledge],
    workspaceFileAssets: [],
  })
  const allTraces = slides.flatMap((slide) => [...slide.sourceTrace, ...slide.blocks.flatMap((block) => block.sourceTrace)])
  assert.equal(
    allTraces.filter((trace) => trace.sourceType === 'company-brain').length,
    0,
    'memory-only knowledge must not create company-brain SourceTrace citations',
  )
}

{
  const slides = createSlidesFromDeck(baseDeck('Sales proposal deck'), [], undefined, {
    approvedMessaging: [
      {
        id: 'msg-1',
        organizationId: 'org-1',
        title: 'pilot clarity',
        content: 'Lead with a low-risk pilot and measurable weekly scorecards.',
        category: 'CTA',
        tags: [],
        approvalStatus: 'approved',
        createdAt: '2026-05-06',
        updatedAt: '2026-05-06',
      },
    ],
    caseStudies: [
      {
        id: 'case-1',
        organizationId: 'org-1',
        title: 'MetroFlow gains',
        customerName: 'MetroFlow',
        industry: 'Home services',
        challenge: 'Missed after-hours calls',
        solution: 'AI intake and callback automation',
        outcome: '31-point callback completion gain',
        sourceKnowledgeItemIds: [],
        createdAt: '2026-05-06',
        updatedAt: '2026-05-06',
      },
    ],
    productsServices: [
      {
        id: 'svc-1',
        organizationId: 'org-1',
        name: 'Dispatcher Dashboard',
        description: 'Tracks callback queue health.',
        targetBuyer: 'Ops leader',
        keyBenefits: ['Faster triage'],
        proofPoints: [],
        commonObjections: [],
        createdAt: '2026-05-06',
        updatedAt: '2026-05-06',
      },
    ],
  })
  const flattened = JSON.stringify(slides.map((slide) => slide.blocks.map((block) => block.content)))
  assert.ok(flattened.includes('Approved messaging:'), 'approved messaging should influence summary wording')
  assert.ok(flattened.includes('Proof signal from case studies:'), 'case studies should influence proof bullets')
  assert.ok(
    flattened.includes('Solution signal from products/services:'),
    'products/services should influence solution bullets',
  )
  assert.ok(flattened.includes('Primary ask: Lead with a low-risk pilot'), 'CTA messaging should influence ask wording')
}

console.info('deckGeneratorQuality OK')
