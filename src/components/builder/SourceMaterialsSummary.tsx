import { buildSourceMaterialsSummary } from '../../data/sourceIngestion'
import type { FileAsset } from '../../types/models'
import { formatConfidence } from '../../utils/formatters'

interface SourceMaterialsSummaryProps {
  assets: FileAsset[]
  onAutoFill: () => void
}

export function SourceMaterialsSummary({
  assets,
  onAutoFill,
}: SourceMaterialsSummaryProps) {
  const summary = buildSourceMaterialsSummary(assets)

  return (
    <section className="panel-card preview-panel">
      <div className="section-heading">
        <div>
          <span className="section-label">Source Materials Summary</span>
          <h3>Ingestion signals and autofill suggestions</h3>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={assets.length === 0}
          onClick={onAutoFill}
        >
          Auto-fill from files
        </button>
      </div>

      <p className="muted-copy">{summary.summaryText}</p>

      {assets.length > 0 ? (
        <>
          <div className="source-summary__stats">
            <article className="source-summary__stat">
              <span className="field-label">Parsed files</span>
              <strong>{summary.parsedFiles}</strong>
            </article>
            <article className="source-summary__stat">
              <span className="field-label">Owner review flags</span>
              <strong>{summary.highlightedFiles}</strong>
            </article>
            <article className="source-summary__stat">
              <span className="field-label">Suggested sections</span>
              <strong>{summary.suggestedSections.length}</strong>
            </article>
          </div>

          <div className="source-summary__stack">
            <div className="context-note">
              <span className="field-label">Suggested audience</span>
              <strong>{summary.suggestedAudience || 'No audience suggestion yet'}</strong>
            </div>

            <div className="context-note">
              <span className="field-label">Suggested tone</span>
              <strong>{summary.suggestedTone || 'No tone suggestion yet'}</strong>
            </div>

            <div className="context-note source-summary__goal">
              <span className="field-label">Suggested goal</span>
              <strong>{summary.suggestedGoal || 'No goal suggestion yet'}</strong>
            </div>
          </div>

          <div className="source-summary__section">
            <span className="field-label">Suggested sections</span>
            <div className="asset-card__chip-row">
              {summary.suggestedSections.map((section) => (
                <span key={section}>{section}</span>
              ))}
            </div>
          </div>

          <div className="source-summary__section">
            <span className="field-label">Source trace preview</span>
            <div className="source-trace source-trace--detailed">
              {summary.tracePreview.map((trace) => (
                <span
                  key={`${trace.fileId}-${trace.extractedSnippet}`}
                  title={trace.extractedSnippet}
                >
                  {trace.fileName} | {formatConfidence(trace.confidence)}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
