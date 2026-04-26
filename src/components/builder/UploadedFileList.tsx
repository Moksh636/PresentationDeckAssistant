import type { FileAsset } from '../../types/models'
import { formatConfidence } from '../../utils/formatters'

interface UploadedFileListProps {
  assets: FileAsset[]
  onMarkReviewed?: (assetId: string) => void
}

function formatUploaderRole(role: FileAsset['uploadedByRole']) {
  return role === 'owner' ? 'Uploaded by owner' : 'Uploaded by collaborator'
}

export function UploadedFileList({ assets, onMarkReviewed }: UploadedFileListProps) {
  if (assets.length === 0) {
    return <p className="muted-copy">No files uploaded yet.</p>
  }

  return (
    <div className="asset-list">
      {assets.map((asset) => (
        <article
          key={asset.id}
          className={`asset-card asset-card--detailed ${
            asset.highlightForOwnerReview ? 'asset-card--review' : ''
          }`}
        >
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

          <dl className="asset-card__facts">
            <div>
              <dt className="field-label">File type</dt>
              <dd>{asset.kind}</dd>
            </div>
            <div>
              <dt className="field-label">Upload source</dt>
              <dd>
                {formatUploaderRole(asset.uploadedByRole)}
                <br />
                {asset.uploadedByUserId}
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

          {asset.highlightForOwnerReview && onMarkReviewed ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => onMarkReviewed(asset.id)}
            >
              Mark reviewed
            </button>
          ) : null}

          <details className="asset-card__details-panel">
            <summary>Extraction details</summary>

            <div className="asset-card__details">
              <div className="asset-card__detail-block asset-card__detail-block--wide">
                <span className="field-label">Extracted text preview</span>
                <p>{asset.extractedTextPreview}</p>
              </div>

              <div className="asset-card__detail-block">
                <span className="field-label">Possible audience</span>
                <p>{asset.possibleAudience}</p>
              </div>

              <div className="asset-card__detail-block">
                <span className="field-label">Possible goal</span>
                <p>{asset.possibleGoal}</p>
              </div>

              <div className="asset-card__detail-block">
                <span className="field-label">Possible tone</span>
                <p>{asset.possibleTone}</p>
              </div>

              <div className="asset-card__detail-block asset-card__detail-block--wide">
                <span className="field-label">Possible sections</span>
                <div className="asset-card__chip-row">
                  {asset.possibleSections.map((section) => (
                    <span key={section}>{section}</span>
                  ))}
                </div>
              </div>

              <div className="asset-card__detail-block asset-card__detail-block--wide">
                <span className="field-label">Extracted metadata</span>
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
                <span className="field-label">Source trace</span>
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
        </article>
      ))}
    </div>
  )
}
