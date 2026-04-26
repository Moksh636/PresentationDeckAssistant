import { useState } from 'react'
import type { CollaborationUpdate } from '../../context/workspaceStoreContext'

interface ShareProjectModalProps {
  isOpen: boolean
  title: string
  description: string
  initialSettings: CollaborationUpdate
  onClose: () => void
  onSave: (settings: CollaborationUpdate) => void
}

export function ShareProjectModal({
  isOpen,
  title,
  description,
  initialSettings,
  onClose,
  onSave,
}: ShareProjectModalProps) {
  const [settings, setSettings] = useState(initialSettings)

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header">
          <div>
            <span className="section-label">Share settings</span>
            <h3 id="share-modal-title">{title}</h3>
            <p>{description}</p>
          </div>

          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-card__body">
          <div className="modal-row">
            <div>
              <span className="field-label">Access level</span>
              <p>Comment-only collaboration</p>
            </div>
            <span className="card-pill">Default</span>
          </div>

          <label className="toggle-field">
            <div className="toggle-field__copy">
              <span>Enable sharing</span>
              <small>Allow collaborators to open the deck in comment-only mode.</small>
            </div>
            <input
              type="checkbox"
              checked={settings.isShared}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  isShared: event.target.checked,
                }))
              }
            />
            <span className="toggle-field__track" />
          </label>

          <label className="toggle-field">
            <div className="toggle-field__copy">
              <span>Share setup inputs</span>
              <small>Expose setup fields for collaborator comments in the builder.</small>
            </div>
            <input
              type="checkbox"
              checked={settings.shareSetupInputs}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  shareSetupInputs: event.target.checked,
                  allowCollaboratorUploads:
                    event.target.checked && !current.allowCollaboratorUploads
                      ? true
                      : current.allowCollaboratorUploads,
                }))
              }
            />
            <span className="toggle-field__track" />
          </label>

          <label className="toggle-field">
            <div className="toggle-field__copy">
              <span>Allow collaborator file uploads</span>
              <small>Collaborator uploads are flagged for owner review after ingestion.</small>
            </div>
            <input
              type="checkbox"
              checked={settings.allowCollaboratorUploads}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  allowCollaboratorUploads: event.target.checked,
                }))
              }
            />
            <span className="toggle-field__track" />
          </label>
        </div>

        <div className="modal-card__footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onSave(settings)
              onClose()
            }}
          >
            Save share settings
          </button>
        </div>
      </div>
    </div>
  )
}
