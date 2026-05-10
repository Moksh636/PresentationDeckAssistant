import assert from 'node:assert/strict'
import {
  BUILTIN_THEME_PROFILES,
  applyThemeToSlideBlocks,
  buildSlideTransitions,
  chooseThemeProfile,
  getBuiltinThemeProfile,
  inferLayoutIntent,
  inferSlideRole,
  resolveDeckTheme,
  runDeckDesignEngine,
} from '../src/data/deckDesignEngine.ts'
import { scoreGeneratedDeckDesign } from '../src/data/deckDesignQuality.ts'
import { createSlidesFromDeck } from '../src/data/deckGenerator.ts'
import { OWNER_USER_ID } from '../src/data/sourceIngestion.ts'
import type {
  CompanyBrandKit,
  CompanyKnowledgeItem,
  Deck,
  Slide,
  SlideBlock,
  SlideDesignIntent,
} from '../src/types/models.ts'

function baseDeck(presentationType: string, overrides: Partial<Deck['setup']> = {}): Deck {
  return {
    id: 'deck-design-engine',
    projectId: 'proj-design',
    title: 'Design engine deck',
    status: 'draft',
    updatedAt: '2026-05-10',
    slideIds: [],
    fileAssetIds: [],
    setup: {
      goal: 'Win agreement on the proposed plan',
      audience: 'Internal stakeholders',
      tone: 'Professional',
      presentationType,
      requiredSections: [],
      notes: '',
      webResearch: false,
      usePreviousDeckContext: false,
      shareSetupInputs: false,
      ...overrides,
    },
    collaboration: {
      isShared: false,
      access: 'comment-only',
      allowCollaboratorUploads: false,
    },
  }
}

// — Theme choice for executive briefing —
{
  const direction = chooseThemeProfile({
    deckSetup: baseDeck('Executive briefing deck', {
      audience: 'CFO and board',
      buyerPersona: 'Chief Financial Officer',
    }).setup,
  })
  const theme = getBuiltinThemeProfile(direction.themeProfileId)
  assert.ok(
    ['premium', 'executive'].includes(theme.mood),
    `executive deck should pick premium or executive mood, got ${theme.mood}`,
  )
  assert.ok(direction.confidence >= 0.7, `executive theme confidence should be >= 0.7, got ${direction.confidence}`)
}

// — Brand kit overrides colors / fonts —
{
  const direction = chooseThemeProfile({ deckSetup: baseDeck('Sales proposal deck').setup })
  const brandKit: CompanyBrandKit = {
    id: 'bk-merge',
    organizationId: 'org-1',
    primaryColor: '#112233',
    secondaryColor: '#445566',
    accentColor: '#ff00aa',
    fontFamily: 'Georgia',
    defaultDeckTone: 'Bold',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }
  const theme = resolveDeckTheme({ visualDirection: direction, brandKit })
  assert.equal(theme.primaryColor, '#112233')
  assert.equal(theme.secondaryColor, '#445566')
  assert.equal(theme.accentColor, '#ff00aa')
  assert.equal(theme.fontFamily, 'Georgia')
  assert.equal(theme.headingFontFamily, 'Georgia')

  const noBrandTheme = resolveDeckTheme({ visualDirection: direction })
  assert.equal(noBrandTheme.id, direction.themeProfileId)
  assert.notEqual(noBrandTheme.primaryColor, '#112233')
}

// — Deck type affects layout intents —
{
  const proposalSlides = createSlidesFromDeck(baseDeck('Sales proposal deck'))
  const briefingSlides = createSlidesFromDeck(baseDeck('Executive briefing deck'))

  const proposalLayouts = new Set(
    proposalSlides.map((slide) => slide.designIntent?.layoutIntent).filter(Boolean),
  )
  const briefingLayouts = new Set(
    briefingSlides.map((slide) => slide.designIntent?.layoutIntent).filter(Boolean),
  )

  assert.ok(proposalLayouts.has('title-hero'), 'proposal deck should include title-hero layout')
  assert.ok(proposalLayouts.has('agenda-bullets'), 'proposal deck should include agenda-bullets layout')
  assert.ok(briefingLayouts.has('title-hero'), 'briefing deck should include title-hero layout')

  const proposalTitle = proposalSlides.find((slide) => slide.designIntent?.role === 'title')
  const proposalAgenda = proposalSlides.find((slide) => slide.designIntent?.role === 'agenda')
  assert.equal(proposalTitle?.designIntent?.layoutIntent, 'title-hero')
  assert.equal(proposalAgenda?.designIntent?.layoutIntent, 'agenda-bullets')
}

