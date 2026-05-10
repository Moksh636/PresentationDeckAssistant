import type { FileAsset } from '../../types/models'
import { formatConfidence } from '../../utils/formatters'
import { isSourceApproved, isSourceExcluded } from '../../data/sourceCitationReview'
import { sanitizeParseWarningsForUserDisplay } from '../../data/sourceParseWarnings'

interface UploadedFileListProps {
  assets: FileAsset[]
  onMarkReviewed?: (assetId: string) => void
}

function formatUploaderRole(role: FileAsset['uploadedByRole']) {
  return role === 'owner' ? 'Uploaded by account owner' : 'Uploaded by collaborator'
}

/**
 * Compact, presentation-only status label for the upload list row.
 * Order matters: approval/exclusion outranks parse state; "limited preview"
 * is the friendly stand-in for technical pdfjs / docx parser warnings.
 */
function sourceRowStatus(
  asset: FileAsset,
  hasLimitedPreview: boolean,
): { label: string; tone: string } {
  if (isSourceExcluded(asset)) {
    return { label: 'Excluded', tone: 'excluded' }
  }
  if (isSourceApproved(asset)) {
    return { label: 'Approved', tone: 'approved' }
  }
  if (asset.status === 'extracting') {
    return { label: 'Processing', tone: 'pending' }
  }
  if (asset.highlightForOwnerReview) {
    return { label: 'Needs review', tone: 'warning' }
  }
  if (asset.status === 'parsed' && asset.sourceTrace.length === 0) {
    return { label: 'Unsupported', tone: 'warning' }
  }
  if (hasLimitedPreview) {
    return { label: 'Limited preview', tone: 'warning' }
  }
  if (asset.status === 'parsed') {
    return { label: 'Parsed', tone: 'parsed' }
  }
  return { label: 'Uploaded', tone: 'uploaded' }
}

export function UploadedFileList({ assets, onMarkReviewed }: UploadedFileListProps) {
  if (assets.length === 0) {
    return <p className="muted-copy builder-upload-empty">No research sources uploaded yet.</p>
  }

  return (
    <div className="uploaded-file-list uploaded-file-list--compact">
      {assets.map((asset) => {
        const sanitized = sanitizeParseWarningsForUserDisplay(asset.parseWarnings)
        const rowStatus = sourceRowStatus(asset, sanitized.hasLimitedPreview)
        const snippetCount = asset.sourceTrace.length
        return (
          <details key={asset.id} className="uploaded-file-row">
            <summary className="uploaded-file-row__summary">
              <span className="uploaded-file-row__name">{asset.name}</span>
              <span
                className={`uploaded-file-row__status uploaded-file-row__status--${rowStatus.tone}`}
              >
                {rowStatus.label}
              </span>
              <span className="uploaded-file-row__size muted-copy">{asset.sizeLabel}</span>
            </summary>
            <div className="uploaded-file-row__body">
              {asset.extractedTextPreview ? (
                <p className="muted-copy uploaded-file-row__blurb">
                  {asset.extractedTextPreview}
                </p>
              ) : asset.summary ? (
                <p className="muted-copy uploaded-file-row__blurb">{asset.summary}</p>
              ) : null}

              {sanitized.friendlyMessage ? (
                <p className="uploaded-file-row__friendly">{sanitized.friendlyMessage}</p>
              ) : null}

              <p className="uploaded-file-row__snippets-line muted-copy">
                {snippetCount === 0
                  ? 'No citation-ready snippets from this source.'
                  : `${snippetCount} citation-ready snippet${snippetCount === 1 ? '' : 's'} available in Source QA.`}
              </p>

              {asset.highlightForOwnerReview && onMarkReviewed ? (
                <button
                  type="button"
                  className="secondary-button secondary-button--sm"
                  onClick={() => onMarkReviewed(asset.id)}
                >
                  Mark reviewed
                </button>
              ) : null}

              <details className="uploaded-file-row__advanced">
                <summary>Advanced source details</summary>
                <div className="asset-card__details">
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
                      <dt className="field-label">Upload actor</dt>
                      <dd>
                        {formatUploaderRole(asset.uploadedByRole)}
                        <span className="muted-copy"> · {asset.uploadedByUserId}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="field-label">Owner review</dt>
                      <dd>
                        {asset.highlightForOwnerReview
                          ? 'Highlighted for owner review'
                          : 'No owner review flag'}
                      </dd>
                    </div>
                    <div>
                      <dt className="field-label">Trace confidence</dt>
                      <dd>{formatConfidence(asset.sourceTrace[0]?.confidence ?? 0)}</dd>
                    </div>
                  </dl>

                  <div className="asset-card__detail-block">
                    <span className="field-label">Inferred buyer persona / role</span>
                    <p>{asset.possibleAudience || '—'}</p>
                  </div>

                  <div className="asset-card__detail-block">
                    <span className="field-label">Inferred meeting goal</span>
                    <p>{asset.possibleGoal || '—'}</p>
                  </div>

                  <div className="asset-card__detail-block">
                    <span className="field-label">Possible tone</span>
                    <p>{asset.possibleTone || '—'}</p>
                  </div>

                  <div className="asset-card__detail-block asset-card__detail-block--wide">
                    <span className="field-label">Raw parser warnings</span>
                    {sanitized.rawWarnings.length > 0 ? (
                      <ul className="intel-citation-list">
                        {sanitized.rawWarnings.map((warning, index) => (
                          <li key={`${asset.id}-w-${index}`}>
                            <p>{warning}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>None</p>
                    )}
                  </div>

                  <div className="asset-card__detail-block asset-card__detail-block--wide">
                    <span className="field-label">Suggested deck sections</span>
                    <div className="asset-card__chip-row">
                      {asset.possibleSections.length === 0 ? (
                        <span className="muted-copy">—</span>
                      ) : (
                        asset.possibleSections.map((section) => (
                          <span key={section}>{section}</span>
                        ))
                      )}
                    </div>
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
                    <span className="field-label">Snippet trace ids &amp; confidence</span>
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
          </details>
        )
      })}
    </div>
  )
}
