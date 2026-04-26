import type { ChartSuggestion, FileAsset } from '../../types/models'
import { formatConfidence } from '../../utils/formatters'

interface ChartSuggestionsPanelProps {
  suggestions: ChartSuggestion[]
  assets: FileAsset[]
  onAccept: (suggestionId: string) => void
  onReject: (suggestionId: string) => void
}

function getAssetName(assets: FileAsset[], fileId: string) {
  return assets.find((asset) => asset.id === fileId)?.name ?? 'Source file'
}

function getStatusLabel(status: ChartSuggestion['status']) {
  if (status === 'accepted') {
    return 'Accepted'
  }

  if (status === 'rejected') {
    return 'Rejected'
  }

  return 'Suggested'
}

export function ChartSuggestionsPanel({
  suggestions,
  assets,
  onAccept,
  onReject,
}: ChartSuggestionsPanelProps) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <section className="panel-card chart-suggestions-panel">
      <div className="section-heading">
        <div>
          <span className="section-label">Chart suggestions</span>
          <h3>Data-backed chart opportunities</h3>
        </div>
      </div>

      <div className="chart-suggestion-list">
        {suggestions.map((suggestion) => (
          <article key={suggestion.id} className="chart-suggestion-card">
            <div className="chart-suggestion-card__header">
              <div>
                <span className="section-label">{suggestion.chartType} chart</span>
                <h4>{suggestion.title}</h4>
                <p>I found data that could work as this chart. Add it to the deck?</p>
              </div>
              <span className={`card-pill chart-status--${suggestion.status}`}>
                {getStatusLabel(suggestion.status)}
              </span>
            </div>

            <div className="chart-suggestion-card__meta">
              <span>{getAssetName(assets, suggestion.fileId)}</span>
              <span>{formatConfidence(suggestion.confidence)}</span>
            </div>

            <p className="muted-copy">{suggestion.reason}</p>

            <div className="chart-data-preview">
              {suggestion.dataPreview.map((item) => (
                <span key={`${suggestion.id}-${item}`}>{item}</span>
              ))}
            </div>

            {suggestion.status === 'suggested' ? (
              <div className="chart-suggestion-card__actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onAccept(suggestion.id)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onReject(suggestion.id)}
                >
                  Reject
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
