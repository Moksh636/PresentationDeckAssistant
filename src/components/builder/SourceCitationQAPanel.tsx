import type { FileAsset } from '../../types/models'
import { formatConfidence } from '../../utils/formatters'
import {
  isSourceApproved,
  isSourceExcluded,
  snippetLabel,
  snippetReviewKey,
} from '../../data/sourceCitationReview'

interface SourceCitationQAPanelProps {
  assets: FileAsset[]
  onSetSourceStatus: (assetId: string, status: 'pending' | 'approved' | 'excluded') => void
  onSetSnippetEnabled: (assetId: string, snippetKey: string, enabled: boolean) => void
  onSetSnippetLabelOverride: (assetId: string, snippetKey: string, labelOverride: string) => void
}

export function SourceCitationQAPanel({
  assets,
  onSetSourceStatus,
  onSetSnippetEnabled,
  onSetSnippetLabelOverride,
}: SourceCitationQAPanelProps) {
  return (
    <section className="panel-card">
      <div className="section-heading">
        <div>
          <span className="section-label">Source citation QA</span>
          <h3>Snippet and trace review</h3>
          <p className="muted-copy">
            Review parse warnings and citations before Intel Review/deck generation. Default mode is
            permissive: all traces are used unless excluded or disabled.
          </p>
        </div>
      </div>
      {assets.length === 0 ? <p className="muted-copy">No sources uploaded yet.</p> : null}
      <div className="asset-list">
        {assets.map((asset) => (
          <article key={asset.id} className="asset-card asset-card--detailed">
            <div className="asset-card__header">
              <div className="asset-card__title">
                <strong>{asset.name}</strong>
                <p>{asset.summary}</p>
              </div>
              <div className="asset-card__status-stack">
                <span>{asset.status}</span>
                <span>{asset.sizeLabel}</span>
              </div>
            </div>

            <div className="asset-card__chip-row">
              <button type="button" className="secondary-button" onClick={() => onSetSourceStatus(asset.id, 'approved')}>
                {isSourceApproved(asset) ? 'Approved' : 'Mark approved'}
              </button>
              <button type="button" className="ghost-button" onClick={() => onSetSourceStatus(asset.id, 'excluded')}>
                {isSourceExcluded(asset) ? 'Excluded' : 'Exclude source'}
              </button>
              <button type="button" className="ghost-button" onClick={() => onSetSourceStatus(asset.id, 'pending')}>
                Clear status
              </button>
            </div>

            <div className="asset-card__details">
              <div className="asset-card__detail-block asset-card__detail-block--wide">
                <span className="field-label">Extracted preview</span>
                <p>{asset.extractedTextPreview || 'No extracted preview available.'}</p>
              </div>
              <div className="asset-card__detail-block asset-card__detail-block--wide">
                <span className="field-label">Parse warnings</span>
                {asset.parseWarnings && asset.parseWarnings.length > 0 ? (
                  <ul className="intel-citation-list">
                    {asset.parseWarnings.map((warning, index) => (
                      <li key={`${asset.id}-warning-${index}`}>
                        <p>{warning}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>None</p>
                )}
              </div>
              <div className="asset-card__detail-block asset-card__detail-block--wide">
                <span className="field-label">Source traces/snippets</span>
                {asset.sourceTrace.length === 0 ? (
                  <p>No snippets extracted from this source.</p>
                ) : (
                  <ul className="intel-citation-list">
                    {asset.sourceTrace.map((trace) => {
                      const key = snippetReviewKey(trace)
                      const enabled = asset.sourceReview?.snippetReviews?.[key]?.enabled !== false
                      return (
                        <li key={`${asset.id}-${key}`}>
                          <div className="intel-knowledge-row-heading">
                            <label>
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(event) =>
                                  onSetSnippetEnabled(asset.id, key, event.target.checked)
                                }
                              />{' '}
                              Enable
                            </label>
                            <span className="intel-citation-meta">{formatConfidence(trace.confidence)}</span>
                          </div>
                          <input
                            type="text"
                            value={snippetLabel(asset, trace)}
                            onChange={(event) =>
                              onSetSnippetLabelOverride(asset.id, key, event.target.value)
                            }
                            placeholder={trace.fileName}
                          />
                          <p>{trace.extractedSnippet}</p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
