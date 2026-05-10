import type { FileAsset, SourceCitationReviewMode } from '../../types/models'
import {
  computeCitationQAStats,
  isSnippetEnabled,
  isSourceApproved,
  isSourceExcluded,
  snippetLabel,
  snippetReviewKey,
} from '../../data/sourceCitationReview'
import { formatConfidence } from '../../utils/formatters'

interface SourceCitationQAPanelProps {
  assets: FileAsset[]
  citationReviewMode: SourceCitationReviewMode
  onSetCitationReviewMode: (mode: SourceCitationReviewMode) => void
  onSetSourceStatus: (assetId: string, status: 'pending' | 'approved' | 'excluded') => void
  onSetSnippetEnabled: (assetId: string, snippetKey: string, enabled: boolean) => void
  onSetSnippetLabelOverride: (assetId: string, snippetKey: string, labelOverride: string) => void
}

export function SourceCitationQAPanel({
  assets,
  citationReviewMode,
  onSetCitationReviewMode,
  onSetSourceStatus,
  onSetSnippetEnabled,
  onSetSnippetLabelOverride,
}: SourceCitationQAPanelProps) {
  const stats = computeCitationQAStats(assets)

  const modeToggle = (
    <div className="scope-toggle source-citation-qa__mode-toggle" role="group" aria-label="Citation review mode">
      <button
        type="button"
        className={citationReviewMode === 'permissive' ? 'is-active' : ''}
        onClick={() => onSetCitationReviewMode('permissive')}
      >
        Permissive
      </button>
      <button
        type="button"
        className={citationReviewMode === 'strict-approved-only' ? 'is-active' : ''}
        onClick={() => onSetCitationReviewMode('strict-approved-only')}
      >
        Strict
      </button>
    </div>
  )

  return (
    <div className="source-citation-qa source-citation-qa--compact">
      <div className="source-citation-qa__toolbar">
        <div className="source-citation-qa__metrics" aria-live="polite">
          <span className="source-citation-qa__metric">
            Files <strong>{stats.files}</strong>
          </span>
          <span className="source-citation-qa__metric">
            Approved <strong>{stats.approved}</strong>
          </span>
          <span className="source-citation-qa__metric">
            Excluded <strong>{stats.excluded}</strong>
          </span>
          <span className="source-citation-qa__metric">
            Snippets <strong>{stats.snippetsEnabled}</strong>
          </span>
        </div>
        {modeToggle}
      </div>
      <p className="muted-copy source-citation-qa__hint">
        Strict mode uses approved sources only for citations.
      </p>
      {assets.length === 0 ? (
        <p className="muted-copy">No sources uploaded yet.</p>
      ) : (
        <div className="source-qa-asset-list source-qa-asset-list--compact">
          {assets.map((asset) => (
            <details key={asset.id} className="source-qa-file">
              <summary className="source-qa-file__summary">
                <span className="source-qa-file__name">{asset.name}</span>
                <span className="source-qa-file__meta">{asset.status}</span>
                <span className="source-qa-file__meta">{asset.sizeLabel}</span>
                {asset.summary ? <span className="source-qa-file__dim">{asset.summary}</span> : null}
              </summary>
              <div className="source-qa-file__body">
                <div className="asset-card__chip-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onSetSourceStatus(asset.id, 'approved')}
                  >
                    {isSourceApproved(asset) ? 'Approved' : 'Mark approved'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onSetSourceStatus(asset.id, 'excluded')}
                  >
                    {isSourceExcluded(asset) ? 'Excluded' : 'Exclude source'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onSetSourceStatus(asset.id, 'pending')}
                  >
                    Clear status
                  </button>
                </div>

                <div className="asset-card__details">
                  <details className="source-qa-subdetail">
                    <summary>Extracted preview</summary>
                    <div className="asset-card__detail-block asset-card__detail-block--wide">
                      <p>{asset.extractedTextPreview || 'No extracted preview available.'}</p>
                    </div>
                  </details>

                  <details className="source-qa-subdetail">
                    <summary>
                      Parse warnings
                      {asset.parseWarnings && asset.parseWarnings.length > 0
                        ? ` (${asset.parseWarnings.length})`
                        : ''}
                    </summary>
                    <div className="asset-card__detail-block asset-card__detail-block--wide">
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
                  </details>

                  <details className="source-qa-subdetail">
                    <summary>Source traces / snippets ({asset.sourceTrace.length})</summary>
                    <div className="asset-card__detail-block asset-card__detail-block--wide">
                      {asset.sourceTrace.length === 0 ? (
                        <p>No snippets extracted from this source.</p>
                      ) : (
                        <ul className="intel-citation-list source-qa-snippet-root">
                          {asset.sourceTrace.map((trace) => {
                            const key = snippetReviewKey(trace)
                            const enabled = isSnippetEnabled(asset, trace)
                            return (
                              <li key={`${asset.id}-${key}`}>
                                <details className="source-qa-snippet-item">
                                  <summary className="source-qa-snippet-item__summary">
                                    <span>{snippetLabel(asset, trace)}</span>
                                    <span className="intel-citation-meta">{formatConfidence(trace.confidence)}</span>
                                  </summary>
                                  <div className="source-qa-snippet-item__body">
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
                                  </div>
                                </details>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
