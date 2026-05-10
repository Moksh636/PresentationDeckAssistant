import type { FileAsset } from '../../types/models'
import { formatConfidence } from '../../utils/formatters'
import { isSourceApproved, isSourceExcluded } from '../../data/sourceCitationReview'

interface UploadedFileListProps {
  assets: FileAsset[]
  onMarkReviewed?: (assetId: string) => void
}

function formatUploaderRole(role: FileAsset['uploadedByRole']) {
  return role === 'owner' ? 'Uploaded by account owner' : 'Uploaded by collaborator'
}

function sourceRowStatus(asset: FileAsset): { label: string; tone: string } {
  if (isSourceExcluded(asset)) {
    return { label: 'Excluded', tone: 'excluded' }
  }
  if (isSourceApproved(asset)) {
    return { label: 'Approved', tone: 'approved' }
  }
  if (asset.parseWarnings && asset.parseWarnings.length > 0) {
    return { label: 'Warning', tone: 'warning' }
  }
  if (asset.status === 'parsed') {
    return { label: 'Parsed', tone: 'parsed' }
  }
  if (asset.status === 'extracting') {
    return { label: 'Parsing…', tone: 'pending' }
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
        const rowStatus = sourceRowStatus(asset)
        return (
        <details key={asset.id} className="uploaded-file-row">
          <summary className="uploaded-file-row__summary">
            <span className="uploaded-file-row__name">{asset.name}</span>
            <span className={`uploaded-file-row__status uploaded-file-row__status--${rowStatus.tone}`}>
              {rowStatus.label}
            </span>
            <span className="uploaded-file-row__size muted-copy">{asset.sizeLabel}</span>
          </summary>
          <div className="uploaded-file-row__body">
            {asset.summary ? <p className="muted-copy uploaded-file-row__blurb">{asset.summary}</p> : null}

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
                  {asset.highlightForOwnerReview ? 'Highlighted for owner review' : 'No owner review flag'}
                </dd>
              </div>
              <div>
                <dt className="field-label">Trace confidence</dt>
                <dd>{formatConfidence(asset.sourceTrace[0]?.confidence ?? 0)}</dd>
              </div>
            </dl>

            {asset.highlightForOwnerReview && onMarkReviewed ? (
              <button type="button" className="secondary-button secondary-button--sm" onClick={() => onMarkReviewed(asset.id)}>
                Mark reviewed
              </button>
            ) : null}

            <details className="uploaded-file-row__deep">
              <summary>Preview, warnings &amp; citation trace</summary>
              <div className="asset-card__details">
                <div className="asset-card__detail-block asset-card__detail-block--wide">
                  <span className="field-label">Account research text preview</span>
                  <p>{asset.extractedTextPreview || '—'}</p>
                </div>

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
                  <span className="field-label">Parse warnings</span>
                  {asset.parseWarnings && asset.parseWarnings.length > 0 ? (
                    <ul className="intel-citation-list">
                      {asset.parseWarnings.map((warning, index) => (
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
                    {asset.possibleSections.map((section) => (
                      <span key={section}>{section}</span>
                    ))}
                  </div>
                </div>

                <div className="asset-card__detail-block asset-card__detail-block--wide">
                  <span className="field-label">File metadata preview</span>
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
                  <span className="field-label">Citation trace</span>
                  <div className="asset-card__trace">
                    {asset.sourceTrace.map((trace) => (
                      <span key={`${asset.id}-${trace.extractedSnippet}`} title={trace.extractedSnippet}>
                        {trace.fileName} | {formatConfidence(trace.confidence)}
                      </span>
                    ))}
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