// — Transitions reflect major role boundaries —
{
  const slides = createSlidesFromDeck(baseDeck('Sales proposal deck', { desiredCta: 'Approve pilot' }))
  const transitions = slides.map((slide) => slide.designIntent?.transitionIn?.type)

  assert.equal(
    slides[0]?.designIntent?.transitionIn?.type,
    'section-break',
    'first slide should use section-break transition',
  )
  const last = slides[slides.length - 1]
  assert.equal(
    last?.designIntent?.transitionIn?.type,
    'zoom',
    'final CTA / next-step slide should use zoom transition',
  )
  assert.ok(
    transitions.every((type) =>
      type === undefined ||
      ['none', 'fade', 'push', 'reveal', 'zoom', 'section-break'].includes(type),
    ),
    'all transitions should be from the approved set',
  )
}

// — Memory-only company knowledge does not create fake citations —
{
  const memoryOnly: CompanyKnowledgeItem = {
    id: 'k-memory',
    organizationId: 'org-1',
    title: 'Field note only',
    description: 'Useful memory without linked file',
    sourceType: 'notes',
    uploadedByUserId: OWNER_USER_ID,
    approvalStatus: 'approved',
    visibility: 'company',
    tags: [],
    createdAt: '2026-05-06',
    updatedAt: '2026-05-06',
  }
  const slides = createSlidesFromDeck(baseDeck('Discovery follow-up deck'), [], undefined, {
    items: [memoryOnly],
    workspaceFileAssets: [],
  })
  const allTraces = slides.flatMap((slide) => [
    ...slide.sourceTrace,
    ...slide.blocks.flatMap((block) => block.sourceTrace),
  ])
  assert.equal(
    allTraces.filter((trace) => trace.sourceType === 'company-brain').length,
    0,
    'memory-only knowledge must not yield company-brain source traces',
  )
}

// — Slides remain editable blocks (engine does not strip structure) —
{
  const slides = createSlidesFromDeck(baseDeck('Sales proposal deck'))
  for (const slide of slides) {
    assert.ok(Array.isArray(slide.blocks), 'slide blocks must be an array')
    assert.ok(slide.blocks.length > 0, 'slide should have at least one block')
    for (const block of slide.blocks) {
      assert.ok(typeof block.id === 'string' && block.id.length > 0, 'block must keep its id')
      assert.ok(block.style, 'block must keep its base style')
      assert.ok('content' in block, 'block must keep its content')
    }
    assert.ok(slide.designIntent, 'each slide should carry a designIntent')
    assert.ok(slide.designIntent?.transitionIn, 'design intent should include a transitionIn')
  }
}

// — applyThemeToSlideBlocks preserves existing colors —
{
  const direction = chooseThemeProfile({ deckSetup: baseDeck('Sales proposal deck').setup })
  const theme = resolveDeckTheme({ visualDirection: direction })
  const slide: Slide = {
    id: 'slide-existing',
    deckId: 'deck-existing',
    index: 1,
    title: 'Sample',
    notes: '',
    sourceTrace: [],
    blocks: [
      {
        id: 'block-existing',
        type: 'title',
        content: 'Existing title',
        style: { align: 'left', fontSize: 'lg', bold: true },
        textStyle: {
          fontFamily: 'Inter',
          fontSizePx: 32,
          bold: true,
          italic: false,
          underline: false,
          alignment: 'left',
          color: '#ABCDEF',
          listStyle: 'none',
          lineHeight: 1.2,
          verticalAlign: 'top',
        },
        sourceTrace: [],
      } satisfies SlideBlock,
    ],
  }
  const intent: SlideDesignIntent = {
    slideId: slide.id,
    role: 'title',
    layoutIntent: 'title-hero',
    visualPriority: 'text',
  }
  const themed = applyThemeToSlideBlocks(slide, theme, intent)
  assert.equal(
    themed.blocks[0]?.textStyle?.color,
    '#ABCDEF',
    'existing block color must not be overridden by the engine',
  )
}

