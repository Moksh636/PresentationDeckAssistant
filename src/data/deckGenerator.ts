import type {
  CompanyKnowledgeItem,
  Deck,
  DeckSetup,
  DeckVersion,
  FileAsset,
  Slide,
  SlideBlock,
  SlideBlockLayout,
  SlideBlockStyle,
  SlideBlockVisualStyle,
  SlideImageAsset,
  SlideTextStyle,
  SourceTrace,
} from '../types/models.ts'
import type { DeckBrandGenerationContext } from './brandKitResolve.ts'
import { buildCompanyKnowledgeDeckInfluence, mergeAssetsForKnowledgeTraceLookup } from './companyBrainDeckPipeline.ts'
import { createDeckInputTrace } from './sourceIngestion.ts'
import { normalizeSlideBlock } from './slideLayout.ts'
import { filterAssetSourceTraces, resolveCitationReviewMode } from './sourceCitationReview.ts'
import { createId } from '../utils/ids.ts'

interface DeckGenerationRequest {
  sourceDeck: Deck
  sourceFiles: FileAsset[]
  previousDeck?: Deck
  /** When set, mock slides pick up Company Brain colors, fonts, and optional logo. */
  brand?: DeckBrandGenerationContext
  /** Company Brain rows selected on the pitch setup (local/mock deck builder). */
  companyKnowledgeItems?: CompanyKnowledgeItem[]
  /** Needed to resolve `fileAssetId` on knowledge rows that point at workspace library uploads. */
  workspaceFileAssets?: FileAsset[]
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
  extras?: {
    textStyle?: Partial<SlideTextStyle>
    visualStyle?: SlideBlockVisualStyle
    imageAsset?: SlideImageAsset
    layout?: SlideBlockLayout
  },
): SlideBlock {
  const block: SlideBlock = {
    id: createId(`block-${type}`),
    type,
    content,
    placeholder,
    style,
    sourceTrace: dedupeSourceTrace(sourceTrace),
  }

  if (extras?.textStyle) {
    block.textStyle = extras.textStyle as SlideTextStyle
  }

  if (extras?.visualStyle) {
    block.visualStyle = extras.visualStyle
  }

  if (extras?.imageAsset) {
    block.imageAsset = extras.imageAsset
  }

  if (extras?.layout) {
    block.layout = extras.layout
  }

  return block
}

