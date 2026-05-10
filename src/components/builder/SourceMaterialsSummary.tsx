import { buildSourceMaterialsSummary } from '../../data/sourceIngestion'
import type { FileAsset } from '../../types/models'
import { formatConfidence } from '../../utils/formatters'

interface SourceMaterialsSummaryProps {
  assets: FileAsset[]
  onAutoFill: () => void
  /** Inline summary for the build workspace (no nested panel chrome). */
  variant?: 'standard' | 'compact'
}

export function SourceMaterialsSummary({
  assets,
  onAutoFill,
  variant = 'standard',
}: SourceMaterialsSummaryProps) {
  const summary = buildSourceMaterialsSummary(assets)

  if (variant === 'compact') {
    return (
      <div className="source-materials-compact">
        <div className="source-materials-compact__head">
          <span className="field-label">Auto-fill brief</span>
          <button
            type="button"
            className="secondary-button secondary-button--sm"
            disabled={assets.length === 0}
            onClick={onAutoFill}
          >
            Auto-fill from sources
          </button>
        </div>
        {assets.length > 0 ? (
          <>
            <div className="source-materials-compact__stats">
              <span>
                Parsed <strong>{summary.parsedFiles}</strong>
              </span>
              <span>
                Flags <strong>{summary.highlightedFiles}</strong>
              </span>
              <span>
                Sections <strong>{summary.suggestedSections.length}</strong>
              </span>
            </div>
            <details className="source-materials-compact__details">
              <summary>Auto-fill suggestions preview</summary>
              <p className="muted-copy source-materials-compact__lede">{summary.summaryText}</p>
              <div className="source-materials-compact__signals">
                <div className="context-note">
                  <span className="field-label">Suggested buyer persona / role</span>
                  <strong>{summary.suggestedAudience || 'No audience suggestion yet'}</strong>
                </div>
                <div className="context-note">
                  <span className="field-label">Suggested tone</span>
                  <strong>{summary.suggestedTone || 'No tone suggestion yet'}</strong>
                </div>
                <div className="context-note source-summary__goal">
                  <span className="field-label">Suggested meeting goal</span>
                  <strong>{summary.suggestedGoal || 'No goal suggestion yet'}</strong>
                </div>
                <div className="source-summary__section">
                  <span className="field-label">Suggested sections</span>
                  <div className="asset-card__chip-row">
                    {summary.suggestedSections.length === 0 ? (
                      <span className="muted-copy">—</span>
                    ) : (
                      summary.suggestedSections.map((section) => (
                        <span key={section}>{section}</span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </details>
          </>
        ) : null}
      </div>
    )
  }

  return (
    <section className="panel-card preview-panel">
      <div className="section-heading">
        <div>
          <span className="section-label">Source intelligence summary</span>
          <h3>Research ingestion signals and autofill suggestions</h3>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={assets.length === 0}
          onClick={onAutoFill}
        >
          Auto-fill from sources
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
              <span className="field-label">Suggested buyer persona / role</span>
              <strong>{summary.suggestedAudience || 'No audience suggestion yet'}</strong>
            </div>

            <div className="context-note">
              <span className="field-label">Suggested tone</span>
              <strong>{summary.suggestedTone || 'No tone suggestion yet'}</strong>
            </div>

            <div className="context-note source-summary__goal">
              <span className="field-label">Suggested meeting goal</span>
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
            <span className="field-label">Citation trace preview</span>
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
