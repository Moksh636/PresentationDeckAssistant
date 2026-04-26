import type {
  Deck,
  DeckVersion,
  FileAsset,
  Slide,
  SlideBlock,
  SlideBlockStyle,
  SourceTrace,
} from '../types/models'
import { createDeckInputTrace } from './sourceIngestion'
import { normalizeSlideBlock } from './slideLayout'
import { createId } from '../utils/ids'

interface DeckGenerationRequest {
  sourceDeck: Deck
  sourceFiles: FileAsset[]
  previousDeck?: Deck
}

interface DeckGenerationResult {
  generatedDeck: Deck
  generatedFiles: FileAsset[]
  generatedSlides: Slide[]
  generatedVersion: DeckVersion
}

function uniqueTraceKey(trace: SourceTrace) {
  return [
    trace.fileId,
    trace.fileName,
    trace.sourceType,
    trace.extractedSnippet,
    trace.addedByUserId,
  ].join('|')
}

function dedupeSourceTrace(traces: SourceTrace[]) {
  const seen = new Set<string>()

  return traces.filter((trace) => {
    const key = uniqueTraceKey(trace)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function buildBlock(
  type: SlideBlock['type'],
  content: SlideBlock['content'],
  style: SlideBlockStyle,
  sourceTrace: SourceTrace[],
  placeholder?: string,
): SlideBlock {
  return {
    id: createId(`block-${type}`),
    type,
    content,
    placeholder,
    style,
    sourceTrace: dedupeSourceTrace(sourceTrace),
  }
}

function buildSlide(
  deckId: string,
  index: number,
  title: string,
  notes: string,
  blocks: SlideBlock[],
  sourceTrace: SourceTrace[] = [],
): Slide {
  const normalizedBlocks = blocks.map((block, index) => normalizeSlideBlock(block, index))

  return {
    id: createId('slide'),
    deckId,
    index,
    title,
    notes,
    blocks: normalizedBlocks,
    sourceTrace: dedupeSourceTrace([
      ...sourceTrace,
      ...normalizedBlocks.flatMap((block) => block.sourceTrace),
    ]),
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function resolveSections(deck: Deck, fileAssets: FileAsset[]) {
  const deckSections = deck.setup.requiredSections.filter(Boolean)

  if (deckSections.length > 0) {
    return deckSections
  }

  const fileSections = [...new Set(fileAssets.flatMap((asset) => asset.possibleSections))]

  if (fileSections.length > 0) {
    return fileSections
  }

  return ['Context', 'Current state', 'Recommendation', 'Next steps']
}

function createToggleTrace(deck: Deck, previousDeck?: Deck) {
  const traces: SourceTrace[] = []

  if (deck.setup.webResearch) {
    traces.push(
      createDeckInputTrace(
        'Web research toggle',
        'Web research was enabled for this generation pipeline.',
        'web-research',
        0.6,
      ),
    )
  }

  if (deck.setup.usePreviousDeckContext) {
    traces.push(
      createDeckInputTrace(
        previousDeck?.title ?? 'Previous deck context',
        previousDeck
          ? `Context was carried forward from ${previousDeck.title}.`
          : 'Previous deck context toggle was enabled in the setup form.',
        'previous-deck',
        previousDeck ? 0.74 : 0.62,
      ),
    )
  }

  return traces
}

function cloneFileAssetsForDeck(fileAssets: FileAsset[], deckId: string, uploadedAt: string) {
  return fileAssets.map((asset) => {
    const nextFileId = createId('file')

    return {
      ...asset,
      id: nextFileId,
      deckId,
      uploadedAt,
      sourceTrace: asset.sourceTrace.map((trace) => ({
        ...trace,
        fileId: nextFileId,
        fileName: asset.name,
      })),
    }
  })
}

function summarizeFiles(fileAssets: FileAsset[]) {
  if (fileAssets.length === 0) {
    return 'No uploaded source materials were available, so the deck was generated purely from the setup brief.'
  }

  return fileAssets
    .slice(0, 3)
    .map((asset) => `${asset.name}: ${asset.extractedTextPreview}`)
    .join(' ')
}

function getExecutiveSummaryBullets(
  goal: string,
  audience: string,
  tone: string,
  fileAssets: FileAsset[],
  sections: string[],
) {
  const leadAsset = fileAssets[0]

  return [
    `Goal: ${goal}`,
    `Audience fit: tailor this narrative for ${audience}.`,
    `Tone: keep the story ${tone.toLowerCase()}.`,
    leadAsset
      ? `Primary source signal: ${leadAsset.name} suggests ${leadAsset.possibleGoal.toLowerCase()}.`
      : `Use the first ${Math.min(3, sections.length)} sections to establish narrative momentum quickly.`,
  ]
}

function getSectionSlideBody(
  section: string,
  index: number,
  audience: string,
  fileAssets: FileAsset[],
) {
  const relatedAsset = fileAssets[index % Math.max(fileAssets.length, 1)]

  if (relatedAsset) {
    return `${section} should connect the deck goal to ${relatedAsset.name} and frame the takeaway for ${audience}.`
  }

  return `${section} should move the audience from the stated goal toward a concrete recommendation.`
}

function createChartSuggestion(fileAssets: FileAsset[], goal: string) {
  const sheetAsset = fileAssets.find((asset) => asset.kind === 'sheet')

  if (sheetAsset) {
    return {
      title: 'Suggested chart direction',
      body: `Use ${sheetAsset.name} for a trend or comparison chart that supports the goal: ${goal}`,
      trace: sheetAsset.sourceTrace,
    }
  }

  return {
    title: 'Suggested chart direction',
    body: 'Add a KPI trend, category comparison, or before/after chart once structured metrics are available.',
    trace: [
      createDeckInputTrace(
        'Chart placeholder',
        'This chart suggestion is a generation placeholder until quantitative sources are attached.',
        'generated-summary',
        0.57,
      ),
    ],
  }
}

function createVisualPlaceholder(fileAssets: FileAsset[], sections: string[]) {
  const visualAsset = fileAssets.find((asset) => asset.kind === 'image') ?? fileAssets[0]

  if (visualAsset) {
    return {
      title: 'Visual placeholder',
      body: `Reserve this slide for a hero image, screenshot, or artifact from ${visualAsset.name}.`,
      trace: visualAsset.sourceTrace,
    }
  }

  return {
    title: 'Visual placeholder',
    body: `Add a screenshot, diagram, or visual artifact that reinforces the section "${sections[0]}".`,
    trace: [
      createDeckInputTrace(
        'Visual placeholder',
        'No uploaded image source was available, so a generic visual placeholder was inserted.',
        'generated-summary',
        0.56,
      ),
    ],
  }
}

function createGeneratedSlides(
  deck: Deck,
  fileAssets: FileAsset[],
  previousDeck?: Deck,
) {
  const sections = resolveSections(deck, fileAssets)
  const goal =
    deck.setup.goal || 'Align the audience on the core recommendation and why it matters now.'
  const audience = deck.setup.audience || 'internal stakeholders'
  const tone = deck.setup.tone || 'clear and professional'
  const notes = deck.setup.notes || 'No additional context provided.'
  const toggleTrace = createToggleTrace(deck, previousDeck)
  const fileTrace = dedupeSourceTrace(fileAssets.flatMap((asset) => asset.sourceTrace))
  const titleTrace = createDeckInputTrace(
    'Presentation title',
    deck.title || 'Untitled presentation',
    'deck-input',
    0.99,
  )
  const goalTrace = createDeckInputTrace('Presentation goal', goal, 'deck-input', 0.97)
  const audienceTrace = createDeckInputTrace('Audience', audience, 'deck-input', 0.94)
  const toneTrace = createDeckInputTrace('Tone and style', tone, 'deck-input', 0.93)
  const typeTrace = createDeckInputTrace(
    'Presentation type',
    deck.setup.presentationType,
    'deck-input',
    0.92,
  )
  const sectionsTrace = createDeckInputTrace(
    'Required sections',
    sections.join(', '),
    'deck-input',
    0.95,
  )
  const notesTrace = createDeckInputTrace('Notes and context', notes, 'deck-input', 0.88)
  const executiveBullets = getExecutiveSummaryBullets(
    goal,
    audience,
    tone,
    fileAssets,
    sections,
  )
  const visualPlaceholder = createVisualPlaceholder(fileAssets, sections)
  const chartSuggestion = createChartSuggestion(fileAssets, goal)

  const slides: Slide[] = []

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      deck.title || 'Untitled presentation',
      'Open with the promise of the presentation and orient the audience quickly.',
      [
        buildBlock('eyebrow', deck.setup.presentationType || 'Generated draft', { align: 'left', fontSize: 'sm' }, [typeTrace]),
        buildBlock('title', deck.title || 'Untitled presentation', { align: 'left', fontSize: 'xl', bold: true }, [titleTrace]),
        buildBlock('body', goal, { align: 'left', fontSize: 'md' }, [goalTrace, audienceTrace]),
        buildBlock(
          'stat',
          `${sections.length} planned sections`,
          { align: 'left', fontSize: 'lg', bold: true },
          [sectionsTrace],
          'Slide count marker',
        ),
      ],
      [titleTrace, goalTrace, ...toggleTrace, ...fileTrace.slice(0, 2)],
    ),
  )

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      'Agenda',
      'This slide should set the narrative order before details begin.',
      [
        buildBlock('title', 'Agenda', { align: 'left', fontSize: 'lg', bold: true }, [sectionsTrace]),
        buildBlock('bullet-list', sections, { align: 'left', fontSize: 'md' }, [sectionsTrace]),
        buildBlock(
          'body',
          `Audience: ${audience}. Tone: ${tone}.`,
          { align: 'left', fontSize: 'md' },
          [audienceTrace, toneTrace],
        ),
      ],
      [sectionsTrace, audienceTrace, toneTrace, ...toggleTrace],
    ),
  )

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      'Executive summary',
      'Condense the main case into a few fast, decision-ready points.',
      [
        buildBlock('title', 'Executive summary', { align: 'left', fontSize: 'lg', bold: true }, [goalTrace]),
        buildBlock('bullet-list', executiveBullets, { align: 'left', fontSize: 'md' }, [goalTrace, audienceTrace, toneTrace, ...fileTrace.slice(0, 2)]),
        buildBlock(
          'quote',
          summarizeFiles(fileAssets),
          { align: 'left', fontSize: 'md', italic: true },
          [...fileTrace.slice(0, 3), ...toggleTrace],
        ),
      ],
      [goalTrace, audienceTrace, toneTrace, ...fileTrace.slice(0, 3), ...toggleTrace],
    ),
  )

  sections.forEach((section, index) => {
    const relatedAsset = fileAssets[index % Math.max(fileAssets.length, 1)]
    const sectionTrace = createDeckInputTrace(
      `Section ${index + 1}`,
      section,
      'deck-input',
      0.9,
    )
    const relatedTrace = relatedAsset?.sourceTrace ?? []

    slides.push(
      buildSlide(
        deck.id,
        slides.length + 1,
        section,
        'Use this as a flexible content slide for the core evidence and argument.',
        [
          buildBlock('eyebrow', `Section ${index + 1}`, { align: 'left', fontSize: 'sm' }, [sectionTrace]),
          buildBlock('title', section, { align: 'left', fontSize: 'lg', bold: true }, [sectionTrace]),
          buildBlock(
            'body',
            getSectionSlideBody(section, index, audience, fileAssets),
            { align: 'left', fontSize: 'md' },
            [goalTrace, audienceTrace, sectionTrace, ...relatedTrace],
          ),
          buildBlock(
            'bullet-list',
            [
              `Anchor the slide to the goal: ${goal}`,
              `Keep the tone ${tone.toLowerCase()}.`,
              relatedAsset
                ? `Pull supporting evidence from ${relatedAsset.name}.`
                : 'Add the strongest supporting evidence available.',
            ],
            { align: 'left', fontSize: 'md' },
            [goalTrace, toneTrace, ...relatedTrace],
          ),
        ],
        [sectionTrace, goalTrace, toneTrace, ...relatedTrace, ...toggleTrace],
      ),
    )
  })

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      visualPlaceholder.title,
      'Reserve a visual beat so the deck does not become all text.',
      [
        buildBlock('title', visualPlaceholder.title, { align: 'left', fontSize: 'lg', bold: true }, visualPlaceholder.trace),
        buildBlock(
          'visual-placeholder',
          visualPlaceholder.body,
          { align: 'left', fontSize: 'md' },
          visualPlaceholder.trace,
          'Describe the visual to add here',
        ),
        buildBlock(
          'body',
          'Use this space for screenshots, diagrams, product imagery, or source artifacts.',
          { align: 'left', fontSize: 'md' },
          [...visualPlaceholder.trace, ...toggleTrace],
        ),
      ],
      [...visualPlaceholder.trace, ...toggleTrace],
    ),
  )

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      chartSuggestion.title,
      'Keep the chart slot editable so a real chart can replace this placeholder later.',
      [
        buildBlock('title', chartSuggestion.title, { align: 'left', fontSize: 'lg', bold: true }, chartSuggestion.trace),
        buildBlock(
          'chart-placeholder',
          chartSuggestion.body,
          { align: 'left', fontSize: 'md' },
          chartSuggestion.trace,
          'Describe the chart to add here',
        ),
        buildBlock(
          'body',
          deck.setup.webResearch
            ? 'If web research stays enabled, validate this chart with external benchmarks before export.'
            : 'Swap this placeholder with a chart once verified metrics are attached.',
          { align: 'left', fontSize: 'md' },
          [...chartSuggestion.trace, ...toggleTrace],
        ),
      ],
      [...chartSuggestion.trace, ...toggleTrace],
    ),
  )

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      'Next steps',
      'Close with clear ownership, timing, and the decision requested from the audience.',
      [
        buildBlock('title', 'Next steps', { align: 'left', fontSize: 'lg', bold: true }, [notesTrace]),
        buildBlock(
          'bullet-list',
          [
            'Confirm the primary recommendation and owner.',
            'Replace placeholders with validated evidence and visuals.',
            'Refine the story for the target audience before sharing.',
          ],
          { align: 'left', fontSize: 'md' },
          [notesTrace, ...toggleTrace],
        ),
        buildBlock(
          'body',
          notes,
          { align: 'left', fontSize: 'md' },
          [notesTrace, ...fileTrace.slice(0, 1), ...toggleTrace],
        ),
      ],
      [notesTrace, ...toggleTrace, ...fileTrace.slice(0, 1)],
    ),
  )

  return slides
}

