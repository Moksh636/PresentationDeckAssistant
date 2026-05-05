import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { getAddedByLabel, getSourceTypeLabel } from '../../data/sourceTrace'
import type { FileAsset, GeneratedDeckReport, ReportType } from '../../types/models'
import { formatConfidence, formatShortDate } from '../../utils/formatters'

interface DeckReportModalProps {
  isOpen: boolean
  reportType: ReportType
  reportAsset?: FileAsset
  onReportTypeChange: (reportType: ReportType) => void
  onGenerate: () => void
  onClose: () => void
}

const reportTypeOptions: Array<{ value: ReportType; label: string; description: string }> = [
  {
    value: 'concise',
    label: 'Concise',
    description: 'Short account intelligence brief for quick review.',
  },
  {
    value: 'detailed',
    label: 'Detailed',
    description: 'Longer account intelligence brief with more slide-by-slide detail.',
  },
]

export function DeckReportModal({
  isOpen,
  reportType,
  reportAsset,
  onReportTypeChange,
  onGenerate,
  onClose,
}: DeckReportModalProps) {
  const report = reportAsset?.report

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop report-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header report-modal__chrome">
          <div>
            <span className="section-label">Intel Brief</span>
            <h3 id="report-modal-title">Generate printable Intel Brief</h3>
            <p>Creates an HTML Intel Brief asset linked to this deck and ready for Print / Save as PDF.</p>
          </div>

          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="report-modal__body">
          <aside className="report-modal__chrome report-settings-panel">
            <div>
              <span className="field-label">Intel Brief type</span>
              <div className="report-type-options">
                {reportTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={reportType === option.value ? 'is-active' : ''}
                    onClick={() => onReportTypeChange(option.value)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <button type="button" className="primary-button" onClick={onGenerate}>
              Generate Intel Brief
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={!report}
              onClick={() => window.print()}
            >
              Print / Save as PDF
            </button>

            {reportAsset ? (
              <div className="report-asset-summary">
                <span className="field-label">Saved Intel Brief asset</span>
                <strong>{reportAsset.name}</strong>
                <p>{reportAsset.summary}</p>
                <small>{reportAsset.sizeLabel}</small>
              </div>
            ) : null}
          </aside>

          <div className="report-preview-panel">
            {report ? (
              <PrintableReport report={report} />
            ) : (
              <div className="report-empty-state">
                <span className="section-label">No Intel Brief generated</span>
                <h4>Choose an Intel Brief type and generate a preview.</h4>
                <p>
                  The Intel Brief will be saved as a deck-linked asset and a deck version labeled
                  "Intel Brief generated."
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PrintableReport({ report }: { report: GeneratedDeckReport }) {
  const theme = report.intelBriefTheme
  const articleStyle: CSSProperties | undefined = theme
    ? { fontFamily: theme.fontFamily }
    : undefined
  const coverStyle: CSSProperties | undefined = theme
    ? {
        borderBottom: `3px solid ${theme.accentColor}`,
      }
    : undefined
  const eyebrowStyle: CSSProperties | undefined = theme
    ? { color: theme.accentColor }
    : undefined
  const titleStyle: CSSProperties | undefined = theme ? { color: theme.primaryColor } : undefined
  const sectionHeadingStyle: CSSProperties | undefined = theme
    ? {
        color: theme.primaryColor,
        borderBottom: `1px solid ${theme.accentColor}`,
        paddingBottom: '6px',
      }
    : undefined
  const subheadingStyle: CSSProperties | undefined = theme ? { color: theme.accentColor } : undefined

  return (
    <article
      className="printable-report"
      aria-label={`${report.title} printable Intel Brief`}
      style={articleStyle}
    >
      <header className="report-document__cover" style={coverStyle}>
        <span style={eyebrowStyle}>{report.reportType} Intel Brief</span>
        <h1 style={titleStyle}>{report.title}</h1>
        <p>Generated {formatShortDate(report.generatedAt)}</p>
      </header>

      <section className="report-section">
        <h2 style={sectionHeadingStyle}>Executive intel summary</h2>
        <p>{report.executiveSummary}</p>
      </section>

      <section className="report-section">
        <h2 style={sectionHeadingStyle}>Account & Pitch Highlights by Slide</h2>
        {report.keyPoints.map((section) => (
          <div key={section.slideId} className="report-section__block">
            <h3 style={subheadingStyle}>
              {section.slideIndex}. {section.title}
            </h3>
            <ul>
              {section.points.map((point) => (
                <li key={`${section.slideId}-${point}`}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="report-section">
        <h2 style={sectionHeadingStyle}>Proof Points / Metrics / Chart Summaries</h2>
        {report.metrics.length > 0 ? (
          report.metrics.map((metric) => (
            <div key={`${metric.slideId}-${metric.summary}`} className="report-section__block">
              <h3 style={subheadingStyle}>{metric.label}</h3>
              <p>
                <strong>{metric.slideTitle}:</strong> {metric.summary}
              </p>
            </div>
          ))
        ) : (
          <p>No proof-point metrics or chart summaries were detected in this deck.</p>
        )}
      </section>

      <section className="report-section">
        <h2 style={sectionHeadingStyle}>Risks / Objections / Decisions / Next Steps</h2>
        {report.decisions.length > 0 ? (
          <ul>
            {report.decisions.map((decision) => (
              <li key={`${decision.slideId}-${decision.summary}`}>
                <strong>{decision.slideTitle}:</strong> {decision.summary}
              </li>
            ))}
          </ul>
        ) : (
          <p>No explicit risks, objections, decisions, or next steps were detected in this deck.</p>
        )}
      </section>

      <section className="report-section report-section--sources">
        <h2 style={sectionHeadingStyle}>Source References</h2>
        {report.sourceReferences.length > 0 ? (
          report.sourceReferences.map((trace, index) => (
            <div key={`${trace.fileId}-${trace.extractedSnippet}-${index}`} className="report-source">
              <div>
                <strong>{trace.fileName}</strong>
                <span>{getSourceTypeLabel(trace.sourceType)}</span>
              </div>
              <p>{trace.extractedSnippet}</p>
              <small>
                Confidence {formatConfidence(trace.confidence)} | {getAddedByLabel(trace)}
              </small>
            </div>
          ))
        ) : (
          <p>No source references are attached to this deck yet.</p>
        )}
      </section>
    </article>
  )
}
