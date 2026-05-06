import { resolveCitationReviewMode } from './sourceCitationReview.ts'
import type {
  CompanyBrandKit,
  Deck,
  DeckReportCompanyBrainEntry,
  DeckReportDecision,
  DeckReportKeyPoint,
  DeckReportMetric,
  FileAsset,
  GeneratedDeckReport,
  ReportType,
  Slide,
  SlideBlock,
  SourceTrace,
} from '../types/models.ts'
import { createId } from '../utils/ids.ts'

interface GenerateDeckReportInput {
  deck: Deck
  slides: Slide[]
  fileAssets: FileAsset[]
  reportType: ReportType
  /** Resolved Brand Kit for this deck (same org + setup.brandKitId), if any. */
  intelBriefBrandKit?: CompanyBrandKit
  /** Rows from pitch setup Brain selections (optional; produced in workspace hook). */
  companyBrainSources?: DeckReportCompanyBrainEntry[]
}

function getSourceTraceKey(trace: SourceTrace) {
  return [
    trace.fileId,
    trace.fileName,
    trace.sourceType,
    trace.extractedSnippet,
    trace.addedByUserId,
  ].join('|')
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function getBlockText(block: SlideBlock) {
  if (block.type === 'shape') {
    return ''
  }

  return normalizeWhitespace(Array.isArray(block.content) ? block.content.join('; ') : block.content)
}

function getSlideTitle(slide: Slide) {
  const titleBlock = slide.blocks.find((block) => block.type === 'title')
  const titleText = titleBlock ? getBlockText(titleBlock) : ''

  return titleText || slide.title || `Slide ${slide.index}`
}

function getSlideTextFragments(slide: Slide) {
  return slide.blocks
    .map(getBlockText)
    .filter(Boolean)
    .filter((fragment, index, fragments) => fragments.indexOf(fragment) === index)
}

function truncateSentence(value: string, maxWords: number) {
  const words = normalizeWhitespace(value).split(' ').filter(Boolean)

  if (words.length <= maxWords) {
    return normalizeWhitespace(value)
  }

  return `${words.slice(0, maxWords).join(' ')}...`
}

function collectSourceReferences(slides: Slide[]) {
  const seen = new Set<string>()
  const references: SourceTrace[] = []

  slides.forEach((slide) => {
    ;[...slide.sourceTrace, ...slide.blocks.flatMap((block) => block.sourceTrace)].forEach((trace) => {
      const key = getSourceTraceKey(trace)

      if (seen.has(key)) {
        return
      }

      seen.add(key)
      references.push(trace)
    })
  })

  return references
}

function buildExecutiveSummary(deck: Deck, slides: Slide[], reportType: ReportType) {
  const executiveSlide = slides.find((slide) =>
    getSlideTitle(slide).toLowerCase().includes('executive summary'),
  )
  const candidateFragments = executiveSlide
    ? getSlideTextFragments(executiveSlide)
    : [
        deck.setup.goal,
        deck.setup.audience ? `Audience: ${deck.setup.audience}` : '',
        deck.setup.tone ? `Tone: ${deck.setup.tone}` : '',
      ].filter(Boolean)
  const maxFragments = reportType === 'concise' ? 2 : 4
  const summary = candidateFragments
    .slice(0, maxFragments)
    .map((fragment) => truncateSentence(fragment, reportType === 'concise' ? 22 : 38))
    .join(' ')

  return summary || 'No executive summary content is available yet.'
}

function buildKeyPoints(slides: Slide[], reportType: ReportType): DeckReportKeyPoint[] {
  const maxSlides = reportType === 'concise' ? 8 : slides.length
  const maxPoints = reportType === 'concise' ? 2 : 4

  return slides.slice(0, maxSlides).map((slide) => {
    const title = getSlideTitle(slide)
    const points = getSlideTextFragments(slide)
      .filter((fragment) => fragment !== title)
      .slice(0, maxPoints)
      .map((fragment) => truncateSentence(fragment, reportType === 'concise' ? 18 : 32))

    return {
      slideId: slide.id,
      slideIndex: slide.index,
      title,
      points: points.length > 0 ? points : ['No narrative text has been added to this slide yet.'],
    }
  })
}

function buildMetrics(slides: Slide[], reportType: ReportType): DeckReportMetric[] {
  const metricPattern = /(\$|%|\bmetric\b|\bkpi\b|\brevenue\b|\bgrowth\b|\bforecast\b|\bchart\b|\btrend\b)/i
  const maxMetrics = reportType === 'concise' ? 4 : 10

  return slides
    .flatMap((slide) => {
      const title = getSlideTitle(slide)

      return slide.blocks.flatMap((block): DeckReportMetric[] => {
        const text = getBlockText(block)
        const looksMetric =
          block.type === 'stat' || block.type === 'chart-placeholder' || metricPattern.test(text)

        if (!looksMetric || !text) {
          return []
        }

        return [
          {
            slideId: slide.id,
            slideTitle: title,
            label: block.type === 'chart-placeholder' ? 'Chart suggestion' : 'Metric signal',
            summary: truncateSentence(text, reportType === 'concise' ? 18 : 30),
          },
        ]
      })
    })
    .slice(0, maxMetrics)
}

function buildDecisions(slides: Slide[], reportType: ReportType): DeckReportDecision[] {
  const decisionPattern = /\b(risk|decision|next step|next steps|recommend|recommendation|ask|blocker|action)\b/i
  const maxItems = reportType === 'concise' ? 5 : 12

  return slides
    .flatMap((slide) => {
      const title = getSlideTitle(slide)

      return getSlideTextFragments(slide)
        .filter((fragment) => decisionPattern.test(fragment) || decisionPattern.test(title))
        .map((fragment) => ({
          slideId: slide.id,
          slideTitle: title,
          summary: truncateSentence(fragment, reportType === 'concise' ? 20 : 34),
        }))
    })
    .slice(0, maxItems)
}

function formatCompanyBrainRow(row: DeckReportCompanyBrainEntry) {
  const rel =
    row.relevanceBand !== undefined || row.relevanceScore !== undefined
      ? ` relevance: ${row.relevanceBand ?? '—'} (${row.relevanceScore !== undefined ? Math.round(row.relevanceScore) : '—'})`
      : ''
  return `- ${row.title} [${row.sourceType}] ${row.approvalStatus} | ${row.visibilityLabel} | ${row.backing}${row.citationCount !== undefined ? ` | citations: ${row.citationCount}` : ''}${rel}`
}

function buildBibliography(report: Omit<GeneratedDeckReport, 'plainText'>) {
  const citationBackedUploads = report.sourceReferences.filter((trace) => trace.sourceType === 'uploaded-file')
  const userPitchInputs = report.sourceReferences.filter((trace) => trace.sourceType === 'deck-input')
  const companyKnowledge = (report.companyBrainSources ?? []).filter((row) => row.backing === 'citation-backed')
  const memoryOnlyCompanyKnowledge = (report.companyBrainSources ?? []).filter(
    (row) => row.backing === 'memory-only',
  )

  return {
    citationBackedUploads,
    companyKnowledge,
    userPitchInputs,
    memoryOnlyCompanyKnowledge,
  }
}

function buildPlainText(report: Omit<GeneratedDeckReport, 'plainText'>) {
  const bibliography = buildBibliography(report)
  const brainLines =
    report.companyBrainSources === undefined
      ? []
      : report.companyBrainSources.length === 0
        ? [
            '',
            'Company Brain sources (pitch selections)',
            '- Selection list was empty once resolved.',
          ]
        : [
            '',
            'Company Brain sources (pitch selections)',
            ...report.companyBrainSources.map(formatCompanyBrainRow),
          ]

  const lines = [
    report.title,
    `Intel Brief type: ${report.reportType}`,
    '',
    'Executive intel summary',
    report.executiveSummary,
    '',
    'Deck highlights',
    ...report.keyPoints.flatMap((section) => [
      `${section.slideIndex}. ${section.title}`,
      ...section.points.map((point) => `- ${point}`),
    ]),
    '',
    'Proof points / Metrics / Chart summaries',
    ...(report.metrics.length > 0
      ? report.metrics.map((metric) => `- ${metric.slideTitle}: ${metric.summary}`)
      : ['- No metric or chart summaries detected.']),
    '',
    'Risks / Decisions / Next Steps',
    ...(report.decisions.length > 0
      ? report.decisions.map((decision) => `- ${decision.slideTitle}: ${decision.summary}`)
      : ['- No explicit risks, decisions, or next steps detected.']),
    '',
    'Source references',
    ...(report.sourceReferences.length > 0
      ? report.sourceReferences.map(
          (trace) => `- ${trace.fileName}: ${trace.extractedSnippet}`,
        )
      : ['- No source references available.']),
    ...brainLines,
    '',
    'Sources / Bibliography',
    `Citation mode: ${report.citationReviewMode === 'strict-approved-only' ? 'Strict approved-only' : 'Permissive'}`,
    '',
    'Citation-backed uploaded files',
    ...(bibliography.citationBackedUploads.length > 0
      ? bibliography.citationBackedUploads.map((trace) => {
          const sameFileCount = bibliography.citationBackedUploads.filter(
            (candidate) => candidate.fileId === trace.fileId,
          ).length
          return `- ${trace.fileName} | ${trace.sourceType} | citation count: ${sameFileCount}`
        })
      : ['- No citation-backed uploaded file traces.']),
    '',
    'Company Brain knowledge',
    ...(bibliography.companyKnowledge.length > 0
      ? bibliography.companyKnowledge.map(formatCompanyBrainRow)
      : ['- No citation-backed Company Brain rows.']),
    ...(bibliography.memoryOnlyCompanyKnowledge.length > 0
      ? bibliography.memoryOnlyCompanyKnowledge.map(
          (row) =>
            `- ${row.title} [${row.sourceType}] ${row.approvalStatus} | ${row.visibilityLabel} | Company knowledge, not citation-backed.`,
        )
      : []),
    '',
    'User-provided pitch inputs',
    ...(bibliography.userPitchInputs.length > 0
      ? bibliography.userPitchInputs.map(
          (trace) => `- ${trace.fileName} | ${trace.sourceType} | ${trace.extractedSnippet}`,
        )
      : ['- No user-provided pitch inputs captured as traces.']),
  ]

  return lines.join('\n')
}

export function generateDeckReport({
  deck,
  slides,
  fileAssets,
  reportType,
  intelBriefBrandKit,
  companyBrainSources,
}: GenerateDeckReportInput): GeneratedDeckReport {
  const sourceReferences = collectSourceReferences(slides)
  const intelBriefTheme = intelBriefBrandKit
    ? {
        primaryColor: intelBriefBrandKit.primaryColor,
        accentColor: intelBriefBrandKit.accentColor,
        secondaryColor: intelBriefBrandKit.secondaryColor,
        fontFamily: intelBriefBrandKit.fontFamily,
      }
    : undefined

  const citationReviewMode = resolveCitationReviewMode(deck.setup)
  const reportWithoutPlainText: Omit<GeneratedDeckReport, 'plainText'> = {
    id: createId('report'),
    deckId: deck.id,
    title: `${deck.title} Intel Brief`,
    reportType,
    generatedAt: new Date().toISOString(),
    executiveSummary: buildExecutiveSummary(deck, slides, reportType),
    keyPoints: buildKeyPoints(slides, reportType),
    metrics: buildMetrics(slides, reportType),
    decisions: buildDecisions(slides, reportType),
    sourceReferences:
      sourceReferences.length > 0
        ? sourceReferences
        : fileAssets.flatMap((asset) => asset.sourceTrace).slice(0, reportType === 'concise' ? 6 : 16),
    ...(companyBrainSources !== undefined ? { companyBrainSources } : {}),
    bibliography: {
      citationBackedUploads: [],
      companyKnowledge: [],
      userPitchInputs: [],
      memoryOnlyCompanyKnowledge: [],
    } as GeneratedDeckReport['bibliography'],
    citationReviewMode,
    intelBriefTheme,
  }
  reportWithoutPlainText.bibliography = buildBibliography(reportWithoutPlainText)

  return {
    ...reportWithoutPlainText,
    plainText: buildPlainText(reportWithoutPlainText),
  }
}
