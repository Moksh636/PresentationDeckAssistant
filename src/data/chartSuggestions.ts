import type {
  ChartSuggestion,
  ChartType,
  FileAsset,
  Slide,
  SlideBlock,
  SlideBlockStyle,
  SourceTrace,
} from '../types/models'
import { createId } from '../utils/ids'
import { normalizeSlideBlock } from './slideLayout'
import { OWNER_USER_ID, createDeckInputTrace } from './sourceIngestion'

const chartBlockStyle: SlideBlockStyle = {
  align: 'left',
  fontSize: 'md',
}

function getSuggestionId(file: FileAsset) {
  return `chart-suggestion-${file.id}`
}

function hasTabularSignal(file: FileAsset) {
  const metadata = file.extractedMetadata
  const textSignals = [
    file.name,
    file.summary,
    file.extractedTextPreview,
    file.possibleGoal,
    ...file.possibleSections,
  ]
    .join(' ')
    .toLowerCase()

  return (
    file.kind === 'sheet' ||
    metadata.containsTables === true ||
    textSignals.includes('metric') ||
    textSignals.includes('forecast') ||
    textSignals.includes('trend') ||
    textSignals.includes('model') ||
    textSignals.includes('financial') ||
    textSignals.includes('scenario')
  )
}

function inferChartType(file: FileAsset): ChartType {
  const signal = [
    file.name,
    file.summary,
    file.extractedTextPreview,
    file.possibleGoal,
    ...file.possibleSections,
  ]
    .join(' ')
    .toLowerCase()

  if (signal.includes('forecast') || signal.includes('trend') || signal.includes('scenario')) {
    return 'line'
  }

  if (signal.includes('comparison') || signal.includes('competitive')) {
    return 'comparison'
  }

  if (signal.includes('metric') || signal.includes('kpi')) {
    return 'kpi'
  }

  return 'bar'
}

function getChartTitle(file: FileAsset, chartType: ChartType) {
  const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ')

  if (chartType === 'line') {
    return `${cleanName} trend`
  }

  if (chartType === 'comparison') {
    return `${cleanName} comparison`
  }

  if (chartType === 'kpi') {
    return `${cleanName} KPI snapshot`
  }

  return `${cleanName} breakdown`
}

function buildDataPreview(file: FileAsset, chartType: ChartType) {
  const topic = String(file.extractedMetadata.detectedTopic ?? file.name)

  if (chartType === 'line') {
    return [
      `${topic}: baseline 42`,
      `${topic}: current 57`,
      `${topic}: forecast 68`,
    ]
  }

  if (chartType === 'comparison') {
    return ['Current plan: 52', 'Alternative plan: 61', 'Market benchmark: 48']
  }

  if (chartType === 'kpi') {
    return ['Primary KPI: 57', 'Target: 70', 'Gap: 13']
  }

  return ['Segment A: 34', 'Segment B: 46', 'Segment C: 28']
}

function getConfidence(file: FileAsset) {
  const baseConfidence = file.sourceTrace[0]?.confidence ?? 0.66
  const metadataBoost = file.extractedMetadata.containsTables === true ? 0.08 : 0
  const kindBoost = file.kind === 'sheet' ? 0.08 : 0

  return Math.min(0.94, Number((baseConfidence + metadataBoost + kindBoost).toFixed(2)))
}

export function createChartSuggestionsFromFiles(
  files: FileAsset[],
  existingSuggestions: ChartSuggestion[] = [],
) {
  const existingById = new Map(existingSuggestions.map((suggestion) => [suggestion.id, suggestion]))

  return files.flatMap((file) => {
    if (!hasTabularSignal(file)) {
      return []
    }

    const id = getSuggestionId(file)
    const existingSuggestion = existingById.get(id)

    if (existingSuggestion) {
      return [existingSuggestion]
    }

    const chartType = inferChartType(file)

    return [
      {
        id,
        deckId: file.deckId,
        fileId: file.id,
        title: getChartTitle(file, chartType),
        chartType,
        reason: `Mock ingestion found tabular signals in ${file.name} that can support a ${chartType} chart.`,
        confidence: getConfidence(file),
        dataPreview: buildDataPreview(file, chartType),
        status: 'suggested' as const,
      },
    ]
  })
}

function dedupeTrace(traces: SourceTrace[]) {
  const seen = new Set<string>()

  return traces.filter((trace) => {
    const key = [
      trace.fileId,
      trace.fileName,
      trace.sourceType,
      trace.extractedSnippet,
      trace.addedByUserId,
    ].join('|')

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function createChartTrace(suggestion: ChartSuggestion, file?: FileAsset) {
  if (file?.sourceTrace.length) {
    return file.sourceTrace
  }

  return [
    createDeckInputTrace(
      suggestion.title,
      suggestion.reason,
      'generated-summary',
      suggestion.confidence,
    ),
  ]
}

function createChartBlock(
  type: SlideBlock['type'],
  content: SlideBlock['content'],
  sourceTrace: SourceTrace[],
  style: SlideBlockStyle = chartBlockStyle,
  placeholder?: string,
): SlideBlock {
  return {
    id: createId(`block-${type}`),
    type,
    content,
    placeholder,
    style,
    sourceTrace: dedupeTrace(sourceTrace),
  }
}

export function createChartSlideFromSuggestion(
  deckId: string,
  slideIndex: number,
  suggestion: ChartSuggestion,
  file?: FileAsset,
): Slide {
  const trace = createChartTrace(suggestion, file)
  const title = suggestion.title || 'Suggested chart'
  const chartDescription = `${suggestion.chartType} chart placeholder from ${file?.name ?? 'source data'}`

  const blocks = [
    createChartBlock('eyebrow', 'Chart suggestion', trace, {
      align: 'left',
      fontSize: 'sm',
    }),
    createChartBlock('title', title, trace, {
      align: 'left',
      fontSize: 'lg',
      bold: true,
    }),
    createChartBlock(
      'chart-placeholder',
      chartDescription,
      trace,
      chartBlockStyle,
      'Replace with rendered chart once real parsing exists',
    ),
    createChartBlock('bullet-list', suggestion.dataPreview, trace),
    createChartBlock(
      'body',
      `Reason: ${suggestion.reason}`,
      [
        ...trace,
        {
          fileId: `chart-suggestion:${suggestion.id}`,
          fileName: 'Chart suggestion engine',
          sourceType: 'generated-summary',
          confidence: suggestion.confidence,
          extractedSnippet: suggestion.reason,
          addedByUserId: OWNER_USER_ID,
        },
      ],
    ),
  ].map((block, index) => normalizeSlideBlock(block, index))

  return {
    id: createId('slide'),
    deckId,
    index: slideIndex,
    title,
    notes: 'Validate the data and replace the placeholder with a rendered chart when real spreadsheet parsing is connected.',
    blocks,
    sourceTrace: dedupeTrace(blocks.flatMap((block) => block.sourceTrace)),
  }
}
