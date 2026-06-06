export type CloudConflictChoice = 'local' | 'cloud' | 'save' | 'cancel'

interface ConflictResolutionModalProps {
  isOpen: boolean
  title: string
  body: string
  onChoose: (choice: CloudConflictChoice) => void
}

/**
 * Replaces `window.prompt` for local vs cloud data conflicts. Matches prior semantics:
 * - local: keep local, skip cloud load
 * - cloud: load cloud (default path when not conflicting — handled by caller)
 * - save: push local to cloud then caller may reload
 * - cancel: abort
 */
export function ConflictResolutionModal({ isOpen, title, body, onChoose }: ConflictResolutionModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => onChoose('cancel')}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header">
          <div>
            <span className="section-label">Data conflict</span>
            <h3 id="conflict-modal-title">{title}</h3>
            <p>{body}</p>
          </div>
        </div>
        <div className="modal-card__body">
          <p className="muted-copy">
            <strong>Keep local</strong> discards the cloud import for this action. <strong>Load cloud</strong> replaces local
            rows for this area. <strong>Save local to cloud</strong> uploads your local data first (then retry load if
            needed).
          </p>
        </div>
        <div className="conflict-resolution-modal__actions">
          <button type="button" className="ghost-button" onClick={() => onChoose('cancel')}>
            Cancel
          </button>
          <button type="button" className="secondary-button" onClick={() => onChoose('local')}>
            Keep local
          </button>
          <button type="button" className="secondary-button" onClick={() => onChoose('save')}>
            Save local to cloud
          </button>
          <button type="button" className="primary-button" onClick={() => onChoose('cloud')}>
            Load cloud
          </button>
        </div>
      </div>
    </div>
  )
}
