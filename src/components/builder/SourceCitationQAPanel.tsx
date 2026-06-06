import { useRef } from 'react'
import type { FileAsset, SourceCitationReviewMode } from '../../types/models'
import {
  computeCitationQAStats,
  isSnippetEnabled,
  isSourceApproved,
  isSourceExcluded,
  snippetLabel,
  snippetReviewKey,
} from '../../data/sourceCitationReview'
import { sanitizeParseWarningsForUserDisplay } from '../../data/sourceParseWarnings'
import { formatConfidence } from '../../utils/formatters'

interface SourceCitationQAPanelProps {
  assets: FileAsset[]
  citationReviewMode: SourceCitationReviewMode
  onSetCitationReviewMode: (mode: SourceCitationReviewMode) => void
  onSetSourceStatus: (assetId: string, status: 'pending' | 'approved' | 'excluded') => void
  onSetSnippetEnabled: (assetId: string, snippetKey: string, enabled: boolean) => void
  onSetSnippetLabelOverride: (assetId: string, snippetKey: string, labelOverride: string) => void
  onApproveAllUsable?: () => void
  onExcludeUnsupported?: () => void
  onClearDecisions?: () => void
}

export function SourceCitationQAPanel({
  assets,
  citationReviewMode,
  onSetCitationReviewMode,
  onSetSourceStatus,
  onSetSnippetEnabled,
  onSetSnippetLabelOverride,
  onApproveAllUsable,
  onExcludeUnsupported,
  onClearDecisions,
}: SourceCitationQAPanelProps) {
  const stats = computeCitationQAStats(assets)
  const listRootRef = useRef<HTMLDivElement | null>(null)

  const pendingSources = assets.filter(
    (asset) => !isSourceApproved(asset) && !isSourceExcluded(asset),
  ).length
  const usableParsed = assets.filter((a) => a.status === 'parsed' && a.sourceTrace.length > 0).length
  const unsupportedParsed = assets.filter((a) => a.status === 'parsed' && a.sourceTrace.length === 0).length

  const expandAllFiles = () => {
    listRootRef.current?.querySelectorAll('details.source-qa-file').forEach((node) => {
      ;(node as HTMLDetailsElement).open = true
    })
  }

  const collapseAllFiles = () => {
    listRootRef.current?.querySelectorAll('details.source-qa-file').forEach((node) => {
      ;(node as HTMLDetailsElement).open = false
    })
  }

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
      <div className="source-citation-qa__quality-row muted-copy" aria-label="Source quality summary">
        <span>
          Pending decisions: <strong>{pendingSources}</strong>
        </span>
        <span aria-hidden="true">
          ·{' '}
        </span>
        <span>
          Usable (parsed + snippets): <strong>{usableParsed}</strong>
        </span>
        <span aria-hidden="true">
          ·{' '}
        </span>
        <span>
          Unsupported text: <strong>{unsupportedParsed}</strong>
        </span>
      </div>
      <div className="source-citation-qa__bulk-actions">
        {onApproveAllUsable ? (
          <button type="button" className="secondary-button secondary-button--sm" onClick={onApproveAllUsable}>
            Approve all usable
          </button>
        ) : null}
        {onExcludeUnsupported ? (
          <button type="button" className="ghost-button ghost-button--sm" onClick={onExcludeUnsupported}>
            Exclude unsupported
          </button>
        ) : null}
        {onClearDecisions ? (
          <button type="button" className="ghost-button ghost-button--sm" onClick={onClearDecisions}>
            Clear decisions
          </button>
        ) : null}
        <button type="button" className="ghost-button ghost-button--sm" onClick={expandAllFiles}>
          Expand all
        </button>
        <button type="button" className="ghost-button ghost-button--sm" onClick={collapseAllFiles}>
          Collapse all
        </button>
      </div>
      <p className="muted-copy source-citation-qa__hint">
        Approve, exclude, and enable individual citation-ready snippets here. Strict mode uses approved sources
        only when generating citations.
      </p>
      {assets.length === 0 ? (
        <div className="builder-empty-callout" role="status">
          <strong>No sources in Source QA.</strong>
          <span className="muted-copy">
            {' '}
            Upload files under Sources — parsed PDFs and documents surface snippets you can enable for citations.
          </span>
        </div>
      ) : (
        <div ref={listRootRef} className="source-qa-asset-list source-qa-asset-list--compact">
          {assets.map((asset) => {
            const sanitized = sanitizeParseWarningsForUserDisplay(asset.parseWarnings, asset.kind)
            return (
              <details key={asset.id} className="source-qa-file">
                <summary className="source-qa-file__summary">
                  <span className="source-qa-file__name">{asset.name}</span>
                  <span className="source-qa-file__meta">{asset.sizeLabel}</span>
                  {asset.summary ? (
                    <span className="source-qa-file__dim">{asset.summary}</span>
                  ) : null}
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

                  {sanitized.friendlyMessage ? (
                    <p className="source-qa-file__friendly">{sanitized.friendlyMessage}</p>
                  ) : null}

                  <div className="asset-card__details">
                    <details className="source-qa-subdetail">
                      <summary>Extracted preview</summary>
                      <div className="asset-card__detail-block asset-card__detail-block--wide">
                        <p>{asset.extractedTextPreview || 'No extracted preview available.'}</p>
                      </div>
                    </details>

                    <details className="source-qa-subdetail" open>
                      <summary>Source snippets ({asset.sourceTrace.length})</summary>
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
                                      <span className="intel-citation-meta">
                                        {formatConfidence(trace.confidence)}
                                      </span>
                                    </summary>
                                    <div className="source-qa-snippet-item__body">
                                      <div className="intel-knowledge-row-heading">
                                        <label>
                                          <input
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={(event) =>
                                              onSetSnippetEnabled(
                                                asset.id,
                                                key,
                                                event.target.checked,
                                              )
                                            }
                                          />{' '}
                                          Enable
                                        </label>
                                      </div>
                                      <input
                                        type="text"
                                        value={snippetLabel(asset, trace)}
                                        onChange={(event) =>
                                          onSetSnippetLabelOverride(
                                            asset.id,
                                            key,
                                            event.target.value,
                                          )
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

                    <details className="source-qa-subdetail">
                      <summary>
                        Advanced source details
                        {sanitized.rawWarnings.length > 0
                          ? ` (${sanitized.rawWarnings.length} parser note${sanitized.rawWarnings.length === 1 ? '' : 's'})`
                          : ''}
                      </summary>
                      <div className="asset-card__detail-block asset-card__detail-block--wide">
                        <dl className="uploaded-file-row__facts">
                          <div>
                            <dt className="field-label">Parse status</dt>
                            <dd>{asset.status}</dd>
                          </div>
                          <div>
                            <dt className="field-label">File type</dt>
                            <dd>{asset.kind}</dd>
                          </div>
                          <div>
                            <dt className="field-label">Trace confidence (top)</dt>
                            <dd>
                              {formatConfidence(asset.sourceTrace[0]?.confidence ?? 0)}
                            </dd>
                          </div>
                        </dl>

                        <div className="asset-card__detail-block asset-card__detail-block--wide">
                          <span className="field-label">Raw parser warnings</span>
                          {sanitized.rawWarnings.length > 0 ? (
                            <ul className="intel-citation-list">
                              {sanitized.rawWarnings.map((warning, index) => (
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
                          <span className="field-label">Extraction metadata</span>
                          <div className="asset-card__metadata">
                            {Object.entries(asset.extractedMetadata).map(([key, value]) => (
                              <div key={key} className="asset-card__metadata-item">
                                <span className="field-label">{key}</span>
                                <strong>{String(value)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="asset-card__detail-block asset-card__detail-block--wide">
                          <span className="field-label">Snippet trace ids</span>
                          <div className="asset-card__trace">
                            {asset.sourceTrace.length === 0 ? (
                              <span className="muted-copy">No snippets extracted.</span>
                            ) : (
                              asset.sourceTrace.map((trace) => (
                                <span
                                  key={`${asset.id}-${trace.fileId}-${trace.extractedSnippet.slice(0, 24)}`}
                                  title={trace.extractedSnippet}
                                >
                                  {trace.fileName} | {formatConfidence(trace.confidence)}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