export async function runMockDeckGenerationPipeline({
  sourceDeck,
  sourceFiles,
  previousDeck,
}: DeckGenerationRequest): Promise<DeckGenerationResult> {
  const generatedAt = new Date().toISOString()
  const generatedDeckId = createId('deck')
  const generatedVersionId = createId('version')
  const generatedFiles = cloneFileAssetsForDeck(sourceFiles, generatedDeckId, generatedAt)
  const generatedDeck: Deck = {
    ...sourceDeck,
    id: generatedDeckId,
    title: sourceDeck.title || 'Untitled presentation',
    updatedAt: generatedAt,
    slideIds: [],
    fileAssetIds: generatedFiles.map((asset) => asset.id),
    activeVersionId: generatedVersionId,
    status: 'ready',
  }
  const generatedSlides = createGeneratedSlides(generatedDeck, generatedFiles, previousDeck).map(
    (slide) => ({
      ...slide,
      deckId: generatedDeckId,
    }),
  )
  const generatedVersion: DeckVersion = {
    id: generatedVersionId,
    deckId: generatedDeckId,
    label: 'Generated draft',
    summary: 'Initial structured deck generated from setup inputs and source materials.',
    createdAt: generatedAt,
    parentVersionId: sourceDeck.activeVersionId,
    sourceDeckId: sourceDeck.id,
    slideSnapshot: generatedSlides,
  }

  await delay(450)

  return {
    generatedDeck: {
      ...generatedDeck,
      slideIds: generatedSlides.map((slide) => slide.id),
    },
    generatedFiles,
    generatedSlides,
    generatedVersion,
  }
}

export function createSlidesFromDeck(deck: Deck, fileAssets: FileAsset[] = []): Slide[] {
  return createGeneratedSlides(deck, fileAssets)
}

export function createAlternateSlides(deck: Deck, currentSlides: Slide[]) {
  const clonedSlides = JSON.parse(JSON.stringify(currentSlides)) as Slide[]

  return clonedSlides.map((slide, slideIndex) => ({
    ...slide,
    id: createId('slide'),
    deckId: deck.id,
    title: slideIndex === 0 ? `Alternate framing` : slide.title,
    blocks: slide.blocks.map((block, blockIndex) => {
      const nextContent =
        slideIndex === 0 && block.type === 'title' && typeof block.content === 'string'
          ? `Alternate framing: ${deck.title}`
          : slideIndex === 0 && blockIndex === 2 && typeof block.content === 'string'
            ? `Shift the opening toward strategic outcomes for ${deck.setup.audience || 'this audience'}.`
            : block.content

      return {
        ...block,
        id: createId(`block-${block.type}`),
        content: nextContent,
      }
    }),
  }))
}
