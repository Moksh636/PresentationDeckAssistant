import { useRef, useState, type DragEvent } from 'react'

interface SourceUploadDropzoneProps {
  onFilesSelected: (files: FileList | File[]) => void
  disabled?: boolean
  disabledMessage?: string
}

export function SourceUploadDropzone({
  onFilesSelected,
  disabled = false,
  disabledMessage,
}: SourceUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)

    if (!disabled && event.dataTransfer.files.length > 0) {
      onFilesSelected(event.dataTransfer.files)
    }
  }

  return (
    <div
      className={`upload-dropzone ${isDragging ? 'is-dragging' : ''} ${
        disabled ? 'is-disabled' : ''
      }`}
      onDragEnter={(event) => {
        if (disabled) {
          return
        }

        event.preventDefault()
        setIsDragging(true)
      }}
      onDragOver={(event) => {
        if (disabled) {
          return
        }

        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={disabled}
        onChange={(event) => {
          if (event.target.files) {
            onFilesSelected(event.target.files)
            event.target.value = ''
          }
        }}
      />
      <span className="section-label">Drag and drop</span>
      <strong>Drop source files here</strong>
      <p>
        {disabledMessage ??
          'Upload PDFs, docs, spreadsheets, or images. Mock ingestion will create placeholder extraction and trace data.'}
      </p>
      <div className="upload-dropzone__actions">
        <button
          type="button"
          className="secondary-button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </button>
        <span>Supports multi-file upload and collaborator-ready source tracking.</span>
      </div>
    </div>
  )
}
