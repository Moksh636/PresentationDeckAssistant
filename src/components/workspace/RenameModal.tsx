import { useId, useState, type FormEvent } from 'react'

export interface RenameModalProps {
  isOpen: boolean
  title: string
  initialValue?: string
  inputLabel?: string
  saveLabel?: string
  onSave: (value: string) => void
  onCancel: () => void
}

export interface OpenRenameOptions {
  title: string
  initialValue?: string
  inputLabel?: string
  saveLabel?: string
  onSave: (value: string) => void
}

export function RenameModal({
  isOpen,
  title,
  initialValue = '',
  inputLabel = 'Name',
  saveLabel = 'Save',
  onSave,
  onCancel,
}: RenameModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <RenameModalForm
      key={`${title}:${initialValue}`}
      title={title}
      initialValue={initialValue}
      inputLabel={inputLabel}
      saveLabel={saveLabel}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
}

function RenameModalForm({
  title,
  initialValue,
  inputLabel,
  saveLabel,
  onSave,
  onCancel,
}: Omit<RenameModalProps, 'isOpen'>) {
  const [value, setValue] = useState(initialValue ?? '')
  const [touched, setTouched] = useState(false)
  const inputId = useId()

  const trimmed = value.trim()
  const showError = touched && !trimmed

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!trimmed) {
      return
    }
    onSave(trimmed)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card modal-card--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-modal-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onCancel()
          }
        }}
      >
        <div className="modal-card__header">
          <div>
            <span className="section-label">Rename</span>
            <h3 id="rename-modal-title">{title}</h3>
          </div>
        </div>
        <form className="modal-card__body" onSubmit={handleSubmit}>
          <label className="field-group" htmlFor={inputId}>
            <span className="field-label">{inputLabel}</span>
            <input
              id={inputId}
              type="text"
              value={value}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
              onBlur={() => setTouched(true)}
            />
            {showError ? (
              <span className="muted-copy" role="alert">
                Enter a name to continue.
              </span>
            ) : null}
          </label>
          <div className="conflict-resolution-modal__actions">
            <button type="button" className="ghost-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={!trimmed}>
              {saveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