// — runDeckDesignEngine attaches design intents and uses the chosen theme —
{
  const slides = createSlidesFromDeck(baseDeck('Sales proposal deck'))
  const engineResult = runDeckDesignEngine({
    slides: slides.map((slide) => ({ ...slide, designIntent: undefined })),
    deckSetup: baseDeck('Sales proposal deck').setup,
  })
  assert.equal(engineResult.designIntents.length, slides.length)
  assert.equal(engineResult.slides.every((slide) => !!slide.designIntent), true)
  assert.ok(BUILTIN_THEME_PROFILES.some((profile) => profile.id === engineResult.theme.id))
}

// — Quality checker flags overcrowded / over-bulleted slides —
{
  const deck = baseDeck('Sales proposal deck')
  const overcrowdedSlide: Slide = {
    id: 'slide-overcrowded',
    deckId: deck.id,
    index: 1,
    title: 'Overcrowded',
    notes: '',
    sourceTrace: [],
    blocks: [
      {
        id: 'block-bullets',
        type: 'bullet-list',
        content: Array.from({ length: 12 }, (_, idx) => `Bullet ${idx + 1}`),
        style: { align: 'left', fontSize: 'md' },
        sourceTrace: [],
      } as SlideBlock,
    ],
  }
  const report = scoreGeneratedDeckDesign(deck, [overcrowdedSlide])
  assert.equal(report.overall, 'warn')
  assert.ok(report.findings.some((finding) => finding.code === 'too-many-bullets'))
  assert.ok(report.score < 100)
}

// — Role inference and layout intent strings cover canonical sales roles —
{
  const fakeSlide = (title: string): Slide => ({
    id: `slide-${title}`,
    deckId: 'deck',
    index: 1,
    title,
    notes: '',
    sourceTrace: [],
    blocks: [],
  })

  assert.equal(inferSlideRole(fakeSlide('Agenda'), 1, 5), 'agenda')
  assert.equal(inferSlideRole(fakeSlide('Why now'), 2, 5), 'problem')
  assert.equal(inferSlideRole(fakeSlide('Proof and differentiation'), 3, 5), 'proof')
  assert.equal(inferSlideRole(fakeSlide('Recommended next step'), 4, 5), 'next-step')
  assert.equal(inferLayoutIntent('case-study', fakeSlide('Customer story')), 'case-study-spotlight')
  assert.equal(inferLayoutIntent('section-divider', fakeSlide('Section')), 'section-divider')
}

// — buildSlideTransitions inserts reveal between problem → solution —
{
  const intents: SlideDesignIntent[] = [
    { slideId: 's1', role: 'title', layoutIntent: 'title-hero', visualPriority: 'text' },
    { slideId: 's2', role: 'problem', layoutIntent: 'problem-evidence', visualPriority: 'text' },
    { slideId: 's3', role: 'solution', layoutIntent: 'solution-overview', visualPriority: 'text' },
    { slideId: 's4', role: 'proof', layoutIntent: 'proof-grid', visualPriority: 'proof' },
    { slideId: 's5', role: 'proposal', layoutIntent: 'proposal-commercial', visualPriority: 'text' },
    { slideId: 's6', role: 'next-step', layoutIntent: 'cta-decision', visualPriority: 'text' },
  ]
  const built = buildSlideTransitions(intents)
  assert.equal(built[0]?.transitionIn?.type, 'section-break')
  assert.equal(built[2]?.transitionIn?.type, 'reveal', 'problem → solution should reveal')
  assert.equal(built[4]?.transitionIn?.type, 'push', 'proof → proposal should push')
  assert.equal(built[5]?.transitionIn?.type, 'zoom', 'next-step should zoom')
}

console.info('deckDesignEngine OK')