function buildSlide(
  deckId: string,
  index: number,
  title: string,
  notes: string,
  blocks: SlideBlock[],
  sourceTrace: SourceTrace[] = [],
  options?: { memoryOnlySources?: string[] },
): Slide {
  const normalizedBlocks = blocks.map((block, index) => normalizeSlideBlock(block, index))
  const mergedTrace = dedupeSourceTrace([...sourceTrace, ...normalizedBlocks.flatMap((block) => block.sourceTrace)])
  const uploadedCitations = dedupeSourceTrace(mergedTrace.filter((trace) => trace.sourceType === 'uploaded-file'))
  const companyKnowledgeCitations = dedupeSourceTrace(
    mergedTrace.filter((trace) => trace.sourceType === 'company-brain'),
  )
  const memoryOnlySources = (options?.memoryOnlySources ?? []).filter(Boolean)
  const generatedInference = dedupeSourceTrace(
    mergedTrace.filter((trace) => trace.sourceType === 'generated-summary'),
  )
  const sourceNotes: string[] = []

  if (uploadedCitations.length > 0 || companyKnowledgeCitations.length > 0 || memoryOnlySources.length > 0) {
    sourceNotes.push('Sources used')
  }
  if (uploadedCitations.length > 0) {
    sourceNotes.push(
      `- Citation-backed sources: ${uploadedCitations
        .map((trace) => trace.fileName)
        .filter((name, idx, arr) => arr.indexOf(name) === idx)
        .join('; ')}`,
    )
  }
  if (companyKnowledgeCitations.length > 0) {
    sourceNotes.push(
      `- Company knowledge sources: ${companyKnowledgeCitations
        .map((trace) => trace.fileName)
        .filter((name, idx, arr) => arr.indexOf(name) === idx)
        .join('; ')}`,
    )
  }
  if (memoryOnlySources.length > 0) {
    sourceNotes.push(`- Memory-only sources: ${memoryOnlySources.join('; ')}`)
  }
  if (generatedInference.length > 0) {
    sourceNotes.push(
      `- Generated inference: ${generatedInference
        .map((trace) => trace.fileName)
        .filter((name, idx, arr) => arr.indexOf(name) === idx)
        .join('; ')}`,
    )
  }
  const finalNotes = [notes.trim(), sourceNotes.join('\n')].filter(Boolean).join('\n\n')

  return {
    id: createId('slide'),
    deckId,
    index,
    title,
    notes: finalNotes,
    blocks: normalizedBlocks,
    sourceTrace: mergedTrace,
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

  const byType: Record<string, string[]> = {
    'Account pitch deck': [
      'Account context & priorities',
      'Why now',
      'Proof from similar accounts',
      'Recommended account plan',
      'Decision & next step',
    ],
    'Discovery follow-up deck': [
      'Discovery recap',
      'Confirmed pain points',
      'Why now',
      'Solution fit',
      'Next step alignment',
    ],
    'Sales proposal deck': [
      'Buyer goals and success criteria',
      'Why now',
      'Proposed solution',
      'Proof and differentiation',
      'Commercial proposal',
      'Decision & next step',
    ],
    'Pilot proposal deck': [
      'Pilot objectives',
      'Why now',
      'Pilot scope and timeline',
      'Success metrics',
      'Risk and mitigation',
      'Pilot kickoff decision',
    ],
    'Executive briefing deck': [
      'Executive context',
      'Why now',
      'Strategic options',
      'Recommendation',
      'Decision and owner',
    ],
    'Renewal / expansion deck': [
      'Current value delivered',
      'Why now for renewal/expansion',
      'Expansion opportunities',
      'Commercial path',
      'Decision and next step',
    ],
    'Sponsor pitch deck': [
      'Sponsor vision fit',
      'Why now',
      'Business case',
      'Proof and credibility',
      'Sponsor ask',
    ],
    'Partnership pitch deck': [
      'Partnership thesis',
      'Why now',
      'Mutual value model',
      'Proof and readiness',
      'Partnership next step',
    ],
    'Client status / account review deck': [
      'Account status snapshot',
      'Progress and outcomes',
      'Risks and blockers',
      'Why now',
      'Recommended actions',
      'Next review checkpoint',
    ],
    'Custom deck': ['Context', 'Why now', 'Proof', 'Recommendation', 'Next steps'],
  }
  const typed = byType[deck.setup.presentationType]
  if (typed && typed.length > 0) {
    return typed
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

function traceApprovalKey(trace: SourceTrace) {
  return `${trace.fileId}::${trace.extractedSnippet}::${trace.addedByUserId}`
}

function collectCitationEligibleTraceKeys(fileAssets: FileAsset[], setup: DeckSetup) {
  const mode = resolveCitationReviewMode(setup)
  const keys = new Set<string>()
  for (const asset of fileAssets) {
    for (const trace of filterAssetSourceTraces(asset, mode)) {
      keys.add(traceApprovalKey(trace))
    }
  }
  return keys
}

function collectCitationFilteredFileTraces(fileAssets: FileAsset[], setup: DeckSetup) {
  const mode = resolveCitationReviewMode(setup)
  return dedupeSourceTrace(fileAssets.flatMap((asset) => filterAssetSourceTraces(asset, mode)))
}

function getExecutiveSummaryBullets(
  setup: DeckSetup,
  fileAssets: FileAsset[],
  sections: string[],
) {
  const goal = setup.goal || 'Align stakeholders on the recommendation.'
  const audience = setup.buyerPersona || setup.audience || 'internal stakeholders'
  const tone = setup.tone || 'clear and professional'
  const company = setup.targetCompany?.trim()
  const offering = setup.offeringSummary?.trim()
  const meetingGoal = setup.meetingGoal?.trim()
  const desiredCta = setup.desiredCta?.trim()
  const pains = (setup.knownPainPoints ?? []).filter(Boolean)
  const leadAsset = fileAssets[0]

  return [
    company ? `Account focus: ${company}` : `Goal: ${goal}`,
    offering ? `Offer framing: ${offering}` : `Meeting objective: ${goal}`,
    `Buyer lens: tailor this narrative for ${audience}.`,
    meetingGoal ? `Meeting goal: ${meetingGoal}` : `Tone: keep the story ${tone.toLowerCase()}.`,
    pains[0] ? `Primary pain to resolve: ${pains[0]}` : `Lead with a concrete business pain before features.`,
    desiredCta ? `Recommended ask: ${desiredCta}` : `Close with a specific decision ask and owner.`,
    leadAsset
      ? `Primary source signal: ${leadAsset.name} suggests ${leadAsset.possibleGoal.toLowerCase() || 'account urgency'}.`
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

function createChartSuggestion(fileAssets: FileAsset[], goal: string, setup: DeckSetup) {
  const sheetAsset = fileAssets.find((asset) => asset.kind === 'sheet')
  const mode = resolveCitationReviewMode(setup)

  if (sheetAsset) {
    return {
      title: 'Suggested chart direction',
      body: `Use ${sheetAsset.name} for a trend or comparison chart that supports the goal: ${goal}`,
      trace: filterAssetSourceTraces(sheetAsset, mode),
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

function createVisualPlaceholder(fileAssets: FileAsset[], sections: string[], setup: DeckSetup) {
  const visualAsset = fileAssets.find((asset) => asset.kind === 'image') ?? fileAssets[0]
  const mode = resolveCitationReviewMode(setup)

  if (visualAsset) {
    return {
      title: 'Visual placeholder',
      body: `Reserve this slide for a hero image, screenshot, or artifact from ${visualAsset.name}.`,
      trace: filterAssetSourceTraces(visualAsset, mode),
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

function placeholderVisualBrand(brand: DeckBrandGenerationContext): SlideBlockVisualStyle {
  return {
    fillColor: brand.kit.primaryColor,
    borderColor: brand.kit.accentColor,
    borderWidthPx: 1,
    opacity: 0.08,
  }
}

function createGeneratedSlides(
  deck: Deck,
  fileAssets: FileAsset[],
  previousDeck?: Deck,
  brand?: DeckBrandGenerationContext,
  companyBrain?: { items: CompanyKnowledgeItem[]; workspaceFileAssets?: FileAsset[] },
) {
  const sections = resolveSections(deck, fileAssets)
  const assetIndexForBrain = mergeAssetsForKnowledgeTraceLookup(
    fileAssets,
    companyBrain?.workspaceFileAssets ?? [],
  )
  const brainInfluence =
    companyBrain?.items && companyBrain.items.length > 0
      ? buildCompanyKnowledgeDeckInfluence(companyBrain.items, assetIndexForBrain)
      : undefined

  const brandText = (partial: Partial<SlideTextStyle>): Partial<SlideTextStyle> | undefined => {
    if (!brand) {
      return undefined
    }

    return {
      fontFamily: brand.kit.fontFamily,
      ...partial,
    }
  }

  const goal =
    deck.setup.goal || 'Align the audience on the core recommendation and why it matters now.'
  const audience = deck.setup.audience || 'internal stakeholders'
  const tone = deck.setup.tone || 'clear and professional'
  const notes = deck.setup.notes || 'No additional context provided.'
  const toggleTrace = createToggleTrace(deck, previousDeck)
  const fileTrace = collectCitationFilteredFileTraces(fileAssets, deck.setup)
  const citationEligibleKeys = collectCitationEligibleTraceKeys(fileAssets, deck.setup)
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
  let executiveBullets = getExecutiveSummaryBullets(deck.setup, fileAssets, sections)
  if (brainInfluence) {
    const extraBrainBullets = [
      ...brainInfluence.proofLines.slice(0, 2).map((line) => `Proof (Company Brain): ${line}`),
      ...brainInfluence.solutionLines.slice(0, 2).map((line) => `Solution (Company Brain): ${line}`),
      ...brainInfluence.valueLines.slice(0, 2).map((line) => `Value / proposal (Company Brain): ${line}`),
      ...brainInfluence.contextLines.slice(0, 2).map((line) => `Context (Company Brain): ${line}`),
    ]
    executiveBullets = [...executiveBullets, ...extraBrainBullets].slice(0, 12)
  }
  const brainCitationTraces = dedupeSourceTrace(
    (brainInfluence?.citedTraces ?? []).filter((trace) => citationEligibleKeys.has(traceApprovalKey(trace))),
  )
  const visualPlaceholder = createVisualPlaceholder(fileAssets, sections, deck.setup)
  const chartSuggestion = createChartSuggestion(fileAssets, goal, deck.setup)

  const slides: Slide[] = []

  const titleSlideBlocks: SlideBlock[] = []

  if (brand?.logoSlideImage) {
    titleSlideBlocks.push(
      buildBlock(
        'visual-placeholder',
        '',
        { align: 'center', fontSize: 'sm' },
        [titleTrace],
        'Logo',
        {
          imageAsset: brand.logoSlideImage,
          layout: { x: 76, y: 6, width: 22, height: 14, zIndex: 40 },
          textStyle: brandText({ alignment: 'center', verticalAlign: 'middle' }),
        },
      ),
    )
  } else if (brand && brand.organizationName.trim()) {
    titleSlideBlocks.push(
      buildBlock(
        'stat',
        brand.organizationName,
        { align: 'right', fontSize: 'sm', bold: true },
        [titleTrace],
        undefined,
        {
          textStyle: brandText({
            color: brand.kit.accentColor,
            alignment: 'right',
          }),
          layout: { x: 58, y: 7, width: 40, height: 12, zIndex: 40 },
        },
      ),
    )
  }

  titleSlideBlocks.push(
    buildBlock(
      'eyebrow',
      deck.setup.presentationType || 'Generated draft',
      { align: 'left', fontSize: 'sm' },
      [typeTrace],
      undefined,
      brand ? { textStyle: brandText({ color: brand.kit.accentColor }) } : undefined,
    ),
    buildBlock(
      'title',
      deck.title || 'Untitled presentation',
      { align: 'left', fontSize: 'xl', bold: true },
      [titleTrace],
      undefined,
      brand ? { textStyle: brandText({ color: brand.kit.primaryColor }) } : undefined,
    ),
    buildBlock(
      'body',
      goal,
      { align: 'left', fontSize: 'md' },
      [goalTrace, audienceTrace],
      undefined,
      brand ? { textStyle: brandText({ color: brand.kit.secondaryColor }) } : undefined,
    ),
    buildBlock(
      'stat',
      `${sections.length} planned sections`,
      { align: 'left', fontSize: 'lg', bold: true },
      [sectionsTrace],
      'Slide count marker',
      brand ? { textStyle: brandText({ color: brand.kit.accentColor }) } : undefined,
    ),
  )

  const titleSlideNotes = [
    'Open with the promise of the presentation and orient the audience quickly.',
    brainInfluence?.memoryOnlyTitles.length
      ? `Company knowledge, not citation-backed (see Intel Review): ${brainInfluence.memoryOnlyTitles.slice(0, 8).join('; ')}${brainInfluence.memoryOnlyTitles.length > 8 ? '…' : ''}`
      : '',
    brainInfluence?.legalTitles.length
      ? `Legal / policy sources in play: ${brainInfluence.legalTitles.join(', ')} — keep precise claims in speaker notes until reviewed.`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      deck.title || 'Untitled presentation',
      titleSlideNotes,
      titleSlideBlocks,
      [titleTrace, goalTrace, ...toggleTrace, ...fileTrace.slice(0, 2), ...brainCitationTraces.slice(0, 4)],
      {
        memoryOnlySources: brainInfluence?.memoryOnlyTitles,
      },
    ),
  )

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      'Agenda',
      'This slide should set the narrative order before details begin.',
      [
        buildBlock(
          'title',
          'Agenda',
          { align: 'left', fontSize: 'lg', bold: true },
          [sectionsTrace],
          undefined,
          brand ? { textStyle: brandText({ color: brand.kit.primaryColor }) } : undefined,
        ),
        buildBlock(
          'bullet-list',
          sections,
          { align: 'left', fontSize: 'md' },
          [sectionsTrace],
          undefined,
          brand ? { textStyle: brandText({}) } : undefined,
        ),
        buildBlock(
          'body',
          `Audience: ${audience}. Tone: ${tone}.`,
          { align: 'left', fontSize: 'md' },
          [audienceTrace, toneTrace],
          undefined,
          brand ? { textStyle: brandText({ color: brand.kit.secondaryColor }) } : undefined,
        ),
      ],
      [sectionsTrace, audienceTrace, toneTrace, ...toggleTrace],
      {
        memoryOnlySources: brainInfluence?.memoryOnlyTitles,
      },
    ),
  )

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      `Executive summary${deck.setup.targetCompany ? `: ${deck.setup.targetCompany}` : ''}`,
      'Condense the main case into a few fast, decision-ready points.',
      [
        buildBlock(
          'title',
          'Executive summary',
          { align: 'left', fontSize: 'lg', bold: true },
          [goalTrace],
          undefined,
          brand ? { textStyle: brandText({ color: brand.kit.primaryColor }) } : undefined,
        ),
        buildBlock(
          'bullet-list',
          executiveBullets,
          { align: 'left', fontSize: 'md' },
          [
            goalTrace,
            audienceTrace,
            toneTrace,
            ...fileTrace.slice(0, 2),
            ...brainCitationTraces.slice(0, 8),
          ],
          undefined,
          brand ? { textStyle: brandText({}) } : undefined,
        ),
        buildBlock(
          'quote',
          summarizeFiles(fileAssets),
          { align: 'left', fontSize: 'md', italic: true },
          [...fileTrace.slice(0, 3), ...toggleTrace],
          undefined,
          brand
            ? {
                textStyle: brandText({
                  color: brand.kit.accentColor,
                  italic: true,
                }),
              }
            : undefined,
        ),
      ],
      [
        goalTrace,
        audienceTrace,
        toneTrace,
        ...fileTrace.slice(0, 3),
        ...toggleTrace,
        ...brainCitationTraces.slice(0, 4),
      ],
      {
        memoryOnlySources: brainInfluence?.memoryOnlyTitles,
      },
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
    const relatedTrace = relatedAsset
      ? filterAssetSourceTraces(relatedAsset, resolveCitationReviewMode(deck.setup))
      : []
    const proofAngle =
      brainInfluence?.proofLines[0] && index === 0
        ? `Company Brain proof cue: ${brainInfluence.proofLines[0]}`
        : undefined
    const solutionAngle =
      brainInfluence?.solutionLines[0] && index === 1
        ? `Company Brain solution cue: ${brainInfluence.solutionLines[0]}`
        : undefined
    const sectionBodyExtra = [proofAngle, solutionAngle].filter(Boolean).join(' ')

    slides.push(
      buildSlide(
        deck.id,
        slides.length + 1,
        section,
        [
          'Use this as a flexible content slide for the core evidence and argument.',
          brainInfluence?.legalTitles.length && index === sections.length - 1
            ? `Risk / terms note: ${brainInfluence.legalTitles.join(', ')} — align claims with approved legal language.`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        [
          buildBlock(
            'eyebrow',
            `Section ${index + 1}`,
            { align: 'left', fontSize: 'sm' },
            [sectionTrace],
            undefined,
            brand ? { textStyle: brandText({ color: brand.kit.accentColor }) } : undefined,
          ),
          buildBlock(
            'title',
            section,
            { align: 'left', fontSize: 'lg', bold: true },
            [sectionTrace],
            undefined,
            brand ? { textStyle: brandText({ color: brand.kit.primaryColor }) } : undefined,
          ),
          buildBlock(
            'body',
            [getSectionSlideBody(section, index, audience, fileAssets), sectionBodyExtra]
              .filter(Boolean)
              .join(' '),
            { align: 'left', fontSize: 'md' },
            [goalTrace, audienceTrace, sectionTrace, ...relatedTrace],
            undefined,
            brand ? { textStyle: brandText({ color: brand.kit.secondaryColor }) } : undefined,
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
            undefined,
            brand ? { textStyle: brandText({}) } : undefined,
          ),
        ],
        [sectionTrace, goalTrace, toneTrace, ...relatedTrace, ...toggleTrace],
        {
          memoryOnlySources: brainInfluence?.memoryOnlyTitles,
        },
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
        buildBlock(
          'title',
          visualPlaceholder.title,
          { align: 'left', fontSize: 'lg', bold: true },
          visualPlaceholder.trace,
          undefined,
          brand ? { textStyle: brandText({ color: brand.kit.primaryColor }) } : undefined,
        ),
        buildBlock(
          'visual-placeholder',
          visualPlaceholder.body,
          { align: 'left', fontSize: 'md' },
          visualPlaceholder.trace,
          'Describe the visual to add here',
          brand
            ? {
                visualStyle: placeholderVisualBrand(brand),
                textStyle: brandText({
                  color: brand.kit.accentColor,
                  verticalAlign: 'middle',
                  alignment: 'center',
                }),
              }
            : undefined,
        ),
        buildBlock(
          'body',
          'Use this space for screenshots, diagrams, product imagery, or source artifacts.',
          { align: 'left', fontSize: 'md' },
          [...visualPlaceholder.trace, ...toggleTrace],
          undefined,
          brand ? { textStyle: brandText({ color: brand.kit.secondaryColor }) } : undefined,
        ),
      ],
      [...visualPlaceholder.trace, ...toggleTrace],
      {
        memoryOnlySources: brainInfluence?.memoryOnlyTitles,
      },
    ),
  )

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      chartSuggestion.title,
      'Keep the chart slot editable so a real chart can replace this placeholder later.',
      [
        buildBlock(
          'title',
          chartSuggestion.title,
          { align: 'left', fontSize: 'lg', bold: true },
          chartSuggestion.trace,
          undefined,
          brand ? { textStyle: brandText({ color: brand.kit.primaryColor }) } : undefined,
        ),
        buildBlock(
          'chart-placeholder',
          chartSuggestion.body,
          { align: 'left', fontSize: 'md' },
          chartSuggestion.trace,
          'Describe the chart to add here',
          brand
            ? {
                visualStyle: placeholderVisualBrand(brand),
                textStyle: brandText({
                  color: brand.kit.accentColor,
                  bold: true,
                  verticalAlign: 'middle',
                  alignment: 'center',
                }),
              }
            : undefined,
        ),
        buildBlock(
          'body',
          deck.setup.webResearch
            ? 'If web research stays enabled, validate this chart with external benchmarks before export.'
            : 'Swap this placeholder with a chart once verified metrics are attached.',
          { align: 'left', fontSize: 'md' },
          [...chartSuggestion.trace, ...toggleTrace],
          undefined,
          brand ? { textStyle: brandText({ color: brand.kit.secondaryColor }) } : undefined,
        ),
      ],
      [...chartSuggestion.trace, ...toggleTrace],
      {
        memoryOnlySources: brainInfluence?.memoryOnlyTitles,
      },
    ),
  )

  const nextStepsNotes = [
    'Close with clear ownership, timing, and the decision requested from the audience.',
    brainInfluence?.legalTitles.length
      ? `Policy / contractual items selected in Company Brain: ${brainInfluence.legalTitles.join(', ')} — double-check wording on slides vs. canonical legal documents.`
      : '',
    brainInfluence?.valueLines[0]
      ? `Commercial anchor from Company Brain: ${brainInfluence.valueLines[0]}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  slides.push(
    buildSlide(
      deck.id,
      slides.length + 1,
      deck.setup.desiredCta ? 'Recommended next step' : 'Next steps',
      nextStepsNotes,
      [
        buildBlock(
          'title',
          deck.setup.desiredCta ? 'Recommended next step' : 'Next steps',
          { align: 'left', fontSize: 'lg', bold: true },
          [notesTrace],
          undefined,
          brand ? { textStyle: brandText({ color: brand.kit.primaryColor }) } : undefined,
        ),
        buildBlock(
          'bullet-list',
          [
            deck.setup.desiredCta
              ? `Primary ask: ${deck.setup.desiredCta}`
              : 'Confirm the primary recommendation and owner.',
            'Replace placeholders with validated evidence and visuals.',
            'Refine the story for the target audience before sharing.',
          ],
          { align: 'left', fontSize: 'md' },
          [notesTrace, ...toggleTrace],
          undefined,
          brand ? { textStyle: brandText({}) } : undefined,
        ),
        buildBlock(
          'body',
          [
            notes,
            deck.setup.meetingGoal ? `Meeting goal anchor: ${deck.setup.meetingGoal}` : '',
          ]
            .filter(Boolean)
            .join(' '),
          { align: 'left', fontSize: 'md' },
          [notesTrace, ...fileTrace.slice(0, 1), ...toggleTrace],
          undefined,
          brand ? { textStyle: brandText({ color: brand.kit.secondaryColor }) } : undefined,
        ),
      ],
      [notesTrace, ...toggleTrace, ...fileTrace.slice(0, 1)],
      {
        memoryOnlySources: brainInfluence?.memoryOnlyTitles,
      },
    ),
  )

  const objectionSignals = [
    ...(deck.setup.knownPainPoints ?? []),
    ...(deck.setup.intel?.objections ?? []),
    ...((brainInfluence?.legalTitles ?? []).map((t) => `Legal/policy watchout: ${t}`)),
  ].filter(Boolean)
  if (objectionSignals.length > 0) {
    const objectionTrace = createDeckInputTrace(
      'Objection and risk signals',
      objectionSignals.join('; '),
      'deck-input',
      0.84,
    )
    slides.push(
      buildSlide(
        deck.id,
        slides.length + 1,
        'Objections and risk handling',
        'Use this slide to address likely pushback before the final ask.',
        [
          buildBlock(
            'title',
            'Objections and risk handling',
            { align: 'left', fontSize: 'lg', bold: true },
            [objectionTrace],
            undefined,
            brand ? { textStyle: brandText({ color: brand.kit.primaryColor }) } : undefined,
          ),
          buildBlock(
            'bullet-list',
            objectionSignals.slice(0, 6).map((signal) => `Mitigate: ${signal}`),
            { align: 'left', fontSize: 'md' },
            [objectionTrace, ...brainCitationTraces.slice(0, 4)],
            undefined,
            brand ? { textStyle: brandText({}) } : undefined,
          ),
          buildBlock(
            'body',
            'Pair each risk with owner, timeline, and supporting proof before external sharing.',
            { align: 'left', fontSize: 'md' },
            [objectionTrace, ...brainCitationTraces.slice(0, 2)],
            undefined,
            brand ? { textStyle: brandText({ color: brand.kit.secondaryColor }) } : undefined,
          ),
        ],
        [objectionTrace, ...brainCitationTraces.slice(0, 6)],
        { memoryOnlySources: brainInfluence?.memoryOnlyTitles },
      ),
    )
  }

  return slides
}

export async function runMockDeckGenerationPipeline({
  sourceDeck,
  sourceFiles,
  previousDeck,
  brand,
  companyKnowledgeItems,
  workspaceFileAssets,
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
  const companyBrainSlice =
    companyKnowledgeItems && companyKnowledgeItems.length > 0
      ? { items: companyKnowledgeItems, workspaceFileAssets }
      : undefined
  const generatedSlides = createGeneratedSlides(
    generatedDeck,
    generatedFiles,
    previousDeck,
    brand,
    companyBrainSlice,
  ).map((slide) => ({
    ...slide,
    deckId: generatedDeckId,
  }))
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

export function createSlidesFromDeck(
  deck: Deck,
  fileAssets: FileAsset[] = [],
  brand?: DeckBrandGenerationContext,
  companyBrain?: { items?: CompanyKnowledgeItem[]; workspaceFileAssets?: FileAsset[] },
): Slide[] {
  const slice =
    companyBrain?.items && companyBrain.items.length > 0
      ? { items: companyBrain.items, workspaceFileAssets: companyBrain.workspaceFileAssets }
      : undefined
  return createGeneratedSlides(deck, fileAssets, undefined, brand, slice)
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
